import type { Role } from "@/generated/prisma/client";

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  STAFF: "Staff",
};

export const ROLES: Role[] = ["ADMIN", "STAFF"];

/**
 * True if `targetId` is the only ADMIN among `users`. Used to block deleting
 * or demoting the last admin, which would lock everyone out of user and
 * pricing management.
 */
export function isLastAdmin(
  users: { id: string; role: Role }[],
  targetId: string,
): boolean {
  const admins = users.filter((u) => u.role === "ADMIN");
  return admins.length === 1 && admins[0].id === targetId;
}
