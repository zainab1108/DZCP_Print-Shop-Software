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
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge className={styles[status] ?? ""} variant="secondary">
      {status.replace("_", " ")}
    </Badge>
  );
}
