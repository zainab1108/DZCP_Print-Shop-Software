import {
  Prisma,
  type InvoiceStatus,
  type QuoteStatus,
} from "@/generated/prisma/client";

import type { MoneyInput } from "@/lib/money";

const { Decimal } = Prisma;

// Invoice statuses that still owe money (money is outstanding / A/R).
const OPEN_INVOICE: InvoiceStatus[] = ["SENT", "PARTIALLY_PAID", "OVERDUE"];
// Statuses that count toward invoiced revenue at all.
const COUNTED_INVOICE: InvoiceStatus[] = [
  "SENT",
  "PARTIALLY_PAID",
  "OVERDUE",
  "PAID",
];

export interface InvoiceLike {
  status: InvoiceStatus;
  total: MoneyInput;
  amountPaid: MoneyInput;
  dueDate: Date | null;
}

export interface InvoiceSummary {
  invoiced: Prisma.Decimal;
  collected: Prisma.Decimal;
  outstanding: Prisma.Decimal; // accounts receivable
  overdueCount: number;
  overdueAmount: Prisma.Decimal;
}

/**
 * Aggregate invoice money. DRAFT and VOID invoices are excluded entirely.
 * Outstanding (A/R) is the unpaid balance of open invoices; overdue is the
 * subset of those past their due date as of `now`.
 */
export function summarizeInvoices(
  invoices: InvoiceLike[],
  now: Date = new Date(),
): InvoiceSummary {
  let invoiced = new Decimal(0);
  let collected = new Decimal(0);
  let outstanding = new Decimal(0);
  let overdueAmount = new Decimal(0);
  let overdueCount = 0;

  for (const inv of invoices) {
    if (!COUNTED_INVOICE.includes(inv.status)) continue;
    const total = new Decimal(inv.total);
    const paid = new Decimal(inv.amountPaid);
    invoiced = invoiced.add(total);
    collected = collected.add(paid);

    if (OPEN_INVOICE.includes(inv.status)) {
      const balance = total.sub(paid);
      outstanding = outstanding.add(balance);
      if (inv.dueDate && inv.dueDate < now) {
        overdueCount += 1;
        overdueAmount = overdueAmount.add(balance);
      }
    }
  }

  return { invoiced, collected, outstanding, overdueCount, overdueAmount };
}

export interface MonthBucket {
  key: string; // YYYY-MM
  label: string; // e.g. "Jul"
  total: Prisma.Decimal;
}

export interface DatedInvoice {
  status: InvoiceStatus;
  total: MoneyInput;
  issueDate: Date;
}

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Invoiced revenue bucketed by issue month, for the last `months` months
 * (oldest first, including the month containing `now`). Empty months are
 * zero-filled so the series is contiguous. DRAFT/VOID excluded.
 */
export function revenueByMonth(
  invoices: DatedInvoice[],
  months: number,
  now: Date = new Date(),
): MonthBucket[] {
  const buckets: MonthBucket[] = [];
  const index = new Map<string, MonthBucket>();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const bucket: MonthBucket = {
      key: monthKey(d),
      label: MONTH_NAMES[d.getMonth()],
      total: new Decimal(0),
    };
    buckets.push(bucket);
    index.set(bucket.key, bucket);
  }

  for (const inv of invoices) {
    if (!COUNTED_INVOICE.includes(inv.status)) continue;
    const bucket = index.get(monthKey(inv.issueDate));
    if (bucket) bucket.total = bucket.total.add(new Decimal(inv.total));
  }

  return buckets;
}

export interface QuoteConversion {
  won: number;
  lost: number;
  decided: number;
  rate: number | null; // won / decided, or null when nothing decided
}

/**
 * Quote win rate. Only decided quotes count: won = APPROVED or CONVERTED,
 * lost = DECLINED or EXPIRED. DRAFT and SENT are still pending and excluded.
 * CONVERTED means the quote became a sales order (not directly an invoice).
 */
export function quoteConversion(
  quotes: { status: QuoteStatus }[],
): QuoteConversion {
  let won = 0;
  let lost = 0;
  for (const q of quotes) {
    if (q.status === "APPROVED" || q.status === "CONVERTED") won += 1;
    else if (q.status === "DECLINED" || q.status === "EXPIRED") lost += 1;
  }
  const decided = won + lost;
  return { won, lost, decided, rate: decided === 0 ? null : won / decided };
}

/**
 * Average production lead time in days for completed (shipped) jobs, rounded
 * to one decimal. Returns null when no jobs have completed.
 */
export function averageLeadTimeDays(
  jobs: { createdAt: Date; completedAt: Date | null }[],
): number | null {
  const done = jobs.filter((j) => j.completedAt !== null);
  if (done.length === 0) return null;
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  const totalDays = done.reduce(
    (sum, j) =>
      sum + (j.completedAt!.getTime() - j.createdAt.getTime()) / MS_PER_DAY,
    0,
  );
  return Math.round((totalDays / done.length) * 10) / 10;
}
