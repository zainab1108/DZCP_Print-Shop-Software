import { notFound, redirect } from "next/navigation";

import { DocumentForm } from "@/components/document-form";
import { dateToInput, quoteNumber, rateToPercent } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function EditQuotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: { lineItems: { orderBy: { sortOrder: "asc" } } },
  });
  if (!quote) notFound();
  if (quote.status !== "DRAFT" && quote.status !== "SENT") {
    redirect(`/quotes/${id}`);
  }

  const [customers, grids] = await Promise.all([
    prisma.customer.findMany({
      where: { archived: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true, taxExempt: true },
    }),
    prisma.priceGrid.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, tierLabel: true },
    }),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-3xl font-bold">Edit {quoteNumber(quote.number)}</h1>
      <DocumentForm
        kind="quote"
        customers={customers}
        grids={grids}
        documentId={id}
        initial={{
          customerId: quote.customerId,
          title: quote.title ?? "",
          issueDate: dateToInput(quote.issueDate),
          secondaryDate: dateToInput(quote.validUntil),
          taxPercent: rateToPercent(quote.taxRate),
          terms: quote.terms ?? "",
          notes: quote.notes ?? "",
          lineItems: quote.lineItems.map((l) => ({
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
