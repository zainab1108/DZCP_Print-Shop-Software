import "dotenv/config";
import { readFileSync } from "node:fs";
import path from "node:path";

import { parse } from "csv-parse/sync";
import { PrismaPg } from "@prisma/adapter-pg";

import { Prisma, PrismaClient } from "../src/generated/prisma/client";

const DATA_DIR = process.argv[2];
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

function readCsv(filename: string): Record<string, string>[] {
  const raw = readFileSync(path.join(DATA_DIR, filename), "utf-8");
  return parse(raw, { columns: true, skip_empty_lines: true, bom: true });
}

async function main() {
  const invoiceRows = readCsv("invoice-export - Zainab.csv");
  const csvTotal = invoiceRows.reduce(
    (sum, r) => sum.plus(new Prisma.Decimal(r.total || 0)),
    new Prisma.Decimal(0),
  );
  const csvPaid = invoiceRows.reduce(
    (sum, r) => sum.plus(new Prisma.Decimal(r.paid_amount || 0)),
    new Prisma.Decimal(0),
  );

  const imported = await prisma.invoice.findMany({
    where: { notes: { contains: "Imported from YoPrint" } },
    include: { lineItems: true, payments: true },
  });

  const dbTotal = imported.reduce((s, i) => s.plus(i.total), new Prisma.Decimal(0));
  const dbPaid = imported.reduce((s, i) => s.plus(i.amountPaid), new Prisma.Decimal(0));

  console.log(`Imported invoices: ${imported.length} (CSV had ${invoiceRows.length} + 3 orphan-payment invoices)`);
  console.log(`CSV total:  ${csvTotal.toFixed(2)}   DB total:  ${dbTotal.toFixed(2)}`);
  console.log(`CSV paid:   ${csvPaid.toFixed(2)}   DB paid:   ${dbPaid.toFixed(2)}  (DB includes 3 orphan invoices' amounts, so DB paid > CSV paid by their sum)`);

  // Every invoice's line items should sum to its subtotal.
  let lineItemMismatch = 0;
  for (const inv of imported) {
    const lineSum = inv.lineItems.reduce((s, l) => s.plus(l.lineTotal), new Prisma.Decimal(0));
    if (!lineSum.equals(inv.subtotal)) {
      lineItemMismatch++;
      console.warn(`  MISMATCH inv #${inv.number}: subtotal=${inv.subtotal} but lineItems sum=${lineSum}`);
    }
  }
  console.log(`Line-item sum mismatches: ${lineItemMismatch}`);

  // subtotal + tax should equal total for every invoice.
  let mathMismatch = 0;
  for (const inv of imported) {
    if (!inv.subtotal.plus(inv.taxAmount).equals(inv.total)) {
      mathMismatch++;
      console.warn(`  MATH MISMATCH inv #${inv.number}: ${inv.subtotal} + ${inv.taxAmount} != ${inv.total}`);
    }
  }
  console.log(`subtotal+tax=total mismatches: ${mathMismatch}`);

  // Payment records per invoice vs amountPaid field (these come from two
  // different CSVs and could disagree).
  let paymentMismatch = 0;
  for (const inv of imported) {
    const paySum = inv.payments.reduce((s, p) => s.plus(p.amount), new Prisma.Decimal(0));
    if (!paySum.equals(inv.amountPaid)) {
      paymentMismatch++;
      console.warn(`  PAYMENT MISMATCH inv #${inv.number} (${inv.title}): amountPaid=${inv.amountPaid} but payments sum=${paySum}`);
    }
  }
  console.log(`Payment-sum vs amountPaid mismatches: ${paymentMismatch}`);

  const customerCount = await prisma.customer.count();
  const addressCount = await prisma.address.count();
  const contactCount = await prisma.contact.count();
  const gridCount = await prisma.priceGrid.count();
  const cellCount = await prisma.priceCell.count();
  console.log(`\nCustomers: ${customerCount}, Addresses: ${addressCount}, Contacts: ${contactCount}`);
  console.log(`Price grids: ${gridCount}, Price cells: ${cellCount}`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
