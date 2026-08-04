import { notFound } from "next/navigation";

import { GridEditor, type GridEditorValues } from "@/components/grid-editor";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function EditGridPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const grid = await prisma.priceGrid.findUnique({
    where: { id },
    include: { cells: true, setupFees: true },
  });
  if (!grid) notFound();

  const tierCount = Math.max(
    1,
    ...grid.cells.map((c) => c.tier),
    ...grid.setupFees.map((f) => f.tier),
  );
  const breaks = [...new Set(grid.cells.map((c) => c.minQuantity))].sort(
    (a, b) => a - b,
  );

  const initial: GridEditorValues = {
    name: grid.name,
    method: grid.method,
    tierLabel: grid.tierLabel,
    notes: grid.notes ?? "",
    tierCount,
    rows: breaks.map((q) => ({
      minQuantity: String(q),
      prices: Array.from({ length: tierCount }, (_, i) => {
        const cell = grid.cells.find(
          (c) => c.minQuantity === q && c.tier === i + 1,
        );
        return cell ? cell.unitPrice.toString() : "";
      }),
    })),
    setupFees: Array.from({ length: tierCount }, (_, i) => {
      const fee = grid.setupFees.find((f) => f.tier === i + 1);
      return fee ? fee.fee.toString() : "";
    }),
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-3xl font-bold">Edit {grid.name}</h1>
      <GridEditor gridId={id} initial={initial} />
    </div>
  );
}
