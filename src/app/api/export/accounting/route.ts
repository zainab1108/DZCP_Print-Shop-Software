import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Quote a value for CSV: wrap in quotes and double any embedded quotes. */
function csv(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

function ymd(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

/**
 * Accounting export: one row per non-draft invoice, with totals and amount
 * paid, for import into QuickBooks/Xero. A plain, dependency-free CSV — the
 * offline path in place of a live accounting API.
 */
export async function GET() {
  const invoices = await prisma.invoice.findMany({
    where: { status: { not: "DRAFT" } },
    orderBy: { number: "asc" },
    include: { customer: { select: { name: true } } },
  });

  const header = [
    "Invoice",
    "Customer",
    "Status",
    "Issue Date",
    "Due Date",
    "Subtotal",
    "Tax",
    "Total",
    "Amount Paid",
    "Balance Due",
  ];

  const rows = invoices.map((inv) =>
    [
      csv(`INV-${inv.number}`),
      csv(inv.customer.name),
      csv(inv.status),
      csv(ymd(inv.issueDate)),
      csv(ymd(inv.dueDate)),
      csv(inv.subtotal.toFixed(2)),
      csv(inv.taxAmount.toFixed(2)),
      csv(inv.total.toFixed(2)),
      csv(inv.amountPaid.toFixed(2)),
      csv(inv.total.sub(inv.amountPaid).toFixed(2)),
    ].join(","),
  );

  const body = [header.map(csv).join(","), ...rows].join("\r\n") + "\r\n";
  const filename = `accounting-export-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
