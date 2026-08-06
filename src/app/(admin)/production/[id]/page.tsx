import Link from "next/link";
import { notFound } from "next/navigation";

import {
  DeleteJobButton,
  JobScheduleForm,
  JobStatusControl,
} from "@/components/job-detail-controls";
import { ShipmentsSection } from "@/components/shipments-section";
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
  dateToInput,
  formatDate,
  invoiceNumber,
  jobNumber,
  quoteNumber,
  salesOrderNumber,
} from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { PRIORITY_LABELS, STATUS_LABELS } from "@/lib/production";

export const dynamic = "force-dynamic";

export default async function JobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const job = await prisma.job.findUnique({
    where: { id },
    include: {
      salesOrder: {
        include: {
          customer: { select: { id: true, name: true } },
          lineItems: { orderBy: { sortOrder: "asc" } },
          invoices: { select: { id: true, number: true } },
          sourceQuote: {
            select: {
              id: true,
              number: true,
              proofs: {
                orderBy: { version: "desc" },
                select: { id: true, version: true, status: true },
              },
            },
          },
        },
      },
      shipments: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!job) notFound();

  const { salesOrder } = job;
  const proofs = salesOrder.sourceQuote?.proofs ?? [];
  const approvedProof = proofs.find((p) => p.status === "APPROVED");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold">{jobNumber(job.number)}</h1>
          <StatusBadge status={job.status} label={STATUS_LABELS[job.status]} />
          <span className="text-muted-foreground text-sm">
            {PRIORITY_LABELS[job.priority]} priority
          </span>
        </div>
        <DeleteJobButton jobId={job.id} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Order</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>
              <Link
                href={`/customers/${salesOrder.customer.id}`}
                className="font-medium hover:underline"
              >
                {salesOrder.customer.name}
              </Link>
            </p>
            {salesOrder.title && (
              <p className="text-muted-foreground">{salesOrder.title}</p>
            )}
            <p className="pt-1">
              Sales order{" "}
              <Link
                href={`/sales-orders/${salesOrder.id}`}
                className="font-medium hover:underline"
              >
                {salesOrderNumber(salesOrder.number)}
              </Link>
            </p>
            {salesOrder.invoices.map((inv) => (
              <p key={inv.id}>
                Invoice{" "}
                <Link
                  href={`/invoices/${inv.id}`}
                  className="font-medium hover:underline"
                >
                  {invoiceNumber(inv.number)}
                </Link>
              </p>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Artwork</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {!salesOrder.sourceQuote ? (
              <p className="text-muted-foreground">
                This order wasn&apos;t created from a quote — no proofs.
              </p>
            ) : proofs.length === 0 ? (
              <p className="text-muted-foreground">No proofs on the quote.</p>
            ) : (
              <>
                {approvedProof ? (
                  <p className="text-green-700 dark:text-green-400">
                    Proof v{approvedProof.version} approved
                  </p>
                ) : (
                  <p className="text-amber-700 dark:text-amber-400">
                    No approved proof yet
                  </p>
                )}
                <Link
                  href={`/quotes/${salesOrder.sourceQuote.id}`}
                  className="text-muted-foreground hover:underline"
                >
                  View proofs on {quoteNumber(salesOrder.sourceQuote.number)} →
                </Link>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <JobStatusControl jobId={job.id} status={job.status} />
            {job.completedAt && (
              <p className="text-muted-foreground text-xs">
                Shipped {formatDate(job.completedAt)}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">What to produce</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Qty</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {salesOrder.lineItems.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>{l.description}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {l.quantity}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Shipments</CardTitle>
        </CardHeader>
        <CardContent>
          <ShipmentsSection
            jobId={job.id}
            shipments={job.shipments.map((s) => ({
              id: s.id,
              carrier: s.carrier,
              service: s.service,
              trackingNumber: s.trackingNumber,
              status: s.status,
              cost: s.cost.toString(),
              shippedAt: s.shippedAt?.toISOString() ?? null,
              deliveredAt: s.deliveredAt?.toISOString() ?? null,
            }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Schedule</CardTitle>
        </CardHeader>
        <CardContent>
          <JobScheduleForm
            jobId={job.id}
            initial={{
              priority: job.priority,
              assignee: job.assignee ?? "",
              dueDate: dateToInput(job.dueDate),
              notes: job.notes ?? "",
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
