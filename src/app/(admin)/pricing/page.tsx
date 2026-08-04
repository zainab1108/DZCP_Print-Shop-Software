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
import { requireAdminPage } from "@/lib/auth/current-user";
import { DECORATION_METHODS, METHOD_LABELS } from "@/lib/decoration-methods";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  await requireAdminPage(); // pricing/markup is money config — admins only
  const [grids, rules] = await Promise.all([
    prisma.priceGrid.findMany({
      orderBy: [{ method: "asc" }, { name: "asc" }],
      include: { _count: { select: { cells: true, setupFees: true } } },
    }),
    prisma.markupRule.findMany({ orderBy: { minCost: "asc" } }),
  ]);

  // Every method gets a section, so it's obvious which ones have no pricing
  // set up yet.
  const byMethod = DECORATION_METHODS.map((method) => ({
    method,
    grids: grids.filter((g) => g.method === method),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Pricing</h1>
        <Button
          nativeButton={false}
          render={<Link href="/pricing/grids/new" />}
        >
          New price grid
        </Button>
      </div>

      {byMethod.map(({ method, grids: methodGrids }) => (
        <Card key={method}>
          <CardHeader>
            <CardTitle className="text-base">{METHOD_LABELS[method]}</CardTitle>
          </CardHeader>
          <CardContent>
            {methodGrids.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No pricing set up for {METHOD_LABELS[method]} yet.{" "}
                <Link
                  href="/pricing/grids/new"
                  className="text-foreground hover:underline"
                >
                  Add a grid →
                </Link>
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Tier axis</TableHead>
                    <TableHead className="text-right">Cells</TableHead>
                    <TableHead className="text-right">Setup fees</TableHead>
                    <TableHead className="w-32" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {methodGrids.map((g) => (
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
                        {g._count.setupFees || "—"}
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
      ))}

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
