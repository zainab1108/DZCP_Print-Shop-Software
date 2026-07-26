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

export default async function SuppliersPage() {
  const suppliers = await prisma.supplier.findMany({
    where: { archived: false },
    orderBy: { name: "asc" },
    include: { _count: { select: { items: true, purchaseOrders: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Suppliers</h1>
        <Button
          nativeButton={false}
          render={<Link href="/inventory/suppliers/new" />}
        >
          New supplier
        </Button>
      </div>

      {suppliers.length === 0 ? (
        <p className="text-muted-foreground">No suppliers yet.</p>
      ) : (
        <div className="rounded-lg border bg-white dark:bg-zinc-900">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="text-right">Items</TableHead>
                <TableHead className="text-right">POs</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <Link
                      href={`/inventory/suppliers/${s.id}/edit`}
                      className="font-medium hover:underline"
                    >
                      {s.name}
                    </Link>
                  </TableCell>
                  <TableCell>{s.email ?? "—"}</TableCell>
                  <TableCell>{s.phone ?? "—"}</TableCell>
                  <TableCell className="text-right">{s._count.items}</TableCell>
                  <TableCell className="text-right">
                    {s._count.purchaseOrders}
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
