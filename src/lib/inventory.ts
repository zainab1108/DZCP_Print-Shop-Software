import { Prisma, type PurchaseOrderStatus } from "@/generated/prisma/client";

import type { MoneyInput } from "@/lib/money";

const { Decimal } = Prisma;

const CENTS = 2;

/** quantity x unitCost, rounded to cents (half-up). Costs can be sub-cent. */
export function poLineTotal(
  quantity: number,
  unitCost: MoneyInput,
): Prisma.Decimal {
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new Error(`Invalid quantity: ${quantity}`);
  }
  return new Decimal(unitCost)
    .mul(quantity)
    .toDecimalPlaces(CENTS, Decimal.ROUND_HALF_UP);
}

/** Sum of line totals for a purchase order. */
export function poTotal(
  lines: { quantity: number; unitCost: MoneyInput }[],
): Prisma.Decimal {
  return lines.reduce(
    (sum, l) => sum.add(poLineTotal(l.quantity, l.unitCost)),
    new Decimal(0),
  );
}

/** Total value of stock on hand: sum of quantityOnHand x unitCost. */
export function inventoryValue(
  items: { quantityOnHand: number; unitCost: MoneyInput }[],
): Prisma.Decimal {
  return items
    .reduce(
      (sum, i) => sum.add(new Decimal(i.unitCost).mul(i.quantityOnHand)),
      new Decimal(0),
    )
    .toDecimalPlaces(CENTS, Decimal.ROUND_HALF_UP);
}

/** At or below the reorder point — time to buy more. */
export function isLowStock(item: {
  quantityOnHand: number;
  reorderPoint: number;
}): boolean {
  return item.quantityOnHand <= item.reorderPoint;
}

export type StockChange =
  { ok: true; newOnHand: number } | { ok: false; error: string };

/**
 * Apply a signed delta to on-hand stock. Stock can't go negative — you can't
 * consume or adjust below zero. A zero delta is a no-op error.
 */
export function applyStockDelta(onHand: number, delta: number): StockChange {
  if (!Number.isInteger(delta) || delta === 0) {
    return { ok: false, error: "Enter a non-zero whole number" };
  }
  const next = onHand + delta;
  if (next < 0) {
    return {
      ok: false,
      error: `Not enough stock: ${onHand} on hand, can't remove ${-delta}`,
    };
  }
  return { ok: true, newOnHand: next };
}

/**
 * Derive a PO's status from how much of it has been received. DRAFT and
 * CANCELLED are lifecycle states set explicitly; everything else follows the
 * received quantities. Mirrors invoice-status-from-payments.
 */
export function derivePoStatus(
  current: PurchaseOrderStatus,
  lines: { quantity: number; quantityReceived: number }[],
): PurchaseOrderStatus {
  if (current === "DRAFT" || current === "CANCELLED") return current;
  const totalOrdered = lines.reduce((s, l) => s + l.quantity, 0);
  const totalReceived = lines.reduce((s, l) => s + l.quantityReceived, 0);
  if (totalReceived === 0) return "ORDERED";
  if (totalReceived >= totalOrdered) return "RECEIVED";
  return "PARTIALLY_RECEIVED";
}

/** How many units of a line are still outstanding. */
export function outstandingQty(line: {
  quantity: number;
  quantityReceived: number;
}): number {
  return Math.max(0, line.quantity - line.quantityReceived);
}
