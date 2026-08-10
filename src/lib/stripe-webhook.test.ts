import { describe, expect, it } from "vitest";
import type Stripe from "stripe";

import { decideWebhookOutcome } from "./stripe-webhook";

/** Minimal fixture — only the fields the decision actually reads. */
function sessionEvent(
  session: Partial<Stripe.Checkout.Session>,
  type = "checkout.session.completed",
): Stripe.Event {
  return {
    id: "evt_test",
    type,
    data: {
      object: {
        id: "cs_test_123",
        payment_status: "paid",
        currency: "usd",
        amount_total: 48506,
        payment_intent: "pi_test_123",
        metadata: { invoiceId: "inv_abc", expectedCents: "48506" },
        ...session,
      },
    },
  } as unknown as Stripe.Event;
}

describe("decideWebhookOutcome", () => {
  it("records a paid session", () => {
    const out = decideWebhookOutcome(sessionEvent({}));
    expect(out).toEqual({
      kind: "record",
      invoiceId: "inv_abc",
      paymentIntentId: "pi_test_123",
      checkoutSessionId: "cs_test_123",
      amount: "485.06",
      expectedCents: 48506,
      amountMismatch: false,
    });
  });

  it("accepts an expanded payment_intent object", () => {
    const out = decideWebhookOutcome(
      sessionEvent({
        payment_intent: { id: "pi_expanded" } as Stripe.PaymentIntent,
      }),
    );
    expect(out.kind).toBe("record");
    if (out.kind === "record") expect(out.paymentIntentId).toBe("pi_expanded");
  });

  // The regression test for the money bug: a staff edit mid-checkout must not
  // cause us to drop a payment Stripe already captured.
  it("still records when the captured amount no longer matches the invoice", () => {
    const out = decideWebhookOutcome(
      sessionEvent({ amount_total: 48506, metadata: { invoiceId: "inv_abc", expectedCents: "30000" } }),
    );
    expect(out.kind).toBe("record");
    if (out.kind === "record") {
      expect(out.amount).toBe("485.06"); // what Stripe took, not the new balance
      expect(out.amountMismatch).toBe(true);
    }
  });

  it("ignores a completed-but-unpaid session", () => {
    // Async payment methods complete the session before the money lands.
    const out = decideWebhookOutcome(sessionEvent({ payment_status: "unpaid" }));
    expect(out.kind).toBe("ignore");
  });

  it("ignores no_payment_required", () => {
    const out = decideWebhookOutcome(
      sessionEvent({ payment_status: "no_payment_required" }),
    );
    expect(out.kind).toBe("ignore");
  });

  it("ignores a non-USD session", () => {
    const out = decideWebhookOutcome(sessionEvent({ currency: "eur" }));
    expect(out.kind).toBe("ignore");
    if (out.kind === "ignore") expect(out.reason).toContain("currency");
  });

  it("ignores a session with no invoiceId metadata", () => {
    const out = decideWebhookOutcome(sessionEvent({ metadata: {} }));
    expect(out.kind).toBe("ignore");
  });

  it("ignores a session with no payment_intent", () => {
    const out = decideWebhookOutcome(sessionEvent({ payment_intent: null }));
    expect(out.kind).toBe("ignore");
  });

  it("ignores a session with no amount_total", () => {
    const out = decideWebhookOutcome(sessionEvent({ amount_total: null }));
    expect(out.kind).toBe("ignore");
  });

  it("ignores expired sessions and unrelated event types", () => {
    expect(
      decideWebhookOutcome(sessionEvent({}, "checkout.session.expired")).kind,
    ).toBe("ignore");
    expect(
      decideWebhookOutcome(sessionEvent({}, "customer.created")).kind,
    ).toBe("ignore");
  });

  it("treats unparseable expectedCents as unknown rather than a mismatch", () => {
    const out = decideWebhookOutcome(
      sessionEvent({ metadata: { invoiceId: "inv_abc" } }),
    );
    expect(out.kind).toBe("record");
    if (out.kind === "record") {
      expect(out.expectedCents).toBeNull();
      expect(out.amountMismatch).toBe(false);
    }
  });
});
