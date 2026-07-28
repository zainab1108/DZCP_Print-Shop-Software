import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";

import { SESSION_COOKIE, verifySession } from "./session";

/**
 * The logged-in staff user for the current request, or null. Reads the signed
 * session cookie, verifies it, then loads the user. Used by the admin layout
 * (display) — the proxy is what actually gates access.
 */
export async function getCurrentUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const uid = await verifySession(token);
  if (!uid) return null;
  return prisma.user.findUnique({
    where: { id: uid },
    select: { id: true, email: true, name: true, role: true },
  });
}

/**
 * For admin-only pages: returns the user if they're an ADMIN, otherwise
 * redirects to the dashboard. (The proxy already ensures they're logged in.)
 */
export async function requireAdminPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") redirect("/");
  return user;
}
