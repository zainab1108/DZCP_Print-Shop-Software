import "server-only";

import { getCurrentUser } from "./current-user";

/**
 * Admin guard for server actions (mutations). Returns an error result the
 * action can return directly; the page-level `requireAdminPage` handles reads.
 */
export async function requireAdminAction(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in" };
  if (user.role !== "ADMIN") {
    return { ok: false, error: "Only admins can do that" };
  }
  return { ok: true };
}
