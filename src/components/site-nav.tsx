import { Home } from "lucide-react";
import Image from "next/image";
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
  { href: "/reports", label: "Reports" },
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
    <header className="bg-[var(--brand-charcoal)] text-white">
      <nav className="mx-auto flex h-16 max-w-6xl items-center gap-6 overflow-x-auto px-4">
        <Link
          href="/"
          className="mr-1 flex shrink-0 items-center gap-2.5 text-lg font-semibold"
        >
          <Image
            src="/logo.png"
            alt="DZ Custom Products"
            width={44}
            height={44}
            className="rounded-full"
            priority
          />
          DZ Custom Products
        </Link>
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="shrink-0 text-base font-medium whitespace-nowrap text-white/70 transition-colors hover:text-white"
          >
            {l.label}
          </Link>
        ))}
        {isAdmin && (
          <Link
            href="/users"
            className="shrink-0 text-base font-medium whitespace-nowrap text-white/70 transition-colors hover:text-white"
          >
            Users
          </Link>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-4">
          <Link
            href="/"
            className="rounded-md p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            title="Home"
          >
            <Home className="size-5" />
          </Link>
          {userEmail && (
            <Link
              href="/account"
              className="hidden text-sm text-white/70 transition-colors hover:text-white sm:inline"
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
