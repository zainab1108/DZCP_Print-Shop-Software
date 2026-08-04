import "server-only";

import { prisma } from "@/lib/prisma";

import type { InvoicePdfData } from "./invoice-pdf";

/**
 * Load an invoice and shape it for the PDF renderer. Returns the owning
 * customerId alongside so the portal route can verify ownership before
 * handing the file over.
 *
 * Internal notes are intentionally not selected — this feeds a document we
 * send to customers.
 */
export async function loadInvoicePdfData(
  invoiceId: string,
): Promise<{ customerId: string; data: InvoicePdfData } | null> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      customer: { include: { addresses: true } },
      lineItems: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!invoice) return null;

  // Prefer the billing address; fall back to shipping if that's all there is.
  const billing =
    invoice.customer.addresses.find((a) => a.type === "BILLING") ??
    invoice.customer.addresses.find((a) => a.type === "SHIPPING") ??
    null;

  return {
    customerId: invoice.customerId,
    data: {
      number: invoice.number,
      title: invoice.title,
      status: invoice.status,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      subtotal: invoice.subtotal.toString(),
      taxRate: invoice.taxRate.toString(),
      taxAmount: invoice.taxAmount.toString(),
      total: invoice.total.toString(),
      amountPaid: invoice.amountPaid.toString(),
      balance: invoice.total.sub(invoice.amountPaid).toString(),
      terms: invoice.terms,
      customer: {
        name: invoice.customer.name,
        email: invoice.customer.email,
        phone: invoice.customer.phone,
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
      lineItems: invoice.lineItems.map((l) => ({
        id: l.id,
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unitPrice.toString(),
        lineTotal: l.lineTotal.toString(),
      })),
    },
  };
}

export function invoicePdfFilename(number: number): string {
  return `INV-${number}.pdf`;
}
