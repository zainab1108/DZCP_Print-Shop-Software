import { notFound, redirect } from "next/navigation";

import { POForm } from "@/components/po-form";
import { dateToInput, poNumber } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function EditPOPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: { lines: { orderBy: { sortOrder: "asc" } } },
  });
  if (!po) notFound();
  if (po.status !== "DRAFT") redirect(`/purchasing/${id}`);

  const [suppliers, items] = await Promise.all([
    prisma.supplier.findMany({
      where: { archived: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.inventoryItem.findMany({
      where: { archived: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true, unitCost: true },
    }),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-3xl font-bold">Edit {poNumber(po.number)}</h1>
      <POForm
        poId={po.id}
        suppliers={suppliers}
        items={items.map((i) => ({
          id: i.id,
          name: i.name,
          unitCost: i.unitCost.toString(),
        }))}
        initial={{
          supplierId: po.supplierId,
          expectedAt: dateToInput(po.expectedAt),
          notes: po.notes ?? "",
          lines: po.lines.map((l) => ({
            itemId: l.itemId ?? "",
            description: l.description,
            quantity: String(l.quantity),
            unitCost: l.unitCost.toString(),
          })),
        }}
      />
    </div>
  );
}
