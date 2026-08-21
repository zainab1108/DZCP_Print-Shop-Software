import "server-only";

import {
  Document,
  Image,
  Page,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";

import {
  formatDate,
  formatMoney,
  formatUnitPrice,
  salesOrderNumber,
} from "./format";
import {
  loadLogo,
  MUTED,
  pdfStyles as styles,
  SHOP_NAME,
  type PdfCustomer,
  type PdfLineItem,
} from "./pdf-shared";

export interface SalesOrderPdfData {
  number: number;
  title: string | null;
  issueDate: Date;
  dueDate: Date | null;
  subtotal: string;
  /** Resolved discount in dollars; "0" when there isn't one. */
  discountAmount: string;
  discountType: "PERCENT" | "AMOUNT";
  discountValue: string;
  taxRate: string;
  taxAmount: string;
  total: string;
  /** Customer-facing terms. Internal notes are deliberately excluded. */
  terms: string | null;
  customer: PdfCustomer;
  lineItems: PdfLineItem[];
}

/** Render a customer-facing sales order confirmation PDF. Internal notes are never included. */
export async function renderSalesOrderPdf(
  data: SalesOrderPdfData,
): Promise<Buffer> {
  const logo = await loadLogo();
  const taxPercent = Number(data.taxRate) * 100;
  const addr = data.customer.address;

  return renderToBuffer(
    <Document
      title={`${salesOrderNumber(data.number)} — ${SHOP_NAME}`}
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
            <Text style={styles.docTitle}>SALES ORDER</Text>
            <Text style={styles.docNumber}>
              {salesOrderNumber(data.number)}
            </Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaBlock}>
            <Text style={styles.label}>FOR</Text>
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
          {Number(data.discountAmount) > 0 && (
            <View style={styles.totalLine}>
              <Text style={{ color: MUTED }}>
                {data.discountType === "PERCENT"
                  ? `Discount (${Number(data.discountValue)}%)`
                  : "Discount"}
              </Text>
              <Text>-{formatMoney(data.discountAmount)}</Text>
            </View>
          )}
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
            `${SHOP_NAME} · ${salesOrderNumber(data.number)} · Page ${pageNumber} of ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>,
  );
}
