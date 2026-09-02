import { NextRequest, NextResponse } from "next/server";
import { scanMarketData } from "@/lib/scanner/engine";
import { detectArbitrage } from "@/lib/scanner/comparison";

// GET /api/scanner/arbitrage?asset=BTC&quote=USDT&capital=1000
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const asset = (searchParams.get("asset") || "BTC").toUpperCase();
  const quote = (searchParams.get("quote") || "USDT").toUpperCase();
  const capital = parseFloat(searchParams.get("capital") || "1000");

  const quotes = await scanMarketData(asset, quote);
  const opportunities = detectArbitrage(quotes, capital);

  return NextResponse.json({
    asset,
    quote,
    capital,
    opportunities,
    timestamp: Date.now(),
    quotesChecked: quotes.length,
    note: "Oportunidades de arbitraje detectadas. NO ejecuta la operación. ROI estimado, no garantizado.",
  });
}
