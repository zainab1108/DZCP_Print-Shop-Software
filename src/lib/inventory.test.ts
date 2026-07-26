import { describe, expect, it } from "vitest";

import {
  applyStockDelta,
  derivePoStatus,
  inventoryValue,
  isLowStock,
  outstandingQty,
  poLineTotal,
  poTotal,
} from "./inventory";

describe("poLineTotal", () => {
  it("multiplies quantity by unit cost, rounding to cents", () => {
    expect(poLineTotal(24, "3.50").toString()).toBe("84");
    // 3 x 0.3333 = 0.9999 -> 1.00
    expect(poLineTotal(3, "0.3333").toString()).toBe("1");
  });

  it("avoids float drift", () => {
    expect(poLineTotal(3, "0.1").toString()).toBe("0.3");
  });

  it("rejects negative or fractional quantities", () => {
    expect(() => poLineTotal(-1, "1")).toThrow();
    expect(() => poLineTotal(1.5, "1")).toThrow();
  });
});

describe("poTotal", () => {
  it("sums line totals", () => {
    const t = poTotal([
      { quantity: 24, unitCost: "3.50" }, // 84.00
      { quantity: 12, unitCost: "5.25" }, // 63.00
      { quantity: 1, unitCost: "9.99" }, // 9.99
    ]);
    expect(t.toString()).toBe("156.99");
  });

  it("is zero for no lines", () => {
    expect(poTotal([]).toString()).toBe("0");
  });
});

describe("inventoryValue", () => {
  it("sums quantity x cost across items", () => {
    const v = inventoryValue([
      { quantityOnHand: 100, unitCost: "2.50" }, // 250
      { quantityOnHand: 40, unitCost: "0.1275" }, // 5.10
    ]);
    expect(v.toString()).toBe("255.1");
  });

  it("is zero for empty inventory", () => {
    expect(inventoryValue([]).toString()).toBe("0");
  });
});

describe("isLowStock", () => {
  it("is true at or below the reorder point", () => {
    expect(isLowStock({ quantityOnHand: 5, reorderPoint: 10 })).toBe(true);
    expect(isLowStock({ quantityOnHand: 10, reorderPoint: 10 })).toBe(true);
    expect(isLowStock({ quantityOnHand: 11, reorderPoint: 10 })).toBe(false);
  });
});

describe("applyStockDelta", () => {
  it("adds and removes stock", () => {
    expect(applyStockDelta(10, 5)).toEqual({ ok: true, newOnHand: 15 });
    expect(applyStockDelta(10, -4)).toEqual({ ok: true, newOnHand: 6 });
  });

  it("allows reducing to exactly zero", () => {
    expect(applyStockDelta(4, -4)).toEqual({ ok: true, newOnHand: 0 });
  });

  it("rejects going negative", () => {
    expect(applyStockDelta(3, -5).ok).toBe(false);
  });

  it("rejects zero and fractional deltas", () => {
    expect(applyStockDelta(10, 0).ok).toBe(false);
    expect(applyStockDelta(10, 1.5).ok).toBe(false);
  });
});

describe("derivePoStatus", () => {
  const lines = [
    { quantity: 24, quantityReceived: 0 },
    { quantity: 12, quantityReceived: 0 },
  ];

  it("is ORDERED when nothing received", () => {
    expect(derivePoStatus("ORDERED", lines)).toBe("ORDERED");
  });

  it("is PARTIALLY_RECEIVED when some received", () => {
    expect(
      derivePoStatus("ORDERED", [
        { quantity: 24, quantityReceived: 24 },
        { quantity: 12, quantityReceived: 0 },
      ]),
    ).toBe("PARTIALLY_RECEIVED");
  });

  it("is RECEIVED when all received", () => {
    expect(
      derivePoStatus("PARTIALLY_RECEIVED", [
        { quantity: 24, quantityReceived: 24 },
        { quantity: 12, quantityReceived: 12 },
      ]),
    ).toBe("RECEIVED");
  });

  it("treats over-receipt as RECEIVED", () => {
    expect(
      derivePoStatus("ORDERED", [{ quantity: 10, quantityReceived: 12 }]),
    ).toBe("RECEIVED");
  });

  it("never changes DRAFT or CANCELLED", () => {
    expect(derivePoStatus("DRAFT", lines)).toBe("DRAFT");
    expect(
      derivePoStatus("CANCELLED", [{ quantity: 10, quantityReceived: 10 }]),
    ).toBe("CANCELLED");
  });
});

describe("outstandingQty", () => {
  it("is the unreceived remainder, floored at zero", () => {
    expect(outstandingQty({ quantity: 24, quantityReceived: 10 })).toBe(14);
    expect(outstandingQty({ quantity: 24, quantityReceived: 24 })).toBe(0);
    expect(outstandingQty({ quantity: 24, quantityReceived: 30 })).toBe(0);
  });
});
