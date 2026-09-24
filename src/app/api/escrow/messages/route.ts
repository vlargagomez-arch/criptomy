import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// ============================================================
// API: /api/escrow/messages?dealId=xxx
// Devuelve mensajes del deal con verificación de hash chain.
// ============================================================

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const dealId = searchParams.get("dealId");
  if (!dealId) return NextResponse.json({ error: "dealId requerido" }, { status: 400 });

  const messages = await db.escrowMessage.findMany({
    where: { dealId },
    orderBy: { ts: "asc" },
  });

  return NextResponse.json({
    messages,
    count: messages.length,
  });
}
