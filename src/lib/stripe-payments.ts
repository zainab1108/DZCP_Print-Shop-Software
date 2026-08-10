import {
  Prisma,
  type InvoiceStatus,
  type PaymentMethod,
} from "@/generated/prisma/client";

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
 * Map Stripe's `payment_method_details.type` onto our PaymentMethod enum.
 *
 * The point is that the ledger stays honest by construction rather than by
 * configuration: today the session is pinned to card, but if that setting or
 * a Stripe default ever changes, a bank payment must not be filed as CARD —
 * the accounting export reads this column.
 *
 * Anything we can't confidently classify becomes OTHER; the caller records
 * the raw Stripe type in the payment notes so nothing is lost.
 */
export function mapStripePaymentMethod(
  stripeType: string | null | undefined,
): PaymentMethod {
  switch (stripeType) {
    case "card":
    case "card_present":
      return "CARD";
    case "us_bank_account":
    case "ach_debit":
    case "ach_credit_transfer":
    case "sepa_debit":
    case "bacs_debit":
      return "ACH";
    default:
      // Includes `link`, which wraps an underlying method we can't see
      // reliably — calling it CARD would be a guess dressed up as a fact.
      return "OTHER";
  }
}

/**
 * Whether a Stripe secret key moves real money.
 *
 * Deliberately derived from the key rather than NODE_ENV: a production
 * deployment running test keys is the normal way to trial payments, and
 * comparing against NODE_ENV would silently drop every test-mode webhook.
 */
export function isLiveKey(key: string | undefined): boolean {
  if (!key) return false;
  return key.startsWith("sk_live_") || key.startsWith("rk_live_");
}

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
