import { NextRequest, NextResponse } from "next/server";
import { getMsgs, verifyChain } from "@/lib/escrow/store";

// ============================================================
// API: /api/escrow/messages?escrowId=xxx
// Devuelve mensajes + verificación de integridad del hash chain
// ============================================================

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const escrowId = searchParams.get("escrowId");
  if (!escrowId) return NextResponse.json({ error: "escrowId requerido" }, { status: 400 });

  const messages = getMsgs(escrowId);
  const integrity = verifyChain(escrowId);

  return NextResponse.json({
    messages,
    count: messages.length,
    integrity,
  });
}
