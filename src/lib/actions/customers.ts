"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { customerInput } from "@/lib/validation";

export type ActionResult =
  { ok: true; id: string } | { ok: false; error: string };

export async function createCustomer(raw: unknown): Promise<ActionResult> {
  const parsed = customerInput.safeParse(raw);
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  const { billingAddress, shippingAddress, ...fields } = parsed.data;

  try {
    const customer = await prisma.customer.create({
      data: {
        ...fields,
        addresses: {
          create: [
            ...(billingAddress
              ? [{ ...billingAddress, type: "BILLING" as const }]
              : []),
            ...(shippingAddress
              ? [{ ...shippingAddress, type: "SHIPPING" as const }]
              : []),
          ],
        },
      },
    });
    revalidatePath("/customers");
    return { ok: true, id: customer.id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to save",
    };
  }
}

export async function updateCustomer(
  id: string,
  raw: unknown,
): Promise<ActionResult> {
  const parsed = customerInput.safeParse(raw);
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  const { billingAddress, shippingAddress, ...fields } = parsed.data;

  try {
    await prisma.$transaction([
      prisma.address.deleteMany({ where: { customerId: id } }),
      prisma.customer.update({
        where: { id },
        data: {
          ...fields,
          addresses: {
            create: [
              ...(billingAddress
                ? [{ ...billingAddress, type: "BILLING" as const }]
                : []),
              ...(shippingAddress
                ? [{ ...shippingAddress, type: "SHIPPING" as const }]
                : []),
            ],
          },
        },
      }),
    ]);
    revalidatePath("/customers");
    revalidatePath(`/customers/${id}`);
    return { ok: true, id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to save",
    };
  }
}

export async function setCustomerArchived(
  id: string,
  archived: boolean,
): Promise<ActionResult> {
  try {
    await prisma.customer.update({ where: { id }, data: { archived } });
    revalidatePath("/customers");
    revalidatePath(`/customers/${id}`);
    return { ok: true, id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to update",
    };
  }
}
