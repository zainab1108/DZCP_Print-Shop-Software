import Link from "next/link";

import { POForm } from "@/components/po-form";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function NewPOPage() {
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

  if (suppliers.length === 0) {
    return (
      <div className="mx-auto max-w-md space-y-4 text-center">
        <h1 className="text-2xl font-semibold">New purchase order</h1>
        <p className="text-muted-foreground">
          Add a supplier first, then create a PO for them.
        </p>
        <Link href="/inventory/suppliers/new" className="underline">
          Add a supplier →
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-2xl font-semibold">New purchase order</h1>
      <POForm
        suppliers={suppliers}
        items={items.map((i) => ({
          id: i.id,
          name: i.name,
          unitCost: i.unitCost.toString(),
        }))}
      />
    </div>
  );
}
