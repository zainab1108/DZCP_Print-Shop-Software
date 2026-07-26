import { notFound } from "next/navigation";

import { InventoryItemForm } from "@/components/inventory-item-form";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function EditItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [item, suppliers] = await Promise.all([
    prisma.inventoryItem.findUnique({ where: { id } }),
    prisma.supplier.findMany({
      where: { archived: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  if (!item) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">Edit {item.name}</h1>
      <InventoryItemForm
        itemId={item.id}
        suppliers={suppliers}
        initial={{
          sku: item.sku,
          name: item.name,
          unit: item.unit,
          reorderPoint: String(item.reorderPoint),
          unitCost: item.unitCost.toString(),
          supplierId: item.supplierId ?? "",
        }}
      />
    </div>
  );
}
