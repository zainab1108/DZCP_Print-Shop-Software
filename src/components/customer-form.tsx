"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createCustomer, updateCustomer } from "@/lib/actions/customers";

export interface AddressValues {
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface CustomerFormValues {
  name: string;
  email: string;
  phone: string;
  website: string;
  taxExempt: boolean;
  notes: string;
  billingAddress: AddressValues;
  shippingAddress: AddressValues;
}

const emptyAddress: AddressValues = {
  line1: "",
  line2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "US",
};

const empty: CustomerFormValues = {
  name: "",
  email: "",
  phone: "",
  website: "",
  taxExempt: false,
  notes: "",
  billingAddress: emptyAddress,
  shippingAddress: emptyAddress,
};

export function CustomerForm({
  initial,
  customerId,
}: {
  initial?: CustomerFormValues;
  customerId?: string;
}) {
  const router = useRouter();
  const [values, setValues] = useState<CustomerFormValues>(initial ?? empty);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const set = (patch: Partial<CustomerFormValues>) =>
    setValues((v) => ({ ...v, ...patch }));

  function submit() {
    setError(null);
    // An address section left blank means "no address".
    const payload = {
      ...values,
      billingAddress: values.billingAddress.line1.trim()
        ? values.billingAddress
        : null,
      shippingAddress: values.shippingAddress.line1.trim()
        ? values.shippingAddress
        : null,
    };
    startTransition(async () => {
      const res = customerId
        ? await updateCustomer(customerId, payload)
        : await createCustomer(payload);
      if (res.ok) {
        router.push(`/customers/${res.id}`);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle>Customer</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={values.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="Acme Screen Printing"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={values.email}
              onChange={(e) => set({ email: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={values.phone}
              onChange={(e) => set({ phone: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              value={values.website}
              onChange={(e) => set({ website: e.target.value })}
            />
          </div>
          <div className="flex items-end gap-2 pb-2">
            <Checkbox
              id="taxExempt"
              checked={values.taxExempt}
              onCheckedChange={(c) => set({ taxExempt: c === true })}
            />
            <Label htmlFor="taxExempt">Tax exempt</Label>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="notes">Internal notes</Label>
            <Textarea
              id="notes"
              value={values.notes}
              onChange={(e) => set({ notes: e.target.value })}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <AddressFields
          title="Billing address"
          values={values.billingAddress}
          onChange={(a) => set({ billingAddress: a })}
        />
        <AddressFields
          title="Shipping address"
          values={values.shippingAddress}
          onChange={(a) => set({ shippingAddress: a })}
        />
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending
            ? "Saving…"
            : customerId
              ? "Save changes"
              : "Create customer"}
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

function AddressFields({
  title,
  values,
  onChange,
}: {
  title: string;
  values: AddressValues;
  onChange: (a: AddressValues) => void;
}) {
  const set = (patch: Partial<AddressValues>) =>
    onChange({ ...values, ...patch });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label>Street</Label>
          <Input
            value={values.line1}
            onChange={(e) => set({ line1: e.target.value })}
            placeholder="Leave blank for none"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Street 2</Label>
          <Input
            value={values.line2}
            onChange={(e) => set({ line2: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>City</Label>
          <Input
            value={values.city}
            onChange={(e) => set({ city: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>State</Label>
          <Input
            value={values.state}
            onChange={(e) => set({ state: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>ZIP</Label>
          <Input
            value={values.postalCode}
            onChange={(e) => set({ postalCode: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Country</Label>
          <Input
            value={values.country}
            onChange={(e) => set({ country: e.target.value })}
          />
        </div>
      </CardContent>
    </Card>
  );
}
