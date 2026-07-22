"use server";

import { revalidatePath } from "next/cache";

import { Prisma, type QuoteStatus } from "@/generated/prisma/client";
import { computeDocumentTotals, percentToRate } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { documentInput, type DocumentInput } from "@/lib/validation";

import type { ActionResult } from "./customers";

const EDITABLE: QuoteStatus[] = ["DRAFT", "SENT"];

function docData(input: DocumentInput, taxExempt: boolean) {
  const totals = computeDocumentTotals(
    input.lineItems.map((l) => ({
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      taxable: l.taxable,
    })),
    percentToRate(input.taxPercent),
    { taxExempt },
  );
  return {
    fields: {
      customerId: input.customerId,
      title: input.title ?? null,
      issueDate: new Date(`${input.issueDate}T00:00:00`),
      taxRate: percentToRate(input.taxPercent),
      subtotal: totals.subtotal,
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

export async function createQuote(raw: unknown): Promise<ActionResult> {
  try {
    const res = await parseAndBuild(raw);
    if (!res.ok) return { ok: false, error: res.error };
    const { fields, lines } = docData(res.input, res.customer.taxExempt);

    const quote = await prisma.quote.create({
      data: {
        ...fields,
        validUntil: res.input.secondaryDate
          ? new Date(`${res.input.secondaryDate}T00:00:00`)
          : null,
        lineItems: { create: lines },
      },
    });
    revalidateQuote(quote.id, quote.customerId);
    return { ok: true, id: quote.id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to save",
    };
  }
}

export async function updateQuote(
  id: string,
  raw: unknown,
): Promise<ActionResult> {
  try {
    const existing = await prisma.quote.findUnique({ where: { id } });
    if (!existing) return { ok: false, error: "Quote not found" };
    if (!EDITABLE.includes(existing.status)) {
      return {
        ok: false,
        error: `A ${existing.status.toLowerCase()} quote can't be edited`,
      };
    }

    const res = await parseAndBuild(raw);
    if (!res.ok) return { ok: false, error: res.error };
    const { fields, lines } = docData(res.input, res.customer.taxExempt);

    await prisma.$transaction([
      prisma.quoteLineItem.deleteMany({ where: { quoteId: id } }),
      prisma.quote.update({
        where: { id },
        data: {
          ...fields,
          validUntil: res.input.secondaryDate
            ? new Date(`${res.input.secondaryDate}T00:00:00`)
            : null,
          lineItems: { create: lines },
        },
      }),
    ]);
    revalidateQuote(id, res.input.customerId);
    return { ok: true, id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to save",
    };
  }
}

export async function setQuoteStatus(
  id: string,
  status: Extract<QuoteStatus, "SENT" | "APPROVED" | "DECLINED" | "EXPIRED">,
): Promise<ActionResult> {
  try {
    const quote = await prisma.quote.findUnique({ where: { id } });
    if (!quote) return { ok: false, error: "Quote not found" };
    if (quote.status === "CONVERTED") {
      return {
        ok: false,
        error: "This quote was already converted to an invoice",
      };
    }
    await prisma.quote.update({ where: { id }, data: { status } });
    revalidateQuote(id, quote.customerId);
    return { ok: true, id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to update",
    };
  }
}

export async function deleteQuote(id: string): Promise<ActionResult> {
  try {
    const quote = await prisma.quote.findUnique({ where: { id } });
    if (!quote) return { ok: false, error: "Quote not found" };
    if (quote.status !== "DRAFT") {
      return { ok: false, error: "Only draft quotes can be deleted" };
    }
    await prisma.quote.delete({ where: { id } });
    revalidateQuote(id, quote.customerId);
    return { ok: true, id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to delete",
    };
  }
}

/** Copy an approved quote into a new draft invoice and mark the quote converted. */
export async function convertQuoteToInvoice(id: string): Promise<ActionResult> {
  try {
    const quote = await prisma.quote.findUnique({
      where: { id },
      include: { lineItems: { orderBy: { sortOrder: "asc" } } },
    });
    if (!quote) return { ok: false, error: "Quote not found" };
    if (quote.status === "CONVERTED") {
      return { ok: false, error: "This quote was already converted" };
    }
    if (quote.status === "DECLINED") {
      return { ok: false, error: "A declined quote can't be converted" };
    }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    const invoice = await prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.create({
        data: {
          customerId: quote.customerId,
          sourceQuoteId: quote.id,
          title: quote.title,
          dueDate,
          taxRate: quote.taxRate,
          subtotal: quote.subtotal,
          taxAmount: quote.taxAmount,
          total: quote.total,
          terms: quote.terms,
          notes: quote.notes,
          lineItems: {
            create: quote.lineItems.map((l) => ({
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
      await tx.quote.update({ where: { id }, data: { status: "CONVERTED" } });
      return inv;
    });

    revalidateQuote(id, quote.customerId);
    revalidatePath("/invoices");
    return { ok: true, id: invoice.id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to convert",
    };
  }
}

function revalidateQuote(id: string, customerId: string) {
  revalidatePath("/quotes");
  revalidatePath(`/quotes/${id}`);
  revalidatePath(`/customers/${customerId}`);
}
