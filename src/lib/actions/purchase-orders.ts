"use server";

import { revalidatePath } from "next/cache";

import { Prisma } from "@/generated/prisma/client";
import {
  derivePoStatus,
  outstandingQty,
  poLineTotal,
  poTotal,
} from "@/lib/inventory";
import { prisma } from "@/lib/prisma";
import { purchaseOrderInput, receiveInput } from "@/lib/validation";

import type { ActionResult } from "./customers";

const EDITABLE = ["DRAFT"];

function buildLines(input: {
  lines: {
    itemId?: string | null;
    description: string;
    quantity: number;
    unitCost: string;
  }[];
}) {
  return input.lines.map((l, i) => ({
    itemId: l.itemId ?? null,
    description: l.description,
    quantity: l.quantity,
    unitCost: new Prisma.Decimal(l.unitCost),
    lineTotal: poLineTotal(l.quantity, l.unitCost),
    sortOrder: i,
  }));
}

export async function createPurchaseOrder(raw: unknown): Promise<ActionResult> {
  const parsed = purchaseOrderInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
  }
  try {
    const po = await prisma.purchaseOrder.create({
      data: {
        supplierId: parsed.data.supplierId,
        expectedAt: parsed.data.expectedAt
          ? new Date(`${parsed.data.expectedAt}T00:00:00`)
          : null,
        notes: parsed.data.notes ?? null,
        total: poTotal(parsed.data.lines),
        lines: { create: buildLines(parsed.data) },
      },
    });
    revalidatePath("/purchasing");
    return { ok: true, id: po.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function updatePurchaseOrder(
  id: string,
  raw: unknown,
): Promise<ActionResult> {
  const parsed = purchaseOrderInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
  }
  try {
    const po = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!po) return { ok: false, error: "PO not found" };
    if (!EDITABLE.includes(po.status)) {
      return { ok: false, error: "Only draft POs can be edited" };
    }
    await prisma.$transaction([
      prisma.purchaseOrderLine.deleteMany({ where: { poId: id } }),
      prisma.purchaseOrder.update({
        where: { id },
        data: {
          supplierId: parsed.data.supplierId,
          expectedAt: parsed.data.expectedAt
            ? new Date(`${parsed.data.expectedAt}T00:00:00`)
            : null,
          notes: parsed.data.notes ?? null,
          total: poTotal(parsed.data.lines),
          lines: { create: buildLines(parsed.data) },
        },
      }),
    ]);
    revalidatePath("/purchasing");
    revalidatePath(`/purchasing/${id}`);
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

/** Mark a draft PO as ordered (sent to the supplier). */
export async function markOrdered(id: string): Promise<ActionResult> {
  try {
    const po = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!po) return { ok: false, error: "PO not found" };
    if (po.status !== "DRAFT") {
      return { ok: false, error: "This PO has already been ordered" };
    }
    await prisma.purchaseOrder.update({
      where: { id },
      data: { status: "ORDERED", orderedAt: new Date() },
    });
    revalidatePath("/purchasing");
    revalidatePath(`/purchasing/${id}`);
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function cancelPurchaseOrder(id: string): Promise<ActionResult> {
  try {
    const po = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!po) return { ok: false, error: "PO not found" };
    if (po.status === "RECEIVED") {
      return { ok: false, error: "A fully received PO can't be cancelled" };
    }
    await prisma.purchaseOrder.update({
      where: { id },
      data: { status: "CANCELLED" },
    });
    revalidatePath("/purchasing");
    revalidatePath(`/purchasing/${id}`);
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function deletePurchaseOrder(id: string): Promise<ActionResult> {
  try {
    const po = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!po) return { ok: false, error: "PO not found" };
    if (po.status !== "DRAFT") {
      return { ok: false, error: "Only draft POs can be deleted" };
    }
    await prisma.purchaseOrder.delete({ where: { id } });
    revalidatePath("/purchasing");
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

/**
 * Receive quantities against PO lines. For each received quantity we bump the
 * line's quantityReceived, add a RECEIVED stock movement, raise the linked
 * item's on-hand and refresh its last unit cost — all in one transaction.
 * The PO status is then re-derived from the received totals.
 */
export async function receivePurchaseOrder(
  id: string,
  raw: unknown,
): Promise<ActionResult> {
  const parsed = receiveInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
  }
  try {
    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: { lines: true },
    });
    if (!po) return { ok: false, error: "PO not found" };
    if (po.status !== "ORDERED" && po.status !== "PARTIALLY_RECEIVED") {
      return { ok: false, error: "This PO isn't open for receiving" };
    }

    const byId = new Map(po.lines.map((l) => [l.id, l]));
    const receipts = parsed.data.receipts.filter((r) => r.quantity > 0);
    if (receipts.length === 0) {
      return { ok: false, error: "Enter a quantity to receive" };
    }

    // Validate before writing anything.
    for (const r of receipts) {
      const line = byId.get(r.lineId);
      if (!line) return { ok: false, error: "Unknown line on this PO" };
      if (r.quantity > outstandingQty(line)) {
        return {
          ok: false,
          error: `Can't receive ${r.quantity} — only ${outstandingQty(line)} outstanding`,
        };
      }
    }

    await prisma.$transaction(async (tx) => {
      for (const r of receipts) {
        const line = byId.get(r.lineId)!;
        await tx.purchaseOrderLine.update({
          where: { id: line.id },
          data: { quantityReceived: line.quantityReceived + r.quantity },
        });
        if (line.itemId) {
          await tx.stockMovement.create({
            data: {
              itemId: line.itemId,
              delta: r.quantity,
              reason: "RECEIVED",
              poId: id,
              note: `Received on PO`,
            },
          });
          const item = await tx.inventoryItem.findUnique({
            where: { id: line.itemId },
          });
          if (item) {
            await tx.inventoryItem.update({
              where: { id: line.itemId },
              data: {
                quantityOnHand: item.quantityOnHand + r.quantity,
                unitCost: line.unitCost, // refresh to the price we just paid
              },
            });
          }
        }
      }

      const updatedLines = po.lines.map((l) => {
        const r = receipts.find((x) => x.lineId === l.id);
        return {
          quantity: l.quantity,
          quantityReceived: l.quantityReceived + (r?.quantity ?? 0),
        };
      });
      await tx.purchaseOrder.update({
        where: { id },
        data: { status: derivePoStatus(po.status, updatedLines) },
      });
    });

    revalidatePath("/purchasing");
    revalidatePath(`/purchasing/${id}`);
    revalidatePath("/inventory");
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}
