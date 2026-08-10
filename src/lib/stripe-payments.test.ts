import { describe, expect, it } from "vitest";

import { Prisma } from "@/generated/prisma/client";

import {
  canPayOnline,
  fromStripeAmount,
  STRIPE_MAX_CENTS,
  toStripeAmount,
} from "./stripe-payments";

const { Decimal } = Prisma;

describe("toStripeAmount", () => {
  it("converts dollars to integer cents", () => {
    expect(toStripeAmount("12.34")).toBe(1234);
    expect(toStripeAmount("100")).toBe(10000);
    expect(toStripeAmount("0.50")).toBe(50);
  });

  it("converts without float drift", () => {
    expect(toStripeAmount(new Decimal("0.1").add("0.2"))).toBe(30);
    expect(toStripeAmount("485.06")).toBe(48506);
  });

  it("accepts the largest amount Stripe allows", () => {
    expect(toStripeAmount("999999.99")).toBe(STRIPE_MAX_CENTS);
  });

  it("rejects amounts above the Stripe maximum", () => {
    expect(() => toStripeAmount("1000000.00")).toThrow(/maximum/);
  });

  it("rejects sub-cent precision rather than rounding", () => {
    expect(() => toStripeAmount("1.005")).toThrow(/sub-cent/);
  });

  it("rejects zero, negatives, and garbage", () => {
    expect(() => toStripeAmount("0")).toThrow();
    expect(() => toStripeAmount("-5")).toThrow();
    expect(() => toStripeAmount(Number.NaN)).toThrow();
  });
});

describe("fromStripeAmount", () => {
  it("converts integer cents to a money string", () => {
    expect(fromStripeAmount(1234)).toBe("12.34");
    expect(fromStripeAmount(5)).toBe("0.05");
    expect(fromStripeAmount(100)).toBe("1.00");
    expect(fromStripeAmount(0)).toBe("0.00");
  });

  it("rejects non-integer and negative amounts", () => {
    expect(() => fromStripeAmount(12.5)).toThrow(/integer/);
    expect(() => fromStripeAmount(-1)).toThrow(/negative/);
  });
});

describe("stripe amount round-trip", () => {
  // The test that actually catches a broken conversion.
  it("survives a round trip for representative money values", () => {
    const values = [
      "0.50",
      "1.00",
      "9.99",
      "12.34",
      "100.00",
      "485.06",
      "663.26",
      "1684.62",
      "999999.99",
    ];
    for (const v of values) {
      expect(fromStripeAmount(toStripeAmount(v))).toBe(new Decimal(v).toFixed(2));
    }
  });
});

describe("canPayOnline", () => {
  it("allows payable statuses with a real balance", () => {
    expect(canPayOnline("SENT", "100.00")).toBe(true);
    expect(canPayOnline("PARTIALLY_PAID", "50.00")).toBe(true);
    expect(canPayOnline("OVERDUE", "50.00")).toBe(true);
  });

  it("refuses statuses that shouldn't take money", () => {
    expect(canPayOnline("DRAFT", "100.00")).toBe(false);
    expect(canPayOnline("PAID", "100.00")).toBe(false);
    expect(canPayOnline("VOID", "100.00")).toBe(false);
  });

  it("refuses a zero balance", () => {
    expect(canPayOnline("SENT", "0")).toBe(false);
  });

  it("refuses a negative (credit) balance", () => {
    // An overpaid invoice must never offer a Pay button.
    expect(canPayOnline("SENT", "-5.00")).toBe(false);
  });

  it("refuses balances below the Stripe minimum", () => {
    expect(canPayOnline("SENT", "0.49")).toBe(false);
    expect(canPayOnline("SENT", "0.50")).toBe(true);
  });

  it("refuses balances above the Stripe maximum", () => {
    expect(canPayOnline("SENT", "1000000.00")).toBe(false);
    expect(canPayOnline("SENT", "999999.99")).toBe(true);
  });
});
