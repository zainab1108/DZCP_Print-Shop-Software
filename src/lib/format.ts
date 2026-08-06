// Client-safe formatting helpers — no Prisma imports here.

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

/** Format a money value (Decimal, string, or number) as USD. */
export function formatMoney(
  value: { toString(): string } | string | number,
): string {
  return usd.format(Number(value.toString()));
}

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Unit prices can carry up to 4 decimal places (sub-cent pricing). */
export function formatUnitPrice(
  value: { toString(): string } | string | number,
): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 4,
  }).format(Number(value.toString()));
}

/** Date -> value for <input type="date">, in local time. */
export function dateToInput(value: Date | null | undefined): string {
  if (!value) return "";
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

export function quoteNumber(n: number): string {
  return `Q-${n}`;
}

export function salesOrderNumber(n: number): string {
  return `SO-${n}`;
}

export function invoiceNumber(n: number): string {
  return `INV-${n}`;
}

export function jobNumber(n: number): string {
  return `JOB-${n}`;
}

export function poNumber(n: number): string {
  return `PO-${n}`;
}

/** Rate fraction (0.0825) -> percent string for form inputs ("8.25"). */
export function rateToPercent(rate: { toString(): string } | string): string {
  return String(Number(rate.toString()) * 100);
}
