// Pure helpers for artwork proof uploads. No fs or Prisma here — the server
// action does the I/O; this is the testable policy layer.

export const MAX_PROOF_BYTES = 20 * 1024 * 1024; // 20 MB

/**
 * Allowed upload types. Keyed by MIME type as reported by the browser; the
 * value is the canonical extension files are stored under. SVG is excluded
 * deliberately: it can carry scripts and proofs are rendered inline.
 */
const ALLOWED: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
};

export type UploadValidation =
  { ok: true; ext: string } | { ok: false; error: string };

export function validateProofUpload(file: {
  type: string;
  size: number;
}): UploadValidation {
  const ext = ALLOWED[file.type];
  if (!ext) {
    return {
      ok: false,
      error: "Unsupported file type — use PNG, JPEG, WebP, GIF, or PDF",
    };
  }
  if (file.size <= 0) {
    return { ok: false, error: "File is empty" };
  }
  if (file.size > MAX_PROOF_BYTES) {
    return {
      ok: false,
      error: `File is too large (max ${MAX_PROOF_BYTES / 1024 / 1024} MB)`,
    };
  }
  return { ok: true, ext };
}

/** Next per-quote version number: 1-based, gap-tolerant. */
export function nextProofVersion(existingVersions: number[]): number {
  return existingVersions.length === 0 ? 1 : Math.max(...existingVersions) + 1;
}

/**
 * Sanitize an original filename for a Content-Disposition header / display.
 * Strips path components and control/quote characters, caps length.
 */
export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  const cleaned = base.replace(/[\r\n"\\<>]/g, "").trim();
  return (cleaned || "file").slice(0, 120);
}
