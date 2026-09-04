// ============================================================
// AAVE V3 — Préstamos y rendimientos sin banco
// ============================================================
// Datos de Aave V3 via DefiLlama API (gratis, sin API key).
// DefiLlama agrega datos on-chain de todos los protocolos DeFi.
// ============================================================

import type { NextRequest, NextResponse } from "next/server";

interface AaveReserve {
  asset: string;
  chain: string;
  supplyAPY: number;
  borrowAPY: number;
  tvlUsd: number;
  timestamp: number;
  status: "ONLINE" | "ERROR";
  error?: string;
}

// Cache simple en memoria
let cache: { data: AaveReserve[]; expiresAt: number } | null = null;
const CACHE_TTL = 60_000; // 1 min

// GET /api/aave?chain=POLYGON&asset=ALL
// GET /api/aave?chain=POLYGON&asset=USDC
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const chain = (searchParams.get("chain") || "POLYGON").toUpperCase();
    const asset = (searchParams.get("asset") || "ALL").toUpperCase();

    // Usar cache si está disponible
    if (cache && Date.now() < cache.expiresAt) {
      const filtered = filterResults(cache.data, chain, asset);
      return NextResponse.json({
        chain: asset === "ALL" ? chain : chain,
        reserves: asset === "ALL" ? filtered : undefined,
        ...(asset !== "ALL" ? filtered[0] : {}),
        source: "Aave V3 (via DefiLlama API)",
        timestamp: Date.now(),
      });
    }

    // Fetch de DefiLlama — solo necesitamos pools de Aave
    const res = await fetch("https://yields.llama.fi/pools", {
      signal: AbortSignal.timeout(30000),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`DefiLlama HTTP ${res.status}`);

    // Parse response — filtrar solo pools de Aave V3 en Polygon/Base/Arbitrum
    const data = await res.json();

    const aavePools = (data.data || [])
      .filter((p: { project: string; chain: string }) => {
        const project = (p.project || "").toLowerCase();
        const chain = (p.chain || "").toLowerCase();
        return (
          project.includes("aave") &&
          (chain === "polygon" || chain === "base" || chain === "arbitrum")
        );
      })
      .slice(0, 30) // limitar para no saturar
      .map((p: {
        symbol: string; chain: string; apy: number; apyBaseBorrow?: number;
        tvlUsd: number;
      }) => ({
        asset: (p.symbol || "").toUpperCase(),
        chain: (p.chain || "").toUpperCase(),
        supplyAPY: p.apy || 0,
        borrowAPY: p.apyBaseBorrow || 0,
        tvlUsd: p.tvlUsd || 0,
        timestamp: Date.now(),
        status: "ONLINE" as const,
      }));

    // Actualizar cache
    cache = { data: aavePools, expiresAt: Date.now() + CACHE_TTL };

    const filtered = filterResults(aavePools, chain, asset);

    if (asset === "ALL") {
      return NextResponse.json({
        chain,
        reserves: filtered,
        timestamp: Date.now(),
        source: "Aave V3 (via DefiLlama API)",
      });
    }

    return NextResponse.json({
      chain,
      asset,
      ...filtered[0],
      source: "Aave V3 (via DefiLlama API)",
    });
  } catch (err) {
    console.error("[/api/aave]", err);
    return NextResponse.json(
      { error: "Error consultando Aave V3", detail: (err as Error).message },
      { status: 500 }
    );
  }
}

function filterResults(data: AaveReserve[], chain: string, asset: string): AaveReserve[] {
  let filtered = data.filter((r) => r.chain === chain);
  if (asset !== "ALL") {
    filtered = filtered.filter((r) => r.asset === asset);
  }
  return filtered;
}
