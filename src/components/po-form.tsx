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
import { Textarea } from "@/components/ui/textarea";
import {
  createPurchaseOrder,
  updatePurchaseOrder,
} from "@/lib/actions/purchase-orders";
import { formatMoney } from "@/lib/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface POLineValues {
  itemId: string;
  description: string;
  quantity: string;
  unitCost: string;
}

export interface POFormValues {
  supplierId: string;
  expectedAt: string;
  notes: string;
  lines: POLineValues[];
}

export interface SupplierOption {
  id: string;
  name: string;
}

export interface ItemOption {
  id: string;
  name: string;
  unitCost: string;
}

const emptyLine: POLineValues = {
  itemId: "",
  description: "",
  quantity: "1",
  unitCost: "",
};
const NONE = "__none__";

export function POForm({
  poId,
  suppliers,
  items,
  initial,
}: {
  poId?: string;
  suppliers: SupplierOption[];
  items: ItemOption[];
  initial?: POFormValues;
}) {
  const router = useRouter();
  const [values, setValues] = useState<POFormValues>(
    initial ?? {
      supplierId: "",
      expectedAt: "",
      notes: "",
      lines: [{ ...emptyLine }],
    },
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const set = (patch: Partial<POFormValues>) =>
    setValues((v) => ({ ...v, ...patch }));
  const setLine = (i: number, patch: Partial<POLineValues>) =>
    setValues((v) => ({
      ...v,
      lines: v.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)),
    }));

  // Picking a stocked item fills description + cost from the catalog.
  function pickItem(i: number, itemId: string) {
    if (itemId === NONE) {
      setLine(i, { itemId: "" });
      return;
    }
    const item = items.find((it) => it.id === itemId);
    setLine(i, {
      itemId,
      description: item?.name ?? "",
      unitCost: item?.unitCost ?? "",
    });
  }

  const lineTotal = (l: POLineValues) => {
    const q = Number(l.quantity || 0);
    const c = Number(l.unitCost || 0);
    return Number.isFinite(q * c) ? Math.round(q * c * 100) / 100 : 0;
  };
  const total = values.lines.reduce((s, l) => s + lineTotal(l), 0);

  function submit() {
    setError(null);
    const payload = {
      supplierId: values.supplierId,
      expectedAt: values.expectedAt,
      notes: values.notes,
      lines: values.lines.map((l) => ({
        itemId: l.itemId || null,
        description: l.description,
        quantity: Number(l.quantity || 0),
        unitCost: l.unitCost.trim(),
      })),
    };
    startTransition(async () => {
      const res = poId
        ? await updatePurchaseOrder(poId, payload)
        : await createPurchaseOrder(payload);
      if (res.ok) router.push(`/purchasing/${res.id}`);
      else setError(res.error);
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
          <CardTitle>Purchase order</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Supplier *</Label>
            <Select
              value={values.supplierId}
              onValueChange={(v) => set({ supplierId: v ?? "" })}
              items={suppliers.map((s) => ({ value: s.id, label: s.name }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pick a supplier" />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="po-expected">Expected date</Label>
            <Input
              id="po-expected"
              type="date"
              value={values.expectedAt}
              onChange={(e) => set({ expectedAt: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lines</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-48">Item</TableHead>
                  <TableHead className="min-w-48">Description</TableHead>
                  <TableHead className="w-20">Qty</TableHead>
                  <TableHead className="w-28">Unit cost</TableHead>
                  <TableHead className="w-24 text-right">Total</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {values.lines.map((line, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Select
                        value={line.itemId || NONE}
                        onValueChange={(v) => pickItem(i, v ?? NONE)}
                        items={[
                          { value: NONE, label: "Custom" },
                          ...items.map((it) => ({
                            value: it.id,
                            label: it.name,
                          })),
                        ]}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>Custom</SelectItem>
                          {items.map((it) => (
                            <SelectItem key={it.id} value={it.id}>
                              {it.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        value={line.description}
                        onChange={(e) =>
                          setLine(i, { description: e.target.value })
                        }
                        placeholder="Item description"
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
                        value={line.unitCost}
                        onChange={(e) =>
                          setLine(i, { unitCost: e.target.value })
                        }
                        placeholder="3.50"
                      />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(lineTotal(line))}
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={values.lines.length === 1}
                        onClick={() =>
                          set({
                            lines: values.lines.filter((_, j) => j !== i),
                          })
                        }
                      >
                        ✕
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                set({ lines: [...values.lines, { ...emptyLine }] })
              }
            >
              + Add line
            </Button>
            <p className="text-sm font-medium">
              Total: <span className="tabular-nums">{formatMoney(total)}</span>
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2">
            <Label htmlFor="po-notes">Notes</Label>
            <Textarea
              id="po-notes"
              value={values.notes}
              onChange={(e) => set({ notes: e.target.value })}
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-destructive text-sm">{error}</p>}
      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : poId ? "Save changes" : "Create PO"}
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
