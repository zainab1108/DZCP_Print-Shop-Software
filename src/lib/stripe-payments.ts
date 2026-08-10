import { Prisma, type InvoiceStatus } from "@/generated/prisma/client";

import type { MoneyInput } from "@/lib/money";

const { Decimal } = Prisma;

/**
 * Stripe's per-charge bounds for USD, in cents. The minimum is a hard API
 * error, so `canPayOnline` has to know about it or we'd render a Pay button
 * that dead-ends. The maximum matters because Invoice.total is Decimal(12,2)
 * and can hold values an order of magnitude above what Stripe accepts.
 */
export const STRIPE_MIN_CENTS = 50;
export const STRIPE_MAX_CENTS = 99_999_999;

/** Invoice statuses that can take an online payment. */
const PAYABLE_ONLINE: InvoiceStatus[] = ["SENT", "PARTIALLY_PAID", "OVERDUE"];

/**
 * Dollars -> integer cents for the Stripe API. Throws rather than rounding:
 * silently rounding money is how you end up charging the wrong amount.
 */
export function toStripeAmount(amount: MoneyInput): number {
  const a = new Decimal(amount);
  if (a.isNaN()) throw new Error("Amount is not a number");
  if (a.lte(0)) throw new Error("Amount must be greater than zero");
  if (a.decimalPlaces() > 2) {
    throw new Error("Amount can't have sub-cent precision");
  }
  const cents = a.mul(100).toNumber();
  if (cents > STRIPE_MAX_CENTS) {
    throw new Error("Amount is above the maximum Stripe accepts");
  }
  return cents;
}

/** Integer cents from Stripe -> a money string safe for Prisma.Decimal. */
export function fromStripeAmount(cents: number): string {
  if (!Number.isInteger(cents)) {
    throw new Error("Stripe amounts are integer cents");
  }
  if (cents < 0) throw new Error("Stripe amount can't be negative");
  return new Decimal(cents).div(100).toFixed(2);
}

/**
 * Whether to offer online payment for an invoice.
 *
 * Deliberately `balance.gt(0)`, not `!balance.isZero()` — an overpaid invoice
 * has a negative balance, and offering to "pay" a credit would be nonsense.
 */
export function canPayOnline(
  status: InvoiceStatus,
  balance: MoneyInput,
): boolean {
  if (!PAYABLE_ONLINE.includes(status)) return false;
  const b = new Decimal(balance);
  if (b.isNaN() || b.lte(0)) return false;
  if (b.decimalPlaces() > 2) return false;
  const cents = b.mul(100).toNumber();
  return cents >= STRIPE_MIN_CENTS && cents <= STRIPE_MAX_CENTS;
}
