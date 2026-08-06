import Link from "next/link";

import { JobMoveControls } from "@/components/job-move-controls";
import { Badge } from "@/components/ui/badge";
import type { JobPriority, JobStatus } from "@/generated/prisma/client";
import { formatDate, jobNumber } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import {
  BOARD_COLUMNS,
  PRIORITY_LABELS,
  STATUS_LABELS,
} from "@/lib/production";

export const dynamic = "force-dynamic";

const priorityStyles: Record<JobPriority, string> = {
  LOW: "text-zinc-500",
  NORMAL: "text-zinc-500",
  HIGH: "text-amber-600 dark:text-amber-400",
  RUSH: "text-red-600 dark:text-red-400 font-semibold",
};

export default async function ProductionPage() {
  const jobs = await prisma.job.findMany({
    orderBy: [{ priority: "desc" }, { dueDate: "asc" }, { number: "asc" }],
    include: {
      salesOrder: {
        select: {
          number: true,
          title: true,
          customer: { select: { name: true } },
        },
      },
    },
  });

  const byStatus = new Map<JobStatus, typeof jobs>();
  for (const col of BOARD_COLUMNS) byStatus.set(col, []);
  for (const job of jobs) byStatus.get(job.status)?.push(job);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Production</h1>
        <span className="text-muted-foreground text-sm">
          {jobs.length} {jobs.length === 1 ? "job" : "jobs"} in production
        </span>
      </div>

      {jobs.length === 0 ? (
        <p className="text-muted-foreground">
          No jobs yet. Send a confirmed sales order into production from its
          page.
        </p>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {BOARD_COLUMNS.map((col) => {
            const colJobs = byStatus.get(col) ?? [];
            return (
              <section key={col} className="w-72 shrink-0">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-sm font-medium">{STATUS_LABELS[col]}</h2>
                  <Badge variant="secondary">{colJobs.length}</Badge>
                </div>
                <div className="space-y-2">
                  {colJobs.map((job) => (
                    <div
                      key={job.id}
                      className="space-y-2 rounded-lg border bg-white p-3 dark:bg-zinc-900"
                    >
                      <div className="flex items-center justify-between">
                        <Link
                          href={`/production/${job.id}`}
                          className="text-sm font-medium hover:underline"
                        >
                          {jobNumber(job.number)}
                        </Link>
                        <span
                          className={`text-xs ${priorityStyles[job.priority]}`}
                        >
                          {PRIORITY_LABELS[job.priority]}
                        </span>
                      </div>
                      <p className="text-sm">{job.salesOrder.customer.name}</p>
                      {job.salesOrder.title && (
                        <p className="text-muted-foreground text-xs">
                          {job.salesOrder.title}
                        </p>
                      )}
                      {job.dueDate && (
                        <p className="text-muted-foreground text-xs">
                          Due {formatDate(job.dueDate)}
                        </p>
                      )}
                      <JobMoveControls jobId={job.id} status={job.status} />
                    </div>
                  ))}
                  {colJobs.length === 0 && (
                    <p className="text-muted-foreground rounded-lg border border-dashed p-3 text-center text-xs">
                      —
                    </p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
