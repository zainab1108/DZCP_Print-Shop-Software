import { UsersManager } from "@/components/users-manager";
import { requireAdminPage } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const admin = await requireAdminPage();

  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { email: "asc" }],
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Staff & roles</h1>
        <p className="text-muted-foreground text-sm">
          Admins manage users and pricing; staff can do everything else.
        </p>
      </div>
      <UsersManager
        currentUserId={admin.id}
        users={users.map((u) => ({
          id: u.id,
          email: u.email,
          name: u.name,
          role: u.role,
          createdAt: u.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
