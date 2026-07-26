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
import { adjustStock } from "@/lib/actions/inventory";

const REASONS = [
  { value: "RECEIVED", label: "Received (add)" },
  { value: "ADJUSTMENT", label: "Adjustment (count/damage)" },
  { value: "CONSUMED", label: "Consumed by a job" },
];

export interface JobOption {
  id: string;
  label: string;
}

export function StockAdjust({
  itemId,
  jobs,
}: {
  itemId: string;
  jobs: JobOption[];
}) {
  const router = useRouter();
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("RECEIVED");
  const [note, setNote] = useState("");
  const [jobId, setJobId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const consumed = reason === "CONSUMED";

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await adjustStock(itemId, {
        delta: delta.trim(),
        reason,
        note,
        jobId: consumed ? jobId : "",
      });
      if (res.ok) {
        setDelta("");
        setNote("");
        setJobId("");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Reason</Label>
          <Select
            value={reason}
            onValueChange={(v) => setReason(v ?? "RECEIVED")}
            items={REASONS}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REASONS.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="adj-qty">
            {consumed ? "Quantity used" : "Change (+/−)"}
          </Label>
          <Input
            id="adj-qty"
            inputMode="numeric"
            value={delta}
            onChange={(e) => setDelta(e.target.value)}
            placeholder={consumed ? "12" : "+24 or -3"}
            required
          />
        </div>
        {consumed && jobs.length > 0 && (
          <div className="space-y-2">
            <Label>Job (optional)</Label>
            <Select
              value={jobId || "__none__"}
              onValueChange={(v) => setJobId(v === "__none__" ? "" : (v ?? ""))}
              items={[
                { value: "__none__", label: "No job" },
                ...jobs.map((j) => ({ value: j.id, label: j.label })),
              ]}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No job</SelectItem>
                {jobs.map((j) => (
                  <SelectItem key={j.id} value={j.id}>
                    {j.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="adj-note">Note</Label>
          <Input
            id="adj-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional"
          />
        </div>
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Recording…" : "Record movement"}
      </Button>
    </form>
  );
}
