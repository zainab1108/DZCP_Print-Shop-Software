import Link from "next/link";

import { DeleteGridButton } from "@/components/delete-grid-button";
import { MarkupRulesEditor } from "@/components/markup-rules-editor";
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
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const [grids, rules] = await Promise.all([
    prisma.priceGrid.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { cells: true } } },
    }),
    prisma.markupRule.findMany({ orderBy: { minCost: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Pricing</h1>
        <Button
          nativeButton={false}
          render={<Link href="/pricing/grids/new" />}
        >
          New price grid
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Price grids</CardTitle>
        </CardHeader>
        <CardContent>
          {grids.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No price grids yet — create one to price decoration by quantity
              and {`"colors"`} (or any tier you define).
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Tier axis</TableHead>
                  <TableHead className="text-right">Cells</TableHead>
                  <TableHead className="w-32" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {grids.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell>
                      <Link
                        href={`/pricing/grids/${g.id}/edit`}
                        className="font-medium hover:underline"
                      >
                        {g.name}
                      </Link>
                    </TableCell>
                    <TableCell>{g.tierLabel}</TableCell>
                    <TableCell className="text-right">
                      {g._count.cells}
                    </TableCell>
                    <TableCell className="text-right">
                      <DeleteGridButton id={g.id} name={g.name} />
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
          <CardTitle className="text-base">Garment markup</CardTitle>
        </CardHeader>
        <CardContent>
          <MarkupRulesEditor
            initial={rules.map((r) => ({
              minCost: r.minCost.toString(),
              multiplier: r.multiplier.toString(),
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
