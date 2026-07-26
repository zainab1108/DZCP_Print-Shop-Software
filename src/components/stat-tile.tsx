import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";

/**
 * A single KPI on the dashboard. Optionally links somewhere and shows a
 * secondary sub-value (e.g. "3 overdue").
 */
export function StatTile({
  label,
  value,
  sub,
  href,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  href?: string;
  tone?: "default" | "warn" | "danger" | "good";
}) {
  const toneClass =
    tone === "danger"
      ? "text-red-600 dark:text-red-400"
      : tone === "warn"
        ? "text-amber-600 dark:text-amber-400"
        : tone === "good"
          ? "text-green-700 dark:text-green-400"
          : "";

  const inner = (
    <Card
      className={href ? "hover:border-foreground/20 transition-colors" : ""}
    >
      <CardContent className="space-y-1 py-4">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          {label}
        </p>
        <p className={`text-2xl font-semibold tabular-nums ${toneClass}`}>
          {value}
        </p>
        {sub && <p className="text-muted-foreground text-xs">{sub}</p>}
      </CardContent>
    </Card>
  );

  return href ? (
    <Link href={href} className="block">
      {inner}
    </Link>
  ) : (
    inner
  );
}
