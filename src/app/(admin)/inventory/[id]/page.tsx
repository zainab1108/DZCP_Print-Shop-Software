import Link from "next/link";
import { notFound } from "next/navigation";

import { StockAdjust } from "@/components/stock-adjust";
import { Badge } from "@/components/ui/badge";
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
import {
  formatDate,
  formatMoney,
  formatUnitPrice,
  jobNumber,
} from "@/lib/format";
import { isLowStock } from "@/lib/inventory";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const reasonLabels: Record<string, string> = {
  RECEIVED: "Received",
  CONSUMED: "Consumed",
  ADJUSTMENT: "Adjustment",
};

export default async function ItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = await prisma.inventoryItem.findUnique({
    where: { id },
    include: {
      supplier: { select: { id: true, name: true } },
      movements: {
        orderBy: { createdAt: "desc" },
        take: 30,
        include: { job: { select: { id: true, number: true } } },
      },
    },
  });
  if (!item) notFound();

  // Jobs still in production, for tagging consumption.
  const jobs = await prisma.job.findMany({
    where: { status: { not: "SHIPPED" } },
    orderBy: { number: "desc" },
    take: 50,
    include: { quote: { select: { title: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">{item.name}</h1>
          {isLowStock(item) && (
            <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100">
              Low stock
            </Badge>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href={`/inventory/${item.id}/edit`} />}
        >
          Edit
        </Button>
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Item</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-mono text-xs">{item.sku}</p>
            <p>Unit: {item.unit}</p>
            <p>Cost: {formatUnitPrice(item.unitCost)}</p>
            <p>
              Supplier:{" "}
              {item.supplier ? (
                <Link
                  href={`/inventory/suppliers/${item.supplier.id}/edit`}
                  className="hover:underline"
                >
                  {item.supplier.name}
                </Link>
              ) : (
                "—"
              )}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Stock</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="text-2xl font-semibold tabular-nums">
              {item.quantityOnHand}
            </p>
            <p className="text-muted-foreground">
              Reorder at {item.reorderPoint} · value{" "}
              {formatMoney(item.unitCost.mul(item.quantityOnHand))}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Record stock movement</CardTitle>
        </CardHeader>
        <CardContent>
          <StockAdjust
            itemId={item.id}
            jobs={jobs.map((j) => ({
              id: j.id,
              label: `${jobNumber(j.number)}${j.quote.title ? ` — ${j.quote.title}` : ""}`,
            }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent movements</CardTitle>
        </CardHeader>
        <CardContent>
          {item.movements.length === 0 ? (
            <p className="text-muted-foreground text-sm">No movements yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="text-right">Change</TableHead>
                  <TableHead>Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {item.movements.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>{formatDate(m.createdAt)}</TableCell>
                    <TableCell>{reasonLabels[m.reason] ?? m.reason}</TableCell>
                    <TableCell
                      className={`text-right tabular-nums ${m.delta < 0 ? "text-red-600 dark:text-red-400" : "text-green-700 dark:text-green-400"}`}
                    >
                      {m.delta > 0 ? `+${m.delta}` : m.delta}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {m.job ? (
                        <Link
                          href={`/production/${m.job.id}`}
                          className="hover:underline"
                        >
                          {jobNumber(m.job.number)}
                        </Link>
                      ) : (
                        (m.note ?? "—")
                      )}
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
