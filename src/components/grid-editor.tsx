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
import type { DecorationMethod } from "@/generated/prisma/client";
import { saveGrid } from "@/lib/actions/pricing";
import {
  DECORATION_METHODS,
  DEFAULT_TIER_LABELS,
  METHOD_LABELS,
} from "@/lib/decoration-methods";

export interface GridEditorValues {
  name: string;
  method: DecorationMethod;
  tierLabel: string;
  notes: string;
  tierCount: number;
  rows: { minQuantity: string; prices: string[] }[]; // prices[i] = tier i+1
  setupFees: string[]; // one-time fee per tier (index = tier - 1); blank = none
}

const starter: GridEditorValues = {
  name: "",
  method: "SCREEN_PRINT",
  tierLabel: "Colors",
  notes: "",
  tierCount: 3,
  rows: [12, 24, 48, 72, 144].map((q) => ({
    minQuantity: String(q),
    prices: ["", "", ""],
  })),
  setupFees: ["", "", ""],
};

export function GridEditor({
  gridId,
  initial,
}: {
  gridId?: string;
  initial?: GridEditorValues;
}) {
  const router = useRouter();
  const [values, setValues] = useState<GridEditorValues>(initial ?? starter);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const set = (patch: Partial<GridEditorValues>) =>
    setValues((v) => ({ ...v, ...patch }));

  const setCell = (row: number, tierIdx: number, price: string) =>
    setValues((v) => ({
      ...v,
      rows: v.rows.map((r, i) =>
        i === row
          ? {
              ...r,
              prices: r.prices.map((p, j) => (j === tierIdx ? price : p)),
            }
          : r,
      ),
    }));

  function addTier() {
    setValues((v) => ({
      ...v,
      tierCount: v.tierCount + 1,
      rows: v.rows.map((r) => ({ ...r, prices: [...r.prices, ""] })),
      setupFees: [...v.setupFees, ""],
    }));
  }

  function removeTier() {
    setValues((v) =>
      v.tierCount <= 1
        ? v
        : {
            ...v,
            tierCount: v.tierCount - 1,
            rows: v.rows.map((r) => ({ ...r, prices: r.prices.slice(0, -1) })),
            setupFees: v.setupFees.slice(0, -1),
          },
    );
  }

  const setSetupFee = (tierIdx: number, fee: string) =>
    setValues((v) => ({
      ...v,
      setupFees: v.setupFees.map((f, j) => (j === tierIdx ? fee : f)),
    }));

  function submit() {
    setError(null);
    // Empty cells are simply absent from the grid (sparse grids are fine).
    const cells = values.rows.flatMap((r) =>
      r.prices
        .map((p, i) => ({
          minQuantity: Number(r.minQuantity),
          tier: i + 1,
          unitPrice: p.trim(),
        }))
        .filter((c) => c.unitPrice !== ""),
    );
    // Blank setup fee = no fee charged for that tier.
    const setupFees = values.setupFees
      .map((fee, i) => ({ tier: i + 1, fee: fee.trim() }))
      .filter((f) => f.fee !== "");
    startTransition(async () => {
      const res = await saveGrid(gridId ?? null, {
        name: values.name,
        method: values.method,
        tierLabel: values.tierLabel,
        notes: values.notes,
        cells,
        setupFees,
      });
      if (res.ok) router.push("/pricing");
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
          <CardTitle>Grid details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="grid-name">Name *</Label>
            <Input
              id="grid-name"
              value={values.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="Screen print — standard"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Decoration method *</Label>
            <Select
              value={values.method}
              onValueChange={(v) => {
                const method = (v ?? "SCREEN_PRINT") as DecorationMethod;
                // Only auto-fill the tier label while it's still the default
                // for the previous method — never clobber a custom label.
                const isDefaultLabel =
                  values.tierLabel === DEFAULT_TIER_LABELS[values.method];
                set({
                  method,
                  ...(isDefaultLabel
                    ? { tierLabel: DEFAULT_TIER_LABELS[method] }
                    : {}),
                });
              }}
              items={DECORATION_METHODS.map((m) => ({
                value: m,
                label: METHOD_LABELS[m],
              }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DECORATION_METHODS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {METHOD_LABELS[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="grid-tier-label">Tier label</Label>
            <Input
              id="grid-tier-label"
              value={values.tierLabel}
              onChange={(e) => set({ tierLabel: e.target.value })}
              placeholder={DEFAULT_TIER_LABELS[values.method]}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="grid-notes">Notes</Label>
            <Input
              id="grid-notes"
              value={values.notes}
              onChange={(e) => set({ notes: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Price per piece — quantity breaks × {values.tierLabel.toLowerCase()}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Qty from</TableHead>
                  {Array.from({ length: values.tierCount }, (_, i) => (
                    <TableHead key={i} className="w-28 text-center">
                      {values.tierLabel} {i + 1}
                    </TableHead>
                  ))}
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {values.rows.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Input
                        inputMode="numeric"
                        value={row.minQuantity}
                        onChange={(e) =>
                          setValues((v) => ({
                            ...v,
                            rows: v.rows.map((r, j) =>
                              j === i
                                ? { ...r, minQuantity: e.target.value }
                                : r,
                            ),
                          }))
                        }
                      />
                    </TableCell>
                    {row.prices.map((price, j) => (
                      <TableCell key={j}>
                        <Input
                          inputMode="decimal"
                          value={price}
                          onChange={(e) => setCell(i, j, e.target.value)}
                          placeholder="—"
                        />
                      </TableCell>
                    ))}
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={values.rows.length === 1}
                        onClick={() =>
                          setValues((v) => ({
                            ...v,
                            rows: v.rows.filter((_, j) => j !== i),
                          }))
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
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setValues((v) => ({
                  ...v,
                  rows: [
                    ...v.rows,
                    { minQuantity: "", prices: Array(v.tierCount).fill("") },
                  ],
                }))
              }
            >
              + Add quantity break
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={addTier}>
              + Add {values.tierLabel.toLowerCase()} column
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={values.tierCount <= 1}
              onClick={removeTier}
            >
              − Remove last column
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">
            Leave a cell blank if that combination isn’t offered.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>One-time setup fee — per order, not per piece</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {Array.from({ length: values.tierCount }, (_, i) => (
                    <TableHead key={i} className="w-28 text-center">
                      {values.tierLabel} {i + 1}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  {values.setupFees.map((fee, i) => (
                    <TableCell key={i}>
                      <Input
                        inputMode="decimal"
                        value={fee}
                        onChange={(e) => setSetupFee(i, e.target.value)}
                        placeholder="—"
                      />
                    </TableCell>
                  ))}
                </TableRow>
              </TableBody>
            </Table>
          </div>
          <p className="text-muted-foreground text-xs">
            E.g. a screen-setup charge per color. Leave blank for no setup fee
            at that tier. Charged once per order — never multiplied by garment
            quantity.
          </p>
        </CardContent>
      </Card>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : gridId ? "Save changes" : "Create grid"}
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
