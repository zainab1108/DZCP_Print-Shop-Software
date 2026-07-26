import { InventoryItemForm } from "@/components/inventory-item-form";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function NewItemPage() {
  const suppliers = await prisma.supplier.findMany({
    where: { archived: false },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">New inventory item</h1>
      <InventoryItemForm suppliers={suppliers} />
    </div>
  );
}
