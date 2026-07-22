"use server";

import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";

import type { ActionResult } from "./customers";

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
