import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { renderQuotePdf } from "@/lib/quote-pdf";
import { loadQuotePdfData, quotePdfFilename } from "@/lib/quote-pdf-data";

export const dynamic = "force-dynamic";

// Customer download. The token is the credential: it must own the quote,
// and drafts are never exposed. A guessed quote id must 404 without the
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

  const loaded = await loadQuotePdfData(id);
  if (
    !loaded ||
    loaded.customerId !== customer.id ||
    loaded.data.status === "DRAFT"
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const pdf = await renderQuotePdf(loaded.data);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${quotePdfFilename(loaded.data.number)}"`,
      "Cache-Control": "no-store",
    },
  });
}
