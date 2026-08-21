import { describe, expect, it } from "vitest";

import {
  computeDocumentTotals,
  computeLineTotal,
  parseDiscountValue,
  percentToRate,
  resolveDiscount,
} from "./money";
import { Prisma } from "@/generated/prisma/client";

describe("computeLineTotal", () => {
  it("multiplies quantity by unit price", () => {
    expect(computeLineTotal(10, "2.50").toString()).toBe("25");
  });

  it("handles sub-cent unit prices", () => {
    expect(computeLineTotal(1000, "0.0525").toString()).toBe("52.5");
  });

  it("rounds half-up to cents", () => {
    // 2 x 0.1275 = 0.255 -> 0.26
    expect(computeLineTotal(2, "0.1275").toString()).toBe("0.26");
    // 3 x 0.3333 = 0.9999 -> 1.00
    expect(computeLineTotal(3, "0.3333").toString()).toBe("1");
  });

  it("avoids binary float drift", () => {
    // 3 x 0.1 must be exactly 0.30, not 0.30000000000000004
    expect(computeLineTotal(3, "0.1").toString()).toBe("0.3");
  });

  it("handles zero quantity and zero price", () => {
    expect(computeLineTotal(0, "9.99").toString()).toBe("0");
    expect(computeLineTotal(5, "0").toString()).toBe("0");
  });

  it("keeps precision on large orders", () => {
    expect(computeLineTotal(99999, "99.9999").toString()).toBe("9999890");
  });

  it("rejects negative or fractional quantities", () => {
    expect(() => computeLineTotal(-1, "1.00")).toThrow();
    expect(() => computeLineTotal(1.5, "1.00")).toThrow();
  });
});

describe("computeDocumentTotals", () => {
  const lines = [
    { quantity: 50, unitPrice: "8.50", taxable: true }, // 425.00
    { quantity: 2, unitPrice: "45.00", taxable: true }, // 90.00
    { quantity: 1, unitPrice: "25.00", taxable: false }, // 25.00 (e.g. shipping)
  ];

  it("computes subtotal, tax on taxable lines only, and total", () => {
    const t = computeDocumentTotals(lines, "0.0825");
    expect(t.subtotal.toString()).toBe("540");
    // taxable base 515.00 x 0.0825 = 42.4875 -> 42.49
    expect(t.taxAmount.toString()).toBe("42.49");
    expect(t.total.toString()).toBe("582.49");
  });

  it("returns per-line totals matching the lines", () => {
    const t = computeDocumentTotals(lines, "0.0825");
    expect(t.lineTotals.map((d) => d.toString())).toEqual(["425", "90", "25"]);
  });

  it("charges no tax when tax-exempt", () => {
    const t = computeDocumentTotals(lines, "0.0825", { taxExempt: true });
    expect(t.taxAmount.toString()).toBe("0");
    expect(t.total.toString()).toBe("540");
  });

  it("handles zero tax rate", () => {
    const t = computeDocumentTotals(lines, 0);
    expect(t.taxAmount.toString()).toBe("0");
    expect(t.total.toString()).toBe("540");
  });

  it("handles an empty document", () => {
    const t = computeDocumentTotals([], "0.0825");
    expect(t.subtotal.toString()).toBe("0");
    expect(t.taxAmount.toString()).toBe("0");
    expect(t.total.toString()).toBe("0");
  });

  it("taxes the rounded line totals, so displayed numbers add up", () => {
    // line total rounds to 0.26; tax must be computed on 0.26, not 0.255
    const t = computeDocumentTotals(
      [{ quantity: 2, unitPrice: "0.1275", taxable: true }],
      "0.10",
    );
    expect(t.subtotal.toString()).toBe("0.26");
    expect(t.taxAmount.toString()).toBe("0.03"); // 0.026 -> 0.03
    expect(t.total.toString()).toBe("0.29");
  });

  it("rejects out-of-range tax rates", () => {
    expect(() => computeDocumentTotals(lines, "1.5")).toThrow();
    expect(() => computeDocumentTotals(lines, "-0.01")).toThrow();
  });
});

describe("percentToRate", () => {
  it("converts a form percent to a fraction", () => {
    expect(percentToRate("8.25").toString()).toBe("0.0825");
  });

  it("treats empty input as zero", () => {
    expect(percentToRate("").toString()).toBe("0");
  });

  it("rounds to 5 decimal places (storage precision)", () => {
    expect(percentToRate("8.12345").toString()).toBe("0.08123");
  });

  it("rejects out-of-range percents", () => {
    expect(() => percentToRate("101")).toThrow();
    expect(() => percentToRate("-1")).toThrow();
  });
});

describe("resolveDiscount", () => {
  const sub = (v: string) => new Prisma.Decimal(v);

  it("resolves a percentage of the subtotal", () => {
    expect(
      resolveDiscount(sub("200.00"), { type: "PERCENT", value: "10" }).toFixed(
        2,
      ),
    ).toBe("20.00");
  });

  it("resolves a flat amount unchanged", () => {
    expect(
      resolveDiscount(sub("200.00"), {
        type: "AMOUNT",
        value: "35.50",
      }).toFixed(2),
    ).toBe("35.50");
  });

  it("rounds a percentage to cents", () => {
    // 33.333% of 100 = 33.333 -> 33.33
    expect(
      resolveDiscount(sub("100.00"), {
        type: "PERCENT",
        value: "33.333",
      }).toFixed(2),
    ).toBe("33.33");
  });

  // A discount bigger than the job would otherwise make the total negative,
  // which is a credit note — not something this app models.
  it("caps a flat discount at the subtotal", () => {
    expect(
      resolveDiscount(sub("50.00"), {
        type: "AMOUNT",
        value: "500.00",
      }).toFixed(2),
    ).toBe("50.00");
  });

  it("treats 100% as the whole subtotal", () => {
    expect(
      resolveDiscount(sub("80.00"), { type: "PERCENT", value: "100" }).toFixed(
        2,
      ),
    ).toBe("80.00");
  });

  it("returns zero when there is no discount", () => {
    expect(resolveDiscount(sub("100.00"), undefined).toString()).toBe("0");
    expect(
      resolveDiscount(sub("100.00"), { type: "AMOUNT", value: "0" }).toString(),
    ).toBe("0");
  });

  it("rejects negative and over-100% discounts", () => {
    expect(() =>
      resolveDiscount(sub("100"), { type: "AMOUNT", value: "-1" }),
    ).toThrow();
    expect(() =>
      resolveDiscount(sub("100"), { type: "PERCENT", value: "101" }),
    ).toThrow();
  });
});

describe("computeDocumentTotals with a discount", () => {
  const taxable = [{ quantity: 1, unitPrice: "100.00", taxable: true }];

  it("subtracts the discount and taxes the discounted amount", () => {
    const t = computeDocumentTotals(taxable, "0.10", {
      discount: { type: "AMOUNT", value: "20.00" },
    });
    expect(t.subtotal.toFixed(2)).toBe("100.00");
    expect(t.discountAmount.toFixed(2)).toBe("20.00");
    expect(t.taxAmount.toFixed(2)).toBe("8.00"); // 10% of 80, not of 100
    expect(t.total.toFixed(2)).toBe("88.00");
  });

  it("handles a percentage discount the same way", () => {
    const t = computeDocumentTotals(taxable, "0.10", {
      discount: { type: "PERCENT", value: "25" },
    });
    expect(t.discountAmount.toFixed(2)).toBe("25.00");
    expect(t.taxAmount.toFixed(2)).toBe("7.50");
    expect(t.total.toFixed(2)).toBe("82.50");
  });

  // Reproduces a real imported YoPrint invoice, to prove we match what the
  // shop's previous system produced: subtotal 224.99, discount 200, tax 1.50.
  it("matches the legacy YoPrint arithmetic", () => {
    const t = computeDocumentTotals(
      [{ quantity: 1, unitPrice: "224.99", taxable: true }],
      "0.06",
      { discount: { type: "AMOUNT", value: "200.00" } },
    );
    expect(t.subtotal.toFixed(2)).toBe("224.99");
    expect(t.discountAmount.toFixed(2)).toBe("200.00");
    expect(t.taxAmount.toFixed(2)).toBe("1.50");
    expect(t.total.toFixed(2)).toBe("26.49");
  });

  // A discount aimed at untaxed goods must not wrongly cut the tax owed.
  it("splits the discount across taxable and non-taxable lines", () => {
    const mixed = [
      { quantity: 1, unitPrice: "800.00", taxable: true },
      { quantity: 1, unitPrice: "200.00", taxable: false },
    ];
    const t = computeDocumentTotals(mixed, "0.10", {
      discount: { type: "AMOUNT", value: "100.00" },
    });
    // 80% of the subtotal is taxable, so 80 of the 100 discount lands there:
    // taxable base 800 - 80 = 720, tax = 72.00
    expect(t.taxAmount.toFixed(2)).toBe("72.00");
    expect(t.total.toFixed(2)).toBe("972.00"); // 1000 - 100 + 72
  });

  it("charges no tax for a tax-exempt customer even with a discount", () => {
    const t = computeDocumentTotals(taxable, "0.10", {
      taxExempt: true,
      discount: { type: "PERCENT", value: "10" },
    });
    expect(t.taxAmount.toFixed(2)).toBe("0.00");
    expect(t.total.toFixed(2)).toBe("90.00");
  });

  it("zeroes the total when the discount covers everything", () => {
    const t = computeDocumentTotals(taxable, "0.10", {
      discount: { type: "PERCENT", value: "100" },
    });
    expect(t.discountAmount.toFixed(2)).toBe("100.00");
    expect(t.taxAmount.toFixed(2)).toBe("0.00");
    expect(t.total.toFixed(2)).toBe("0.00");
  });

  it("never produces a negative total from an oversized discount", () => {
    const t = computeDocumentTotals(taxable, "0.10", {
      discount: { type: "AMOUNT", value: "999.00" },
    });
    expect(t.total.toFixed(2)).toBe("0.00");
  });

  it("behaves exactly as before when there is no discount", () => {
    const t = computeDocumentTotals(taxable, "0.10");
    expect(t.discountAmount.toString()).toBe("0");
    expect(t.taxAmount.toFixed(2)).toBe("10.00");
    expect(t.total.toFixed(2)).toBe("110.00");
  });

  it("survives a zero subtotal without dividing by zero", () => {
    const t = computeDocumentTotals(
      [{ quantity: 0, unitPrice: "10.00", taxable: true }],
      "0.10",
      {
        discount: { type: "PERCENT", value: "50" },
      },
    );
    expect(t.total.toFixed(2)).toBe("0.00");
  });
});

describe("parseDiscountValue", () => {
  it("parses a form value and treats empty as zero", () => {
    expect(parseDiscountValue("12.50").toFixed(2)).toBe("12.50");
    expect(parseDiscountValue("").toString()).toBe("0");
  });

  it("rejects negatives", () => {
    expect(() => parseDiscountValue("-5")).toThrow();
  });
});
