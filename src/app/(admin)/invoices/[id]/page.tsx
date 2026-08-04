import Link from "next/link";
import { notFound } from "next/navigation";

import { InvoiceActions } from "@/components/document-actions";
import { DocumentLines } from "@/components/document-lines";
import { PaymentsSection } from "@/components/payments-section";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatDate,
  formatMoney,
  invoiceNumber,
  quoteNumber,
} from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      customer: true,
      lineItems: { orderBy: { sortOrder: "asc" } },
      sourceQuote: { select: { id: true, number: true } },
      payments: { orderBy: { receivedAt: "asc" } },
    },
  });
  if (!invoice) notFound();

  const balance = invoice.total.sub(invoice.amountPaid);
  const overdue =
    (invoice.status === "SENT" || invoice.status === "PARTIALLY_PAID") &&
    !!invoice.dueDate &&
    invoice.dueDate < new Date();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">
              {invoiceNumber(invoice.number)}
            </h1>
            <StatusBadge status={invoice.status} />
            {overdue && (
              <span className="text-destructive text-sm font-medium">
                Overdue
              </span>
            )}
          </div>
          {invoice.title && (
            <p className="text-muted-foreground">{invoice.title}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<a href={`/api/invoices/${invoice.id}/pdf`} download />}
          >
            Download PDF
          </Button>
          <InvoiceActions id={invoice.id} status={invoice.status} />
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Customer</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <Link
              href={`/customers/${invoice.customerId}`}
              className="font-medium hover:underline"
            >
              {invoice.customer.name}
            </Link>
            {invoice.customer.taxExempt && (
              <p className="text-muted-foreground">Tax exempt</p>
            )}
            {invoice.sourceQuote && (
              <p className="text-muted-foreground mt-2">
                From quote{" "}
                <Link
                  href={`/quotes/${invoice.sourceQuote.id}`}
                  className="text-foreground font-medium hover:underline"
                >
                  {quoteNumber(invoice.sourceQuote.number)}
                </Link>
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>Issued: {formatDate(invoice.issueDate)}</p>
            <p>Due: {formatDate(invoice.dueDate)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>Paid: {formatMoney(invoice.amountPaid)}</p>
            <p className={balance.isZero() ? "" : "font-medium"}>
              Balance due: {formatMoney(balance)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Line items</CardTitle>
        </CardHeader>
        <CardContent>
          <DocumentLines lines={invoice.lineItems} totals={invoice} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payments</CardTitle>
        </CardHeader>
        <CardContent>
          <PaymentsSection
            invoiceId={invoice.id}
            balance={balance.toFixed(2)}
            canRecord={
              invoice.status === "SENT" || invoice.status === "PARTIALLY_PAID"
            }
            payments={invoice.payments.map((p) => ({
              id: p.id,
              amount: p.amount.toString(),
              method: p.method,
              reference: p.reference,
              receivedAt: p.receivedAt.toISOString(),
              notes: p.notes,
            }))}
          />
        </CardContent>
      </Card>

      {(invoice.terms || invoice.notes) && (
        <div className="grid gap-6 sm:grid-cols-2">
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
          {invoice.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Internal notes</CardTitle>
              </CardHeader>
              <CardContent className="text-sm whitespace-pre-wrap">
                {invoice.notes}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
