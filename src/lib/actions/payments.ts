"use server";

import { revalidatePath } from "next/cache";

import { Prisma } from "@/generated/prisma/client";
import {
  deriveInvoiceStatus,
  sumPayments,
  validatePaymentAmount,
} from "@/lib/payments";
import { prisma } from "@/lib/prisma";
import { paymentInput } from "@/lib/validation";

import type { ActionResult } from "./customers";

/** Statuses that can accept a payment. */
const PAYABLE = ["SENT", "PARTIALLY_PAID", "OVERDUE"] as const;

export async function recordPayment(
  invoiceId: string,
  raw: unknown,
): Promise<ActionResult> {
  const parsed = paymentInput.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { payments: true },
    });
    if (!invoice) return { ok: false, error: "Invoice not found" };
    if (!PAYABLE.includes(invoice.status as (typeof PAYABLE)[number])) {
      return {
        ok: false,
        error: `A ${invoice.status.toLowerCase().replace("_", " ")} invoice can't accept payments`,
      };
    }

    const alreadyPaid = sumPayments(invoice.payments);
    const check = validatePaymentAmount(
      parsed.data.amount,
      invoice.total,
      alreadyPaid,
    );
    if (!check.ok) return { ok: false, error: check.error };

    const amount = new Prisma.Decimal(parsed.data.amount);

    // Interactive transaction with an incremental update: the UPDATE takes a
    // row lock held to commit, which serializes this against a Stripe webhook
    // landing at the same moment. Its return value is the post-increment row,
    // so no re-read is needed. Absolute writes here would clobber.
    await prisma.$transaction(async (tx) => {
      await tx.payment.create({
        data: {
          invoiceId,
          amount,
          method: parsed.data.method,
          reference: parsed.data.reference ?? null,
          receivedAt: new Date(`${parsed.data.receivedAt}T00:00:00`),
          notes: parsed.data.notes ?? null,
        },
      });
      const updated = await tx.invoice.update({
        where: { id: invoiceId },
        data: { amountPaid: { increment: amount } },
      });
      const status = deriveInvoiceStatus(
        updated.status,
        updated.total,
        updated.amountPaid,
      );
      if (status !== updated.status) {
        await tx.invoice.update({ where: { id: invoiceId }, data: { status } });
      }
    });

    revalidateInvoice(invoiceId, invoice.customerId);
    return { ok: true, id: invoiceId };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to save",
    };
  }
}

export async function deletePayment(paymentId: string): Promise<ActionResult> {
  try {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { invoice: true },
    });
    if (!payment) return { ok: false, error: "Payment not found" };
    const invoice = payment.invoice;
    if (invoice.status === "VOID") {
      return {
        ok: false,
        error: "Payments on a void invoice can't be changed",
      };
    }

    // Mirrors recordPayment: decrement under the same row lock, so the two
    // paths can't clobber each other. Uniformly incremental on purpose —
    // mixing absolute and incremental writers is what loses payments.
    await prisma.$transaction(async (tx) => {
      await tx.payment.delete({ where: { id: paymentId } });
      const updated = await tx.invoice.update({
        where: { id: invoice.id },
        data: { amountPaid: { decrement: payment.amount } },
      });
      const status = deriveInvoiceStatus(
        updated.status,
        updated.total,
        updated.amountPaid,
      );
      if (status !== updated.status) {
        await tx.invoice.update({ where: { id: invoice.id }, data: { status } });
      }
    });

    revalidateInvoice(invoice.id, invoice.customerId);
    return { ok: true, id: invoice.id };
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
