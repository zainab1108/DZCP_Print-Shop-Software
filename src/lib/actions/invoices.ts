"use server";

import { revalidatePath } from "next/cache";

import { Prisma, type InvoiceStatus } from "@/generated/prisma/client";
import {
  computeDocumentTotals,
  parseDiscountValue,
  percentToRate,
} from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { documentInput, type DocumentInput } from "@/lib/validation";

import type { ActionResult } from "./customers";

const EDITABLE: InvoiceStatus[] = ["DRAFT", "SENT"];

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

export async function createInvoice(raw: unknown): Promise<ActionResult> {
  try {
    const res = await parseAndBuild(raw);
    if (!res.ok) return { ok: false, error: res.error };
    const { fields, lines } = docData(res.input, res.customer.taxExempt);

    const invoice = await prisma.invoice.create({
      data: { ...fields, lineItems: { create: lines } },
    });
    revalidateInvoice(invoice.id, invoice.customerId);
    return { ok: true, id: invoice.id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to save",
    };
  }
}

export async function updateInvoice(
  id: string,
  raw: unknown,
): Promise<ActionResult> {
  try {
    const existing = await prisma.invoice.findUnique({ where: { id } });
    if (!existing) return { ok: false, error: "Invoice not found" };
    if (!EDITABLE.includes(existing.status)) {
      return {
        ok: false,
        error: `A ${existing.status.toLowerCase().replace("_", " ")} invoice can't be edited`,
      };
    }

    const res = await parseAndBuild(raw);
    if (!res.ok) return { ok: false, error: res.error };
    const { fields, lines } = docData(res.input, res.customer.taxExempt);

    await prisma.$transaction([
      prisma.invoiceLineItem.deleteMany({ where: { invoiceId: id } }),
      prisma.invoice.update({
        where: { id },
        data: { ...fields, lineItems: { create: lines } },
      }),
    ]);
    revalidateInvoice(id, res.input.customerId);
    return { ok: true, id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to save",
    };
  }
}

export async function setInvoiceStatus(
  id: string,
  status: Extract<InvoiceStatus, "SENT" | "VOID">,
): Promise<ActionResult> {
  try {
    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) return { ok: false, error: "Invoice not found" };
    if (invoice.status === "PAID" || invoice.status === "VOID") {
      return {
        ok: false,
        error: `A ${invoice.status.toLowerCase()} invoice can't change status`,
      };
    }
    await prisma.invoice.update({ where: { id }, data: { status } });
    revalidateInvoice(id, invoice.customerId);
    return { ok: true, id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to update",
    };
  }
}

export async function deleteInvoice(id: string): Promise<ActionResult> {
  try {
    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) return { ok: false, error: "Invoice not found" };
    if (invoice.status !== "DRAFT") {
      return { ok: false, error: "Only draft invoices can be deleted" };
    }
    await prisma.invoice.delete({ where: { id } });
    revalidateInvoice(id, invoice.customerId);
    return { ok: true, id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to delete",
    };
  }
}

function revalidateInvoice(id: string, customerId: string) {
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
  revalidatePath(`/customers/${customerId}`);
}
