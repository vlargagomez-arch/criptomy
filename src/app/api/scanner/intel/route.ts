import { NextResponse } from "next/server";
import {
  fetchEthGasPrice,
  fetchFearGreedIndex,
  fetchTrendingCoins,
  fetchTopMovers,
  STAKING_YIELDS,
} from "@/lib/scanner/market-intel";

// GET /api/scanner/intel — datos de mercado adicionales (gas, fear&greed, trending, movers, staking)
// Todo público, sin API key.
export async function GET() {
  try {
    const [gas, fearGreed, trending, movers] = await Promise.all([
      fetchEthGasPrice(),
      fetchFearGreedIndex(),
      fetchTrendingCoins(),
      fetchTopMovers(),
    ]);

    return NextResponse.json({
      gas,
      fearGreed,
      trending,
      gainers: movers.gainers,
      losers: movers.losers,
      stakingYields: STAKING_YIELDS,
      timestamp: Date.now(),
    });
  } catch (err) {
    console.error("[/api/scanner/intel]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
