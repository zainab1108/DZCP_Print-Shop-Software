import Link from "next/link";
import { notFound } from "next/navigation";

import { ArchiveCustomerButton } from "@/components/document-actions";
import { PortalAccessCard } from "@/components/portal-access-card";
import { StatusBadge } from "@/components/status-badge";
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
import { setCustomerArchived } from "@/lib/actions/customers";
import {
  formatDate,
  formatMoney,
  invoiceNumber,
  quoteNumber,
  salesOrderNumber,
} from "@/lib/format";
import { prisma } from "@/lib/prisma";
import type { Address } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

export default async function CustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      addresses: true,
      quotes: { orderBy: { createdAt: "desc" }, take: 10 },
      salesOrders: { orderBy: { createdAt: "desc" }, take: 10 },
      invoices: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });
  if (!customer) notFound();

  const billing = customer.addresses.find((a) => a.type === "BILLING");
  const shipping = customer.addresses.find((a) => a.type === "SHIPPING");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold">{customer.name}</h1>
          {customer.taxExempt && <Badge variant="outline">Tax exempt</Badge>}
          {customer.archived && <Badge variant="secondary">Archived</Badge>}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={`/customers/${id}/edit`} />}
          >
            Edit
          </Button>
          <ArchiveCustomerButton
            id={id}
            archived={customer.archived}
            action={setCustomerArchived}
          />
          <Button
            size="sm"
            nativeButton={false}
            render={<Link href={`/quotes/new?customerId=${id}`} />}
          >
            New quote
          </Button>
          <Button
            size="sm"
            variant="secondary"
            nativeButton={false}
            render={<Link href={`/sales-orders/new?customerId=${id}`} />}
          >
            New sales order
          </Button>
          <Button
            size="sm"
            variant="secondary"
            nativeButton={false}
            render={<Link href={`/invoices/new?customerId=${id}`} />}
          >
            New invoice
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contact info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>{customer.email ?? "No email"}</p>
            <p>{customer.phone ?? "No phone"}</p>
            <p>{customer.website ?? "No website"}</p>
            {customer.notes && (
              <p className="text-muted-foreground border-t pt-2">
                {customer.notes}
              </p>
            )}
          </CardContent>
        </Card>
        <AddressCard title="Billing address" address={billing} />
        <AddressCard title="Shipping address" address={shipping} />
      </div>

      <PortalAccessCard
        customerId={customer.id}
        portalToken={customer.portalToken}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent quotes</CardTitle>
        </CardHeader>
        <CardContent>
          {customer.quotes.length === 0 ? (
            <p className="text-muted-foreground text-sm">No quotes yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customer.quotes.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell>
                      <Link
                        href={`/quotes/${q.id}`}
                        className="font-medium hover:underline"
                      >
                        {quoteNumber(q.number)}
                      </Link>
                    </TableCell>
                    <TableCell>{q.title ?? "—"}</TableCell>
                    <TableCell>
                      <StatusBadge status={q.status} />
                    </TableCell>
                    <TableCell>{formatDate(q.issueDate)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(q.total)}
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
          <CardTitle className="text-base">Recent sales orders</CardTitle>
        </CardHeader>
        <CardContent>
          {customer.salesOrders.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No sales orders yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customer.salesOrders.map((so) => (
                  <TableRow key={so.id}>
                    <TableCell>
                      <Link
                        href={`/sales-orders/${so.id}`}
                        className="font-medium hover:underline"
                      >
                        {salesOrderNumber(so.number)}
                      </Link>
                    </TableCell>
                    <TableCell>{so.title ?? "—"}</TableCell>
                    <TableCell>
                      <StatusBadge status={so.status} />
                    </TableCell>
                    <TableCell>{formatDate(so.issueDate)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(so.total)}
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
          <CardTitle className="text-base">Recent invoices</CardTitle>
        </CardHeader>
        <CardContent>
          {customer.invoices.length === 0 ? (
            <p className="text-muted-foreground text-sm">No invoices yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customer.invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>
                      <Link
                        href={`/invoices/${inv.id}`}
                        className="font-medium hover:underline"
                      >
                        {invoiceNumber(inv.number)}
                      </Link>
                    </TableCell>
                    <TableCell>{inv.title ?? "—"}</TableCell>
                    <TableCell>
                      <StatusBadge status={inv.status} />
                    </TableCell>
                    <TableCell>{formatDate(inv.dueDate)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(inv.total)}
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

function AddressCard({
  title,
  address,
}: {
  title: string;
  address: Address | undefined;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm">
        {!address ? (
          <p className="text-muted-foreground">None on file.</p>
        ) : (
          <address className="space-y-1 not-italic">
            <p>{address.line1}</p>
            {address.line2 && <p>{address.line2}</p>}
            <p>
              {[address.city, address.state, address.postalCode]
                .filter(Boolean)
                .join(", ")}
            </p>
            <p>{address.country}</p>
          </address>
        )}
      </CardContent>
    </Card>
  );
}
