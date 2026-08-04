import { NextResponse } from "next/server";

import { renderInvoicePdf } from "@/lib/invoice-pdf";
import { invoicePdfFilename, loadInvoicePdfData } from "@/lib/invoice-pdf-data";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Customer download. The token is the credential: it must own the invoice,
// and drafts are never exposed. A guessed invoice id must 404 without the
// matching token.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string; id: string }> },
) {
  const { token, id } = await params;

  const customer = await prisma.customer.findUnique({
    where: { portalToken: token },
    select: { id: true },
  });
  if (!customer) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const loaded = await loadInvoicePdfData(id);
  if (
    !loaded ||
    loaded.customerId !== customer.id ||
    loaded.data.status === "DRAFT"
  ) {
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
