import { describe, expect, it } from "vitest";

import { isLastAdmin } from "./roles";

describe("isLastAdmin", () => {
  const users = [
    { id: "a", role: "ADMIN" as const },
    { id: "b", role: "STAFF" as const },
    { id: "c", role: "STAFF" as const },
  ];

  it("is true for the sole admin", () => {
    expect(isLastAdmin(users, "a")).toBe(true);
  });

  it("is false when another admin exists", () => {
    const twoAdmins = [...users, { id: "d", role: "ADMIN" as const }];
    expect(isLastAdmin(twoAdmins, "a")).toBe(false);
    expect(isLastAdmin(twoAdmins, "d")).toBe(false);
  });

  it("is false for a staff member (not an admin at all)", () => {
    expect(isLastAdmin(users, "b")).toBe(false);
  });

  it("is false for an unknown id", () => {
    expect(isLastAdmin(users, "zzz")).toBe(false);
  });

  it("handles an empty set", () => {
    expect(isLastAdmin([], "a")).toBe(false);
  });
});
