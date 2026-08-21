import { Prisma } from "@/generated/prisma/client";

const { Decimal } = Prisma;

export type MoneyInput = Prisma.Decimal | string | number;

export interface LineInput {
  quantity: number;
  unitPrice: MoneyInput; // up to 4 decimal places
  taxable: boolean;
}

export type DiscountKind = "PERCENT" | "AMOUNT";

export interface DiscountInput {
  type: DiscountKind;
  /** Percent (10 = 10%) when type is PERCENT, dollars when AMOUNT. */
  value: MoneyInput;
}

export interface DocumentTotals {
  lineTotals: Prisma.Decimal[];
  /** Sum of line totals, before any discount. */
  subtotal: Prisma.Decimal;
  /** Resolved discount in dollars, never more than the subtotal. */
  discountAmount: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  /** subtotal - discountAmount + taxAmount */
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
 * Resolve a discount to dollars, capped at the subtotal.
 *
 * Capping matters: a flat discount larger than the job would otherwise make
 * the total negative, which is a credit note, not something this app models.
 */
export function resolveDiscount(
  subtotal: Prisma.Decimal,
  discount: DiscountInput | undefined,
): Prisma.Decimal {
  if (!discount) return new Decimal(0);
  const value = new Decimal(discount.value);
  if (value.isNaN() || value.isNegative()) {
    throw new Error(`Invalid discount value: ${discount.value}`);
  }

  let amount: Prisma.Decimal;
  if (discount.type === "PERCENT") {
    if (value.greaterThan(100)) {
      throw new Error(`Invalid discount percent: ${value.toString()}`);
    }
    amount = subtotal
      .mul(value)
      .div(100)
      .toDecimalPlaces(CENTS, Decimal.ROUND_HALF_UP);
  } else {
    amount = value.toDecimalPlaces(CENTS, Decimal.ROUND_HALF_UP);
  }

  return amount.greaterThan(subtotal) ? subtotal : amount;
}

/**
 * Compute persisted document totals. Tax applies to the sum of taxable line
 * totals (post-rounding), so what the customer sees always adds up.
 *
 * A discount reduces the sale price, so tax is charged on the discounted
 * amount rather than the original. When a document mixes taxable and
 * non-taxable lines the discount is split across them in proportion to their
 * share of the subtotal — otherwise a discount aimed at untaxed goods would
 * wrongly cut the tax owed (or vice versa).
 */
export function computeDocumentTotals(
  lines: LineInput[],
  taxRate: MoneyInput, // fraction, e.g. 0.0825
  opts: { taxExempt?: boolean; discount?: DiscountInput } = {},
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

  const discountAmount = resolveDiscount(subtotal, opts.discount);

  // Proportional split. Guard the zero-subtotal case so we never divide by 0.
  const discountOnTaxable = subtotal.isZero()
    ? new Decimal(0)
    : discountAmount.mul(taxableBase).div(subtotal);
  const discountedTaxable = taxableBase.sub(discountOnTaxable);

  const taxAmount = opts.taxExempt
    ? new Decimal(0)
    : discountedTaxable.mul(rate).toDecimalPlaces(CENTS, Decimal.ROUND_HALF_UP);

  return {
    lineTotals,
    subtotal,
    discountAmount,
    taxAmount,
    total: subtotal.sub(discountAmount).add(taxAmount),
  };
}

/** Parse a discount value from a form into a Decimal, treating "" as zero. */
export function parseDiscountValue(value: string | number): Prisma.Decimal {
  const v = new Decimal(value === "" ? 0 : value);
  if (v.isNaN() || v.isNegative()) {
    throw new Error(`Invalid discount value: ${value}`);
  }
  return v.toDecimalPlaces(CENTS, Decimal.ROUND_HALF_UP);
}

/** Parse a percent string from a form ("8.25") into a rate fraction (0.0825). */
export function percentToRate(percent: string | number): Prisma.Decimal {
  const p = new Decimal(percent === "" ? 0 : percent);
  if (p.isNegative() || p.greaterThan(100)) {
    throw new Error(`Invalid tax percent: ${p.toString()}`);
  }
  return p.div(100).toDecimalPlaces(5, Decimal.ROUND_HALF_UP);
}
