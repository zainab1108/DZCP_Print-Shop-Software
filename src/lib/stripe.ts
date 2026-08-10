import "server-only";

import Stripe from "stripe";

import { isLiveKey } from "./stripe-payments";

// Pinned so a Stripe-side default bump can't change payload shapes under us
// without a deploy. Must match the version the installed SDK's types describe
// (see node_modules/stripe/cjs/apiVersion.js) or the types drift from reality.
const API_VERSION = "2026-07-29.dahlia";

let client: Stripe | null = null;

/**
 * Lazily built — a module-level `new Stripe(...)` would throw during
 * `next build`, where the key isn't present. Mirrors the accessor pattern in
 * src/lib/auth/session.ts.
 */
export function stripe(): Stripe {
  if (client) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is missing (set it in .env)");
  }
  client = new Stripe(key, { apiVersion: API_VERSION, typescript: true });
  return client;
}

/** Fails closed: a missing secret must never fall back to an unverified body. */
export function stripeWebhookSecret(): string {
  const s = process.env.STRIPE_WEBHOOK_SECRET;
  if (!s) {
    throw new Error("STRIPE_WEBHOOK_SECRET is missing (set it in .env)");
  }
  return s;
}

/**
 * Absolute base URL for Stripe redirect targets.
 *
 * Read from env only — never from the request's Host header. The success URL
 * embeds the customer's portal token, so a spoofed Host would hand that token
 * to an attacker-controlled origin.
 */
export function appUrl(): string {
  const raw = process.env.APP_URL;
  if (!raw) throw new Error("APP_URL is missing (set it in .env)");
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("APP_URL must be an absolute URL (e.g. https://example.com)");
  }
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new Error("APP_URL must use https in production");
  }
  return url.origin;
}

/**
 * True when the configured key moves real money. See `isLiveKey` for why this
 * is derived from the key rather than NODE_ENV.
 */
export function isLiveMode(): boolean {
  return isLiveKey(process.env.STRIPE_SECRET_KEY);
}

/** Stripe online payments are only offered once the keys are configured. */
export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.APP_URL);
}
