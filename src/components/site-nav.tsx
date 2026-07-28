import Link from "next/link";

import { LogoutButton } from "@/components/logout-button";

const links = [
  { href: "/customers", label: "Customers" },
  { href: "/quotes", label: "Quotes" },
  { href: "/invoices", label: "Invoices" },
  { href: "/production", label: "Production" },
  { href: "/shipping", label: "Shipping" },
  { href: "/inventory", label: "Inventory" },
  { href: "/purchasing", label: "Purchasing" },
  { href: "/pricing", label: "Pricing" },
];

export function SiteNav({
  userEmail,
  isAdmin,
}: {
  userEmail?: string;
  isAdmin?: boolean;
}) {
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
        {isAdmin && (
          <Link
            href="/users"
            className="text-muted-foreground hover:text-foreground text-sm font-medium"
          >
            Users
          </Link>
        )}
        <div className="ml-auto flex items-center gap-3">
          {userEmail && (
            <Link
              href="/account"
              className="text-muted-foreground hover:text-foreground hidden text-xs sm:inline"
            >
              {userEmail}
            </Link>
          )}
          <LogoutButton />
        </div>
      </nav>
    </header>
  );
}
