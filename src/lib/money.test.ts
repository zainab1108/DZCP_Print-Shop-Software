import { describe, expect, it } from "vitest";

import {
  computeDocumentTotals,
  computeLineTotal,
  percentToRate,
} from "./money";

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
