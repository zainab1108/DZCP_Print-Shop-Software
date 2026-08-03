"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";
import {
  PriceCalculator,
  type GridOption,
} from "@/components/price-calculator";
import { createInvoice, updateInvoice } from "@/lib/actions/invoices";
import { createQuote, updateQuote } from "@/lib/actions/quotes";
import { formatMoney } from "@/lib/format";

export interface LineValues {
  description: string;
  quantity: string; // kept as strings while editing
  unitPrice: string;
  taxable: boolean;
}

export interface DocumentFormValues {
  customerId: string;
  title: string;
  issueDate: string; // yyyy-mm-dd
  secondaryDate: string; // validUntil (quote) / dueDate (invoice)
  taxPercent: string;
  terms: string;
  notes: string;
  lineItems: LineValues[];
}

export interface CustomerOption {
  id: string;
  name: string;
  taxExempt: boolean;
}

const emptyLine: LineValues = {
  description: "",
  quantity: "1",
  unitPrice: "",
  taxable: true,
};

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function DocumentForm({
  kind,
  customers,
  initial,
  documentId,
  defaultCustomerId,
  grids = [],
}: {
  kind: "quote" | "invoice";
  customers: CustomerOption[];
  initial?: DocumentFormValues;
  documentId?: string;
  defaultCustomerId?: string;
  grids?: GridOption[];
}) {
  const router = useRouter();
  const [values, setValues] = useState<DocumentFormValues>(
    initial ?? {
      customerId: defaultCustomerId ?? "",
      title: "",
      issueDate: today(),
      secondaryDate: "",
      taxPercent: "",
      terms: "",
      notes: "",
      lineItems: [{ ...emptyLine }],
    },
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const set = (patch: Partial<DocumentFormValues>) =>
    setValues((v) => ({ ...v, ...patch }));

  const setLine = (i: number, patch: Partial<LineValues>) =>
    setValues((v) => ({
      ...v,
      lineItems: v.lineItems.map((l, j) => (j === i ? { ...l, ...patch } : l)),
    }));

  const customer = customers.find((c) => c.id === values.customerId);

  // Display-only preview with float math; authoritative totals are computed
  // server-side with Decimal in src/lib/money.ts (tested).
  const preview = previewTotals(values, customer?.taxExempt ?? false);

  function submit() {
    setError(null);
    const payload = {
      ...values,
      lineItems: values.lineItems.map((l) => ({
        description: l.description,
        quantity: Number(l.quantity || 0),
        unitPrice: l.unitPrice.trim(),
        taxable: l.taxable,
      })),
    };
    startTransition(async () => {
      const action = documentId
        ? kind === "quote"
          ? updateQuote(documentId, payload)
          : updateInvoice(documentId, payload)
        : kind === "quote"
          ? createQuote(payload)
          : createInvoice(payload);
      const res = await action;
      if (res.ok) {
        router.push(`/${kind}s/${res.id}`);
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
          <CardTitle>
            {kind === "quote" ? "Quote" : "Invoice"} details
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Customer *</Label>
            <Select
              value={values.customerId}
              onValueChange={(v) => set({ customerId: v ?? "" })}
              items={customers.map((c) => ({
                value: c.id,
                label: c.taxExempt ? `${c.name} (tax exempt)` : c.name,
              }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pick a customer" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                    {c.taxExempt ? " (tax exempt)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="title">Job title</Label>
            <Input
              id="title"
              value={values.title}
              onChange={(e) => set({ title: e.target.value })}
              placeholder="50 staff polos, 2-color front"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="issueDate">Issue date *</Label>
            <Input
              id="issueDate"
              type="date"
              value={values.issueDate}
              onChange={(e) => set({ issueDate: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="secondaryDate">
              {kind === "quote" ? "Valid until" : "Due date"}
            </Label>
            <Input
              id="secondaryDate"
              type="date"
              value={values.secondaryDate}
              onChange={(e) => set({ secondaryDate: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="taxPercent">Tax rate %</Label>
            <Input
              id="taxPercent"
              inputMode="decimal"
              value={values.taxPercent}
              onChange={(e) => set({ taxPercent: e.target.value })}
              placeholder="8.25"
            />
            {customer?.taxExempt && (
              <p className="text-muted-foreground text-xs">
                {customer.name} is tax exempt — no tax will be charged.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Line items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-64">Description</TableHead>
                  <TableHead className="w-24">Qty</TableHead>
                  <TableHead className="w-32">Unit price</TableHead>
                  <TableHead className="w-16 text-center">Tax</TableHead>
                  <TableHead className="w-28 text-right">Total</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {values.lineItems.map((line, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Input
                        value={line.description}
                        onChange={(e) =>
                          setLine(i, { description: e.target.value })
                        }
                        placeholder="Gildan 5000 tee, 2-color front print"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        inputMode="numeric"
                        value={line.quantity}
                        onChange={(e) =>
                          setLine(i, { quantity: e.target.value })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        inputMode="decimal"
                        value={line.unitPrice}
                        onChange={(e) =>
                          setLine(i, { unitPrice: e.target.value })
                        }
                        placeholder="8.50"
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Checkbox
                        checked={line.taxable}
                        onCheckedChange={(c) =>
                          setLine(i, { taxable: c === true })
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(lineTotal(line))}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {grids.length > 0 && (
                          <PriceCalculator
                            grids={grids}
                            initialQuantity={line.quantity}
                            onApply={(v) =>
                              setLine(i, {
                                quantity: v.quantity,
                                unitPrice: v.unitPrice,
                              })
                            }
                            onAddSetupFeeLine={(v) =>
                              set({
                                lineItems: [
                                  ...values.lineItems,
                                  {
                                    description: v.description,
                                    quantity: "1",
                                    unitPrice: v.unitPrice,
                                    taxable: true,
                                  },
                                ],
                              })
                            }
                          />
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={values.lineItems.length === 1}
                          onClick={() =>
                            set({
                              lineItems: values.lineItems.filter(
                                (_, j) => j !== i,
                              ),
                            })
                          }
                        >
                          ✕
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              set({ lineItems: [...values.lineItems, { ...emptyLine }] })
            }
          >
            + Add line
          </Button>

          <div className="ml-auto w-full max-w-xs space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="tabular-nums">
                {formatMoney(preview.subtotal)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax</span>
              <span className="tabular-nums">{formatMoney(preview.tax)}</span>
            </div>
            <div className="flex justify-between font-medium">
              <span>Total</span>
              <span className="tabular-nums">{formatMoney(preview.total)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="terms">Terms (shown to customer)</Label>
            <Textarea
              id="terms"
              value={values.terms}
              onChange={(e) => set({ terms: e.target.value })}
              rows={3}
            />
          </div>
          <div className="space-y-2">
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

      {error && <p className="text-destructive text-sm">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : documentId ? "Save changes" : `Create ${kind}`}
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

function lineTotal(line: LineValues): number {
  const qty = Number(line.quantity || 0);
  const price = Number(line.unitPrice || 0);
  if (!Number.isFinite(qty) || !Number.isFinite(price)) return 0;
  return Math.round(qty * price * 100) / 100;
}

function previewTotals(values: DocumentFormValues, taxExempt: boolean) {
  const totals = values.lineItems.map(lineTotal);
  const subtotal = totals.reduce((a, b) => a + b, 0);
  const taxableBase = values.lineItems.reduce(
    (sum, l, i) => (l.taxable ? sum + totals[i] : sum),
    0,
  );
  const rate = Number(values.taxPercent || 0) / 100;
  const tax =
    taxExempt || !Number.isFinite(rate) || rate <= 0
      ? 0
      : Math.round(taxableBase * rate * 100) / 100;
  return { subtotal, tax, total: subtotal + tax };
}
