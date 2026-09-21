import { NextRequest, NextResponse } from "next/server";

// ============================================================
// API: /api/earn/defi — DeFi yields reales de DeFiLlama
// ============================================================
// GET /api/earn/defi?asset=USDC&type=lending
//
// DeFiLlama /yields.llama.fi/pools devuelve TODOS los pools DeFi
// con APYs reales, TVL, chain, project, tipo, etc.
//
// Normalizamos a:
// { asset, chain, project, apy, apyBase, apyReward, tvlUsd,
//   stablecoin, ilRisk, poolMeta, url, updatedAt }
// ============================================================

interface DefiLlamaPool {
  chain: string;
  project: string;
  symbol: string;
  tvlUsd: number;
  apyBase: number | null;
  apyReward: number | null;
  apy: number;
  rewardTokens: string[] | null;
  pool: string;
  apyPct1D: number | null;
  apyPct7D: number | null;
  apyPct30D: number | null;
  stablecoin: boolean;
  ilRisk: boolean | string;
  predictions: any;
  underlyingTokens: string[] | null;
}

interface NormalizedPool {
  asset: string;
  chain: string;
  project: string;
  apy: number;
  apyBase: number | null;
  apyReward: number | null;
  apy7d: number | null;
  apy30d: number | null;
  tvlUsd: number;
  stablecoin: boolean;
  ilRisk: boolean;
  yieldSource: string;
  liquidity: string;
  lockPeriod: string;
  riskFactors: string[];
  url: string;
  updatedAt: number;
}

// Cache simple en memoria
let cached: { data: NormalizedPool[]; timestamp: number } | null = null;
const CACHE_TTL = 60_000; // 1 minuto

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const assetFilter = (searchParams.get("asset") || "ALL").toUpperCase();
  const typeFilter = searchParams.get("type") || "ALL";

  try {
    // Check cache
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      let results = cached.data;
      if (assetFilter !== "ALL") {
        results = results.filter(p =>
          p.asset === assetFilter ||
          p.asset.includes(assetFilter) ||
          (assetFilter === "BTC" && (p.asset.includes("BTC") || p.asset.includes("WBTC") || p.asset.includes("CBBTC"))) ||
          (assetFilter === "ETH" && (p.asset.includes("ETH") || p.asset.includes("stETH") || p.asset.includes("wstETH")))
        );
      }
      if (typeFilter !== "ALL") {
        if (typeFilter === "lending") results = results.filter(p => p.yieldSource.includes("préstamo") || p.yieldSource.includes("lending") || p.project === "Aave" || p.project === "Compound");
        else if (typeFilter === "staking") results = results.filter(p => p.yieldSource.includes("staking") || p.project === "Lido" || p.project === "Babylon");
        else if (typeFilter === "lp") results = results.filter(p => p.ilRisk === true);
      }
      return NextResponse.json({ pools: results.slice(0, 30), count: results.length, cached: true, updatedAt: cached.timestamp });
    }

    // Fetch DeFiLlama
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    const res = await fetch("https://yields.llama.fi/pools", {
      signal: controller.signal,
      headers: { "Accept": "application/json" },
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return NextResponse.json({ error: "DeFiLlama no respondió", pools: [] }, { status: 502 });
    }

    const data = await res.json() as { data: DefiLlamaPool[] };
    if (!data.data || !Array.isArray(data.data)) {
      return NextResponse.json({ error: "Formato inesperado de DeFiLlama", pools: [] }, { status: 502 });
    }

    // Normalizar — filtrar solo pools con APY > 0 y TVL > 100K
    const normalized: NormalizedPool[] = data.data
      .filter(p => p.apy > 0 && p.tvlUsd > 100_000 && !p.symbol.includes("-"))
      .map(p => {
        const isLending = p.project === "Aave" || p.project === "Compound" || p.project === "Morpho" || p.project === "Spark";
        const isStaking = p.project === "Lido" || p.project === "Babylon" || p.project === "Rocket Pool" || p.project === "Stader";

        let yieldSource = "Rendimiento del protocolo";
        if (isLending) yieldSource = "Intereses pagados por prestatarios del mercado de préstamos.";
        else if (isStaking) yieldSource = "Recompensas de staking de la red.";
        else if (p.ilRisk) yieldSource = "Comisiones de trading del pool de liquidez.";
        else if (p.apyReward && p.apyReward > 0) yieldSource = `Intereses base + recompensas en tokens (${p.rewardTokens?.join(", ") || "tokens"}).`;

        const riskFactors: string[] = [];
        if (p.ilRisk) riskFactors.push("Impermanent loss");
        riskFactors.push("Smart contract");
        if (p.tvlUsd < 1_000_000) riskFactors.push("Liquidez baja");
        if (p.apyReward && p.apyReward > p.apyBase!) riskFactors.push("Recompensas temporales");

        const url = `https://defillama.com/yields/pool/${p.pool}`;

        return {
          asset: p.symbol,
          chain: p.chain,
          project: p.project,
          apy: p.apy,
          apyBase: p.apyBase,
          apyReward: p.apyReward,
          apy7d: p.apyPct7D !== null ? p.apy + p.apyPct7D : null,
          apy30d: p.apyPct30D !== null ? p.apy + p.apyPct30D : null,
          tvlUsd: p.tvlUsd,
          stablecoin: p.stablecoin,
          ilRisk: p.ilRisk === true,
          yieldSource,
          liquidity: "Flexible",
          lockPeriod: "Ninguno",
          riskFactors,
          url,
          updatedAt: Date.now(),
        };
      })
      .sort((a, b) => b.apy - a.apy)
      .slice(0, 50); // Top 50

    cached = { data: normalized, timestamp: Date.now() };

    // Apply filters
    let results = normalized;
    if (assetFilter !== "ALL") {
      results = results.filter(p =>
        p.asset === assetFilter ||
        p.asset.includes(assetFilter) ||
        (assetFilter === "BTC" && (p.asset.includes("BTC") || p.asset.includes("WBTC") || p.asset.includes("CBBTC"))) ||
        (assetFilter === "ETH" && (p.asset.includes("ETH") || p.asset.includes("stETH") || p.asset.includes("wstETH")))
      );
    }
    if (typeFilter !== "ALL") {
      if (typeFilter === "lending") results = results.filter(p => p.project === "Aave" || p.project === "Compound" || p.project === "Morpho" || p.project === "Spark");
      else if (typeFilter === "staking") results = results.filter(p => p.project === "Lido" || p.project === "Babylon" || p.project === "Rocket Pool");
      else if (typeFilter === "lp") results = results.filter(p => p.ilRisk === true);
    }

    return NextResponse.json({ pools: results.slice(0, 30), count: results.length, cached: false, updatedAt: cached.timestamp });
  } catch (err) {
    return NextResponse.json({ error: "Esta fuente no respondió en este momento.", pools: [] }, { status: 502 });
  }
}
