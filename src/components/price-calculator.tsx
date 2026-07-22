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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { calculateLinePrice, type CalcResult } from "@/lib/actions/pricing";
import { formatMoney } from "@/lib/format";

export interface GridOption {
  id: string;
  name: string;
  tierLabel: string;
}

/** "10.6500" -> "10.65", "10.0000" -> "10" — cosmetic only. */
function trimZeros(s: string): string {
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
}

export function PriceCalculator({
  grids,
  initialQuantity,
  onApply,
}: {
  grids: GridOption[];
  initialQuantity: string;
  onApply: (values: { quantity: string; unitPrice: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [gridId, setGridId] = useState(grids[0]?.id ?? "");
  const [quantity, setQuantity] = useState(initialQuantity);
  const [tier, setTier] = useState("1");
  const [garmentCost, setGarmentCost] = useState("");
  const [result, setResult] = useState<CalcResult | null>(null);
  const [pending, startTransition] = useTransition();

  const grid = grids.find((g) => g.id === gridId);

  function compute() {
    setResult(null);
    startTransition(async () => {
      const res = await calculateLinePrice({
        gridId,
        quantity: Number(quantity || 0),
        tier: Number(tier || 0),
        garmentCost,
      });
      setResult(res);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setQuantity(initialQuantity);
          setResult(null);
        }
      }}
    >
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            title="Price from grid"
          >
            $
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Price from grid</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Price grid</Label>
            <Select
              value={gridId}
              onValueChange={(v) => {
                setGridId(v ?? "");
                setResult(null);
              }}
              items={grids.map((g) => ({ value: g.id, label: g.name }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pick a grid" />
              </SelectTrigger>
              <SelectContent>
                {grids.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="calc-qty">Quantity</Label>
              <Input
                id="calc-qty"
                inputMode="numeric"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="calc-tier">{grid?.tierLabel ?? "Tier"}</Label>
              <Input
                id="calc-tier"
                inputMode="numeric"
                value={tier}
                onChange={(e) => setTier(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="calc-cost">Garment cost</Label>
              <Input
                id="calc-cost"
                inputMode="decimal"
                value={garmentCost}
                onChange={(e) => setGarmentCost(e.target.value)}
                placeholder="optional"
              />
            </div>
          </div>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={pending || !gridId}
            onClick={compute}
          >
            {pending ? "Calculating…" : "Calculate"}
          </Button>

          {result &&
            (result.ok ? (
              <div className="space-y-1 rounded-md border p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Decoration / pc</span>
                  <span className="tabular-nums">
                    {formatMoney(result.decorationUnit)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Garment (marked up) / pc
                  </span>
                  <span className="tabular-nums">
                    {formatMoney(result.garmentUnit)}
                  </span>
                </div>
                <div className="flex justify-between font-medium">
                  <span>Unit price</span>
                  <span className="tabular-nums">
                    {formatMoney(result.unitPrice)}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-destructive text-sm">{result.error}</p>
            ))}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!result?.ok}
              onClick={() => {
                if (result?.ok) {
                  onApply({
                    quantity,
                    unitPrice: trimZeros(result.unitPrice),
                  });
                  setOpen(false);
                }
              }}
            >
              Apply to line
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
