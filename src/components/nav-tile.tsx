import Link from "next/link";
import type { LucideIcon } from "lucide-react";

/** One colorful icon-tile in a launcher section. `color` is a Tailwind bg-* class. */
export function NavTile({
  href,
  icon: Icon,
  label,
  description,
  color,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  description: string;
  color: string;
}) {
  return (
    <Link
      href={href}
      className="hover:bg-muted/60 flex min-w-40 flex-1 basis-44 flex-col items-center gap-3 rounded-lg px-4 py-7 text-center transition-colors"
    >
      <span
        className={`flex size-16 items-center justify-center rounded-2xl text-white shadow-sm transition-transform group-hover:scale-105 ${color}`}
      >
        <Icon className="size-8" strokeWidth={1.75} />
      </span>
      <span className="text-lg font-semibold">{label}</span>
      <span className="text-muted-foreground text-sm leading-snug">
        {description}
      </span>
    </Link>
  );
}

export function NavSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-bold tracking-widest text-[var(--brand-gold-dark)] uppercase">
        {title}
      </h2>
      <div className="flex flex-wrap gap-1 rounded-xl border bg-white p-2 dark:bg-zinc-900">
        {children}
      </div>
    </div>
  );
}
