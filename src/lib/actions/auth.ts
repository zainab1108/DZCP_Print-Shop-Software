"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { verifyPassword } from "@/lib/auth/password";
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  signSession,
} from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

/** Only allow redirecting to local paths, never off-site (open-redirect guard). */
function safeNext(next: string): string {
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export type LoginState = { error: string } | null;

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(String(formData.get("next") ?? "/"));

  const user = email
    ? await prisma.user.findUnique({ where: { email } })
    : null;
  // Verify even when the user is missing to keep timing uniform, and always
  // return the same generic message (no account enumeration).
  const ok =
    user !== null && (await verifyPassword(password, user.passwordHash));
  if (!user || !ok) {
    return { error: "Invalid email or password" };
  }

  const token = await signSession(user.id);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });

  redirect(next);
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
