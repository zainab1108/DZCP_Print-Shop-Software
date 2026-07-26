import Link from "next/link";
import { notFound } from "next/navigation";

import { POActions, ReceivePanel } from "@/components/po-controls";
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
  formatUnitPrice,
  poNumber,
} from "@/lib/format";
import { outstandingQty } from "@/lib/inventory";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function POPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      supplier: true,
      lines: {
        orderBy: { sortOrder: "asc" },
        include: { item: { select: { id: true } } },
      },
    },
  });
  if (!po) notFound();

  const open = po.status === "ORDERED" || po.status === "PARTIALLY_RECEIVED";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">{poNumber(po.number)}</h1>
          <StatusBadge status={po.status} />
        </div>
        <POActions id={po.id} status={po.status} />
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Supplier</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <Link
              href={`/inventory/suppliers/${po.supplier.id}/edit`}
              className="font-medium hover:underline"
            >
              {po.supplier.name}
            </Link>
            {po.supplier.account && (
              <p className="text-muted-foreground">
                Acct {po.supplier.account}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>Ordered: {formatDate(po.orderedAt)}</p>
            <p>Expected: {formatDate(po.expectedAt)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              {formatMoney(po.total)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lines</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Ordered</TableHead>
                <TableHead className="text-right">Received</TableHead>
                <TableHead className="text-right">Unit cost</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {po.lines.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>
                    {l.item ? (
                      <Link
                        href={`/inventory/${l.item.id}`}
                        className="hover:underline"
                      >
                        {l.description}
                      </Link>
                    ) : (
                      l.description
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {l.quantity}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {l.quantityReceived}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatUnitPrice(l.unitCost)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(l.lineTotal)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {open && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Receive</CardTitle>
          </CardHeader>
          <CardContent>
            <ReceivePanel
              poId={po.id}
              lines={po.lines.map((l) => ({
                id: l.id,
                description: l.description,
                outstanding: outstandingQty(l),
              }))}
            />
          </CardContent>
        </Card>
      )}

      {po.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap">
            {po.notes}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
