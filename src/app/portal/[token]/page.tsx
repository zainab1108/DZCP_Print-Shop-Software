import Link from "next/link";
import { notFound } from "next/navigation";

import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatDate,
  formatMoney,
  invoiceNumber,
  quoteNumber,
} from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function PortalHome({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const customer = await prisma.customer.findUnique({
    where: { portalToken: token },
    include: {
      quotes: {
        where: { status: { not: "DRAFT" } },
        orderBy: { number: "desc" },
      },
      invoices: {
        where: { status: { not: "DRAFT" } },
        orderBy: { number: "desc" },
      },
    },
  });
  if (!customer) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{customer.name}</h1>
        <p className="text-muted-foreground text-sm">
          Your quotes and invoices. Quotes awaiting your approval are marked
          “sent”.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quotes</CardTitle>
        </CardHeader>
        <CardContent>
          {customer.quotes.length === 0 ? (
            <p className="text-muted-foreground text-sm">No quotes yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Valid until</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customer.quotes.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell>
                      <Link
                        href={`/portal/${token}/quotes/${q.id}`}
                        className="font-medium hover:underline"
                      >
                        {quoteNumber(q.number)}
                      </Link>
                    </TableCell>
                    <TableCell>{q.title ?? "—"}</TableCell>
                    <TableCell>
                      <StatusBadge status={q.status} />
                    </TableCell>
                    <TableCell>{formatDate(q.validUntil)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(q.total)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          {customer.invoices.length === 0 ? (
            <p className="text-muted-foreground text-sm">No invoices yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customer.invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>
                      <Link
                        href={`/portal/${token}/invoices/${inv.id}`}
                        className="font-medium hover:underline"
                      >
                        {invoiceNumber(inv.number)}
                      </Link>
                    </TableCell>
                    <TableCell>{inv.title ?? "—"}</TableCell>
                    <TableCell>
                      <StatusBadge status={inv.status} />
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
