"use server";

import { revalidatePath } from "next/cache";

import { Prisma, type SalesOrderStatus } from "@/generated/prisma/client";
import {
  computeDocumentTotals,
  parseDiscountValue,
  percentToRate,
} from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { documentInput, type DocumentInput } from "@/lib/validation";

import type { ActionResult } from "./customers";

const EDITABLE: SalesOrderStatus[] = ["DRAFT", "CONFIRMED"];

function docData(input: DocumentInput, taxExempt: boolean) {
  const totals = computeDocumentTotals(
    input.lineItems.map((l) => ({
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      taxable: l.taxable,
    })),
    percentToRate(input.taxPercent),
    {
      taxExempt,
      discount: { type: input.discountType, value: input.discountValue },
    },
  );
  return {
    fields: {
      customerId: input.customerId,
      title: input.title ?? null,
      issueDate: new Date(`${input.issueDate}T00:00:00`),
      dueDate: input.secondaryDate
        ? new Date(`${input.secondaryDate}T00:00:00`)
        : null,
      taxRate: percentToRate(input.taxPercent),
      subtotal: totals.subtotal,
      discountType: input.discountType,
      discountValue: parseDiscountValue(input.discountValue),
      discountAmount: totals.discountAmount,
      taxAmount: totals.taxAmount,
      total: totals.total,
      terms: input.terms ?? null,
      notes: input.notes ?? null,
    },
    lines: input.lineItems.map((l, i) => ({
      description: l.description,
      quantity: l.quantity,
      unitPrice: new Prisma.Decimal(l.unitPrice),
      taxable: l.taxable,
      lineTotal: totals.lineTotals[i],
      sortOrder: i,
    })),
  };
}

async function parseAndBuild(raw: unknown) {
  const parsed = documentInput.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const customer = await prisma.customer.findUnique({
    where: { id: parsed.data.customerId },
  });
  if (!customer) return { ok: false as const, error: "Customer not found" };
  return { ok: true as const, input: parsed.data, customer };
}

export async function createSalesOrder(raw: unknown): Promise<ActionResult> {
  try {
    const res = await parseAndBuild(raw);
    if (!res.ok) return { ok: false, error: res.error };
    const { fields, lines } = docData(res.input, res.customer.taxExempt);

    const salesOrder = await prisma.salesOrder.create({
      data: { ...fields, lineItems: { create: lines } },
    });
    revalidateSalesOrder(salesOrder.id, salesOrder.customerId);
    return { ok: true, id: salesOrder.id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to save",
    };
  }
}

export async function updateSalesOrder(
  id: string,
  raw: unknown,
): Promise<ActionResult> {
  try {
    const existing = await prisma.salesOrder.findUnique({ where: { id } });
    if (!existing) return { ok: false, error: "Sales order not found" };
    if (!EDITABLE.includes(existing.status)) {
      return {
        ok: false,
        error: `A ${existing.status.toLowerCase()} sales order can't be edited`,
      };
    }

    const res = await parseAndBuild(raw);
    if (!res.ok) return { ok: false, error: res.error };
    const { fields, lines } = docData(res.input, res.customer.taxExempt);

    await prisma.$transaction([
      prisma.salesOrderLineItem.deleteMany({ where: { salesOrderId: id } }),
      prisma.salesOrder.update({
        where: { id },
        data: { ...fields, lineItems: { create: lines } },
      }),
    ]);
    revalidateSalesOrder(id, res.input.customerId);
    return { ok: true, id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to save",
    };
  }
}

export async function setSalesOrderStatus(
  id: string,
  status: Extract<SalesOrderStatus, "CONFIRMED" | "CANCELLED">,
): Promise<ActionResult> {
  try {
    const salesOrder = await prisma.salesOrder.findUnique({ where: { id } });
    if (!salesOrder) return { ok: false, error: "Sales order not found" };
    if (salesOrder.status === "INVOICED" || salesOrder.status === "CANCELLED") {
      return {
        ok: false,
        error: `A ${salesOrder.status.toLowerCase()} sales order can't change status`,
      };
    }
    await prisma.salesOrder.update({ where: { id }, data: { status } });
    revalidateSalesOrder(id, salesOrder.customerId);
    return { ok: true, id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to update",
    };
  }
}

export async function deleteSalesOrder(id: string): Promise<ActionResult> {
  try {
    const salesOrder = await prisma.salesOrder.findUnique({ where: { id } });
    if (!salesOrder) return { ok: false, error: "Sales order not found" };
    if (salesOrder.status !== "DRAFT") {
      return { ok: false, error: "Only draft sales orders can be deleted" };
    }
    await prisma.salesOrder.delete({ where: { id } });
    revalidateSalesOrder(id, salesOrder.customerId);
    return { ok: true, id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to delete",
    };
  }
}

/** Copy a confirmed sales order into a new draft invoice and mark it invoiced. */
export async function convertSalesOrderToInvoice(
  id: string,
): Promise<ActionResult> {
  try {
    const salesOrder = await prisma.salesOrder.findUnique({
      where: { id },
      include: { lineItems: { orderBy: { sortOrder: "asc" } } },
    });
    if (!salesOrder) return { ok: false, error: "Sales order not found" };
    if (salesOrder.status === "INVOICED") {
      return { ok: false, error: "This sales order was already invoiced" };
    }
    if (salesOrder.status === "CANCELLED") {
      return { ok: false, error: "A cancelled sales order can't be invoiced" };
    }

    let dueDate = salesOrder.dueDate;
    if (!dueDate) {
      dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);
    }

    const invoice = await prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.create({
        data: {
          customerId: salesOrder.customerId,
          sourceSalesOrderId: salesOrder.id,
          title: salesOrder.title,
          dueDate,
          taxRate: salesOrder.taxRate,
          subtotal: salesOrder.subtotal,
          discountType: salesOrder.discountType,
          discountValue: salesOrder.discountValue,
          discountAmount: salesOrder.discountAmount,
          taxAmount: salesOrder.taxAmount,
          total: salesOrder.total,
          terms: salesOrder.terms,
          notes: salesOrder.notes,
          lineItems: {
            create: salesOrder.lineItems.map((l) => ({
              description: l.description,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              taxable: l.taxable,
              lineTotal: l.lineTotal,
              sortOrder: l.sortOrder,
            })),
          },
        },
      });
      await tx.salesOrder.update({
        where: { id },
        data: { status: "INVOICED" },
      });
      return inv;
    });

    revalidateSalesOrder(id, salesOrder.customerId);
    revalidatePath("/invoices");
    return { ok: true, id: invoice.id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to convert",
    };
  }
}

/**
 * Un-commit a sales order: copy it into a fresh draft quote and cancel the
 * sales order. Blocked once a job (production has started) or an invoice
 * exists — those represent real work/billing that reverting would orphan.
 */
export async function convertSalesOrderToQuote(
  id: string,
): Promise<ActionResult> {
  try {
    const salesOrder = await prisma.salesOrder.findUnique({
      where: { id },
      include: {
        lineItems: { orderBy: { sortOrder: "asc" } },
        job: { select: { id: true } },
      },
    });
    if (!salesOrder) return { ok: false, error: "Sales order not found" };
    if (salesOrder.status === "INVOICED") {
      return {
        ok: false,
        error: "An invoiced sales order can't be reverted to a quote",
      };
    }
    if (salesOrder.status === "CANCELLED") {
      return { ok: false, error: "This sales order was already cancelled" };
    }
    if (salesOrder.job) {
      return {
        ok: false,
        error:
          "Production has already started on this order — it can't be reverted",
      };
    }

    const quote = await prisma.$transaction(async (tx) => {
      const q = await tx.quote.create({
        data: {
          customerId: salesOrder.customerId,
          title: salesOrder.title,
          taxRate: salesOrder.taxRate,
          subtotal: salesOrder.subtotal,
          discountType: salesOrder.discountType,
          discountValue: salesOrder.discountValue,
          discountAmount: salesOrder.discountAmount,
          taxAmount: salesOrder.taxAmount,
          total: salesOrder.total,
          terms: salesOrder.terms,
          notes: salesOrder.notes,
          lineItems: {
            create: salesOrder.lineItems.map((l) => ({
              description: l.description,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              taxable: l.taxable,
              lineTotal: l.lineTotal,
              sortOrder: l.sortOrder,
            })),
          },
        },
      });
      await tx.salesOrder.update({
        where: { id },
        data: { status: "CANCELLED" },
      });
      return q;
    });

    revalidateSalesOrder(id, salesOrder.customerId);
    revalidatePath("/quotes");
    return { ok: true, id: quote.id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to convert",
    };
  }
}

function revalidateSalesOrder(id: string, customerId: string) {
  revalidatePath("/sales-orders");
  revalidatePath(`/sales-orders/${id}`);
  revalidatePath(`/customers/${customerId}`);
}
