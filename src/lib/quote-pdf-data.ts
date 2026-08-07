import "server-only";

import { prisma } from "@/lib/prisma";

import type { QuotePdfData } from "./quote-pdf";

/**
 * Load a quote and shape it for the PDF renderer. Returns the owning
 * customerId alongside so a portal route could verify ownership before
 * handing the file over.
 *
 * Internal notes are intentionally not selected — this feeds a document we
 * send to customers.
 */
export async function loadQuotePdfData(
  quoteId: string,
): Promise<{ customerId: string; data: QuotePdfData } | null> {
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: {
      customer: { include: { addresses: true } },
      lineItems: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!quote) return null;

  // Prefer the billing address; fall back to shipping if that's all there is.
  const billing =
    quote.customer.addresses.find((a) => a.type === "BILLING") ??
    quote.customer.addresses.find((a) => a.type === "SHIPPING") ??
    null;

  return {
    customerId: quote.customerId,
    data: {
      number: quote.number,
      title: quote.title,
      status: quote.status,
      issueDate: quote.issueDate,
      validUntil: quote.validUntil,
      subtotal: quote.subtotal.toString(),
      taxRate: quote.taxRate.toString(),
      taxAmount: quote.taxAmount.toString(),
      total: quote.total.toString(),
      terms: quote.terms,
      customer: {
        name: quote.customer.name,
        email: quote.customer.email,
        phone: quote.customer.phone,
        address: billing
          ? {
              line1: billing.line1,
              line2: billing.line2,
              city: billing.city,
              state: billing.state,
              postalCode: billing.postalCode,
              country: billing.country,
            }
          : null,
      },
      lineItems: quote.lineItems.map((l) => ({
        id: l.id,
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unitPrice.toString(),
        lineTotal: l.lineTotal.toString(),
      })),
    },
  };
}

export function quotePdfFilename(number: number): string {
  return `Q-${number}.pdf`;
}
