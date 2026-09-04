import { NextRequest, NextResponse } from "next/server";
import { scanP2PArbitrageV2 } from "@/lib/p2p-arbitrage/engine-v2";

// GET /api/scanner/p2p-arbitrage?asset=USDT&fiat=COP
// Devuelve oportunidades de arbitraje P2P calculadas con el algoritmo v2:
//   1. Fetch paralelo BUY+SELL de 4 exchanges (8 requests en paralelo)
//   2. Filtro reputation: completionRate ≥ 80%
//   3. Sort: BUY asc, SELL desc
//   4. Cross-match: top 12 BUY × top 12 SELL = 144 max
//   5. Cálculo: grossSpread, withdrawalFee (1 USDT TRC20), netSpread, opSize, netProfit
//   6. Filtro: netSpread ≥ 0.1% y profit > 0
//   7. Sort por netSpread desc
//   8. Top 30 oportunidades
//
// Body opcional: { clientBuyOffers: [], clientSellOffers: [] }
// (ofertas adicionales del client-side fetch, para exchanges bloqueados server)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const asset = (searchParams.get("asset") || "USDT").toUpperCase();
  const fiat = (searchParams.get("fiat") || "COP").toUpperCase();

  try {
    // Sin client-side offers por GET (solo server-side)
    const result = await scanP2PArbitrageV2({ asset, fiat });
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

// POST permite pasar client-side offers del navegador
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const asset = (body.asset || "USDT").toUpperCase();
    const fiat = (body.fiat || "COP").toUpperCase();
    const clientBuyOffers = body.clientBuyOffers || [];
    const clientSellOffers = body.clientSellOffers || [];

    const result = await scanP2PArbitrageV2({
      asset,
      fiat,
      clientBuyOffers,
      clientSellOffers,
      withdrawalNetwork: body.withdrawalNetwork || "TRC20",
    });
    return NextResponse.json({
      asset,
      fiat,
      ...result,
      timestamp: Date.now(),
    });
  } catch (err) {
    console.error("[/api/scanner/p2p-arbitrage POST]", err);
    return NextResponse.json(
      { error: "Error interno: " + (err as Error).message },
      { status: 500 }
    );
  }
}
