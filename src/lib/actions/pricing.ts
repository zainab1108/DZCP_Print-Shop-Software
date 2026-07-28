"use server";

import { revalidatePath } from "next/cache";

import { Prisma } from "@/generated/prisma/client";
import { requireAdminAction } from "@/lib/auth/require-admin-action";
import { priceLine } from "@/lib/pricing";
import { prisma } from "@/lib/prisma";
import { calcInput, gridInput, markupRulesInput } from "@/lib/validation";

import type { ActionResult } from "./customers";

export async function saveGrid(
  gridId: string | null,
  raw: unknown,
): Promise<ActionResult> {
  const guard = await requireAdminAction();
  if (!guard.ok) return guard;
  const parsed = gridInput.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const { cells, ...fields } = parsed.data;

  const seen = new Set<string>();
  for (const c of cells) {
    const key = `${c.minQuantity}:${c.tier}`;
    if (seen.has(key)) {
      return {
        ok: false,
        error: `Duplicate cell for quantity ${c.minQuantity}, tier ${c.tier}`,
      };
    }
    seen.add(key);
  }

  const cellData = cells.map((c) => ({
    minQuantity: c.minQuantity,
    tier: c.tier,
    unitPrice: new Prisma.Decimal(c.unitPrice),
  }));

  try {
    let id = gridId;
    if (id) {
      await prisma.$transaction([
        prisma.priceCell.deleteMany({ where: { gridId: id } }),
        prisma.priceGrid.update({
          where: { id },
          data: { ...fields, cells: { create: cellData } },
        }),
      ]);
    } else {
      const grid = await prisma.priceGrid.create({
        data: { ...fields, cells: { create: cellData } },
      });
      id = grid.id;
    }
    revalidatePath("/pricing");
    return { ok: true, id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to save",
    };
  }
}

export async function deleteGrid(id: string): Promise<ActionResult> {
  const guard = await requireAdminAction();
  if (!guard.ok) return guard;
  try {
    await prisma.priceGrid.delete({ where: { id } });
    revalidatePath("/pricing");
    return { ok: true, id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to delete",
    };
  }
}

/** Replace the global markup table wholesale — it's small and edited as one. */
export async function saveMarkupRules(raw: unknown): Promise<ActionResult> {
  const guard = await requireAdminAction();
  if (!guard.ok) return guard;
  const parsed = markupRulesInput.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const seen = new Set<string>();
  for (const r of parsed.data.rules) {
    const key = new Prisma.Decimal(r.minCost).toFixed(2);
    if (seen.has(key)) {
      return { ok: false, error: `Two rules start at cost ${key}` };
    }
    seen.add(key);
  }

  try {
    await prisma.$transaction([
      prisma.markupRule.deleteMany({}),
      prisma.markupRule.createMany({
        data: parsed.data.rules.map((r) => ({
          minCost: new Prisma.Decimal(r.minCost),
          multiplier: new Prisma.Decimal(r.multiplier),
        })),
      }),
    ]);
    revalidatePath("/pricing");
    return { ok: true, id: "markup" };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to save",
    };
  }
}

export type CalcResult =
  | {
      ok: true;
      decorationUnit: string;
      garmentUnit: string;
      unitPrice: string;
    }
  | { ok: false; error: string };

/** Compute a suggested unit price for a line. Pure lookup — writes nothing. */
export async function calculateLinePrice(raw: unknown): Promise<CalcResult> {
  const parsed = calcInput.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  try {
    const [grid, markupRules] = await Promise.all([
      prisma.priceGrid.findUnique({
        where: { id: parsed.data.gridId },
        include: { cells: true },
      }),
      prisma.markupRule.findMany(),
    ]);
    if (!grid) return { ok: false, error: "Price grid not found" };

    const res = priceLine({
      cells: grid.cells,
      markupRules,
      quantity: parsed.data.quantity,
      tier: parsed.data.tier,
      garmentCost: parsed.data.garmentCost || null,
    });
    if (!res.ok) return res;

    return {
      ok: true,
      decorationUnit: res.decorationUnit.toFixed(4),
      garmentUnit: res.garmentUnit.toFixed(2),
      unitPrice: res.unitPrice.toFixed(4),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}
