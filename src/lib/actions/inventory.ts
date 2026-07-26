"use server";

import { revalidatePath } from "next/cache";

import { Prisma } from "@/generated/prisma/client";
import { applyStockDelta } from "@/lib/inventory";
import { prisma } from "@/lib/prisma";
import { inventoryItemInput, stockAdjustInput } from "@/lib/validation";

import type { ActionResult } from "./customers";

export async function createItem(raw: unknown): Promise<ActionResult> {
  const parsed = inventoryItemInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
  }
  const { supplierId, unitCost, ...fields } = parsed.data;
  try {
    const item = await prisma.inventoryItem.create({
      data: {
        ...fields,
        unitCost: new Prisma.Decimal(unitCost),
        supplierId: supplierId ?? null,
      },
    });
    revalidatePath("/inventory");
    return { ok: true, id: item.id };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002"
          ? "That SKU is already in use"
          : e instanceof Error
            ? e.message
            : "Failed",
    };
  }
}

export async function updateItem(
  id: string,
  raw: unknown,
): Promise<ActionResult> {
  const parsed = inventoryItemInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
  }
  const { supplierId, unitCost, ...fields } = parsed.data;
  try {
    // Editing an item never changes on-hand — that only moves via movements.
    await prisma.inventoryItem.update({
      where: { id },
      data: {
        ...fields,
        unitCost: new Prisma.Decimal(unitCost),
        supplierId: supplierId ?? null,
      },
    });
    revalidatePath("/inventory");
    revalidatePath(`/inventory/${id}`);
    return { ok: true, id };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002"
          ? "That SKU is already in use"
          : e instanceof Error
            ? e.message
            : "Failed",
    };
  }
}

export async function setItemArchived(
  id: string,
  archived: boolean,
): Promise<ActionResult> {
  try {
    await prisma.inventoryItem.update({ where: { id }, data: { archived } });
    revalidatePath("/inventory");
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

/**
 * Record a manual stock movement (receipt correction, count, damage, or
 * consumption against a job). On-hand is updated in the same transaction as
 * the movement row, and can never go negative.
 */
export async function adjustStock(
  itemId: string,
  raw: unknown,
): Promise<ActionResult> {
  const parsed = stockAdjustInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
  }
  try {
    const item = await prisma.inventoryItem.findUnique({
      where: { id: itemId },
    });
    if (!item) return { ok: false, error: "Item not found" };

    const delta = Number(parsed.data.delta);
    // CONSUMED is always a reduction regardless of the sign entered.
    const signed = parsed.data.reason === "CONSUMED" ? -Math.abs(delta) : delta;

    const change = applyStockDelta(item.quantityOnHand, signed);
    if (!change.ok) return { ok: false, error: change.error };

    await prisma.$transaction([
      prisma.stockMovement.create({
        data: {
          itemId,
          delta: signed,
          reason: parsed.data.reason,
          note: parsed.data.note ?? null,
          jobId: parsed.data.jobId ?? null,
        },
      }),
      prisma.inventoryItem.update({
        where: { id: itemId },
        data: { quantityOnHand: change.newOnHand },
      }),
    ]);

    revalidatePath("/inventory");
    revalidatePath(`/inventory/${itemId}`);
    if (parsed.data.jobId) revalidatePath(`/production/${parsed.data.jobId}`);
    return { ok: true, id: itemId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}
