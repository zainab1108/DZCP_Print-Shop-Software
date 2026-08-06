"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import type { JobStatus } from "@/generated/prisma/client";
import { createJobFromSalesOrder } from "@/lib/actions/jobs";
import { jobNumber } from "@/lib/format";
import { STATUS_LABELS } from "@/lib/production";

export function SendToProduction({
  salesOrderId,
  producible,
  job,
}: {
  salesOrderId: string;
  producible: boolean;
  job: { id: string; number: number; status: JobStatus } | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (job) {
    return (
      <div className="flex items-center gap-2">
        <StatusBadge status={job.status} label={STATUS_LABELS[job.status]} />
        <Button
          size="sm"
          variant="outline"
          onClick={() => router.push(`/production/${job.id}`)}
        >
          View {jobNumber(job.number)}
        </Button>
      </div>
    );
  }

  if (!producible) return null;

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const res = await createJobFromSalesOrder(salesOrderId);
            if (res.ok) router.push(`/production/${res.id}`);
            else setError(res.error);
          })
        }
      >
        {pending ? "Creating…" : "Send to production"}
      </Button>
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}
