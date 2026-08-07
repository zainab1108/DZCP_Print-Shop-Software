import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { StyleSheet } from "@react-pdf/renderer";

// Brand colors, matching the app (see globals.css).
export const GOLD = "#a9814f";
export const CHARCOAL = "#1a1a1a";
export const MUTED = "#6b7280";
export const BORDER = "#e5e7eb";

export const SHOP_NAME = "DZ Custom Products";

export const pdfStyles = StyleSheet.create({
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

export interface PdfCustomer {
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
}

export interface PdfLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
}

/**
 * Deliberately a downscaled copy: react-pdf embeds the raw bytes, so the
 * full-size logo.png (1500px, ~1.5MB) would bloat every PDF. This one is
 * 256px — still sharp at the ~56pt it renders at.
 */
export async function loadLogo(): Promise<Buffer | null> {
  try {
    return await readFile(path.join(process.cwd(), "public", "logo-pdf.png"));
  } catch {
    return null; // Logo is decorative — never block the document on it.
  }
}
