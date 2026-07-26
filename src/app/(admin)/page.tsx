import Link from "next/link";

import { RevenueBars } from "@/components/revenue-bars";
import { StatTile } from "@/components/stat-tile";
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
  invoiceNumber,
  quoteNumber,
} from "@/lib/format";
import { inventoryValue, isLowStock } from "@/lib/inventory";
import { prisma } from "@/lib/prisma";
import { STATUS_LABELS } from "@/lib/production";
import {
  averageLeadTimeDays,
  quoteConversion,
  revenueByMonth,
  summarizeInvoices,
} from "@/lib/reporting";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const now = new Date();

  const [
    invoices,
    quotes,
    jobs,
    items,
    openPos,
    shipments,
    overdueInvoices,
    lowStockItems,
    pendingQuotes,
  ] = await Promise.all([
    prisma.invoice.findMany({
      select: {
        status: true,
        total: true,
        amountPaid: true,
        dueDate: true,
        issueDate: true,
      },
    }),
    prisma.quote.findMany({ select: { status: true } }),
    prisma.job.findMany({
      select: { status: true, createdAt: true, completedAt: true },
    }),
    prisma.inventoryItem.findMany({
      where: { archived: false },
      select: { quantityOnHand: true, reorderPoint: true, unitCost: true },
    }),
    prisma.purchaseOrder.findMany({
      where: { status: { in: ["ORDERED", "PARTIALLY_RECEIVED"] } },
      select: { total: true },
    }),
    prisma.shipment.findMany({ select: { status: true } }),
    prisma.invoice.findMany({
      where: {
        status: { in: ["SENT", "PARTIALLY_PAID", "OVERDUE"] },
        dueDate: { lt: now },
      },
      orderBy: { dueDate: "asc" },
      take: 6,
      include: { customer: { select: { name: true } } },
    }),
    prisma.inventoryItem.findMany({
      where: { archived: false },
      orderBy: { name: "asc" },
      include: { supplier: { select: { name: true } } },
    }),
    prisma.quote.findMany({
      where: { status: "SENT" },
      orderBy: { issueDate: "asc" },
      take: 6,
      include: { customer: { select: { name: true } } },
    }),
  ]);

  const money = summarizeInvoices(invoices, now);
  const revenue = revenueByMonth(invoices, 6, now);
  const conversion = quoteConversion(quotes);
  const leadTime = averageLeadTimeDays(jobs);
  const stockValue = inventoryValue(items);
  const lows = lowStockItems.filter(isLowStock);

  const activeJobs = jobs.filter(
    (j) => j.status !== "SHIPPED" && j.status !== "ON_HOLD",
  ).length;
  const openShipments = shipments.filter(
    (s) => s.status !== "DELIVERED" && s.status !== "RETURNED",
  ).length;
  const openPoValue = openPos.reduce((sum, p) => sum + Number(p.total), 0);

  // Jobs grouped by status for the production breakdown.
  const jobCounts = new Map<string, number>();
  for (const j of jobs)
    jobCounts.set(j.status, (jobCounts.get(j.status) ?? 0) + 1);
  const activeJobBreakdown = [...jobCounts.entries()]
    .filter(([status]) => status !== "SHIPPED")
    .sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      {/* Money KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Outstanding (A/R)"
          value={formatMoney(money.outstanding)}
          sub={
            money.overdueCount > 0
              ? `${money.overdueCount} overdue · ${formatMoney(money.overdueAmount)}`
              : "Nothing overdue"
          }
          href="/invoices"
          tone={money.overdueCount > 0 ? "danger" : "default"}
        />
        <StatTile
          label="Collected"
          value={formatMoney(money.collected)}
          sub={`${formatMoney(money.invoiced)} invoiced`}
          tone="good"
        />
        <StatTile
          label="Quote win rate"
          value={
            conversion.rate === null
              ? "—"
              : `${Math.round(conversion.rate * 100)}%`
          }
          sub={`${conversion.won} won of ${conversion.decided} decided`}
          href="/quotes"
        />
        <StatTile
          label="Avg lead time"
          value={leadTime === null ? "—" : `${leadTime} d`}
          sub="Approval to shipped"
          href="/production"
        />
      </div>

      {/* Operations KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Jobs in production"
          value={String(activeJobs)}
          href="/production"
        />
        <StatTile
          label="Open shipments"
          value={String(openShipments)}
          href="/shipping"
        />
        <StatTile
          label="Stock value"
          value={formatMoney(stockValue)}
          sub={lows.length > 0 ? `${lows.length} low` : "All stocked"}
          href="/inventory"
          tone={lows.length > 0 ? "warn" : "default"}
        />
        <StatTile
          label="Open POs"
          value={formatMoney(openPoValue)}
          href="/purchasing"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">
              Invoiced revenue — last 6 months
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueBars
              data={revenue.map((b) => ({
                key: b.key,
                label: b.label,
                amount: Number(b.total),
              }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Production</CardTitle>
          </CardHeader>
          <CardContent>
            {activeJobBreakdown.length === 0 ? (
              <p className="text-muted-foreground text-sm">No active jobs.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {activeJobBreakdown.map(([status, count]) => (
                  <li
                    key={status}
                    className="flex items-center justify-between"
                  >
                    <StatusBadge
                      status={status}
                      label={
                        STATUS_LABELS[status as keyof typeof STATUS_LABELS]
                      }
                    />
                    <span className="tabular-nums">{count}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Overdue invoices</CardTitle>
          </CardHeader>
          <CardContent>
            {overdueInvoices.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No overdue invoices. 🎉
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overdueInvoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell>
                        <Link
                          href={`/invoices/${inv.id}`}
                          className="font-medium hover:underline"
                        >
                          {invoiceNumber(inv.number)}
                        </Link>
                      </TableCell>
                      <TableCell>{inv.customer.name}</TableCell>
                      <TableCell className="text-red-600 dark:text-red-400">
                        {formatDate(inv.dueDate)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(inv.total.sub(inv.amountPaid))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Needs attention</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">
                Quotes awaiting reply
              </p>
              {pendingQuotes.length === 0 ? (
                <p className="text-muted-foreground">None.</p>
              ) : (
                <ul className="space-y-1">
                  {pendingQuotes.map((q) => (
                    <li key={q.id}>
                      <Link
                        href={`/quotes/${q.id}`}
                        className="hover:underline"
                      >
                        {quoteNumber(q.number)}
                      </Link>{" "}
                      <span className="text-muted-foreground">
                        · {q.customer.name}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">
                Low stock
              </p>
              {lows.length === 0 ? (
                <p className="text-muted-foreground">All stocked.</p>
              ) : (
                <ul className="space-y-1">
                  {lows.slice(0, 6).map((item) => (
                    <li key={item.id} className="flex justify-between">
                      <Link
                        href={`/inventory/${item.id}`}
                        className="hover:underline"
                      >
                        {item.name}
                      </Link>
                      <span className="text-muted-foreground tabular-nums">
                        {item.quantityOnHand}/{item.reorderPoint}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
