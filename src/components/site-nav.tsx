import Link from "next/link";

const links = [
  { href: "/customers", label: "Customers" },
  { href: "/quotes", label: "Quotes" },
  { href: "/invoices", label: "Invoices" },
];

export function SiteNav() {
  return (
    <header className="border-b bg-white dark:bg-zinc-900">
      <nav className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
        <Link href="/" className="font-semibold">
          Print Shop Manager
        </Link>
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="text-muted-foreground hover:text-foreground text-sm font-medium"
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
