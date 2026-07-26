import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

// Local disk storage for proof files, kept outside src/ and outside
// public/ so files are never served except through the authenticated
// route handlers in src/app/api/proofs.
const PROOFS_DIR = path.join(process.cwd(), "uploads", "proofs");

function proofPath(id: string, ext: string): string {
  // id is always a Prisma cuid we generated; ext comes from our own
  // canonical allow-list (see src/lib/proofs.ts) — neither is user path input.
  return path.join(PROOFS_DIR, `${id}.${ext}`);
}

export async function saveProofFile(
  id: string,
  ext: string,
  bytes: Buffer,
): Promise<void> {
  await mkdir(PROOFS_DIR, { recursive: true });
  await writeFile(proofPath(id, ext), bytes);
}

export async function readProofFile(id: string, ext: string): Promise<Buffer> {
  return readFile(proofPath(id, ext));
}

export async function deleteProofFile(id: string, ext: string): Promise<void> {
  await unlink(proofPath(id, ext)).catch(() => {
    // Already gone — deleting the DB row should still succeed.
  });
}
