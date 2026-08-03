import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMoney, formatUnitPrice } from "@/lib/format";
import { inventoryValue, isLowStock } from "@/lib/inventory";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const items = await prisma.inventoryItem.findMany({
    where: { archived: false },
    orderBy: { name: "asc" },
    include: { supplier: { select: { name: true } } },
  });

  const value = inventoryValue(items);
  const lowCount = items.filter(isLowStock).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Inventory</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/inventory/suppliers" />}
          >
            Suppliers
          </Button>
          <Button nativeButton={false} render={<Link href="/inventory/new" />}>
            New item
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-6 text-sm">
        <span>
          <span className="text-muted-foreground">Stock value: </span>
          <span className="font-medium">{formatMoney(value)}</span>
        </span>
        <span>
          <span className="text-muted-foreground">Low stock: </span>
          <span className="font-medium">{lowCount}</span>
        </span>
      </div>

      {items.length === 0 ? (
        <p className="text-muted-foreground">
          No items yet — add blank stock and supplies to track.
        </p>
      ) : (
        <div className="rounded-lg border bg-white dark:bg-zinc-900">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead className="text-right">On hand</TableHead>
                <TableHead className="text-right">Reorder</TableHead>
                <TableHead className="text-right">Unit cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-xs">
                    {item.sku}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/inventory/${item.id}`}
                      className="font-medium hover:underline"
                    >
                      {item.name}
                    </Link>
                  </TableCell>
                  <TableCell>{item.supplier?.name ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    <span className="mr-2">{item.quantityOnHand}</span>
                    {isLowStock(item) && (
                      <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100">
                        Low
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {item.reorderPoint}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatUnitPrice(item.unitCost)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
