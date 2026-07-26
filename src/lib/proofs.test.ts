import { describe, expect, it } from "vitest";

import {
  MAX_PROOF_BYTES,
  nextProofVersion,
  safeFileName,
  validateProofUpload,
} from "./proofs";

describe("validateProofUpload", () => {
  it("accepts allowed types and maps to canonical extensions", () => {
    expect(validateProofUpload({ type: "image/png", size: 1000 })).toEqual({
      ok: true,
      ext: "png",
    });
    expect(validateProofUpload({ type: "image/jpeg", size: 1000 })).toEqual({
      ok: true,
      ext: "jpg",
    });
    expect(
      validateProofUpload({ type: "application/pdf", size: 1000 }),
    ).toEqual({ ok: true, ext: "pdf" });
  });

  it("rejects SVG and unknown types", () => {
    expect(validateProofUpload({ type: "image/svg+xml", size: 100 }).ok).toBe(
      false,
    );
    expect(validateProofUpload({ type: "application/zip", size: 100 }).ok).toBe(
      false,
    );
    expect(validateProofUpload({ type: "", size: 100 }).ok).toBe(false);
  });

  it("rejects empty and oversized files, allows the exact cap", () => {
    expect(validateProofUpload({ type: "image/png", size: 0 }).ok).toBe(false);
    expect(
      validateProofUpload({ type: "image/png", size: MAX_PROOF_BYTES + 1 }).ok,
    ).toBe(false);
    expect(
      validateProofUpload({ type: "image/png", size: MAX_PROOF_BYTES }).ok,
    ).toBe(true);
  });
});

describe("nextProofVersion", () => {
  it("starts at 1 and increments past the max", () => {
    expect(nextProofVersion([])).toBe(1);
    expect(nextProofVersion([1, 2, 3])).toBe(4);
  });

  it("tolerates gaps from deleted versions", () => {
    expect(nextProofVersion([1, 5])).toBe(6);
  });
});

describe("safeFileName", () => {
  it("strips directory components", () => {
    expect(safeFileName("../../etc/passwd")).toBe("passwd");
    expect(safeFileName("C:\\art\\front.png")).toBe("front.png");
  });

  it("strips header-breaking characters", () => {
    expect(safeFileName('mock"up\r\n.png')).toBe("mockup.png");
  });

  it("falls back for empty results and caps length", () => {
    expect(safeFileName("///")).toBe("file");
    expect(safeFileName("a".repeat(300)).length).toBe(120);
  });
});
