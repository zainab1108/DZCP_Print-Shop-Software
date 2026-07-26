"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createSupplier, updateSupplier } from "@/lib/actions/suppliers";

export interface SupplierValues {
  name: string;
  email: string;
  phone: string;
  website: string;
  account: string;
  notes: string;
}

const empty: SupplierValues = {
  name: "",
  email: "",
  phone: "",
  website: "",
  account: "",
  notes: "",
};

export function SupplierForm({
  supplierId,
  initial,
}: {
  supplierId?: string;
  initial?: SupplierValues;
}) {
  const router = useRouter();
  const [values, setValues] = useState<SupplierValues>(initial ?? empty);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const set = (patch: Partial<SupplierValues>) =>
    setValues((v) => ({ ...v, ...patch }));

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = supplierId
        ? await updateSupplier(supplierId, values)
        : await createSupplier(values);
      if (res.ok) router.push("/inventory/suppliers");
      else setError(res.error);
    });
  }

  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="sup-name">Name *</Label>
        <Input
          id="sup-name"
          value={values.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="SanMar"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="sup-email">Email</Label>
        <Input
          id="sup-email"
          value={values.email}
          onChange={(e) => set({ email: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="sup-phone">Phone</Label>
        <Input
          id="sup-phone"
          value={values.phone}
          onChange={(e) => set({ phone: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="sup-website">Website</Label>
        <Input
          id="sup-website"
          value={values.website}
          onChange={(e) => set({ website: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="sup-account">Account #</Label>
        <Input
          id="sup-account"
          value={values.account}
          onChange={(e) => set({ account: e.target.value })}
        />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="sup-notes">Notes</Label>
        <Textarea
          id="sup-notes"
          value={values.notes}
          onChange={(e) => set({ notes: e.target.value })}
          rows={2}
        />
      </div>
      {error && (
        <p className="text-destructive text-sm sm:col-span-2">{error}</p>
      )}
      <div className="flex gap-3 sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : supplierId ? "Save changes" : "Add supplier"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={pending}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
