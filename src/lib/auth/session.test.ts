import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { signSession, verifySession } from "./session";

const OLD = process.env.AUTH_SECRET;
beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret-at-least-16-chars-long";
});
afterAll(() => {
  process.env.AUTH_SECRET = OLD;
});

describe("signSession / verifySession", () => {
  it("round-trips a valid token", async () => {
    const token = await signSession("user_123");
    expect(await verifySession(token)).toBe("user_123");
  });

  it("rejects null / empty / malformed tokens", async () => {
    expect(await verifySession(null)).toBeNull();
    expect(await verifySession("")).toBeNull();
    expect(await verifySession("no-dot-here")).toBeNull();
    expect(await verifySession("a.b.c")).toBeNull();
  });

  it("rejects a tampered payload", async () => {
    const token = await signSession("user_123");
    const [, sig] = token.split(".");
    const forged =
      Buffer.from(JSON.stringify({ uid: "admin", exp: 9999999999 })).toString(
        "base64url",
      ) +
      "." +
      sig;
    expect(await verifySession(forged)).toBeNull();
  });

  it("rejects an expired token", async () => {
    const token = await signSession("user_123", -10); // already expired
    expect(await verifySession(token)).toBeNull();
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await signSession("user_123");
    process.env.AUTH_SECRET = "a-completely-different-secret-value";
    try {
      expect(await verifySession(token)).toBeNull();
    } finally {
      process.env.AUTH_SECRET = "test-secret-at-least-16-chars-long";
    }
  });
});
