import { describe, expect, it } from "vitest";

import {
  averageLeadTimeDays,
  quoteConversion,
  revenueByMonth,
  summarizeInvoices,
} from "./reporting";

const NOW = new Date("2026-07-26T12:00:00");

describe("summarizeInvoices", () => {
  const invoices = [
    {
      status: "PAID" as const,
      total: "485.06",
      amountPaid: "485.06",
      dueDate: new Date("2026-06-01"),
    },
    {
      status: "PARTIALLY_PAID" as const,
      total: "1000.00",
      amountPaid: "400.00",
      dueDate: new Date("2026-08-15"),
    },
    {
      status: "SENT" as const,
      total: "200.00",
      amountPaid: "0",
      dueDate: new Date("2026-07-01"),
    }, // overdue
    {
      status: "DRAFT" as const,
      total: "999.00",
      amountPaid: "0",
      dueDate: null,
    },
    { status: "VOID" as const, total: "50.00", amountPaid: "0", dueDate: null },
  ];

  it("sums invoiced and collected across counted invoices", () => {
    const s = summarizeInvoices(invoices, NOW);
    // 485.06 + 1000 + 200 (draft & void excluded)
    expect(s.invoiced.toString()).toBe("1685.06");
    expect(s.collected.toString()).toBe("885.06"); // 485.06 + 400
  });

  it("outstanding is the unpaid balance of open invoices only", () => {
    const s = summarizeInvoices(invoices, NOW);
    // (1000-400) + (200-0) = 800; PAID contributes nothing outstanding
    expect(s.outstanding.toString()).toBe("800");
  });

  it("flags overdue open invoices by due date", () => {
    const s = summarizeInvoices(invoices, NOW);
    // only the SENT one is past due (2026-07-01 < now); the partial is future
    expect(s.overdueCount).toBe(1);
    expect(s.overdueAmount.toString()).toBe("200");
  });

  it("handles an empty set", () => {
    const s = summarizeInvoices([], NOW);
    expect(s.invoiced.toString()).toBe("0");
    expect(s.outstanding.toString()).toBe("0");
    expect(s.overdueCount).toBe(0);
  });
});

describe("revenueByMonth", () => {
  const invoices = [
    {
      status: "PAID" as const,
      total: "500.00",
      issueDate: new Date("2026-07-10"),
    },
    {
      status: "SENT" as const,
      total: "250.00",
      issueDate: new Date("2026-07-20"),
    },
    {
      status: "PAID" as const,
      total: "1000.00",
      issueDate: new Date("2026-05-05"),
    },
    {
      status: "DRAFT" as const,
      total: "999.00",
      issueDate: new Date("2026-07-01"),
    }, // excluded
  ];

  it("buckets invoiced totals by issue month, newest last", () => {
    const series = revenueByMonth(invoices, 3, NOW);
    expect(series.map((b) => b.key)).toEqual(["2026-05", "2026-06", "2026-07"]);
    expect(series.map((b) => b.total.toString())).toEqual(["1000", "0", "750"]);
    expect(series.map((b) => b.label)).toEqual(["May", "Jun", "Jul"]);
  });

  it("zero-fills a fully empty range", () => {
    const series = revenueByMonth([], 2, NOW);
    expect(series.map((b) => b.total.toString())).toEqual(["0", "0"]);
  });

  it("ignores invoices outside the window", () => {
    const old = [
      {
        status: "PAID" as const,
        total: "999",
        issueDate: new Date("2025-01-01"),
      },
    ];
    const series = revenueByMonth(old, 3, NOW);
    expect(series.every((b) => b.total.isZero())).toBe(true);
  });
});

describe("quoteConversion", () => {
  it("counts won over decided, ignoring pending", () => {
    const c = quoteConversion([
      { status: "APPROVED" },
      { status: "CONVERTED" },
      { status: "DECLINED" },
      { status: "EXPIRED" },
      { status: "SENT" }, // pending, ignored
      { status: "DRAFT" }, // pending, ignored
    ]);
    expect(c.won).toBe(2);
    expect(c.lost).toBe(2);
    expect(c.decided).toBe(4);
    expect(c.rate).toBe(0.5);
  });

  it("returns null rate when nothing is decided", () => {
    expect(
      quoteConversion([{ status: "SENT" }, { status: "DRAFT" }]).rate,
    ).toBeNull();
    expect(quoteConversion([]).rate).toBeNull();
  });
});

describe("averageLeadTimeDays", () => {
  it("averages completed job durations in days", () => {
    const jobs = [
      {
        createdAt: new Date("2026-07-01T00:00:00"),
        completedAt: new Date("2026-07-05T00:00:00"),
      }, // 4d
      {
        createdAt: new Date("2026-07-10T00:00:00"),
        completedAt: new Date("2026-07-16T00:00:00"),
      }, // 6d
      { createdAt: new Date("2026-07-20T00:00:00"), completedAt: null }, // not done
    ];
    expect(averageLeadTimeDays(jobs)).toBe(5);
  });

  it("rounds to one decimal", () => {
    const jobs = [
      {
        createdAt: new Date("2026-07-01T00:00:00"),
        completedAt: new Date("2026-07-02T00:00:00"),
      }, // 1d
      {
        createdAt: new Date("2026-07-01T00:00:00"),
        completedAt: new Date("2026-07-03T00:00:00"),
      }, // 2d
      {
        createdAt: new Date("2026-07-01T00:00:00"),
        completedAt: new Date("2026-07-04T00:00:00"),
      }, // 3d
      {
        createdAt: new Date("2026-07-01T00:00:00"),
        completedAt: new Date("2026-07-05T00:00:00"),
      }, // 4d
    ];
    expect(averageLeadTimeDays(jobs)).toBe(2.5);
  });

  it("returns null when nothing has completed", () => {
    expect(
      averageLeadTimeDays([{ createdAt: new Date(), completedAt: null }]),
    ).toBeNull();
    expect(averageLeadTimeDays([])).toBeNull();
  });
});
