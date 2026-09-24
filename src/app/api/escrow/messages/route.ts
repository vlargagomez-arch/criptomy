import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// ============================================================
// API: /api/escrow/messages?dealId=xxx
// Devuelve mensajes del deal. Siempre devuelve JSON válido.
// ============================================================

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const dealId = searchParams.get("dealId");
    if (!dealId) {
      return NextResponse.json({ error: "dealId requerido" }, { status: 400 });
    }

    const messages = await db.escrowMessage.findMany({
      where: { dealId },
      orderBy: { ts: "asc" },
    });

    return NextResponse.json({
      messages,
      count: messages.length,
    });
  } catch (err: any) {
    console.error("[escrow messages GET]", err);
    const msg = err?.message || "";
    if (msg.includes("relation") && msg.includes("does not exist")) {
      return NextResponse.json({
        messages: [],
        count: 0,
        error: "Las tablas de escrow no existen en la base de datos.",
        migrationNeeded: true,
      }, { status: 500 });
    }
    return NextResponse.json({
      messages: [],
      count: 0,
      error: "Error interno: " + msg.slice(0, 200),
    }, { status: 500 });
  }
}
