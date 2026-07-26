import { formatMoney } from "@/lib/format";

export interface RevenueBar {
  key: string;
  label: string;
  amount: number;
}

/**
 * Minimal monthly-revenue bar chart. Server-rendered CSS bars — no chart
 * dependency — scaled to the largest month. Neutral, matches the app style.
 */
export function RevenueBars({ data }: { data: RevenueBar[] }) {
  const max = Math.max(1, ...data.map((d) => d.amount));

  return (
    <div className="flex items-end gap-3" style={{ height: 160 }}>
      {data.map((d) => {
        const pct = Math.round((d.amount / max) * 100);
        return (
          <div key={d.key} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-muted-foreground text-[10px] tabular-nums">
              {d.amount > 0 ? formatMoney(d.amount) : ""}
            </span>
            <div className="flex w-full flex-1 items-end">
              <div
                className="bg-foreground/80 w-full rounded-t"
                style={{ height: `${Math.max(pct, d.amount > 0 ? 2 : 0)}%` }}
                title={`${d.label}: ${formatMoney(d.amount)}`}
              />
            </div>
            <span className="text-muted-foreground text-xs">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}
