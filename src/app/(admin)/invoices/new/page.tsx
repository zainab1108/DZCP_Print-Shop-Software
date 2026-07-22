import { DocumentForm } from "@/components/document-form";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>;
}) {
  const { customerId } = await searchParams;
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
      <h1 className="text-2xl font-semibold">New invoice</h1>
      <DocumentForm
        kind="invoice"
        customers={customers}
        grids={grids}
        defaultCustomerId={customerId}
      />
    </div>
  );
}
