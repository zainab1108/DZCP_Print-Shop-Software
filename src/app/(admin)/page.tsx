import {
  BarChart3,
  Factory,
  FileText,
  Receipt,
  Settings,
  ShoppingCart,
  Tag,
  Truck,
  UserCog,
  Users,
  Warehouse,
} from "lucide-react";

import { NavSection, NavTile } from "@/components/nav-tile";
import { StatTile } from "@/components/stat-tile";
import { getCurrentUser } from "@/lib/auth/current-user";
import { formatMoney } from "@/lib/format";
import { inventoryValue, isLowStock } from "@/lib/inventory";
import { prisma } from "@/lib/prisma";
import { summarizeInvoices } from "@/lib/reporting";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentUser();
  const isAdmin = user?.role === "ADMIN";

  const [invoices, activeJobCount, openShipmentCount, items] =
    await Promise.all([
      prisma.invoice.findMany({
        select: {
          status: true,
          total: true,
          amountPaid: true,
          dueDate: true,
        },
      }),
      prisma.job.count({
        where: { status: { notIn: ["SHIPPED", "ON_HOLD"] } },
      }),
      prisma.shipment.count({
        where: { status: { notIn: ["DELIVERED", "RETURNED"] } },
      }),
      prisma.inventoryItem.findMany({
        where: { archived: false },
        select: { quantityOnHand: true, reorderPoint: true, unitCost: true },
      }),
    ]);

  const money = summarizeInvoices(invoices);
  const lows = items.filter(isLowStock);

  const firstName = user?.name?.split(" ")[0];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">
          {firstName ? `Welcome back, ${firstName}` : "Welcome back"}
        </h1>
        <p className="text-muted-foreground text-base">
          Here&apos;s what&apos;s happening in the shop today.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Outstanding (A/R)"
          value={formatMoney(money.outstanding)}
          sub={
            money.overdueCount > 0
              ? `${money.overdueCount} overdue`
              : "Nothing overdue"
          }
          href="/reports"
          tone={money.overdueCount > 0 ? "danger" : "default"}
        />
        <StatTile
          label="Jobs in production"
          value={String(activeJobCount)}
          href="/production"
        />
        <StatTile
          label="Open shipments"
          value={String(openShipmentCount)}
          href="/shipping"
        />
        <StatTile
          label="Stock value"
          value={formatMoney(inventoryValue(items))}
          sub={lows.length > 0 ? `${lows.length} low` : "All stocked"}
          href="/inventory"
          tone={lows.length > 0 ? "warn" : "default"}
        />
      </div>

      <NavSection title="Sales">
        <NavTile
          href="/customers"
          icon={Users}
          label="Customers"
          description="Add or update customer info"
          color="bg-blue-500"
        />
        <NavTile
          href="/quotes"
          icon={FileText}
          label="Quotes"
          description="Create or update quotes"
          color="bg-indigo-500"
        />
        <NavTile
          href="/invoices"
          icon={Receipt}
          label="Invoices"
          description="View and record payments"
          color="bg-emerald-500"
        />
      </NavSection>

      <NavSection title="Production">
        <NavTile
          href="/production"
          icon={Factory}
          label="Production"
          description="Manage the job board"
          color="bg-orange-500"
        />
        <NavTile
          href="/shipping"
          icon={Truck}
          label="Shipping"
          description="Track outbound shipments"
          color="bg-teal-500"
        />
      </NavSection>

      <NavSection title="Stock control">
        <NavTile
          href="/inventory"
          icon={Warehouse}
          label="Inventory"
          description="Manage stock on hand"
          color="bg-purple-500"
        />
        <NavTile
          href="/purchasing"
          icon={ShoppingCart}
          label="Purchasing"
          description="Create and receive POs"
          color="bg-pink-500"
        />
      </NavSection>

      <NavSection title="Reports & configuration">
        <NavTile
          href="/reports"
          icon={BarChart3}
          label="Reports"
          description="Revenue, A/R, and lead times"
          color="bg-cyan-500"
        />
        {isAdmin && (
          <NavTile
            href="/pricing"
            icon={Tag}
            label="Pricing"
            description="Price grids and markup"
            color="bg-amber-500"
          />
        )}
        {isAdmin && (
          <NavTile
            href="/users"
            icon={UserCog}
            label="Users"
            description="Staff logins and roles"
            color="bg-red-500"
          />
        )}
        <NavTile
          href="/account"
          icon={Settings}
          label="Account"
          description="Your profile and password"
          color="bg-slate-500"
        />
      </NavSection>
    </div>
  );
}
