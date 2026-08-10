import Link from "next/link";
import { notFound } from "next/navigation";

import { DocumentLines } from "@/components/document-lines";
import { PortalPayButton } from "@/components/portal-pay-button";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
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
import {
  CARRIER_LABELS,
  isDispatched,
  SHIPMENT_STATUS_LABELS,
  trackingUrl,
} from "@/lib/shipping";
import { stripe, stripeConfigured } from "@/lib/stripe";
import { canPayOnline } from "@/lib/stripe-payments";

export const dynamic = "force-dynamic";

/**
 * Did the customer really just pay? Read-only check against Stripe.
 *
 * `?paid=1` on its own is trivially spoofable, so it's never trusted for
 * display — we confirm the session is real, is for THIS invoice, and actually
 * settled. This never writes; the webhook is the sole writer.
 */
async function justPaid(
  sessionId: string | undefined,
  invoiceId: string,
): Promise<boolean> {
  if (!sessionId || !stripeConfigured()) return false;
  try {
    const session = await stripe().checkout.sessions.retrieve(sessionId);
    return (
      session.metadata?.invoiceId === invoiceId &&
      session.payment_status === "paid"
    );
  } catch {
    return false;
  }
}

export default async function PortalInvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string; id: string }>;
  searchParams: Promise<{ paid?: string; session_id?: string }>;
}) {
  const { token, id } = await params;
  const { session_id: sessionId } = await searchParams;
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
      sourceSalesOrder: {
        select: {
          job: { select: { shipments: { orderBy: { createdAt: "desc" } } } },
        },
      },
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
  // Only surface shipments that have actually left the shop.
  const shipments = (invoice.sourceSalesOrder?.job?.shipments ?? []).filter(
    (s) => isDispatched(s.status),
  );

  // Stripe redirects back immediately, often before the webhook lands, so a
  // confirmed payment can coexist with a still-outstanding balance for a
  // second or two. Say so plainly rather than showing a stale "unpaid".
  const paymentConfirmed = await justPaid(sessionId, invoice.id);
  const awaitingWebhook = paymentConfirmed && balance.gt(0);
  const offerPayment =
    stripeConfigured() &&
    canPayOnline(invoice.status, balance) &&
    !awaitingWebhook; // never offer to pay twice

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold">
            {invoiceNumber(invoice.number)}
          </h1>
          <StatusBadge status={invoice.status} />
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={
              <a
                href={`/api/portal/${token}/invoices/${invoice.id}/pdf`}
                download
              />
            }
          >
            Download PDF
          </Button>
          <Link
            href={`/portal/${token}`}
            className="text-muted-foreground text-sm hover:underline"
          >
            ← All documents
          </Link>
        </div>
      </div>
      {invoice.title && (
        <p className="text-muted-foreground">{invoice.title}</p>
      )}
      <p className="text-muted-foreground text-sm">
        Issued {formatDate(invoice.issueDate)}
        {invoice.dueDate && <> · due {formatDate(invoice.dueDate)}</>}
      </p>

      {awaitingWebhook && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm font-medium">
              Payment received — we&apos;re confirming it with our payment
              processor.
            </p>
            <p className="text-muted-foreground text-sm">
              This invoice will update shortly. You don&apos;t need to pay
              again.
            </p>
          </CardContent>
        </Card>
      )}

      {balance.gt(0) && invoice.status !== "VOID" && (
        <Card>
          <CardContent className="space-y-3 pt-6">
            <p className="text-sm">
              Balance due:{" "}
              <span className="font-semibold">{formatMoney(balance)}</span>
              {invoice.dueDate && <> by {formatDate(invoice.dueDate)}</>}
            </p>
            {offerPayment && (
              <PortalPayButton
                token={token}
                invoiceId={invoice.id}
                amountLabel={formatMoney(balance)}
              />
            )}
          </CardContent>
        </Card>
      )}

      {shipments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Shipment tracking</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {shipments.map((s) => {
              const url = trackingUrl(s.carrier, s.trackingNumber);
              return (
                <div key={s.id} className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">
                    {CARRIER_LABELS[s.carrier]}
                  </span>
                  <StatusBadge
                    status={s.status}
                    label={SHIPMENT_STATUS_LABELS[s.status]}
                  />
                  {s.trackingNumber &&
                    (url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono underline-offset-2 hover:underline"
                      >
                        {s.trackingNumber}
                      </a>
                    ) : (
                      <span className="font-mono">{s.trackingNumber}</span>
                    ))}
                  {s.shippedAt && (
                    <span className="text-muted-foreground">
                      shipped {formatDate(s.shippedAt)}
                    </span>
                  )}
                </div>
              );
            })}
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
