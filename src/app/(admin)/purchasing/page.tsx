import Link from "next/link";

import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatMoney, poNumber } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function PurchasingPage() {
  const pos = await prisma.purchaseOrder.findMany({
    orderBy: { number: "desc" },
    include: { supplier: { select: { name: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Purchasing</h1>
        <Button nativeButton={false} render={<Link href="/purchasing/new" />}>
          New purchase order
        </Button>
      </div>

      {pos.length === 0 ? (
        <p className="text-muted-foreground">
          No purchase orders yet. Create one to restock from a supplier.
        </p>
      ) : (
        <div className="rounded-lg border bg-white dark:bg-zinc-900">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expected</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pos.map((po) => (
                <TableRow key={po.id}>
                  <TableCell>
                    <Link
                      href={`/purchasing/${po.id}`}
                      className="font-medium hover:underline"
                    >
                      {poNumber(po.number)}
                    </Link>
                  </TableCell>
                  <TableCell>{po.supplier.name}</TableCell>
                  <TableCell>
                    <StatusBadge status={po.status} />
                  </TableCell>
                  <TableCell>{formatDate(po.expectedAt)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(po.total)}
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
