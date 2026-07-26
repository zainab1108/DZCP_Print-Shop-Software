"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { deleteProofFile, saveProofFile } from "@/lib/proof-storage";
import {
  nextProofVersion,
  safeFileName,
  validateProofUpload,
} from "@/lib/proofs";

import type { ActionResult } from "./customers";

export async function uploadProof(
  quoteId: string,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const quote = await prisma.quote.findUnique({ where: { id: quoteId } });
    if (!quote) return { ok: false, error: "Quote not found" };

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return { ok: false, error: "No file provided" };
    }

    const check = validateProofUpload({ type: file.type, size: file.size });
    if (!check.ok) return { ok: false, error: check.error };

    const existing = await prisma.proof.findMany({
      where: { quoteId },
      select: { version: true },
    });
    const version = nextProofVersion(existing.map((p) => p.version));
    const note = String(formData.get("note") ?? "").trim();

    const proof = await prisma.proof.create({
      data: {
        quoteId,
        version,
        fileName: safeFileName(file.name),
        fileExt: check.ext,
        mimeType: file.type,
        size: file.size,
        note: note || null,
      },
    });

    const bytes = Buffer.from(await file.arrayBuffer());
    try {
      await saveProofFile(proof.id, check.ext, bytes);
    } catch (e) {
      // Roll back the DB row if the file write failed — don't leave a
      // proof record pointing at a file that doesn't exist.
      await prisma.proof.delete({ where: { id: proof.id } });
      throw e;
    }

    revalidatePath(`/quotes/${quoteId}`);
    revalidatePath("/quotes");
    return { ok: true, id: proof.id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Upload failed",
    };
  }
}

export async function deleteProof(proofId: string): Promise<ActionResult> {
  try {
    const proof = await prisma.proof.findUnique({ where: { id: proofId } });
    if (!proof) return { ok: false, error: "Proof not found" };

    await prisma.proof.delete({ where: { id: proofId } });
    await deleteProofFile(proof.id, proof.fileExt);

    revalidatePath(`/quotes/${proof.quoteId}`);
    return { ok: true, id: proof.quoteId };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Delete failed",
    };
  }
}

/** Admin-side decision, e.g. recording a phone/email approval. */
export async function decideProofAsAdmin(
  proofId: string,
  decision: "APPROVED" | "CHANGES_REQUESTED",
  feedback?: string,
): Promise<ActionResult> {
  return decideProof(proofId, decision, feedback ?? null, null);
}

/**
 * Portal-side decision. The token is the credential: the proof's quote
 * must belong to the customer owning the token.
 */
export async function decideProofByToken(
  token: string,
  proofId: string,
  decision: "APPROVED" | "CHANGES_REQUESTED",
  feedback: string,
): Promise<ActionResult> {
  const customer = await prisma.customer.findUnique({
    where: { portalToken: token },
    select: { id: true },
  });
  if (!customer)
    return { ok: false, error: "This portal link is no longer valid" };

  const result = await decideProof(proofId, decision, feedback, customer.id);
  revalidatePath(`/portal/${token}`);
  return result;
}

async function decideProof(
  proofId: string,
  decision: "APPROVED" | "CHANGES_REQUESTED",
  feedback: string | null,
  requireCustomerId: string | null,
): Promise<ActionResult> {
  try {
    const proof = await prisma.proof.findUnique({
      where: { id: proofId },
      include: { quote: { select: { customerId: true } } },
    });
    if (!proof) return { ok: false, error: "Proof not found" };
    if (requireCustomerId && proof.quote.customerId !== requireCustomerId) {
      return { ok: false, error: "Proof not found" };
    }
    if (proof.status !== "PENDING") {
      return { ok: false, error: "This proof already has a decision" };
    }
    if (decision === "CHANGES_REQUESTED" && !feedback?.trim()) {
      return { ok: false, error: "Describe what needs to change" };
    }

    await prisma.proof.update({
      where: { id: proofId },
      data: {
        status: decision,
        feedback: feedback?.trim() || null,
        decidedAt: new Date(),
      },
    });

    revalidatePath(`/quotes/${proof.quoteId}`);
    revalidatePath("/quotes");
    return { ok: true, id: proof.quoteId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}
