import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { readProofFile } from "@/lib/proof-storage";

export const dynamic = "force-dynamic";

// Portal download — the token must own the proof's quote. Never trust the
// proof id alone; a guessed id must still 404 without the matching token.
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

  const proof = await prisma.proof.findUnique({
    where: { id },
    include: { quote: { select: { customerId: true } } },
  });
  if (!proof || proof.quote.customerId !== customer.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const bytes = await readProofFile(proof.id, proof.fileExt);
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": proof.mimeType,
        "Content-Disposition": `inline; filename="${proof.fileName}"`,
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    });
  } catch {
    return NextResponse.json({ error: "File missing" }, { status: 404 });
  }
}
