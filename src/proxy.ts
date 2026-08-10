import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";

// Paths reachable without a staff login. The customer portal authenticates
// with its own per-customer token, so it (and its file/api routes) stays open.
const PUBLIC_PREFIXES = ["/login", "/portal", "/api/portal"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const uid = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  if (uid) return NextResponse.next();

  // Unauthenticated: 401 for API/data routes, redirect to login for pages.
  // This also covers server-action POSTs, which target admin page routes.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = `next=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Run on everything except Next internals and static asset files.
  //
  // api/stripe/webhook is excluded rather than added to PUBLIC_PREFIXES: it
  // authenticates by Stripe signature, not by session, and keeping the proxy
  // off it avoids Next buffering a copy of the request body (which is
  // truncated past 10MB *without failing* — that would silently break
  // signature verification). Excluding the exact path also means a future
  // /api/stripe/* route doesn't inherit public access by accident.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/stripe/webhook|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
