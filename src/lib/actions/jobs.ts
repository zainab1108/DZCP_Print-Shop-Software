"use server";

import { revalidatePath } from "next/cache";

import type { JobStatus } from "@/generated/prisma/client";
import { canTransition, isTerminal } from "@/lib/production";
import { prisma } from "@/lib/prisma";
import { jobScheduleInput } from "@/lib/validation";

import type { ActionResult } from "./customers";

// A sales order must be at least this far along before it can go into production.
const PRODUCIBLE = ["CONFIRMED", "INVOICED"];

/** Create the production job for a confirmed sales order (one per order). */
export async function createJobFromSalesOrder(
  salesOrderId: string,
): Promise<ActionResult> {
  try {
    const salesOrder = await prisma.salesOrder.findUnique({
      where: { id: salesOrderId },
      include: { job: { select: { id: true } } },
    });
    if (!salesOrder) return { ok: false, error: "Sales order not found" };
    if (salesOrder.job) return { ok: true, id: salesOrder.job.id }; // already in production
    if (!PRODUCIBLE.includes(salesOrder.status)) {
      return {
        ok: false,
        error: "Only confirmed sales orders can go into production",
      };
    }

    const job = await prisma.job.create({ data: { salesOrderId } });
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
    revalidatePath(`/sales-orders/${job.salesOrderId}`);
    return { ok: true, id: job.salesOrderId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

function revalidateJob(jobId: string) {
  revalidatePath("/production");
  revalidatePath(`/production/${jobId}`);
  revalidatePath("/sales-orders");
}
