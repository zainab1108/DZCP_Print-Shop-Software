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
import { Textarea } from "@/components/ui/textarea";
import type { JobPriority, JobStatus } from "@/generated/prisma/client";
import { deleteJob, moveJob, updateJobSchedule } from "@/lib/actions/jobs";
import { BOARD_COLUMNS, canTransition, STATUS_LABELS } from "@/lib/production";

const PRIORITIES: { value: JobPriority; label: string }[] = [
  { value: "LOW", label: "Low" },
  { value: "NORMAL", label: "Normal" },
  { value: "HIGH", label: "High" },
  { value: "RUSH", label: "Rush" },
];

export function JobStatusControl({
  jobId,
  status,
}: {
  jobId: string;
  status: JobStatus;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Any column we can validly transition to from here.
  const targets = BOARD_COLUMNS.filter((s) => canTransition(status, s));

  function move(to: string) {
    startTransition(async () => {
      setError(null);
      const res = await moveJob(jobId, to as JobStatus);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  return (
    <div className="space-y-2">
      <Label>Move to</Label>
      <div className="flex flex-wrap gap-2">
        {targets.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            This job has shipped — no further steps.
          </p>
        ) : (
          targets.map((s) => (
            <Button
              key={s}
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => move(s)}
            >
              {STATUS_LABELS[s]}
            </Button>
          ))
        )}
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}

/**
 * Same capability as JobStatusControl (one valid step at a time, via
 * moveJob/canTransition) but as a dropdown — for embedding compactly on the
 * sales order page rather than the full production kanban/detail view.
 */
export function JobStatusDropdown({
  jobId,
  status,
}: {
  jobId: string;
  status: JobStatus;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const targets = BOARD_COLUMNS.filter((s) => canTransition(status, s));

  function move(to: JobStatus | null) {
    if (!to || to === status) return;
    startTransition(async () => {
      setError(null);
      const res = await moveJob(jobId, to);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  const items = [
    { value: status, label: STATUS_LABELS[status] },
    ...targets.map((s) => ({ value: s, label: STATUS_LABELS[s] })),
  ];

  return (
    <div className="space-y-1">
      <Select value={status} onValueChange={move} items={items}>
        <SelectTrigger className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((it) => (
            <SelectItem key={it.value} value={it.value}>
              {it.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {pending && <p className="text-muted-foreground text-xs">Updating…</p>}
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}

export function JobScheduleForm({
  jobId,
  initial,
}: {
  jobId: string;
  initial: {
    priority: JobPriority;
    assignee: string;
    dueDate: string;
    notes: string;
  };
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const set = (patch: Partial<typeof values>) =>
    setValues((v) => ({ ...v, ...patch }));

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await updateJobSchedule(jobId, values);
      if (res.ok) {
        setSaved(true);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Priority</Label>
          <Select
            value={values.priority}
            onValueChange={(v) =>
              set({ priority: (v ?? "NORMAL") as JobPriority })
            }
            items={PRIORITIES}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITIES.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="job-due">Due date</Label>
          <Input
            id="job-due"
            type="date"
            value={values.dueDate}
            onChange={(e) => set({ dueDate: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="job-assignee">Assignee</Label>
          <Input
            id="job-assignee"
            value={values.assignee}
            onChange={(e) => set({ assignee: e.target.value })}
            placeholder="Who's running it"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="job-notes">Shop-floor notes</Label>
        <Textarea
          id="job-notes"
          value={values.notes}
          onChange={(e) => set({ notes: e.target.value })}
          rows={3}
        />
      </div>
      <div className="flex items-center gap-3">
        <Button size="sm" disabled={pending} onClick={save}>
          {pending ? "Saving…" : "Save schedule"}
        </Button>
        {saved && <span className="text-sm text-green-600">Saved</span>}
        {error && <span className="text-destructive text-sm">{error}</span>}
      </div>
    </div>
  );
}

export function DeleteJobButton({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (
          confirm(
            "Remove this job from production? The sales order and invoice are unaffected.",
          )
        ) {
          startTransition(async () => {
            const res = await deleteJob(jobId);
            if (res.ok) router.push("/production");
            else alert(res.error);
          });
        }
      }}
    >
      Remove from production
    </Button>
  );
}
