import type { JobStatus } from "@/generated/prisma/client";

// The linear production pipeline, in order. ON_HOLD is deliberately excluded:
// it's a parking state reachable from (and returnable to) any active stage.
export const PIPELINE: JobStatus[] = [
  "QUEUED",
  "ARTWORK",
  "PREPRESS",
  "PRINTING",
  "CURING",
  "FINISHING",
  "QC",
  "READY",
  "SHIPPED",
];

// Columns shown on the board, in order. ON_HOLD gets its own column at the end.
export const BOARD_COLUMNS: JobStatus[] = [...PIPELINE, "ON_HOLD"];

export const STATUS_LABELS: Record<JobStatus, string> = {
  QUEUED: "Queued",
  ARTWORK: "Artwork",
  PREPRESS: "Prepress",
  PRINTING: "Printing",
  CURING: "Curing",
  FINISHING: "Finishing",
  QC: "QC",
  READY: "Ready",
  SHIPPED: "Shipped",
  ON_HOLD: "On hold",
};

export const PRIORITY_LABELS = {
  LOW: "Low",
  NORMAL: "Normal",
  HIGH: "High",
  RUSH: "Rush",
} as const;

/** SHIPPED is terminal; ON_HOLD is not (it can return to the flow). */
export function isTerminal(status: JobStatus): boolean {
  return status === "SHIPPED";
}

/** The next stage in the pipeline, or null if there isn't one. */
export function nextStatus(status: JobStatus): JobStatus | null {
  const i = PIPELINE.indexOf(status);
  if (i === -1 || i === PIPELINE.length - 1) return null;
  return PIPELINE[i + 1];
}

/** The previous stage in the pipeline, or null if there isn't one. */
export function prevStatus(status: JobStatus): JobStatus | null {
  const i = PIPELINE.indexOf(status);
  if (i <= 0) return null;
  return PIPELINE[i - 1];
}

/**
 * Whether a status change is allowed. Rules:
 * - No-op changes are rejected (nothing to do).
 * - Any active stage can go ON_HOLD.
 * - ON_HOLD can return only to a real pipeline stage.
 * - Within the pipeline, moving one step in either direction is allowed
 *   (advance work, or bump it back for a redo). Bigger jumps are rejected so
 *   the board reflects real transitions rather than accidental skips.
 */
export function canTransition(from: JobStatus, to: JobStatus): boolean {
  if (from === to) return false;
  if (to === "ON_HOLD") return from !== "ON_HOLD";
  if (from === "ON_HOLD") return PIPELINE.includes(to);
  const fi = PIPELINE.indexOf(from);
  const ti = PIPELINE.indexOf(to);
  if (fi === -1 || ti === -1) return false;
  return Math.abs(ti - fi) === 1;
}
