"use server";

import { revalidatePath } from "next/cache";

import type { JobStatus } from "@/generated/prisma/client";
import { canTransition, isTerminal } from "@/lib/production";
import { prisma } from "@/lib/prisma";
import { jobScheduleInput } from "@/lib/validation";

import type { ActionResult } from "./customers";

// A quote must be at least this far along before it can go into production.
const PRODUCIBLE = ["APPROVED", "CONVERTED"];

/** Create the production job for an approved/converted quote (one per quote). */
export async function createJobFromQuote(
  quoteId: string,
): Promise<ActionResult> {
  try {
    const quote = await prisma.quote.findUnique({
      where: { id: quoteId },
      include: { job: { select: { id: true } } },
    });
    if (!quote) return { ok: false, error: "Quote not found" };
    if (quote.job) return { ok: true, id: quote.job.id }; // already in production
    if (!PRODUCIBLE.includes(quote.status)) {
      return {
        ok: false,
        error: "Only approved quotes can go into production",
      };
    }

    const job = await prisma.job.create({ data: { quoteId } });
    revalidateJob(job.id);
    return { ok: true, id: job.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function moveJob(
  jobId: string,
  to: JobStatus,
): Promise<ActionResult> {
  try {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) return { ok: false, error: "Job not found" };
    if (!canTransition(job.status, to)) {
      return { ok: false, error: "That isn't a valid next step" };
    }

    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: to,
        // Stamp completion the first time it ships; clear it if moved back.
        completedAt: isTerminal(to)
          ? (job.completedAt ?? new Date())
          : job.status === "SHIPPED"
            ? null
            : job.completedAt,
      },
    });
    revalidateJob(jobId);
    return { ok: true, id: jobId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function updateJobSchedule(
  jobId: string,
  raw: unknown,
): Promise<ActionResult> {
  const parsed = jobScheduleInput.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  try {
    await prisma.job.update({
      where: { id: jobId },
      data: {
        priority: parsed.data.priority,
        assignee: parsed.data.assignee ?? null,
        notes: parsed.data.notes ?? null,
        dueDate: parsed.data.dueDate
          ? new Date(`${parsed.data.dueDate}T00:00:00`)
          : null,
      },
    });
    revalidateJob(jobId);
    return { ok: true, id: jobId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function deleteJob(jobId: string): Promise<ActionResult> {
  try {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) return { ok: false, error: "Job not found" };
    await prisma.job.delete({ where: { id: jobId } });
    revalidatePath("/production");
    revalidatePath(`/quotes/${job.quoteId}`);
    return { ok: true, id: job.quoteId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

function revalidateJob(jobId: string) {
  revalidatePath("/production");
  revalidatePath(`/production/${jobId}`);
  revalidatePath("/quotes");
}
