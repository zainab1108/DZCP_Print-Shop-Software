"use server";

import { revalidatePath } from "next/cache";

import type { Role } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { getCurrentUser } from "@/lib/auth/current-user";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { isLastAdmin } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import { changePasswordInput, newUserInput } from "@/lib/validation";

import type { ActionResult } from "./customers";

/** All user-management actions require an ADMIN caller. */
async function requireAdmin(): Promise<
  { ok: true; adminId: string } | { ok: false; error: string }
> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in" };
  if (user.role !== "ADMIN") {
    return { ok: false, error: "Only admins can manage users" };
  }
  return { ok: true, adminId: user.id };
}

export async function createUser(raw: unknown): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return admin;

  const parsed = newUserInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
  }
  try {
    const user = await prisma.user.create({
      data: {
        email: parsed.data.email,
        name: parsed.data.name ?? null,
        role: parsed.data.role,
        passwordHash: await hashPassword(parsed.data.password),
      },
    });
    revalidatePath("/users");
    return { ok: true, id: user.id };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002"
          ? "That email is already in use"
          : e instanceof Error
            ? e.message
            : "Failed",
    };
  }
}

export async function updateUserRole(
  userId: string,
  role: Role,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return admin;
  try {
    // Demoting the last admin would lock everyone out of management.
    if (role !== "ADMIN") {
      const users = await prisma.user.findMany({
        select: { id: true, role: true },
      });
      if (isLastAdmin(users, userId)) {
        return { ok: false, error: "Can't demote the last admin" };
      }
    }
    await prisma.user.update({ where: { id: userId }, data: { role } });
    revalidatePath("/users");
    return { ok: true, id: userId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function resetUserPassword(
  userId: string,
  newPassword: string,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return admin;
  if (newPassword.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters" };
  }
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await hashPassword(newPassword) },
    });
    revalidatePath("/users");
    return { ok: true, id: userId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function deleteUser(userId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return admin;
  if (userId === admin.adminId) {
    return { ok: false, error: "You can't delete your own account" };
  }
  try {
    const users = await prisma.user.findMany({
      select: { id: true, role: true },
    });
    if (isLastAdmin(users, userId)) {
      return { ok: false, error: "Can't delete the last admin" };
    }
    await prisma.user.delete({ where: { id: userId } });
    revalidatePath("/users");
    return { ok: true, id: userId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

/** Self-service: any signed-in user changes their own password. */
export async function changeMyPassword(raw: unknown): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };

  const parsed = changePasswordInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
  }
  try {
    const user = await prisma.user.findUnique({ where: { id: me.id } });
    if (!user) return { ok: false, error: "Account not found" };
    const ok = await verifyPassword(
      parsed.data.currentPassword,
      user.passwordHash,
    );
    if (!ok) return { ok: false, error: "Current password is incorrect" };

    await prisma.user.update({
      where: { id: me.id },
      data: { passwordHash: await hashPassword(parsed.data.newPassword) },
    });
    return { ok: true, id: me.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}
