import Link from "next/link";
import { notFound } from "next/navigation";

import { DocumentLines } from "@/components/document-lines";
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
import { formatDate, formatMoney, invoiceNumber } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function PortalInvoicePage({
  params,
}: {
  params: Promise<{ token: string; id: string }>;
}) {
  const { token, id } = await params;
  const customer = await prisma.customer.findUnique({
    where: { portalToken: token },
    select: { id: true },
  });
  if (!customer) notFound();

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      lineItems: { orderBy: { sortOrder: "asc" } },
      payments: { orderBy: { receivedAt: "asc" } },
    },
  });
  if (
    !invoice ||
    invoice.customerId !== customer.id ||
    invoice.status === "DRAFT"
  ) {
    notFound();
  }

  const balance = invoice.total.sub(invoice.amountPaid);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">
            {invoiceNumber(invoice.number)}
          </h1>
          <StatusBadge status={invoice.status} />
        </div>
        <Link
          href={`/portal/${token}`}
          className="text-muted-foreground text-sm hover:underline"
        >
          ← All documents
        </Link>
      </div>
      {invoice.title && (
        <p className="text-muted-foreground">{invoice.title}</p>
      )}
      <p className="text-muted-foreground text-sm">
        Issued {formatDate(invoice.issueDate)}
        {invoice.dueDate && <> · due {formatDate(invoice.dueDate)}</>}
      </p>

      {!balance.isZero() && invoice.status !== "VOID" && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm">
              Balance due:{" "}
              <span className="font-semibold">{formatMoney(balance)}</span>
              {invoice.dueDate && <> by {formatDate(invoice.dueDate)}</>}
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Line items</CardTitle>
        </CardHeader>
        <CardContent>
          <DocumentLines lines={invoice.lineItems} totals={invoice} />
        </CardContent>
      </Card>

      {invoice.payments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payments received</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{formatDate(p.receivedAt)}</TableCell>
                    <TableCell>{p.method}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(p.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {invoice.terms && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Terms</CardTitle>
          </CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap">
            {invoice.terms}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
