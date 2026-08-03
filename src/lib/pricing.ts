import { Prisma } from "@/generated/prisma/client";

import type { MoneyInput } from "@/lib/money";

const { Decimal } = Prisma;

export interface GridCellInput {
  minQuantity: number;
  tier: number;
  unitPrice: MoneyInput;
}

export interface MarkupRuleInput {
  minCost: MoneyInput;
  multiplier: MoneyInput;
}

/**
 * Resolve the decoration price per piece from grid cells: among cells of the
 * requested tier whose minQuantity <= quantity, the one with the highest
 * minQuantity wins. Returns null when the grid has no applicable cell
 * (quantity below the lowest break, or unknown tier).
 */
export function resolveDecorationPrice(
  cells: GridCellInput[],
  quantity: number,
  tier: number,
): Prisma.Decimal | null {
  if (!Number.isInteger(quantity) || quantity <= 0) return null;
  let best: GridCellInput | null = null;
  for (const cell of cells) {
    if (cell.tier !== tier || cell.minQuantity > quantity) continue;
    if (!best || cell.minQuantity > best.minQuantity) best = cell;
  }
  return best ? new Decimal(best.unitPrice) : null;
}

/**
 * Apply the garment markup: the rule with the highest minCost <= cost wins.
 * With no applicable rule the cost passes through unchanged. Sell prices are
 * rounded to whole cents (half-up).
 */
export function applyMarkup(
  cost: MoneyInput,
  rules: MarkupRuleInput[],
): Prisma.Decimal {
  const c = new Decimal(cost);
  if (c.isNegative()) throw new Error(`Invalid garment cost: ${c.toString()}`);
  let best: MarkupRuleInput | null = null;
  let bestMin: Prisma.Decimal | null = null;
  for (const rule of rules) {
    const min = new Decimal(rule.minCost);
    if (min.gt(c)) continue;
    if (bestMin === null || min.gt(bestMin)) {
      best = rule;
      bestMin = min;
    }
  }
  if (!best) return c.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  return c
    .mul(new Decimal(best.multiplier))
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export interface SetupFeeTierInput {
  tier: number;
  fee: MoneyInput;
}

/**
 * Resolve the one-time setup fee for a tier (e.g. number of colors/screens),
 * if the grid defines one. Unlike resolveDecorationPrice this is an exact
 * tier match, not a quantity-break lookup — setup fees don't scale with
 * quantity, only with how many screens/colors the job needs. Returns null
 * when no fee is configured for that tier (no setup fee charged).
 */
export function resolveSetupFee(
  tiers: SetupFeeTierInput[],
  tier: number,
): Prisma.Decimal | null {
  const match = tiers.find((t) => t.tier === tier);
  return match ? new Decimal(match.fee) : null;
}

export type LinePriceResult =
  | {
      ok: true;
      decorationUnit: Prisma.Decimal;
      garmentUnit: Prisma.Decimal;
      unitPrice: Prisma.Decimal; // decoration + marked-up garment, per piece
    }
  | { ok: false; error: string };

/** Price one line: decoration from the grid plus marked-up garment cost. */
export function priceLine(input: {
  cells: GridCellInput[];
  markupRules: MarkupRuleInput[];
  quantity: number;
  tier: number;
  garmentCost?: MoneyInput | null;
}): LinePriceResult {
  const decorationUnit = resolveDecorationPrice(
    input.cells,
    input.quantity,
    input.tier,
  );
  if (decorationUnit === null) {
    return {
      ok: false,
      error: "No grid price for that quantity/tier combination",
    };
  }
  const garmentUnit =
    input.garmentCost == null || input.garmentCost === ""
      ? new Decimal(0)
      : applyMarkup(input.garmentCost, input.markupRules);
  return {
    ok: true,
    decorationUnit,
    garmentUnit,
    unitPrice: decorationUnit.add(garmentUnit),
  };
}
