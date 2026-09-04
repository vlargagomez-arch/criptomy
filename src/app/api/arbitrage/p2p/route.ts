import { NextRequest, NextResponse } from "next/server";
import { scanP2PArbitrage } from "@/lib/p2p-arbitrage/engine-v3";

// GET /api/arbitrage/p2p?asset=USDT&fiat=COP&rows=15&payment=Nequi&exchanges=binance,okx,bybit,kraken&minReputation=80&minNetSpread=0.1
//
// Devuelve oportunidades de arbitraje P2P calculadas con el algoritmo v3:
//   1. Fetch paralelo 4 exchanges (Binance P2P, OKX P2P, Bybit P2P, Kraken Spot)
//      8 requests en paralelo (4 × BUY + 4 × SELL)
//   2. Filtro reputation >= minReputation (default 80)
//   3. Conversión Kraken USDT → fiat local
//   4. Sort BUY asc, SELL desc
//   5. Cross-match top 12 × top 12 = 144 max
//   6. Cálculo profit NETO después de fees de retiro (flat)
//   7. Filtro netSpread >= 0.1% y profit > 0
//   8. Top 30 ordenadas por netSpread desc

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const asset = (searchParams.get("asset") || "USDT").toUpperCase();
  const fiat = (searchParams.get("fiat") || "USD").toUpperCase();
  const rows = Math.min(parseInt(searchParams.get("rows") || "15", 10), 30);
  const payment = searchParams.get("payment") || undefined;
  const exchanges = searchParams.get("exchanges") || "binance,okx,bybit,kraken";
  const minReputation = parseInt(searchParams.get("minReputation") || "90", 10);
  const minNetSpread = parseFloat(searchParams.get("minNetSpread") || "0.1");

  try {
    const result = await scanP2PArbitrage({
      asset, fiat, rows, payment, exchanges, minReputation, minNetSpread,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[/api/arbitrage/p2p]", err);
    return NextResponse.json(
      { success: false, error: "Error interno: " + (err as Error).message },
      { status: 500 }
    );
  }
}

// POST también soportado (mismo params en body)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const asset = (body.asset || "USDT").toUpperCase();
    const fiat = (body.fiat || "USD").toUpperCase();
    const rows = Math.min(parseInt(body.rows || "15", 10), 30);
    const payment = body.payment || undefined;
    const exchanges = body.exchanges || "binance,okx,bybit,kraken";
    const minReputation = parseInt(body.minReputation || "90", 10);
    const minNetSpread = parseFloat(body.minNetSpread || "0.1");

    const result = await scanP2PArbitrage({
      asset, fiat, rows, payment, exchanges, minReputation, minNetSpread,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[/api/arbitrage/p2p POST]", err);
    return NextResponse.json(
      { success: false, error: "Error interno: " + (err as Error).message },
      { status: 500 }
    );
  }
}
