import { notFound, redirect } from "next/navigation";

import { DocumentForm } from "@/components/document-form";
import { dateToInput, rateToPercent, salesOrderNumber } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function EditSalesOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const salesOrder = await prisma.salesOrder.findUnique({
    where: { id },
    include: { lineItems: { orderBy: { sortOrder: "asc" } } },
  });
  if (!salesOrder) notFound();
  if (salesOrder.status !== "DRAFT" && salesOrder.status !== "CONFIRMED") {
    redirect(`/sales-orders/${id}`);
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
        Edit {salesOrderNumber(salesOrder.number)}
      </h1>
      <DocumentForm
        kind="salesOrder"
        customers={customers}
        grids={grids}
        documentId={id}
        initial={{
          customerId: salesOrder.customerId,
          title: salesOrder.title ?? "",
          issueDate: dateToInput(salesOrder.issueDate),
          secondaryDate: dateToInput(salesOrder.dueDate),
          taxPercent: rateToPercent(salesOrder.taxRate),
          discountType: salesOrder.discountType,
          discountValue: salesOrder.discountValue.isZero()
            ? ""
            : salesOrder.discountValue.toString(),
          terms: salesOrder.terms ?? "",
          notes: salesOrder.notes ?? "",
          lineItems: salesOrder.lineItems.map((l) => ({
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
