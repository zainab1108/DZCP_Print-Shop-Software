"use server";

import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";

import { invoiceNumber } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { appUrl, stripe } from "@/lib/stripe";
import { canPayOnline, toStripeAmount } from "@/lib/stripe-payments";

import type { ActionResult } from "./customers";

export type CheckoutResult =
  { ok: true; url: string } | { ok: false; error: string };

export async function enablePortal(customerId: string): Promise<ActionResult> {
  try {
    const token = randomBytes(24).toString("base64url");
    await prisma.customer.update({
      where: { id: customerId },
      data: { portalToken: token },
    });
    revalidatePath(`/customers/${customerId}`);
    return { ok: true, id: customerId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function revokePortal(customerId: string): Promise<ActionResult> {
  try {
    await prisma.customer.update({
      where: { id: customerId },
      data: { portalToken: null },
    });
    revalidatePath(`/customers/${customerId}`);
    return { ok: true, id: customerId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

/**
 * Quote decisions made from the portal. The token is the credential: the
 * quote must belong to the customer owning the token and be awaiting a
 * decision (SENT). Never trust ids from the portal beyond that check.
 */
export async function decideQuoteByToken(
  token: string,
  quoteId: string,
  decision: "APPROVED" | "DECLINED",
): Promise<ActionResult> {
  try {
    const customer = await prisma.customer.findUnique({
      where: { portalToken: token },
      select: { id: true },
    });
    if (!customer)
      return { ok: false, error: "This portal link is no longer valid" };

    const quote = await prisma.quote.findUnique({ where: { id: quoteId } });
    if (!quote || quote.customerId !== customer.id) {
      return { ok: false, error: "Quote not found" };
    }
    if (quote.status !== "SENT") {
      return { ok: false, error: "This quote is not awaiting a decision" };
    }

    await prisma.quote.update({
      where: { id: quoteId },
      data: { status: decision },
    });
    revalidatePath(`/portal/${token}`);
    revalidatePath(`/quotes/${quoteId}`);
    revalidatePath("/quotes");
    return { ok: true, id: quoteId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

/**
 * Start a Stripe Checkout session for the full remaining balance of an
 * invoice. Same credential rule as decideQuoteByToken: the token must own the
 * invoice, and a mismatch reads the same as "not found".
 *
 * The amount is derived here, server-side, from the invoice's own totals — it
 * is never accepted from the client. This action does NOT record anything;
 * the webhook is the sole writer of payments.
 */
export async function createCheckoutSession(
  token: string,
  invoiceId: string,
): Promise<CheckoutResult> {
  try {
    const customer = await prisma.customer.findUnique({
      where: { portalToken: token },
      select: { id: true, email: true },
    });
    if (!customer)
      return { ok: false, error: "This portal link is no longer valid" };

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
    });
    if (!invoice || invoice.customerId !== customer.id) {
      return { ok: false, error: "Invoice not found" };
    }

    const balance = invoice.total.sub(invoice.amountPaid);
    if (!canPayOnline(invoice.status, balance)) {
      return { ok: false, error: "This invoice can't be paid online" };
    }
    const cents = toStripeAmount(balance);

    const base = appUrl();
    const returnTo = `${base}/portal/${token}/invoices/${invoice.id}`;
    const label = invoiceNumber(invoice.number);

    const session = await stripe().checkout.sessions.create(
      {
        mode: "payment",
        // Pinned to card so Payment.method: "CARD" is true by construction —
        // automatic payment methods would silently add Link/Cash App/ACH.
        payment_method_types: ["card"],
        client_reference_id: invoice.id,
        customer_email: customer.email ?? undefined,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: cents,
              product_data: {
                name: `${label}${invoice.title ? ` — ${invoice.title}` : ""}`,
              },
            },
          },
        ],
        metadata: { invoiceId: invoice.id, expectedCents: String(cents) },
        // Session metadata is NOT copied to the PaymentIntent, and refund and
        // dispute events carry only the PI — so set it on both.
        payment_intent_data: {
          description: label,
          metadata: { invoiceId: invoice.id },
        },
        success_url: `${returnTo}?paid=1&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: returnTo,
      },
      {
        // Collapses double-clicks into one session. The balance is part of the
        // key so a changed invoice mints a fresh session, and the hour bucket
        // keeps us from replaying an expired one for the rest of the day.
        idempotencyKey: `checkout:${invoice.id}:${cents}:${Math.floor(Date.now() / 3_600_000)}`,
      },
    );

    if (!session.url) {
      return { ok: false, error: "Stripe did not return a checkout URL" };
    }
    return { ok: true, url: session.url };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}
