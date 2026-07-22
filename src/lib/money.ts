import { Prisma } from "@/generated/prisma/client";

const { Decimal } = Prisma;

export type MoneyInput = Prisma.Decimal | string | number;

export interface LineInput {
  quantity: number;
  unitPrice: MoneyInput; // up to 4 decimal places
  taxable: boolean;
}

export interface DocumentTotals {
  lineTotals: Prisma.Decimal[];
  subtotal: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  total: Prisma.Decimal;
}

const CENTS = 2;

/** quantity x unitPrice, rounded to cents (half-up). */
export function computeLineTotal(
  quantity: number,
  unitPrice: MoneyInput,
): Prisma.Decimal {
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new Error(`Invalid quantity: ${quantity}`);
  }
  return new Decimal(unitPrice)
    .mul(quantity)
    .toDecimalPlaces(CENTS, Decimal.ROUND_HALF_UP);
}

/**
 * Compute persisted document totals. Tax applies to the sum of taxable line
 * totals (post-rounding), so what the customer sees always adds up.
 */
export function computeDocumentTotals(
  lines: LineInput[],
  taxRate: MoneyInput, // fraction, e.g. 0.0825
  opts: { taxExempt?: boolean } = {},
): DocumentTotals {
  const rate = new Decimal(taxRate);
  if (rate.isNegative() || rate.greaterThan(1)) {
    throw new Error(`Invalid tax rate: ${rate.toString()}`);
  }

  const lineTotals = lines.map((l) =>
    computeLineTotal(l.quantity, l.unitPrice),
  );
  const subtotal = lineTotals.reduce((sum, t) => sum.add(t), new Decimal(0));

  const taxableBase = lines.reduce(
    (sum, l, i) => (l.taxable ? sum.add(lineTotals[i]) : sum),
    new Decimal(0),
  );
  const taxAmount = opts.taxExempt
    ? new Decimal(0)
    : taxableBase.mul(rate).toDecimalPlaces(CENTS, Decimal.ROUND_HALF_UP);

  return {
    lineTotals,
    subtotal,
    taxAmount,
    total: subtotal.add(taxAmount),
  };
}

/** Parse a percent string from a form ("8.25") into a rate fraction (0.0825). */
export function percentToRate(percent: string | number): Prisma.Decimal {
  const p = new Decimal(percent === "" ? 0 : percent);
  if (p.isNegative() || p.greaterThan(100)) {
    throw new Error(`Invalid tax percent: ${p.toString()}`);
  }
  return p.div(100).toDecimalPlaces(5, Decimal.ROUND_HALF_UP);
}
