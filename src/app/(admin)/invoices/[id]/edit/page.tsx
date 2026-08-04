import { notFound, redirect } from "next/navigation";

import { DocumentForm } from "@/components/document-form";
import { dateToInput, invoiceNumber, rateToPercent } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function EditInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { lineItems: { orderBy: { sortOrder: "asc" } } },
  });
  if (!invoice) notFound();
  if (invoice.status !== "DRAFT" && invoice.status !== "SENT") {
    redirect(`/invoices/${id}`);
  }

  const [customers, grids] = await Promise.all([
    prisma.customer.findMany({
      where: { archived: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true, taxExempt: true },
    }),
    prisma.priceGrid.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, method: true, tierLabel: true },
    }),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-3xl font-bold">
        Edit {invoiceNumber(invoice.number)}
      </h1>
      <DocumentForm
        kind="invoice"
        customers={customers}
        grids={grids}
        documentId={id}
        initial={{
          customerId: invoice.customerId,
          title: invoice.title ?? "",
          issueDate: dateToInput(invoice.issueDate),
          secondaryDate: dateToInput(invoice.dueDate),
          taxPercent: rateToPercent(invoice.taxRate),
          terms: invoice.terms ?? "",
          notes: invoice.notes ?? "",
          lineItems: invoice.lineItems.map((l) => ({
            description: l.description,
            quantity: String(l.quantity),
            unitPrice: l.unitPrice.toString(),
            taxable: l.taxable,
          })),
        }}
      />
    </div>
  );
}
