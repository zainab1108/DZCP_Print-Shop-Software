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
import { formatDate, formatMoney, invoiceNumber } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function isOverdue(inv: { status: string; dueDate: Date | null }): boolean {
  return (
    (inv.status === "SENT" || inv.status === "PARTIALLY_PAID") &&
    !!inv.dueDate &&
    inv.dueDate < new Date()
  );
}

export default async function InvoicesPage() {
  const invoices = await prisma.invoice.findMany({
    orderBy: { number: "desc" },
    include: { customer: { select: { name: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Invoices</h1>
        <Button nativeButton={false} render={<Link href="/invoices/new" />}>
          New invoice
        </Button>
      </div>

      {invoices.length === 0 ? (
        <p className="text-muted-foreground">
          No invoices yet — create one directly or convert an approved quote.
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
                <TableHead>Due</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell>
                    <Link
                      href={`/invoices/${inv.id}`}
                      className="font-medium hover:underline"
                    >
                      {invoiceNumber(inv.number)}
                    </Link>
                  </TableCell>
                  <TableCell>{inv.customer.name}</TableCell>
                  <TableCell>{inv.title ?? "—"}</TableCell>
                  <TableCell className="space-x-2">
                    <StatusBadge status={inv.status} />
                    {isOverdue(inv) && (
                      <span className="text-destructive text-xs font-medium">
                        Overdue
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{formatDate(inv.dueDate)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(inv.total.sub(inv.amountPaid))}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(inv.total)}
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
