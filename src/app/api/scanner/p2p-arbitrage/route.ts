import { NextRequest, NextResponse } from "next/server";
import { scanP2PArbitrage } from "@/lib/p2p-arbitrage/engine";

// GET /api/scanner/p2p-arbitrage?asset=USDT&fiat=COP
// Devuelve oportunidades de arbitraje P2P + las ofertas BUY/SELL originales
// + referencia spot (Kraken, Bitvavo, Coinbase).
//
// Responde al requerimiento del usuario:
//   "crear una sección ahí de arbitraje P2P, ya sabe que tiene que
//    incluir Binance, Kraken, Bitvavo o incluir más más opciones"
//   "el mercado P2P que coincida con los mismos números o las mismas
//    cantidades del momento de compra y de venta"

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
      providers: [
        { id: "binance-p2p", name: "Binance P2P", role: "P2P (BUY + SELL)", status: "ONLINE", note: "Mayor mercado P2P de LATAM" },
        { id: "kraken", name: "Kraken", role: "Spot referencia", status: result.spotProviders.find((p) => p.provider === "kraken")?.status || "OFFLINE" },
        { id: "bitvavo", name: "Bitvavo", role: "Spot referencia EU", status: result.spotProviders.find((p) => p.provider === "bitvavo")?.status || "OFFLINE" },
        { id: "coinbase", name: "Coinbase", role: "Spot referencia USA", status: result.spotProviders.find((p) => p.provider === "coinbase")?.status || "OFFLINE" },
      ],
    });
  } catch (err) {
    console.error("[/api/scanner/p2p-arbitrage]", err);
    return NextResponse.json(
      { error: "Error interno: " + (err as Error).message },
      { status: 500 }
    );
  }
}
