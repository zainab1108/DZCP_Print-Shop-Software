import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const { archived } = await searchParams;
  const showArchived = archived === "1";

  const customers = await prisma.customer.findMany({
    where: { archived: showArchived },
    orderBy: { name: "asc" },
    include: { _count: { select: { quotes: true, invoices: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          {showArchived ? "Archived customers" : "Customers"}
        </h1>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={
              <Link
                href={showArchived ? "/customers" : "/customers?archived=1"}
              />
            }
          >
            {showArchived ? "Show active" : "Show archived"}
          </Button>
          <Button nativeButton={false} render={<Link href="/customers/new" />}>
            New customer
          </Button>
        </div>
      </div>

      {customers.length === 0 ? (
        <p className="text-muted-foreground">
          {showArchived
            ? "No archived customers."
            : "No customers yet — add your first one."}
        </p>
      ) : (
        <div className="rounded-lg border bg-white dark:bg-zinc-900">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="text-right">Quotes</TableHead>
                <TableHead className="text-right">Invoices</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link
                      href={`/customers/${c.id}`}
                      className="font-medium hover:underline"
                    >
                      {c.name}
                    </Link>
                  </TableCell>
                  <TableCell>{c.email ?? "—"}</TableCell>
                  <TableCell>{c.phone ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    {c._count.quotes}
                  </TableCell>
                  <TableCell className="text-right">
                    {c._count.invoices}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
