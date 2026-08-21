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
import { formatDate, formatMoney, salesOrderNumber } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SalesOrdersPage() {
  const salesOrders = await prisma.salesOrder.findMany({
    orderBy: { number: "desc" },
    include: { customer: { select: { name: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Sales orders</h1>
        <Button nativeButton={false} render={<Link href="/sales-orders/new" />}>
          New sales order
        </Button>
      </div>

      {salesOrders.length === 0 ? (
        <p className="text-muted-foreground">
          No sales orders yet — create one, or convert an approved quote.
        </p>
      ) : (
        <div className="rounded-lg border bg-white dark:bg-zinc-900">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead>Due</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {salesOrders.map((so) => (
                <TableRow key={so.id}>
                  <TableCell>
                    <Link
                      href={`/sales-orders/${so.id}`}
                      className="font-medium hover:underline"
                    >
                      {salesOrderNumber(so.number)}
                    </Link>
                  </TableCell>
                  <TableCell>{so.customer.name}</TableCell>
                  <TableCell>{so.title ?? "—"}</TableCell>
                  <TableCell>
                    <StatusBadge status={so.status} />
                  </TableCell>
                  <TableCell>{formatDate(so.issueDate)}</TableCell>
                  <TableCell>{formatDate(so.dueDate)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(so.total)}
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
