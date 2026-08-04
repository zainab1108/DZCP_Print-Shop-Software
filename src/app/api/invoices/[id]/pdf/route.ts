import { NextResponse } from "next/server";

import { renderInvoicePdf } from "@/lib/invoice-pdf";
import { invoicePdfFilename, loadInvoicePdfData } from "@/lib/invoice-pdf-data";

export const dynamic = "force-dynamic";

// Staff download. The proxy gates /api/* behind a valid session already.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const loaded = await loadInvoicePdfData(id);
  if (!loaded) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const pdf = await renderInvoicePdf(loaded.data);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoicePdfFilename(loaded.data.number)}"`,
      "Cache-Control": "no-store",
    },
  });
}
