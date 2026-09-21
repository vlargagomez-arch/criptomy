import { NextRequest, NextResponse } from "next/server";
import { getEarnOpportunities } from "@/lib/earn/services/earn.service";

// ============================================================
// API: /api/earn/defi?asset=BTC&type=lending
// Devuelve oportunidades DeFi reales de DeFiLlama.
// ============================================================

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const asset = searchParams.get("asset") || "ALL";
  const type = searchParams.get("type") || "ALL";

  try {
    const result = await getEarnOpportunities({ asset, type: type as any });
    return NextResponse.json({
      pools: result.opportunities,
      count: result.total,
      cached: result.cached,
      updatedAt: result.updatedAt,
      source: result.source,
    });
  } catch (err: any) {
    return NextResponse.json({
      error: err?.message || "Esta fuente no respondió en este momento.",
      pools: [],
      count: 0,
      cached: false,
      updatedAt: Date.now(),
      source: "DeFiLlama",
    }, { status: 200 });
  }
}
