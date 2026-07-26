import { describe, expect, it } from "vitest";

import { isDispatched, trackingUrl } from "./shipping";

describe("trackingUrl", () => {
  it("builds carrier deep links", () => {
    expect(trackingUrl("UPS", "1Z999AA10123456784")).toBe(
      "https://www.ups.com/track?tracknum=1Z999AA10123456784",
    );
    expect(trackingUrl("USPS", "9400111899223197428490")).toBe(
      "https://tools.usps.com/go/TrackConfirmAction?tLabels=9400111899223197428490",
    );
    expect(trackingUrl("FEDEX", "123456789012")).toBe(
      "https://www.fedex.com/fedextrack/?trknbr=123456789012",
    );
  });

  it("url-encodes the tracking number", () => {
    expect(trackingUrl("UPS", "1Z 999 AA")).toBe(
      "https://www.ups.com/track?tracknum=1Z%20999%20AA",
    );
  });

  it("trims surrounding whitespace", () => {
    expect(trackingUrl("FEDEX", "  123  ")).toBe(
      "https://www.fedex.com/fedextrack/?trknbr=123",
    );
  });

  it("returns null for a blank number", () => {
    expect(trackingUrl("UPS", "")).toBeNull();
    expect(trackingUrl("UPS", "   ")).toBeNull();
    expect(trackingUrl("UPS", null)).toBeNull();
    expect(trackingUrl("UPS", undefined)).toBeNull();
  });

  it("returns null for carriers without a public template", () => {
    expect(trackingUrl("OTHER", "123")).toBeNull();
  });
});

describe("isDispatched", () => {
  it("is true once shipped or beyond", () => {
    expect(isDispatched("SHIPPED")).toBe(true);
    expect(isDispatched("IN_TRANSIT")).toBe(true);
    expect(isDispatched("DELIVERED")).toBe(true);
  });

  it("is false for pending and returned", () => {
    expect(isDispatched("PENDING")).toBe(false);
    expect(isDispatched("RETURNED")).toBe(false);
  });
});
