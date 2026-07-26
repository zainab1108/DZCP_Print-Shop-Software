"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import type { JobStatus } from "@/generated/prisma/client";
import { moveJob } from "@/lib/actions/jobs";
import { nextStatus, prevStatus, STATUS_LABELS } from "@/lib/production";

/**
 * Compact move controls for a board card: step back, step forward, and a
 * hold/resume toggle. Bigger jumps live on the job detail page.
 */
export function JobMoveControls({
  jobId,
  status,
}: {
  jobId: string;
  status: JobStatus;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const move = (to: JobStatus) =>
    startTransition(async () => {
      setError(null);
      const res = await moveJob(jobId, to);
      if (res.ok) router.refresh();
      else setError(res.error);
    });

  const prev = prevStatus(status);
  const next = nextStatus(status);
  const onHold = status === "ON_HOLD";

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-1">
        {!onHold && prev && (
          <Button
            variant="outline"
            size="xs"
            disabled={pending}
            onClick={() => move(prev)}
            title={`Back to ${STATUS_LABELS[prev]}`}
          >
            ←
          </Button>
        )}
        {!onHold && next && (
          <Button size="xs" disabled={pending} onClick={() => move(next)}>
            {STATUS_LABELS[next]} →
          </Button>
        )}
        {onHold ? (
          <Button
            variant="outline"
            size="xs"
            disabled={pending}
            onClick={() => move("QUEUED")}
          >
            Resume
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="xs"
            disabled={pending}
            onClick={() => move("ON_HOLD")}
          >
            Hold
          </Button>
        )}
      </div>
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}
