import Link from "next/link";

import { StatusBadge } from "@/components/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, jobNumber } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import {
  CARRIER_LABELS,
  SHIPMENT_STATUS_LABELS,
  trackingUrl,
} from "@/lib/shipping";

export const dynamic = "force-dynamic";

export default async function ShippingPage() {
  const shipments = await prisma.shipment.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      job: {
        select: {
          id: true,
          number: true,
          quote: { select: { customer: { select: { name: true } } } },
        },
      },
    },
  });

  const open = shipments.filter(
    (s) => s.status !== "DELIVERED" && s.status !== "RETURNED",
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Shipping</h1>
        <span className="text-muted-foreground text-sm">
          {open} open · {shipments.length} total
        </span>
      </div>

      {shipments.length === 0 ? (
        <p className="text-muted-foreground">
          No shipments yet. Add one from a job in production.
        </p>
      ) : (
        <div className="rounded-lg border bg-white dark:bg-zinc-900">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Carrier</TableHead>
                <TableHead>Tracking</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Shipped</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shipments.map((s) => {
                const url = trackingUrl(s.carrier, s.trackingNumber);
                return (
                  <TableRow key={s.id}>
                    <TableCell>
                      <Link
                        href={`/production/${s.job.id}`}
                        className="font-medium hover:underline"
                      >
                        {jobNumber(s.job.number)}
                      </Link>
                    </TableCell>
                    <TableCell>{s.job.quote.customer.name}</TableCell>
                    <TableCell>{CARRIER_LABELS[s.carrier]}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {s.trackingNumber ? (
                        url ? (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline-offset-2 hover:underline"
                          >
                            {s.trackingNumber}
                          </a>
                        ) : (
                          s.trackingNumber
                        )
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        status={s.status}
                        label={SHIPMENT_STATUS_LABELS[s.status]}
                      />
                    </TableCell>
                    <TableCell>{formatDate(s.shippedAt)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
