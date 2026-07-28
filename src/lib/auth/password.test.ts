import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "./password";

describe("hashPassword / verifyPassword", () => {
  it("verifies a correct password", async () => {
    const stored = await hashPassword("correct horse battery");
    expect(await verifyPassword("correct horse battery", stored)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const stored = await hashPassword("correct horse battery");
    expect(await verifyPassword("wrong password xyz", stored)).toBe(false);
  });

  it("uses a random salt, so equal passwords hash differently", async () => {
    const a = await hashPassword("same-password-1");
    const b = await hashPassword("same-password-1");
    expect(a).not.toBe(b);
    expect(await verifyPassword("same-password-1", a)).toBe(true);
    expect(await verifyPassword("same-password-1", b)).toBe(true);
  });

  it("rejects too-short passwords at hash time", async () => {
    await expect(hashPassword("short")).rejects.toThrow();
  });

  it("returns false for a malformed stored value", async () => {
    expect(await verifyPassword("whatever", "not-a-valid-hash")).toBe(false);
    expect(await verifyPassword("whatever", "")).toBe(false);
  });
});
