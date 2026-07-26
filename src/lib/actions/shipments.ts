"use server";

import { revalidatePath } from "next/cache";

import { Prisma } from "@/generated/prisma/client";
import { isDispatched } from "@/lib/shipping";
import { prisma } from "@/lib/prisma";
import { shipmentInput } from "@/lib/validation";

import type { ActionResult } from "./customers";

function parse(raw: unknown) {
  const parsed = shipmentInput.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const d = parsed.data;
  return {
    ok: true as const,
    data: {
      carrier: d.carrier,
      service: d.service ?? null,
      trackingNumber: d.trackingNumber ?? null,
      status: d.status,
      cost: new Prisma.Decimal(d.cost || 0),
      weightOz: d.weightOz ? Number(d.weightOz) : null,
      shippedAt: d.shippedAt ? new Date(`${d.shippedAt}T00:00:00`) : null,
      notes: d.notes ?? null,
    },
  };
}

/**
 * Create a shipment for a job. If it's created already dispatched and the job
 * hasn't shipped yet, advance the job to SHIPPED so the board reflects reality.
 */
export async function createShipment(
  jobId: string,
  raw: unknown,
): Promise<ActionResult> {
  const parsed = parse(raw);
  if (!parsed.ok) return parsed;
  try {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) return { ok: false, error: "Job not found" };

    // Default shippedAt to today when marking dispatched without a date.
    const data = { ...parsed.data };
    if (isDispatched(data.status) && !data.shippedAt) {
      data.shippedAt = new Date();
    }

    const shipment = await prisma.shipment.create({
      data: { ...data, jobId },
    });

    if (isDispatched(data.status) && job.status !== "SHIPPED") {
      await prisma.job.update({
        where: { id: jobId },
        data: { status: "SHIPPED", completedAt: job.completedAt ?? new Date() },
      });
      revalidatePath("/production");
    }

    revalidateShipment(jobId);
    return { ok: true, id: shipment.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function updateShipmentStatus(
  shipmentId: string,
  status: "PENDING" | "SHIPPED" | "IN_TRANSIT" | "DELIVERED" | "RETURNED",
): Promise<ActionResult> {
  try {
    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
    });
    if (!shipment) return { ok: false, error: "Shipment not found" };

    await prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        status,
        // Stamp the transitions we can infer.
        shippedAt:
          isDispatched(status) && !shipment.shippedAt
            ? new Date()
            : shipment.shippedAt,
        deliveredAt:
          status === "DELIVERED"
            ? (shipment.deliveredAt ?? new Date())
            : shipment.deliveredAt,
      },
    });
    revalidateShipment(shipment.jobId);
    return { ok: true, id: shipmentId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function deleteShipment(
  shipmentId: string,
): Promise<ActionResult> {
  try {
    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
    });
    if (!shipment) return { ok: false, error: "Shipment not found" };
    await prisma.shipment.delete({ where: { id: shipmentId } });
    revalidateShipment(shipment.jobId);
    return { ok: true, id: shipment.jobId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

function revalidateShipment(jobId: string) {
  revalidatePath("/shipping");
  revalidatePath(`/production/${jobId}`);
}
