import type Stripe from "stripe";

import { fromStripeAmount } from "./stripe-payments";

/**
 * What the webhook should do with an event. Kept as a pure decision so the
 * whole surface is unit-testable from plain fixtures — no network, no DB.
 */
export type WebhookOutcome =
  | { kind: "ignore"; reason: string }
  | {
      kind: "record";
      invoiceId: string;
      paymentIntentId: string;
      checkoutSessionId: string;
      /** What Stripe actually captured, in dollars. */
      amount: string;
      /** Cents the invoice was expected to be when checkout started. */
      expectedCents: number | null;
      /** True when the captured amount no longer matches the invoice. */
      amountMismatch: boolean;
    };

function idOf(
  value: string | { id: string } | null | undefined,
): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

/**
 * Decide what to do with a Stripe event.
 *
 * The load-bearing rule: when we record, we record what Stripe *captured*
 * (`amount_total`), never a figure recomputed from the invoice's current
 * balance. A SENT invoice stays editable, so staff can change the total while
 * a customer is mid-checkout; re-validating here would reject money that has
 * already moved. A mismatch is flagged for staff, not refused.
 */
export function decideWebhookOutcome(event: Stripe.Event): WebhookOutcome {
  if (event.type !== "checkout.session.completed") {
    return { kind: "ignore", reason: `unhandled event type ${event.type}` };
  }

  const session = event.data.object as Stripe.Checkout.Session;

  // `status: "complete"` is NOT proof of payment — asynchronous methods
  // complete the session first and settle later. Only payment_status says
  // the money arrived.
  if (session.payment_status !== "paid") {
    return {
      kind: "ignore",
      reason: `payment_status is ${session.payment_status}, not paid`,
    };
  }

  // We only ever create USD sessions. Asserting it here guards the 100x error
  // a zero-decimal currency (JPY, KRW) would cause in fromStripeAmount.
  if (session.currency && session.currency.toLowerCase() !== "usd") {
    return {
      kind: "ignore",
      reason: `unexpected currency ${session.currency}`,
    };
  }

  const invoiceId = session.metadata?.invoiceId;
  if (!invoiceId) {
    return { kind: "ignore", reason: "session has no invoiceId metadata" };
  }

  const paymentIntentId = idOf(session.payment_intent);
  if (!paymentIntentId) {
    return { kind: "ignore", reason: "session has no payment_intent" };
  }

  if (session.amount_total == null) {
    return { kind: "ignore", reason: "session has no amount_total" };
  }

  const rawExpected = session.metadata?.expectedCents;
  const parsedExpected = rawExpected == null ? NaN : Number(rawExpected);
  const expectedCents = Number.isInteger(parsedExpected)
    ? parsedExpected
    : null;

  return {
    kind: "record",
    invoiceId,
    paymentIntentId,
    checkoutSessionId: session.id,
    amount: fromStripeAmount(session.amount_total),
    expectedCents,
    amountMismatch:
      expectedCents !== null && expectedCents !== session.amount_total,
  };
}
