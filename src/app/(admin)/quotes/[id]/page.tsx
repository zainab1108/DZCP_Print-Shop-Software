import Link from "next/link";
import { notFound } from "next/navigation";

import { QuoteActions } from "@/components/document-actions";
import { DocumentLines } from "@/components/document-lines";
import { ProofsSection } from "@/components/proofs-section";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, invoiceNumber, quoteNumber } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function QuotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: {
      customer: true,
      lineItems: { orderBy: { sortOrder: "asc" } },
      invoices: { select: { id: true, number: true } },
      proofs: { orderBy: { version: "asc" } },
    },
  });
  if (!quote) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">
              {quoteNumber(quote.number)}
            </h1>
            <StatusBadge status={quote.status} />
          </div>
          {quote.title && (
            <p className="text-muted-foreground">{quote.title}</p>
          )}
        </div>
        <QuoteActions id={quote.id} status={quote.status} />
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Customer</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <Link
              href={`/customers/${quote.customerId}`}
              className="font-medium hover:underline"
            >
              {quote.customer.name}
            </Link>
            {quote.customer.taxExempt && (
              <p className="text-muted-foreground">Tax exempt</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>Issued: {formatDate(quote.issueDate)}</p>
            <p>Valid until: {formatDate(quote.validUntil)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Linked invoices</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {quote.invoices.length === 0 ? (
              <p className="text-muted-foreground">None yet.</p>
            ) : (
              quote.invoices.map((inv) => (
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
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Line items</CardTitle>
        </CardHeader>
        <CardContent>
          <DocumentLines lines={quote.lineItems} totals={quote} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Art proofs</CardTitle>
        </CardHeader>
        <CardContent>
          <ProofsSection
            quoteId={quote.id}
            proofs={quote.proofs.map((p) => ({
              id: p.id,
              version: p.version,
              fileName: p.fileName,
              mimeType: p.mimeType,
              status: p.status,
              note: p.note,
              feedback: p.feedback,
              decidedAt: p.decidedAt?.toISOString() ?? null,
              createdAt: p.createdAt.toISOString(),
            }))}
          />
        </CardContent>
      </Card>

      {(quote.terms || quote.notes) && (
        <div className="grid gap-6 sm:grid-cols-2">
          {quote.terms && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Terms</CardTitle>
              </CardHeader>
              <CardContent className="text-sm whitespace-pre-wrap">
                {quote.terms}
              </CardContent>
            </Card>
          )}
          {quote.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Internal notes</CardTitle>
              </CardHeader>
              <CardContent className="text-sm whitespace-pre-wrap">
                {quote.notes}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
