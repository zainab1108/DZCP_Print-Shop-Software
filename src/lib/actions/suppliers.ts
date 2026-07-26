"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { supplierInput } from "@/lib/validation";

import type { ActionResult } from "./customers";

export async function createSupplier(raw: unknown): Promise<ActionResult> {
  const parsed = supplierInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
  }
  try {
    const s = await prisma.supplier.create({ data: parsed.data });
    revalidatePath("/inventory/suppliers");
    return { ok: true, id: s.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function updateSupplier(
  id: string,
  raw: unknown,
): Promise<ActionResult> {
  const parsed = supplierInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
  }
  try {
    await prisma.supplier.update({ where: { id }, data: parsed.data });
    revalidatePath("/inventory/suppliers");
    revalidatePath(`/inventory/suppliers/${id}`);
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function setSupplierArchived(
  id: string,
  archived: boolean,
): Promise<ActionResult> {
  try {
    await prisma.supplier.update({ where: { id }, data: { archived } });
    revalidatePath("/inventory/suppliers");
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}
