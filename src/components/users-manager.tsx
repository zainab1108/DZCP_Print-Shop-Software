"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Role } from "@/generated/prisma/client";
import {
  createUser,
  deleteUser,
  resetUserPassword,
  updateUserRole,
} from "@/lib/actions/users";
import { formatDate } from "@/lib/format";
import { ROLE_LABELS, ROLES } from "@/lib/auth/roles";

export interface StaffRow {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  createdAt: string;
}

export function UsersManager({
  users,
  currentUserId,
}: {
  users: StaffRow[];
  currentUserId: string;
}) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Staff</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="w-40">Role</TableHead>
                <TableHead>Added</TableHead>
                <TableHead className="w-48" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <UserRow key={u.id} user={u} isSelf={u.id === currentUserId} />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AddUserForm />
    </div>
  );
}

function UserRow({ user, isSelf }: { user: StaffRow; isSelf: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      setError(null);
      const res = await fn();
      if (res.ok) router.refresh();
      else setError(res.error ?? "Failed");
    });

  function resetPassword() {
    const pw = prompt(`Set a new password for ${user.email} (min 8 chars):`);
    if (pw === null) return;
    run(() => resetUserPassword(user.id, pw));
  }

  function remove() {
    if (confirm(`Delete ${user.email}? This can't be undone.`)) {
      run(() => deleteUser(user.id));
    }
  }

  return (
    <TableRow>
      <TableCell className="font-medium">
        {user.email}
        {isSelf && <span className="text-muted-foreground"> (you)</span>}
      </TableCell>
      <TableCell>{user.name ?? "—"}</TableCell>
      <TableCell>
        <Select
          value={user.role}
          onValueChange={(v) =>
            v && run(() => updateUserRole(user.id, v as Role))
          }
          items={ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLES.map((r) => (
              <SelectItem key={r} value={r}>
                {ROLE_LABELS[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>{formatDate(user.createdAt)}</TableCell>
      <TableCell>
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={resetPassword}
          >
            Reset password
          </Button>
          {!isSelf && (
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={remove}
            >
              Delete
            </Button>
          )}
        </div>
        {error && (
          <p className="text-destructive text-right text-xs">{error}</p>
        )}
      </TableCell>
    </TableRow>
  );
}

function AddUserForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("STAFF");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await createUser({ email, name, role, password });
      if (res.ok) {
        setEmail("");
        setName("");
        setPassword("");
        setRole("STAFF");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Add staff member</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="nu-email">Email *</Label>
            <Input
              id="nu-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nu-name">Name</Label>
            <Input
              id="nu-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Select
              value={role}
              onValueChange={(v) => setRole((v ?? "STAFF") as Role)}
              items={ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="nu-password">Initial password *</Label>
            <Input
              id="nu-password"
              type="text"
              autoComplete="off"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 8 characters — share it with them"
              required
            />
          </div>
          {error && (
            <p className="text-destructive text-sm sm:col-span-2">{error}</p>
          )}
          <div className="sm:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Adding…" : "Add staff member"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
