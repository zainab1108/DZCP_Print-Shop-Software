import "dotenv/config";
import { readFileSync } from "node:fs";
import path from "node:path";

import { parse } from "csv-parse/sync";
import { PrismaPg } from "@prisma/adapter-pg";

import {
  Prisma,
  PrismaClient,
  type DecorationMethod,
  type PaymentMethod,
} from "../src/generated/prisma/client";

// One-time historical import from YoPrint CSV exports. Run locally against
// dev first, then on the server against production. Expects the export
// files (unzipped) in the directory given as argv[2].
//
// Scope, per the decisions made when this was written:
// - Customers: deduped by contact email (YoPrint's own export has ~12
//   duplicate/near-duplicate entries), preferring the row with a non-blank
//   last_ordered_date since that's the one actually used for orders.
// - Invoices: imported as closed historical records (all confirmed done).
//   No granular line-item data exists in any export (job rows are 1:1 with
//   orders, not per-garment), so each invoice gets one line item for the
//   whole order amount, plus a separate negative "Discount" line when
//   YoPrint recorded one (this app's Invoice model has no discount field).
// - 3 payments reference orders absent from both the invoice and
//   sales-order exports; they get a bare invoice (total = amount paid).
// - tax-export and the yoprint_jobs_page_* files are redundant with
//   invoice-export / already-completed work; not imported.
// - DTF pricing ("low|high" per cell) uses the high value.

const DATA_DIR = process.argv[2];
if (!DATA_DIR) {
  console.error("Usage: tsx scripts/import-yoprint.ts <path-to-csv-dir>");
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

function readCsv(filename: string): Record<string, string>[] {
  const raw = readFileSync(path.join(DATA_DIR, filename), "utf-8");
  return parse(raw, { columns: true, skip_empty_lines: true, bom: true });
}

function dec(value: string | undefined): Prisma.Decimal {
  const v = (value ?? "").trim();
  return new Prisma.Decimal(v === "" ? 0 : v);
}

// YoPrint ISO dates ("2025-08-04") and job-page dates ("Aug 06, 2025") both
// parse fine with Date(); payment dates ("04 Aug 2025") need help.
function parseDate(value: string | undefined): Date | null {
  const v = (value ?? "").trim();
  if (!v) return null;
  const ddMonYyyy = v.match(/^(\d{1,2}) (\w{3}) (\d{4})$/);
  if (ddMonYyyy) {
    const [, d, mon, y] = ddMonYyyy;
    const parsed = new Date(`${mon} ${d}, ${y}`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const parsed = new Date(v);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function invoiceStatus(
  paid: Prisma.Decimal,
  balanceDue: Prisma.Decimal,
): "PAID" | "PARTIALLY_PAID" | "SENT" {
  if (balanceDue.lessThanOrEqualTo(0)) return "PAID";
  if (paid.greaterThan(0)) return "PARTIALLY_PAID";
  return "SENT";
}

function paymentMethod(raw: string): PaymentMethod {
  const v = raw.trim().toLowerCase();
  if (v.includes("bank") || v.includes("zelle") || v.includes("ach"))
    return "ACH";
  if (v.includes("cash")) return "CASH";
  if (v.includes("check")) return "CHECK";
  if (v.includes("card")) return "CARD";
  return "OTHER";
}

async function importCustomers() {
  const rows = readCsv("customer-export - Zainab.csv");

  // Dedup by email, preferring the row with a last_ordered_date (the one
  // actually used for orders). Rows without an email are kept as-is; a few
  // may create near-duplicate customers, but there's no reliable key to
  // dedup them by.
  const byEmail = new Map<string, Record<string, string>>();
  const noEmail: Record<string, string>[] = [];
  for (const row of rows) {
    const email = row.contact_email.trim().toLowerCase();
    if (!email) {
      noEmail.push(row);
      continue;
    }
    const existing = byEmail.get(email);
    if (!existing || (!existing.last_ordered_date && row.last_ordered_date)) {
      byEmail.set(email, row);
    }
  }

  const emailToCustomerId = new Map<string, string>();
  const nameToCustomerId = new Map<string, string>();

  for (const row of [...byEmail.values(), ...noEmail]) {
    const email = row.contact_email.trim() || null;

    let customerId: string;
    const existing = email
      ? await prisma.customer.findFirst({ where: { email } })
      : null;
    if (existing) {
      customerId = existing.id;
    } else {
      const created = await prisma.customer.create({
        data: {
          name: row.name.trim(),
          email,
          phone: row.contact_phone.trim() || null,
          website: row.website.trim() || null,
          taxExempt: row.tax_exempt.trim().toUpperCase() === "TRUE",
          notes: row.internal_notes.trim() || null,
        },
      });
      customerId = created.id;

      if (row.shipping_address_1.trim() && row.shipping_city.trim()) {
        await prisma.address.create({
          data: {
            customerId,
            type: "SHIPPING",
            line1: row.shipping_address_1.trim(),
            line2: row.shipping_address_2.trim() || null,
            city: row.shipping_city.trim(),
            state: row.shipping_state.trim() || null,
            postalCode: row.shipping_postal_code.trim() || null,
            country: row.shipping_country_code.trim() || "US",
          },
        });
      }
      if (row.billing_address_1.trim() && row.billing_city.trim()) {
        await prisma.address.create({
          data: {
            customerId,
            type: "BILLING",
            line1: row.billing_address_1.trim(),
            line2: row.billing_address_2.trim() || null,
            city: row.billing_city.trim(),
            state: row.billing_state.trim() || null,
            postalCode: row.billing_postal_code.trim() || null,
            country: row.billing_country_code.trim() || "US",
          },
        });
      }

      const firstName =
        row.contact_first_name.trim() || row.name.trim().split(/\s+/)[0];
      if (firstName) {
        await prisma.contact.create({
          data: {
            customerId,
            firstName,
            lastName: row.contact_last_name.trim() || null,
            email,
            phone: row.contact_phone.trim() || null,
            isPrimary: true,
          },
        });
      }
    }

    if (email) emailToCustomerId.set(email, customerId);
    nameToCustomerId.set(row.name.trim().toLowerCase(), customerId);
  }

  console.log(
    `Customers: ${byEmail.size + noEmail.length} rows -> ${new Set([...emailToCustomerId.values(), ...nameToCustomerId.values()]).size} unique customers`,
  );
  return { emailToCustomerId, nameToCustomerId };
}

async function importInvoices(customerMaps: {
  emailToCustomerId: Map<string, string>;
  nameToCustomerId: Map<string, string>;
}) {
  const rows = readCsv("invoice-export - Zainab.csv");
  const orderIdToInvoiceId = new Map<string, string>();
  const yoprintInvoiceIdToInvoiceId = new Map<string, string>();
  let unmatched = 0;

  for (const row of rows) {
    const email = row.customer_email.trim().toLowerCase();
    const customerId =
      (email && customerMaps.emailToCustomerId.get(email)) ||
      customerMaps.nameToCustomerId.get(row.customer_name.trim().toLowerCase());
    if (!customerId) {
      console.warn(`  no customer match for order ${row.order_id} (${row.customer_name})`);
      unmatched++;
      continue;
    }

    const discount = dec(row.discount);
    const subtotalPreDiscount = dec(row.subtotal);
    const subtotal = subtotalPreDiscount.minus(discount);
    const taxAmount = dec(row.tax);
    const taxRate = dec(row.tax_percentage).dividedBy(100);
    const total = dec(row.total);
    const amountPaid = dec(row.paid_amount);
    const balanceDue = dec(row.balance_due);
    const issueDate = parseDate(row.order_issue_date) ?? new Date();
    const dueDate = parseDate(row.order_customer_in_hand_date);

    const invoice = await prisma.invoice.create({
      data: {
        customerId,
        status: invoiceStatus(amountPaid, balanceDue),
        title: row.order_name.trim() || null,
        issueDate,
        dueDate,
        subtotal,
        taxRate,
        taxAmount,
        total,
        amountPaid,
        notes: `Imported from YoPrint (Order ${row.order_id})`,
        lineItems: {
          create: [
            {
              description: row.order_name.trim() || row.jobs.trim() || "Order",
              quantity: 1,
              unitPrice: subtotalPreDiscount,
              taxable: taxAmount.greaterThan(0),
              lineTotal: subtotalPreDiscount,
              sortOrder: 0,
            },
            ...(discount.greaterThan(0)
              ? [
                  {
                    description: "Discount",
                    quantity: 1,
                    unitPrice: discount.negated(),
                    taxable: false,
                    lineTotal: discount.negated(),
                    sortOrder: 1,
                  },
                ]
              : []),
          ],
        },
      },
    });

    orderIdToInvoiceId.set(row.order_id, invoice.id);
    if (row.invoice_id.trim()) {
      yoprintInvoiceIdToInvoiceId.set(row.invoice_id.trim(), invoice.id);
    }
  }

  console.log(`Invoices: ${rows.length} rows, ${unmatched} unmatched, ${orderIdToInvoiceId.size} created`);
  return { orderIdToInvoiceId, yoprintInvoiceIdToInvoiceId };
}

async function importPayments(
  yoprintInvoiceIdToInvoiceId: Map<string, string>,
  customerMaps: {
    emailToCustomerId: Map<string, string>;
    nameToCustomerId: Map<string, string>;
  },
) {
  const rows = readCsv("payment-export - Zainab.csv");
  let created = 0;
  let orphanInvoicesCreated = 0;

  for (const row of rows) {
    const yoprintInvoiceId = row.invoices.trim();
    let invoiceId = yoprintInvoiceIdToInvoiceId.get(yoprintInvoiceId);

    if (!invoiceId) {
      // Orphan: no matching row in invoice-export or sales-order-export.
      // Create a bare invoice so the payment has somewhere to attach —
      // total is just the amount paid, no line-item/tax detail available.
      const customerId = customerMaps.nameToCustomerId.get(
        row.customer_name.trim().toLowerCase(),
      );
      if (!customerId) {
        console.warn(
          `  orphan payment for ${row.order_id} (${row.customer_name}): no customer match, skipping`,
        );
        continue;
      }
      const amount = dec(row.amount);
      const invoice = await prisma.invoice.create({
        data: {
          customerId,
          status: "PAID",
          title: row.order_label.trim() || null,
          issueDate: parseDate(row.date) ?? new Date(),
          subtotal: amount,
          taxRate: 0,
          taxAmount: 0,
          total: amount,
          amountPaid: amount,
          notes: `Imported from YoPrint (Order ${row.order_id}) — no invoice/order data found in export, total inferred from payment amount`,
          lineItems: {
            create: [
              {
                description: row.order_label.trim() || "Order",
                quantity: 1,
                unitPrice: amount,
                taxable: false,
                lineTotal: amount,
                sortOrder: 0,
              },
            ],
          },
        },
      });
      invoiceId = invoice.id;
      yoprintInvoiceIdToInvoiceId.set(yoprintInvoiceId, invoiceId);
      orphanInvoicesCreated++;
    }

    await prisma.payment.create({
      data: {
        invoiceId,
        amount: dec(row.amount),
        method: paymentMethod(row.payment_method),
        reference: row.reference_id.trim() || null,
        notes: row.reference_description.trim() || null,
        receivedAt: parseDate(row.date) ?? new Date(),
      },
    });
    created++;
  }

  console.log(
    `Payments: ${rows.length} rows, ${created} created, ${orphanInvoicesCreated} orphan invoices created`,
  );
}

const PRICING_FILES: {
  file: string;
  gridName: string;
  method: DecorationMethod;
  tierLabel: string;
  useHighOfRange?: boolean;
}[] = [
  {
    file: "yoprint_service_pricing_Screen Printing (Water Based - A4 (8_ X 11.5_)).csv",
    gridName: "Screen print — Water Based (A4)",
    method: "SCREEN_PRINT",
    tierLabel: "Colors",
  },
  {
    file: "yoprint_service_pricing_Screen Printing (Water Based - A5 (6_ X 8_)).csv",
    gridName: "Screen print — Water Based (A5)",
    method: "SCREEN_PRINT",
    tierLabel: "Colors",
  },
  {
    file: "yoprint_service_pricing_Screen Printing (Plastisol - A4 (8_ X 11.5_)).csv",
    gridName: "Screen print — Plastisol (A4)",
    method: "SCREEN_PRINT",
    tierLabel: "Colors",
  },
  {
    file: "yoprint_service_pricing_Embroidery.csv",
    gridName: "Embroidery — standard",
    method: "EMBROIDERY",
    tierLabel: "Stitch count (k)",
  },
  {
    file: "yoprint_service_pricing_Laser Engraving.csv",
    gridName: "Laser engraving — standard",
    method: "LASER_ENGRAVING",
    tierLabel: "Type",
  },
  {
    file: "yoprint_service_pricing_Custom Promo Product.csv",
    gridName: "Promotional — standard",
    method: "PROMOTIONAL",
    tierLabel: "Shape",
  },
  {
    file: "yoprint_service_pricing_Direct To Transfer.csv",
    gridName: "DTF — standard",
    method: "DTF",
    tierLabel: "Size",
    useHighOfRange: true,
  },
];

async function importPricing() {
  for (const spec of PRICING_FILES) {
    const raw = readFileSync(path.join(DATA_DIR, spec.file), "utf-8");
    const rows: Record<string, string>[] = parse(raw, {
      columns: true,
      skip_empty_lines: true,
      bom: true,
    });
    const header = Object.keys(rows[0]).filter((k) => k !== "qty/type");

    const existing = await prisma.priceGrid.findFirst({
      where: { name: spec.gridName },
    });
    if (existing) {
      console.log(`Pricing: "${spec.gridName}" already exists, skipping`);
      continue;
    }

    const grid = await prisma.priceGrid.create({
      data: { name: spec.gridName, method: spec.method, tierLabel: spec.tierLabel },
    });

    let cellCount = 0;
    for (const row of rows) {
      const minQuantity = parseInt(row["qty/type"], 10);
      for (const [tierIndex, tierName] of header.entries()) {
        const raw = row[tierName];
        if (!raw) continue;
        const value = spec.useHighOfRange
          ? raw.split("|").map((s) => s.trim()).pop()!
          : raw.split("|")[0].trim();
        await prisma.priceCell.upsert({
          where: {
            gridId_minQuantity_tier: { gridId: grid.id, minQuantity, tier: tierIndex + 1 },
          },
          create: {
            gridId: grid.id,
            minQuantity,
            tier: tierIndex + 1,
            unitPrice: new Prisma.Decimal(value),
          },
          update: { unitPrice: new Prisma.Decimal(value) },
        });
        cellCount++;
      }
    }
    console.log(`Pricing: "${spec.gridName}" -> ${cellCount} cells (tiers: ${header.join(", ")})`);
  }
}

async function main() {
  console.log(`Importing from ${DATA_DIR}\n`);

  console.log("== Customers ==");
  const customerMaps = await importCustomers();

  console.log("\n== Invoices ==");
  const { yoprintInvoiceIdToInvoiceId } = await importInvoices(customerMaps);

  console.log("\n== Payments ==");
  await importPayments(yoprintInvoiceIdToInvoiceId, customerMaps);

  console.log("\n== Pricing ==");
  await importPricing();

  console.log("\nDone.");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
