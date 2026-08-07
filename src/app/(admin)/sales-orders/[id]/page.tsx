import Link from "next/link";
import { notFound } from "next/navigation";

import { SalesOrderActions } from "@/components/document-actions";
import { DocumentLines } from "@/components/document-lines";
import { JobStatusDropdown } from "@/components/job-detail-controls";
import { SendToProduction } from "@/components/send-to-production";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatDate,
  invoiceNumber,
  jobNumber,
  quoteNumber,
  salesOrderNumber,
} from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SalesOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const salesOrder = await prisma.salesOrder.findUnique({
    where: { id },
    include: {
      customer: true,
      lineItems: { orderBy: { sortOrder: "asc" } },
      sourceQuote: { select: { id: true, number: true } },
      invoices: { select: { id: true, number: true } },
      job: { select: { id: true, number: true, status: true } },
    },
  });
  if (!salesOrder) notFound();

  const producible =
    salesOrder.status === "CONFIRMED" || salesOrder.status === "INVOICED";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">
              {salesOrderNumber(salesOrder.number)}
            </h1>
            <StatusBadge status={salesOrder.status} />
          </div>
          {salesOrder.title && (
            <p className="text-muted-foreground">{salesOrder.title}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={
                <a href={`/api/sales-orders/${salesOrder.id}/pdf`} download />
              }
            >
              Download PDF
            </Button>
            <SalesOrderActions id={salesOrder.id} status={salesOrder.status} />
          </div>
          <SendToProduction
            salesOrderId={salesOrder.id}
            producible={producible}
            job={salesOrder.job}
          />
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Customer</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <Link
              href={`/customers/${salesOrder.customerId}`}
              className="font-medium hover:underline"
            >
              {salesOrder.customer.name}
            </Link>
            {salesOrder.customer.taxExempt && (
              <p className="text-muted-foreground">Tax exempt</p>
            )}
            {salesOrder.sourceQuote && (
              <p className="text-muted-foreground">
                From{" "}
                <Link
                  href={`/quotes/${salesOrder.sourceQuote.id}`}
                  className="hover:underline"
                >
                  {quoteNumber(salesOrder.sourceQuote.number)}
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
            <p>Issued: {formatDate(salesOrder.issueDate)}</p>
            <p>Due: {formatDate(salesOrder.dueDate)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Production</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {salesOrder.job ? (
              <>
                <Link
                  href={`/production/${salesOrder.job.id}`}
                  className="block font-medium hover:underline"
                >
                  {jobNumber(salesOrder.job.number)}
                </Link>
                <JobStatusDropdown
                  jobId={salesOrder.job.id}
                  status={salesOrder.job.status}
                />
              </>
            ) : (
              <p className="text-muted-foreground">
                {producible
                  ? "Not sent to production yet."
                  : "Confirm the order to send it to production."}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Line items</CardTitle>
        </CardHeader>
        <CardContent>
          <DocumentLines lines={salesOrder.lineItems} totals={salesOrder} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invoices</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {salesOrder.invoices.length === 0 ? (
            <p className="text-muted-foreground">None yet.</p>
          ) : (
            salesOrder.invoices.map((inv) => (
              <Link
                key={inv.id}
                href={`/invoices/${inv.id}`}
                className="block font-medium hover:underline"
              >
                {invoiceNumber(inv.number)}
              </Link>
            ))
          )}
        </CardContent>
      </Card>

      {(salesOrder.terms || salesOrder.notes) && (
        <div className="grid gap-6 sm:grid-cols-2">
          {salesOrder.terms && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Terms</CardTitle>
              </CardHeader>
              <CardContent className="text-sm whitespace-pre-wrap">
                {salesOrder.terms}
              </CardContent>
            </Card>
          )}
          {salesOrder.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Internal notes</CardTitle>
              </CardHeader>
              <CardContent className="text-sm whitespace-pre-wrap">
                {salesOrder.notes}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
