// ============================================================
// AAVE V3 — Préstamos y rendimientos sin banco
// ============================================================
// DeFi lending: deposita cripto y gana interés, o pide préstamos
// usando tu cripto como colateral. Sin KYC, sin banco, sin aprobación.
// Smart contracts ya desplegados en Polygon, Base, Arbitrum.
// Solo leemos datos on-chain (no ejecutamos transacciones).
// ============================================================

import type { NextRequest, NextResponse } from "next/server";

// Aave V3 Pool addresses (ya desplegados, no son nuestros)
const AAVE_POOLS: Record<string, { address: string; rpc: string; name: string }> = {
  POLYGON: {
    address: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
    rpc: "https://1rpc.io/matic",
    name: "Polygon",
  },
  BASE: {
    address: "0xA238Dd80C259a72e81D7e5664C9F3A60b6c20A84",
    rpc: "https://base.publicnode.com",
    name: "Base",
  },
  ARBITRUM: {
    address: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
    rpc: "https://arbitrum-one.publicnode.com",
    name: "Arbitrum",
  },
};

// Token addresses en Polygon (los más usados en LATAM)
const TOKENS: Record<string, Record<string, string>> = {
  POLYGON: {
    USDC: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    USDT: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
    WETH: "0x7ceB233D2C190576F932bFbE11D7d33Ba24f0F5E",
    WBTC: "0x1BFD67037B42Cf73acF2047067bd5F2C4D2eF1C0",
    WMATIC: "0x0d500B1d8E2eFbEE00D8b4D28Fe25B5b8C6b7e07",
    DAI: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063",
  },
  BASE: {
    USDC: "0x833589fCD6eDb6Ee088c21f1cd6a55D2b27E0c4E",
    WETH: "0x4200000000000000000000000000000000000006",
  },
  ARBITRUM: {
    USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    USDT: "0xFd086bD7b31Fe25B5b8C6b5b5b5b5b5b5b5b5b5b",
    WETH: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
  },
};

// reserveData(asset) selector = 0x35ea6a75
const RESERVE_DATA_SELECTOR = "0x35ea6a75";

interface AaveReserveData {
  asset: string;
  chain: string;
  supplyAPY: number;
  borrowAPY: number;
  timestamp: number;
  status: "ONLINE" | "ERROR";
  error?: string;
}

function decodeRay(hex: string): number {
  try {
    return Number(BigInt(hex)) / 1e27;
  } catch {
    return 0;
  }
}

async function fetchReserveData(chain: string, asset: string): Promise<AaveReserveData> {
  const pool = AAVE_POOLS[chain];
  if (!pool) return { asset, chain, supplyAPY: 0, borrowAPY: 0, timestamp: Date.now(), status: "ERROR", error: "Chain no soportada" };

  const tokenAddr = TOKENS[chain]?.[asset];
  if (!tokenAddr) return { asset, chain, supplyAPY: 0, borrowAPY: 0, timestamp: Date.now(), status: "ERROR", error: "Token no soportado" };

  const data = RESERVE_DATA_SELECTOR + tokenAddr.slice(2).padStart(64, "0");

  try {
    const res = await fetch(pool.rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_call",
        params: [{ to: pool.address, data }, "latest"],
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as { result?: string; error?: unknown };
    if (json.error || !json.result) throw new Error("Sin respuesta");

    const hex = json.result.replace("0x", "");
    const liquidityRate = decodeRay("0x" + hex.slice(64, 128));
    const variableBorrowRate = decodeRay("0x" + hex.slice(192, 256));

    return {
      asset,
      chain,
      supplyAPY: liquidityRate * 100,
      borrowAPY: variableBorrowRate * 100,
      timestamp: Date.now(),
      status: "ONLINE",
    };
  } catch (err) {
    return { asset, chain, supplyAPY: 0, borrowAPY: 0, timestamp: Date.now(), status: "ERROR", error: (err as Error).message };
  }
}

// GET /api/aave?chain=POLYGON&asset=USDC
// GET /api/aave?chain=POLYGON&asset=ALL
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const chain = (searchParams.get("chain") || "POLYGON").toUpperCase();
    const asset = (searchParams.get("asset") || "USDC").toUpperCase();

    if (asset === "ALL") {
      const tokens = Object.keys(TOKENS[chain] || {});
      // Usar allSettled para que un token que falle no rompa todo
      const results = await Promise.allSettled(
        tokens.map((a) => fetchReserveData(chain, a))
      );
      const reserves = results.map((r) =>
        r.status === "fulfilled" ? r.value : { asset: "?", chain, supplyAPY: 0, borrowAPY: 0, timestamp: Date.now(), status: "ERROR" as const, error: "Failed" }
      );
      return NextResponse.json({
        chain,
        reserves,
        timestamp: Date.now(),
        source: "Aave V3 (on-chain via RPC público)",
      });
    }

    const result = await fetchReserveData(chain, asset);
    return NextResponse.json({
      chain,
      asset,
      ...result,
      source: "Aave V3 (on-chain via RPC público)",
    });
  } catch (err) {
    console.error("[/api/aave]", err);
    return NextResponse.json(
      { error: "Error interno consultando Aave V3", detail: (err as Error).message },
      { status: 500 }
    );
  }
}
