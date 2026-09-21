import { NextRequest, NextResponse } from "next/server";
import { getBasisMulti } from "@/lib/earn/services/basis.service";

// ============================================================
// API: /api/earn/basis?symbol=BTCUSDT
// Devuelve basis multi-exchange: Binance COIN-M → Bybit (cálculo)
// ============================================================

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get("symbol") || "BTCUSDT").toUpperCase();

  try {
    const result = await getBasisMulti(symbol);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({
      primary: null,
      fallbacks: [],
      failed: [{ exchange: "ALL", reason: err?.message || "Error interno" }],
      updatedAt: Date.now(),
    }, { status: 200 });
  }
}
