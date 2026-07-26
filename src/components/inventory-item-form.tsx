"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createItem, updateItem } from "@/lib/actions/inventory";

export interface ItemValues {
  sku: string;
  name: string;
  unit: string;
  reorderPoint: string;
  unitCost: string;
  supplierId: string;
}

export interface SupplierOption {
  id: string;
  name: string;
}

const empty: ItemValues = {
  sku: "",
  name: "",
  unit: "each",
  reorderPoint: "0",
  unitCost: "",
  supplierId: "",
};

const NONE = "__none__";

export function InventoryItemForm({
  itemId,
  suppliers,
  initial,
}: {
  itemId?: string;
  suppliers: SupplierOption[];
  initial?: ItemValues;
}) {
  const router = useRouter();
  const [values, setValues] = useState<ItemValues>(initial ?? empty);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const set = (patch: Partial<ItemValues>) =>
    setValues((v) => ({ ...v, ...patch }));

  function submit() {
    setError(null);
    const payload = {
      sku: values.sku,
      name: values.name,
      unit: values.unit,
      reorderPoint: Number(values.reorderPoint || 0),
      unitCost: values.unitCost.trim(),
      supplierId: values.supplierId === NONE ? "" : values.supplierId,
    };
    startTransition(async () => {
      const res = itemId
        ? await updateItem(itemId, payload)
        : await createItem(payload);
      if (res.ok) router.push(`/inventory/${res.id}`);
      else setError(res.error);
    });
  }

  const supplierValue = values.supplierId || NONE;

  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="item-sku">SKU *</Label>
        <Input
          id="item-sku"
          value={values.sku}
          onChange={(e) => set({ sku: e.target.value })}
          placeholder="G5000-BLK-L"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="item-name">Name *</Label>
        <Input
          id="item-name"
          value={values.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="Gildan 5000 — Black — L"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="item-unit">Unit</Label>
        <Input
          id="item-unit"
          value={values.unit}
          onChange={(e) => set({ unit: e.target.value })}
          placeholder="each"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="item-reorder">Reorder point</Label>
        <Input
          id="item-reorder"
          inputMode="numeric"
          value={values.reorderPoint}
          onChange={(e) => set({ reorderPoint: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="item-cost">Unit cost</Label>
        <Input
          id="item-cost"
          inputMode="decimal"
          value={values.unitCost}
          onChange={(e) => set({ unitCost: e.target.value })}
          placeholder="3.50"
        />
      </div>
      <div className="space-y-2">
        <Label>Supplier</Label>
        <Select
          value={supplierValue}
          onValueChange={(v) =>
            set({ supplierId: v === NONE ? "" : (v ?? "") })
          }
          items={[
            { value: NONE, label: "None" },
            ...suppliers.map((s) => ({ value: s.id, label: s.name })),
          ]}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>None</SelectItem>
            {suppliers.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {itemId && (
        <p className="text-muted-foreground text-xs sm:col-span-2">
          On-hand quantity changes through stock movements, not this form.
        </p>
      )}
      {error && (
        <p className="text-destructive text-sm sm:col-span-2">{error}</p>
      )}
      <div className="flex gap-3 sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : itemId ? "Save changes" : "Add item"}
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
