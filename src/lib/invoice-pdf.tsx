import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";

import {
  formatDate,
  formatMoney,
  formatUnitPrice,
  invoiceNumber,
} from "./format";

// Brand colors, matching the app (see globals.css).
const GOLD = "#a9814f";
const CHARCOAL = "#1a1a1a";
const MUTED = "#6b7280";
const BORDER = "#e5e7eb";

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 56,
    paddingHorizontal: 44,
    fontSize: 10,
    color: CHARCOAL,
    fontFamily: "Helvetica",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 28,
  },
  logo: { width: 56, height: 56, marginRight: 12 },
  shopName: { fontSize: 15, fontFamily: "Helvetica-Bold" },
  docTitle: {
    fontSize: 24,
    fontFamily: "Helvetica-Bold",
    color: GOLD,
    textAlign: "right",
  },
  docNumber: { fontSize: 12, textAlign: "right", marginTop: 2 },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  metaBlock: { flexGrow: 1, flexBasis: 0 },
  label: {
    fontSize: 8,
    color: MUTED,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  tableHead: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: CHARCOAL,
    paddingBottom: 5,
    marginBottom: 2,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingVertical: 6,
  },
  colDesc: { flexGrow: 1, flexBasis: 0 },
  colQty: { width: 50, textAlign: "right" },
  colPrice: { width: 78, textAlign: "right" },
  colTotal: { width: 82, textAlign: "right" },
  headText: { fontSize: 8, color: MUTED, fontFamily: "Helvetica-Bold" },
  totals: { marginTop: 14, marginLeft: "auto", width: 230 },
  totalLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  grandTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: CHARCOAL,
    marginTop: 4,
    paddingTop: 6,
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
  },
  balanceDue: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#faf6f0",
    borderWidth: 1,
    borderColor: GOLD,
    marginTop: 8,
    padding: 7,
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
  },
  terms: {
    marginTop: 28,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  footer: {
    position: "absolute",
    bottom: 26,
    left: 44,
    right: 44,
    textAlign: "center",
    fontSize: 8,
    color: MUTED,
  },
});

export interface InvoicePdfData {
  number: number;
  title: string | null;
  status: string;
  issueDate: Date;
  dueDate: Date | null;
  subtotal: string;
  taxRate: string;
  taxAmount: string;
  total: string;
  amountPaid: string;
  balance: string;
  /** Customer-facing terms. Internal notes are deliberately excluded. */
  terms: string | null;
  customer: {
    name: string;
    email: string | null;
    phone: string | null;
    address: {
      line1: string;
      line2: string | null;
      city: string;
      state: string | null;
      postalCode: string | null;
      country: string;
    } | null;
  };
  lineItems: {
    id: string;
    description: string;
    quantity: number;
    unitPrice: string;
    lineTotal: string;
  }[];
}

const SHOP_NAME = "DZ Custom Products";

async function loadLogo(): Promise<Buffer | null> {
  // Deliberately a downscaled copy: react-pdf embeds the raw bytes, so the
  // full-size logo.png (1500px, ~1.5MB) would bloat every invoice. This one
  // is 256px — still sharp at the ~56pt it renders at.
  try {
    return await readFile(path.join(process.cwd(), "public", "logo-pdf.png"));
  } catch {
    return null; // Logo is decorative — never block the invoice on it.
  }
}

/** Render a customer-facing invoice PDF. Internal notes are never included. */
export async function renderInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  const logo = await loadLogo();
  const taxPercent = Number(data.taxRate) * 100;
  const addr = data.customer.address;

  return renderToBuffer(
    <Document
      title={`${invoiceNumber(data.number)} — ${SHOP_NAME}`}
      author={SHOP_NAME}
    >
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {logo && (
              // This is @react-pdf/renderer's Image (a PDF primitive), not an
              // HTML <img>; it has no alt prop and PDFs carry no a11y tree.
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image style={styles.logo} src={{ data: logo, format: "png" }} />
            )}
            <Text style={styles.shopName}>{SHOP_NAME}</Text>
          </View>
          <View>
            <Text style={styles.docTitle}>INVOICE</Text>
            <Text style={styles.docNumber}>{invoiceNumber(data.number)}</Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaBlock}>
            <Text style={styles.label}>BILL TO</Text>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>
              {data.customer.name}
            </Text>
            {addr && (
              <>
                <Text>{addr.line1}</Text>
                {addr.line2 ? <Text>{addr.line2}</Text> : null}
                <Text>
                  {[addr.city, addr.state, addr.postalCode]
                    .filter(Boolean)
                    .join(", ")}
                </Text>
                <Text>{addr.country}</Text>
              </>
            )}
            {data.customer.email ? <Text>{data.customer.email}</Text> : null}
            {data.customer.phone ? <Text>{data.customer.phone}</Text> : null}
          </View>
          <View style={[styles.metaBlock, { alignItems: "flex-end" }]}>
            <Text style={styles.label}>ISSUED</Text>
            <Text style={{ marginBottom: 6 }}>
              {formatDate(data.issueDate)}
            </Text>
            {data.dueDate && (
              <>
                <Text style={styles.label}>DUE</Text>
                <Text>{formatDate(data.dueDate)}</Text>
              </>
            )}
          </View>
        </View>

        {data.title ? (
          <Text style={{ marginBottom: 12, fontFamily: "Helvetica-Bold" }}>
            {data.title}
          </Text>
        ) : null}

        <View style={styles.tableHead}>
          <Text style={[styles.colDesc, styles.headText]}>DESCRIPTION</Text>
          <Text style={[styles.colQty, styles.headText]}>QTY</Text>
          <Text style={[styles.colPrice, styles.headText]}>UNIT PRICE</Text>
          <Text style={[styles.colTotal, styles.headText]}>TOTAL</Text>
        </View>
        {data.lineItems.map((l) => (
          <View key={l.id} style={styles.row} wrap={false}>
            <Text style={styles.colDesc}>{l.description}</Text>
            <Text style={styles.colQty}>{l.quantity}</Text>
            <Text style={styles.colPrice}>{formatUnitPrice(l.unitPrice)}</Text>
            <Text style={styles.colTotal}>{formatMoney(l.lineTotal)}</Text>
          </View>
        ))}

        <View style={styles.totals}>
          <View style={styles.totalLine}>
            <Text style={{ color: MUTED }}>Subtotal</Text>
            <Text>{formatMoney(data.subtotal)}</Text>
          </View>
          <View style={styles.totalLine}>
            <Text style={{ color: MUTED }}>
              Tax ({taxPercent.toFixed(taxPercent % 1 === 0 ? 0 : 2)}%)
            </Text>
            <Text>{formatMoney(data.taxAmount)}</Text>
          </View>
          <View style={styles.grandTotal}>
            <Text>Total</Text>
            <Text>{formatMoney(data.total)}</Text>
          </View>
          {Number(data.amountPaid) > 0 && (
            <View style={styles.totalLine}>
              <Text style={{ color: MUTED }}>Paid</Text>
              <Text>−{formatMoney(data.amountPaid)}</Text>
            </View>
          )}
          <View style={styles.balanceDue}>
            <Text>Balance due</Text>
            <Text>{formatMoney(data.balance)}</Text>
          </View>
        </View>

        {data.terms ? (
          <View style={styles.terms}>
            <Text style={styles.label}>TERMS</Text>
            <Text>{data.terms}</Text>
          </View>
        ) : null}

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `${SHOP_NAME} · ${invoiceNumber(data.number)} · Page ${pageNumber} of ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>,
  );
}
