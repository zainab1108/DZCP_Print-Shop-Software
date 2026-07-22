import { describe, expect, it } from "vitest";

import {
  deriveInvoiceStatus,
  sumPayments,
  validatePaymentAmount,
} from "./payments";

describe("sumPayments", () => {
  it("sums exactly, without float drift", () => {
    const total = sumPayments([
      { amount: "0.10" },
      { amount: "0.20" },
      { amount: "0.30" },
    ]);
    expect(total.toString()).toBe("0.6");
  });

  it("returns zero for no payments", () => {
    expect(sumPayments([]).toString()).toBe("0");
  });
});

describe("deriveInvoiceStatus", () => {
  it("marks fully paid invoices PAID", () => {
    expect(deriveInvoiceStatus("SENT", "485.06", "485.06")).toBe("PAID");
  });

  it("treats overpayment as PAID", () => {
    expect(deriveInvoiceStatus("SENT", "100.00", "150.00")).toBe("PAID");
  });

  it("marks partial payments PARTIALLY_PAID", () => {
    expect(deriveInvoiceStatus("SENT", "485.06", "100.00")).toBe(
      "PARTIALLY_PAID",
    );
  });

  it("a cent short is still PARTIALLY_PAID", () => {
    expect(deriveInvoiceStatus("SENT", "485.06", "485.05")).toBe(
      "PARTIALLY_PAID",
    );
  });

  it("falls back to SENT when all payments are removed", () => {
    expect(deriveInvoiceStatus("PAID", "485.06", "0")).toBe("SENT");
    expect(deriveInvoiceStatus("PARTIALLY_PAID", "485.06", "0")).toBe("SENT");
  });

  it("never changes DRAFT or VOID", () => {
    expect(deriveInvoiceStatus("DRAFT", "100", "100")).toBe("DRAFT");
    expect(deriveInvoiceStatus("VOID", "100", "100")).toBe("VOID");
  });

  it("keeps a zero-total invoice SENT until something is paid", () => {
    expect(deriveInvoiceStatus("SENT", "0", "0")).toBe("SENT");
  });
});

describe("validatePaymentAmount", () => {
  it("accepts a valid partial payment", () => {
    expect(validatePaymentAmount("100.00", "485.06", "0")).toEqual({
      ok: true,
    });
  });

  it("accepts paying the exact balance", () => {
    expect(validatePaymentAmount("385.06", "485.06", "100.00")).toEqual({
      ok: true,
    });
  });

  it("rejects zero and negative amounts", () => {
    expect(validatePaymentAmount("0", "485.06", "0").ok).toBe(false);
    expect(validatePaymentAmount("-5", "485.06", "0").ok).toBe(false);
  });

  it("rejects overpayment by a cent", () => {
    const res = validatePaymentAmount("385.07", "485.06", "100.00");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("385.06");
  });

  it("rejects sub-cent precision", () => {
    expect(validatePaymentAmount("10.001", "485.06", "0").ok).toBe(false);
  });

  it("rejects non-numeric garbage", () => {
    expect(validatePaymentAmount(Number.NaN, "485.06", "0").ok).toBe(false);
  });
});
