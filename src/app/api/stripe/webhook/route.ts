import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { Prisma } from "@/generated/prisma/client";
import { deriveInvoiceStatus } from "@/lib/payments";
import { prisma } from "@/lib/prisma";
import { isLiveMode, stripe, stripeWebhookSecret } from "@/lib/stripe";
import { mapStripePaymentMethod } from "@/lib/stripe-payments";
import { decideWebhookOutcome } from "@/lib/stripe-webhook";

/**
 * Ask Stripe what was actually used to pay, so the ledger reflects reality
 * rather than our session config. Deliberately best-effort: if the lookup
 * fails we still record the payment (the money moved) and fall back to OTHER
 * rather than asserting a method we couldn't confirm.
 */
async function resolvePaymentMethod(paymentIntentId: string): Promise<{
  method: ReturnType<typeof mapStripePaymentMethod>;
  rawType: string;
}> {
  try {
    const pi = await stripe().paymentIntents.retrieve(paymentIntentId, {
      expand: ["latest_charge"],
    });
    const charge =
      pi.latest_charge && typeof pi.latest_charge !== "string"
        ? pi.latest_charge
        : null;
    const rawType = charge?.payment_method_details?.type ?? "unknown";
    return { method: mapStripePaymentMethod(rawType), rawType };
  } catch (e) {
    console.error(
      `stripe webhook: could not resolve payment method for ${paymentIntentId}:`,
      e instanceof Error ? e.message : e,
    );
    return { method: "OTHER", rawType: "lookup-failed" };
  }
}

export const dynamic = "force-dynamic";
// No `runtime` export on purpose: constructEvent needs Node's crypto.

/**
 * Stripe payment webhook — the ONLY thing that records an online payment.
 *
 * Reachable without a session (Stripe can't send our cookie); the Stripe
 * signature is the credential instead, and it's verified before any DB access.
 * The route is excluded from the proxy matcher so the raw body reaches us
 * unbuffered — see src/proxy.ts.
 *
 * Status codes drive Stripe's retry behaviour, so they're part of the
 * contract: 400 = not from Stripe (don't retry), 200 = handled or
 * deliberately ignored, 500 = retry this.
 */
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  // Raw body — parsing it first would break signature verification.
  const body = await request.text();

  let event: Stripe.Event;
  try {
    // Throws if the secret is missing. Never fall back to an unverified parse.
    event = stripe().webhooks.constructEvent(
      body,
      signature,
      stripeWebhookSecret(),
    );
  } catch (e) {
    console.error(
      "stripe webhook: signature verification failed:",
      e instanceof Error ? e.message : e,
    );
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // A live endpoint wired to a test-mode secret would otherwise write fake
  // payments into the real ledger (and vice versa).
  if (event.livemode !== isLiveMode()) {
    console.warn(
      `stripe webhook: ignoring ${event.id} — livemode ${event.livemode} does not match this environment`,
    );
    return NextResponse.json({ received: true, ignored: "livemode" });
  }

  const outcome = decideWebhookOutcome(event);
  if (outcome.kind === "ignore") {
    return NextResponse.json({ received: true, ignored: outcome.reason });
  }

  const amount = new Prisma.Decimal(outcome.amount);
  // Outside the transaction on purpose — a slow Stripe round trip inside one
  // would blow Prisma's 5s interactive timeout and abort the write.
  const { method, rawType } = await resolvePaymentMethod(
    outcome.paymentIntentId,
  );

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.payment.findUnique({
        where: { stripePaymentIntentId: outcome.paymentIntentId },
        select: { id: true },
      });
      if (existing) return { alreadyProcessed: true as const };

      const invoice = await tx.invoice.findUnique({
        where: { id: outcome.invoiceId },
        select: { id: true, customerId: true },
      });
      if (!invoice) return { missingInvoice: true as const };

      await tx.payment.create({
        data: {
          invoiceId: invoice.id,
          amount,
          method,
          reference: outcome.paymentIntentId,
          stripePaymentIntentId: outcome.paymentIntentId,
          stripeCheckoutSessionId: outcome.checkoutSessionId,
          notes: [
            `Paid online via Stripe (${rawType}).`,
            outcome.amountMismatch
              ? `Amount differs from the balance when checkout started (expected ${outcome.expectedCents} cents) — the invoice changed mid-checkout; review for a possible refund.`
              : null,
          ]
            .filter(Boolean)
            .join(" "),
        },
      });

      // The UPDATE takes a row lock held to commit, serializing this against
      // a staff entry landing at the same moment; its return value is the
      // post-increment row, so no re-read is needed.
      const updated = await tx.invoice.update({
        where: { id: invoice.id },
        data: { amountPaid: { increment: amount } },
      });
      const status = deriveInvoiceStatus(
        updated.status,
        updated.total,
        updated.amountPaid,
      );
      if (status !== updated.status) {
        await tx.invoice.update({
          where: { id: invoice.id },
          data: { status },
        });
      }

      return { recorded: true as const, customerId: invoice.customerId };
    });

    if ("missingInvoice" in result) {
      // Retryable: most likely a replica/deploy race, so let Stripe try again.
      console.error(
        `stripe webhook: invoice ${outcome.invoiceId} not found for ${outcome.paymentIntentId}`,
      );
      return NextResponse.json({ error: "Invoice not found" }, { status: 500 });
    }

    if ("alreadyProcessed" in result) {
      return NextResponse.json({ received: true, alreadyProcessed: true });
    }

    console.log(
      `stripe webhook: recorded ${outcome.amount} for invoice ${outcome.invoiceId} (${outcome.paymentIntentId})`,
    );
    revalidatePath("/invoices");
    revalidatePath(`/invoices/${outcome.invoiceId}`);
    revalidatePath(`/customers/${result.customerId}`);
    return NextResponse.json({ received: true });
  } catch (e) {
    // Caught out here on purpose: a unique violation aborts the Postgres
    // transaction, so it can't be handled from inside it. P2002 means a
    // concurrent delivery won the race — that's success, not failure.
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return NextResponse.json({ received: true, alreadyProcessed: true });
    }
    console.error(
      `stripe webhook: failed to record ${outcome.paymentIntentId}:`,
      e instanceof Error ? e.message : e,
    );
    return NextResponse.json({ error: "Failed to record" }, { status: 500 });
  }
}
