import { NextRequest, NextResponse } from "next/server";
import { scanMarketData } from "@/lib/scanner/engine";

// GET /api/scanner/market?asset=BTC&quote=USDT
// Devuelve quotes de TODOS los providers para el par solicitado
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const asset = (searchParams.get("asset") || "BTC").toUpperCase();
  const quote = (searchParams.get("quote") || "USDT").toUpperCase();

  const quotes = await scanMarketData(asset, quote);
  return NextResponse.json({
    asset,
    quote,
    quotes,
    timestamp: Date.now(),
    providersOk: quotes.filter((q) => q.status === "ONLINE").length,
    providersTotal: quotes.length,
  });
}
