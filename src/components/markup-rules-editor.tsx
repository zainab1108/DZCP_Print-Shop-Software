"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { saveMarkupRules } from "@/lib/actions/pricing";

interface RuleRow {
  minCost: string;
  multiplier: string;
}

export function MarkupRulesEditor({ initial }: { initial: RuleRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<RuleRow[]>(
    initial.length > 0 ? initial : [{ minCost: "0", multiplier: "2.5" }],
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const setRow = (i: number, patch: Partial<RuleRow>) =>
    setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await saveMarkupRules({ rules: rows });
      if (res.ok) {
        setSaved(true);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-sm">
        Garment sell price = supplier cost × multiplier. The rule with the
        highest “cost from” at or below the cost applies.
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cost from ($)</TableHead>
            <TableHead>Multiplier</TableHead>
            <TableHead className="w-16" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow key={i}>
              <TableCell>
                <Input
                  inputMode="decimal"
                  value={row.minCost}
                  onChange={(e) => setRow(i, { minCost: e.target.value })}
                  className="max-w-32"
                />
              </TableCell>
              <TableCell>
                <Input
                  inputMode="decimal"
                  value={row.multiplier}
                  onChange={(e) => setRow(i, { multiplier: e.target.value })}
                  className="max-w-32"
                />
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={rows.length === 1}
                  onClick={() => setRows((r) => r.filter((_, j) => j !== i))}
                >
                  ✕
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            setRows((r) => [...r, { minCost: "", multiplier: "" }])
          }
        >
          + Add tier
        </Button>
        <Button size="sm" disabled={pending} onClick={save}>
          {pending ? "Saving…" : "Save markup rules"}
        </Button>
        {saved && <span className="text-sm text-green-600">Saved</span>}
        {error && <span className="text-destructive text-sm">{error}</span>}
      </div>
    </div>
  );
}
