import { Badge } from "@/components/ui/badge";

const styles: Record<string, string> = {
  DRAFT: "bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-100",
  SENT: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  APPROVED: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
  DECLINED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
  EXPIRED: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100",
  CONVERTED:
    "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100",
  PARTIALLY_PAID:
    "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100",
  PAID: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
  OVERDUE: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
  VOID: "bg-zinc-200 text-zinc-500 line-through dark:bg-zinc-700",
  PENDING: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  CHANGES_REQUESTED:
    "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100",
  // Production job statuses.
  QUEUED: "bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-100",
  ARTWORK: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  PREPRESS: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  PRINTING:
    "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-100",
  CURING:
    "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-100",
  FINISHING:
    "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100",
  QC: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100",
  READY: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
  SHIPPED: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
  ON_HOLD: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
};

export function StatusBadge({
  status,
  label,
}: {
  status: string;
  label?: string;
}) {
  return (
    <Badge className={styles[status] ?? ""} variant="secondary">
      {label ?? status.replace("_", " ")}
    </Badge>
  );
}
