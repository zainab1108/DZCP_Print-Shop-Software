import { Prisma, type InvoiceStatus } from "@/generated/prisma/client";

import type { MoneyInput } from "@/lib/money";

const { Decimal } = Prisma;

/** Sum payment amounts exactly. */
export function sumPayments(
  payments: { amount: MoneyInput }[],
): Prisma.Decimal {
  return payments.reduce(
    (sum, p) => sum.add(new Decimal(p.amount)),
    new Decimal(0),
  );
}

/**
 * Derive an invoice's status from its payment state. DRAFT and VOID are
 * lifecycle states that payments never change; everything else follows the
 * balance. Deleting payments can move an invoice back from PAID.
 */
export function deriveInvoiceStatus(
  current: InvoiceStatus,
  total: MoneyInput,
  amountPaid: MoneyInput,
): InvoiceStatus {
  if (current === "DRAFT" || current === "VOID") return current;
  const t = new Decimal(total);
  const paid = new Decimal(amountPaid);
  if (paid.gt(0) && paid.gte(t)) return "PAID";
  if (paid.gt(0)) return "PARTIALLY_PAID";
  return "SENT";
}

/**
 * Apply a captured payment to an invoice's running totals.
 *
 * Unlike `validatePaymentAmount`, this never rejects: it's for money that has
 * already moved (a settled Stripe charge), where refusing would mean losing
 * the record of a real payment. Overpayment is absorbed — `deriveInvoiceStatus`
 * already treats paid >= total as PAID — and surfaced to staff by the caller.
 */
export function applyPaymentToInvoice(
  current: InvoiceStatus,
  total: MoneyInput,
  amountPaid: MoneyInput,
  captured: MoneyInput,
): { amountPaid: Prisma.Decimal; status: InvoiceStatus } {
  const newPaid = new Decimal(amountPaid).add(new Decimal(captured));
  return {
    amountPaid: newPaid,
    status: deriveInvoiceStatus(current, total, newPaid),
  };
}

export type PaymentValidation = { ok: true } | { ok: false; error: string };

/**
 * A payment must be positive and must not overpay the invoice.
 * (Overpayments/credits are out of scope until the payments stage grows up.)
 */
export function validatePaymentAmount(
  amount: MoneyInput,
  total: MoneyInput,
  alreadyPaid: MoneyInput,
): PaymentValidation {
  const a = new Decimal(amount);
  if (a.isNaN() || a.lte(0)) {
    return { ok: false, error: "Payment amount must be greater than zero" };
  }
  if (a.decimalPlaces() > 2) {
    return { ok: false, error: "Payment amount can't have sub-cent precision" };
  }
  const balance = new Decimal(total).sub(alreadyPaid);
  if (a.gt(balance)) {
    return {
      ok: false,
      error: `Payment exceeds the remaining balance (${balance.toFixed(2)})`,
    };
  }
  return { ok: true };
}
