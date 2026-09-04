import { NextRequest, NextResponse } from "next/server";
import { scanP2PArbitrage } from "@/lib/p2p-arbitrage/engine";

// GET /api/scanner/p2p-arbitrage?asset=USDT&fiat=COP
// Devuelve oportunidades de arbitraje P2P + las ofertas BUY/SELL originales
// + referencia spot (Kraken, Bitvavo, Coinbase).
// + estado de cada P2P provider (Binance, Bybit, OKX, HTX, KuCoin, Bitget, Gate).

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const asset = (searchParams.get("asset") || "USDT").toUpperCase();
  const fiat = (searchParams.get("fiat") || "COP").toUpperCase();

  try {
    const result = await scanP2PArbitrage({ asset, fiat });
    return NextResponse.json({
      asset,
      fiat,
      ...result,
      timestamp: Date.now(),
    });
  } catch (err) {
    console.error("[/api/scanner/p2p-arbitrage]", err);
    return NextResponse.json(
      { error: "Error interno: " + (err as Error).message },
      { status: 500 }
    );
  }
}
