// Stateless signed session tokens. HMAC-SHA256 over a small JSON payload,
// using Web Crypto so the same code verifies in the proxy (edge-style) and in
// server actions/components. No DB lookup needed to authenticate a request.

export const SESSION_COOKIE = "psm_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

interface SessionPayload {
  uid: string;
  exp: number; // unix seconds
}

function b64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}
// Fresh ArrayBuffer-backed views so they satisfy Web Crypto's BufferSource.
function fromB64url(s: string): Uint8Array<ArrayBuffer> {
  const buf = Buffer.from(s, "base64url");
  const out = new Uint8Array(buf.byteLength);
  out.set(buf);
  return out;
}
function enc(s: string): Uint8Array<ArrayBuffer> {
  const u = new TextEncoder().encode(s);
  const out = new Uint8Array(u.byteLength);
  out.set(u);
  return out;
}

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) {
    throw new Error("AUTH_SECRET is missing or too short (set it in .env)");
  }
  return s;
}

async function hmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    enc(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

/** Sign a session token for a user, valid for SESSION_TTL_SECONDS. */
export async function signSession(
  userId: string,
  ttlSeconds: number = SESSION_TTL_SECONDS,
): Promise<string> {
  const payload: SessionPayload = {
    uid: userId,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const body = b64url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(), enc(body));
  return `${body}.${b64url(new Uint8Array(sig))}`;
}

/**
 * Verify a token's signature and expiry. Returns the user id, or null if the
 * token is malformed, tampered, or expired.
 */
export async function verifySession(
  token: string | undefined | null,
): Promise<string | null> {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot < 1) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  let ok = false;
  try {
    ok = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(),
      fromB64url(sig),
      enc(body),
    );
  } catch {
    return null;
  }
  if (!ok) return null;

  try {
    const payload = JSON.parse(
      new TextDecoder().decode(fromB64url(body)),
    ) as SessionPayload;
    if (!payload.uid || typeof payload.exp !== "number") return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload.uid;
  } catch {
    return null;
  }
}
