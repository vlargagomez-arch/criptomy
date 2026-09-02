import { NextRequest, NextResponse } from "next/server";
import { scanP2P } from "@/lib/scanner/engine";

// GET /api/scanner/p2p?asset=USDT&fiat=COP&tradeType=BUY
// Devuelve ofertas P2P de Binance (único con endpoint público)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const asset = (searchParams.get("asset") || "USDT").toUpperCase();
  const fiat = (searchParams.get("fiat") || "COP").toUpperCase();
  const tradeType = ((searchParams.get("tradeType") || "BUY").toUpperCase() === "SELL" ? "SELL" : "BUY") as "BUY" | "SELL";
  const payTypes = searchParams.get("payTypes")?.split(",").filter(Boolean);

  const offers = await scanP2P({ asset, fiat, tradeType, payTypes });
  return NextResponse.json({
    asset,
    fiat,
    tradeType,
    offers,
    timestamp: Date.now(),
    count: offers.length,
    provider: "binance",
    note: "Solo Binance P2P disponible vía API pública. OKX y Bybit requieren advertiser role.",
  });
}
