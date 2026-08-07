import { NextResponse } from "next/server";

import { renderSalesOrderPdf } from "@/lib/sales-order-pdf";
import {
  loadSalesOrderPdfData,
  salesOrderPdfFilename,
} from "@/lib/sales-order-pdf-data";

export const dynamic = "force-dynamic";

// Staff download. The proxy gates /api/* behind a valid session already.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const data = await loadSalesOrderPdfData(id);
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const pdf = await renderSalesOrderPdf(data);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${salesOrderPdfFilename(data.number)}"`,
      "Cache-Control": "no-store",
    },
  });
}
