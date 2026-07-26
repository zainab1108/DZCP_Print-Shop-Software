import { NextResponse } from "next/server";

import { readProofFile } from "@/lib/proof-storage";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Admin download — consistent with the rest of the admin area, which has
// no login system of its own.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const proof = await prisma.proof.findUnique({ where: { id } });
  if (!proof) return NextResponse.json({ error: "Not found" }, { status: 404 });

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
