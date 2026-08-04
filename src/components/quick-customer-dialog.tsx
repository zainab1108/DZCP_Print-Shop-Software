"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createCustomer } from "@/lib/actions/customers";

export interface CreatedCustomer {
  id: string;
  name: string;
  taxExempt: boolean;
}

/**
 * Create a customer without leaving the quote/invoice form. Captures just the
 * essentials — the full customer page handles addresses, contacts, and notes.
 */
export function QuickCustomerDialog({
  onCreated,
}: {
  onCreated: (customer: CreatedCustomer) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [taxExempt, setTaxExempt] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setName("");
    setEmail("");
    setPhone("");
    setTaxExempt(false);
    setError(null);
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await createCustomer({ name, email, phone, taxExempt });
      if (res.ok) {
        // Hand the new customer back so the form can select it immediately.
        onCreated({ id: res.id, name: name.trim(), taxExempt });
        reset();
        setOpen(false);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger
        render={
          <Button type="button" variant="outline" size="sm">
            + New
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New customer</DialogTitle>
        </DialogHeader>
        {/* Deliberately a div, not a form: this dialog is portaled but stays
            a React-tree descendant of the quote/invoice <form>, so a nested
            form's submit would bubble into it. */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="qc-name">Name *</Label>
            <Input
              id="qc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Brewing Co."
              required
              autoFocus
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="qc-email">Email</Label>
              <Input
                id="qc-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="qc-phone">Phone</Label>
              <Input
                id="qc-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="qc-tax-exempt"
              checked={taxExempt}
              onCheckedChange={(c) => setTaxExempt(c === true)}
            />
            <Label htmlFor="qc-tax-exempt">Tax exempt</Label>
          </div>
          <p className="text-muted-foreground text-xs">
            Addresses and contacts can be added later from the customer page.
          </p>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={pending || !name.trim()}
              onClick={submit}
            >
              {pending ? "Creating…" : "Create & select"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
