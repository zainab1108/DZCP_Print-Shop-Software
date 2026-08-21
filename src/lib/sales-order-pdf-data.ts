import "server-only";

import { prisma } from "@/lib/prisma";

import type { SalesOrderPdfData } from "./sales-order-pdf";

/**
 * Load a sales order and shape it for the PDF renderer.
 *
 * Internal notes are intentionally not selected — this feeds a document we
 * send to customers.
 */
export async function loadSalesOrderPdfData(
  salesOrderId: string,
): Promise<SalesOrderPdfData | null> {
  const salesOrder = await prisma.salesOrder.findUnique({
    where: { id: salesOrderId },
    include: {
      customer: { include: { addresses: true } },
      lineItems: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!salesOrder) return null;

  // Prefer the billing address; fall back to shipping if that's all there is.
  const billing =
    salesOrder.customer.addresses.find((a) => a.type === "BILLING") ??
    salesOrder.customer.addresses.find((a) => a.type === "SHIPPING") ??
    null;

  return {
    number: salesOrder.number,
    title: salesOrder.title,
    issueDate: salesOrder.issueDate,
    dueDate: salesOrder.dueDate,
    subtotal: salesOrder.subtotal.toString(),
    discountAmount: salesOrder.discountAmount.toString(),
    discountType: salesOrder.discountType,
    discountValue: salesOrder.discountValue.toString(),
    taxRate: salesOrder.taxRate.toString(),
    taxAmount: salesOrder.taxAmount.toString(),
    total: salesOrder.total.toString(),
    terms: salesOrder.terms,
    customer: {
      name: salesOrder.customer.name,
      email: salesOrder.customer.email,
      phone: salesOrder.customer.phone,
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
    lineItems: salesOrder.lineItems.map((l) => ({
      id: l.id,
      description: l.description,
      quantity: l.quantity,
      unitPrice: l.unitPrice.toString(),
      lineTotal: l.lineTotal.toString(),
    })),
  };
}

export function salesOrderPdfFilename(number: number): string {
  return `SO-${number}.pdf`;
}
