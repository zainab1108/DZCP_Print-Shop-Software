import { describe, expect, it } from "vitest";

import { applyMarkup, priceLine, resolveDecorationPrice } from "./pricing";

// A realistic screen print grid: breaks at 12/24/48/72/144, tiers = colors.
const cells = [
  { minQuantity: 12, tier: 1, unitPrice: "3.50" },
  { minQuantity: 24, tier: 1, unitPrice: "2.75" },
  { minQuantity: 48, tier: 1, unitPrice: "2.10" },
  { minQuantity: 72, tier: 1, unitPrice: "1.75" },
  { minQuantity: 144, tier: 1, unitPrice: "1.40" },
  { minQuantity: 12, tier: 2, unitPrice: "4.25" },
  { minQuantity: 24, tier: 2, unitPrice: "3.40" },
  { minQuantity: 48, tier: 2, unitPrice: "2.65" },
];

describe("resolveDecorationPrice", () => {
  it("picks the highest applicable quantity break", () => {
    expect(resolveDecorationPrice(cells, 50, 1)?.toString()).toBe("2.1");
  });

  it("applies breaks exactly at the boundary", () => {
    expect(resolveDecorationPrice(cells, 24, 1)?.toString()).toBe("2.75");
    expect(resolveDecorationPrice(cells, 23, 1)?.toString()).toBe("3.5");
  });

  it("uses the top break for very large quantities", () => {
    expect(resolveDecorationPrice(cells, 10000, 1)?.toString()).toBe("1.4");
  });

  it("returns null below the lowest break", () => {
    expect(resolveDecorationPrice(cells, 11, 1)).toBeNull();
  });

  it("returns null for a tier the grid doesn't have", () => {
    expect(resolveDecorationPrice(cells, 100, 6)).toBeNull();
  });

  it("returns null for zero/negative/fractional quantities", () => {
    expect(resolveDecorationPrice(cells, 0, 1)).toBeNull();
    expect(resolveDecorationPrice(cells, -5, 1)).toBeNull();
    expect(resolveDecorationPrice(cells, 12.5, 1)).toBeNull();
  });
});

const rules = [
  { minCost: "0", multiplier: "2.5" },
  { minCost: "5.00", multiplier: "2.2" },
  { minCost: "15.00", multiplier: "1.8" },
];

describe("applyMarkup", () => {
  it("applies the tier for the cost range", () => {
    expect(applyMarkup("3.20", rules).toString()).toBe("8");
    expect(applyMarkup("6.00", rules).toString()).toBe("13.2");
  });

  it("applies tiers exactly at the boundary", () => {
    // 5.00 hits the ×2.2 tier, not ×2.5
    expect(applyMarkup("5.00", rules).toString()).toBe("11");
    expect(applyMarkup("4.99", rules).toString()).toBe("12.48"); // 12.475 -> 12.48
  });

  it("uses the top tier above all boundaries", () => {
    expect(applyMarkup("20.00", rules).toString()).toBe("36");
  });

  it("rounds the sell price to cents, half-up", () => {
    // 3.33 * 2.5 = 8.325 -> 8.33
    expect(applyMarkup("3.33", rules).toString()).toBe("8.33");
  });

  it("passes cost through when no rule applies", () => {
    expect(applyMarkup("4.37", []).toString()).toBe("4.37");
  });

  it("handles zero cost", () => {
    expect(applyMarkup("0", rules).toString()).toBe("0");
  });

  it("rejects negative costs", () => {
    expect(() => applyMarkup("-1", rules)).toThrow();
  });
});

describe("priceLine", () => {
  it("adds decoration and marked-up garment per piece", () => {
    const res = priceLine({
      cells,
      markupRules: rules,
      quantity: 48,
      tier: 2,
      garmentCost: "3.20", // -> 8.00 sell
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.decorationUnit.toString()).toBe("2.65");
      expect(res.garmentUnit.toString()).toBe("8");
      expect(res.unitPrice.toString()).toBe("10.65");
    }
  });

  it("prices decoration-only lines when no garment cost given", () => {
    const res = priceLine({
      cells,
      markupRules: rules,
      quantity: 100,
      tier: 1,
      garmentCost: null,
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.garmentUnit.toString()).toBe("0");
      expect(res.unitPrice.toString()).toBe("1.75");
    }
  });

  it("fails cleanly when the grid can't price the line", () => {
    const res = priceLine({
      cells,
      markupRules: rules,
      quantity: 5,
      tier: 1,
    });
    expect(res.ok).toBe(false);
  });
});
