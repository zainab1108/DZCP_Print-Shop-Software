import type { Carrier, ShipmentStatus } from "@/generated/prisma/client";

export const CARRIER_LABELS: Record<Carrier, string> = {
  UPS: "UPS",
  USPS: "USPS",
  FEDEX: "FedEx",
  DHL: "DHL",
  OTHER: "Other",
};

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  PENDING: "Pending",
  SHIPPED: "Shipped",
  IN_TRANSIT: "In transit",
  DELIVERED: "Delivered",
  RETURNED: "Returned",
};

// Public tracking-page URL templates. {n} is replaced with the (encoded)
// tracking number. Deep links only — no carrier API is called.
const TRACKING_TEMPLATES: Partial<Record<Carrier, string>> = {
  UPS: "https://www.ups.com/track?tracknum={n}",
  USPS: "https://tools.usps.com/go/TrackConfirmAction?tLabels={n}",
  FEDEX: "https://www.fedex.com/fedextrack/?trknbr={n}",
  DHL: "https://www.dhl.com/us-en/home/tracking.html?tracking-id={n}",
};

/**
 * Build a customer-facing tracking URL from a carrier and tracking number.
 * Returns null when the number is blank or the carrier has no public
 * template (e.g. OTHER). The number is URL-encoded.
 */
export function trackingUrl(
  carrier: Carrier,
  trackingNumber: string | null | undefined,
): string | null {
  const num = trackingNumber?.trim();
  if (!num) return null;
  const template = TRACKING_TEMPLATES[carrier];
  if (!template) return null;
  return template.replace("{n}", encodeURIComponent(num));
}

// Ordered shipment lifecycle; RETURNED is an exceptional end state reachable
// from any active status, not part of the linear flow.
const FLOW: ShipmentStatus[] = [
  "PENDING",
  "SHIPPED",
  "IN_TRANSIT",
  "DELIVERED",
];

export const SHIPMENT_STATUS_OPTIONS: ShipmentStatus[] = [...FLOW, "RETURNED"];

/** A shipment counts as gone once it's shipped (or beyond). */
export function isDispatched(status: ShipmentStatus): boolean {
  return (
    status === "SHIPPED" || status === "IN_TRANSIT" || status === "DELIVERED"
  );
}
