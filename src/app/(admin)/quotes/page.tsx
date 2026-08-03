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
import { formatDate, formatMoney, quoteNumber } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function QuotesPage() {
  const quotes = await prisma.quote.findMany({
    orderBy: { number: "desc" },
    include: { customer: { select: { name: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Quotes</h1>
        <Button nativeButton={false} render={<Link href="/quotes/new" />}>
          New quote
        </Button>
      </div>

      {quotes.length === 0 ? (
        <p className="text-muted-foreground">
          No quotes yet — create your first one.
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
                <TableHead>Valid until</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotes.map((q) => (
                <TableRow key={q.id}>
                  <TableCell>
                    <Link
                      href={`/quotes/${q.id}`}
                      className="font-medium hover:underline"
                    >
                      {quoteNumber(q.number)}
                    </Link>
                  </TableCell>
                  <TableCell>{q.customer.name}</TableCell>
                  <TableCell>{q.title ?? "—"}</TableCell>
                  <TableCell>
                    <StatusBadge status={q.status} />
                  </TableCell>
                  <TableCell>{formatDate(q.issueDate)}</TableCell>
                  <TableCell>{formatDate(q.validUntil)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(q.total)}
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
