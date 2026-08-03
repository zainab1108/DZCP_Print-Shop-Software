import Link from "next/link";
import { notFound } from "next/navigation";

import { DocumentLines } from "@/components/document-lines";
import { PortalProofs } from "@/components/portal-proofs";
import { PortalQuoteActions } from "@/components/portal-quote-actions";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, quoteNumber } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function PortalQuotePage({
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

  const quote = await prisma.quote.findUnique({
    where: { id },
    include: {
      lineItems: { orderBy: { sortOrder: "asc" } },
      proofs: { orderBy: { version: "asc" } },
    },
  });
  if (!quote || quote.customerId !== customer.id || quote.status === "DRAFT") {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold">{quoteNumber(quote.number)}</h1>
          <StatusBadge status={quote.status} />
        </div>
        <Link
          href={`/portal/${token}`}
          className="text-muted-foreground text-sm hover:underline"
        >
          ← All documents
        </Link>
      </div>
      {quote.title && <p className="text-muted-foreground">{quote.title}</p>}
      <p className="text-muted-foreground text-sm">
        Issued {formatDate(quote.issueDate)}
        {quote.validUntil && <> · valid until {formatDate(quote.validUntil)}</>}
      </p>

      {quote.status === "SENT" && (
        <Card>
          <CardContent className="space-y-3 pt-6">
            <p className="text-sm font-medium">
              This quote is awaiting your decision.
            </p>
            <PortalQuoteActions token={token} quoteId={quote.id} />
          </CardContent>
        </Card>
      )}

      {quote.proofs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Art proofs</CardTitle>
          </CardHeader>
          <CardContent>
            <PortalProofs
              token={token}
              proofs={quote.proofs.map((p) => ({
                id: p.id,
                version: p.version,
                mimeType: p.mimeType,
                status: p.status,
                note: p.note,
                feedback: p.feedback,
                createdAt: p.createdAt.toISOString(),
              }))}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Line items</CardTitle>
        </CardHeader>
        <CardContent>
          <DocumentLines lines={quote.lineItems} totals={quote} />
        </CardContent>
      </Card>

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
    </div>
  );
}
