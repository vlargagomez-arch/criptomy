// ============================================================
// Service: Basis — Multi-provider con fallback
// ============================================================
// Primario: Binance COIN-M basis (endpoint oficial /futures/data/basis).
// Si Binance falla, fallback: Bybit (cálculo (futures - index)/index).
// ============================================================

import { getCached, setCached, dedupe, retryWithBackoff } from "../cache";
import { getBinanceBasis } from "../providers/binance-basis";
import { getBybitBasis } from "../providers/bybit-basis";
import type { BasisData } from "../types";

const TTL = 30_000;
const cacheKey = (sym: string) => `basis:${sym}`;

// Mapeo símbolo → pair COIN-M en Binance
function toBinancePair(symbol: string): string {
  // BTCUSDT → BTCUSD
  if (symbol.endsWith("USDT")) return symbol.replace("USDT", "USD");
  if (symbol.endsWith("USD")) return symbol;
  return symbol;
}

export async function getBasisMulti(symbol: string): Promise<{
  primary: BasisData | null;
  fallbacks: BasisData[];
  failed: { exchange: string; reason: string }[];
  updatedAt: number;
}> {
  const sym = symbol.toUpperCase();
  const cached = getCached<any>(cacheKey(sym));
  if (cached) return cached;

  return dedupe(cacheKey(sym), async () => {
    const results = await Promise.all([
      (async () => {
        try {
          const data = await retryWithBackoff(() => getBinanceBasis(toBinancePair(sym)), 1, 250);
          return { ok: true as const, data };
        } catch (err: any) {
          return { ok: false as const, exchange: "Binance", reason: err?.message?.slice(0, 120) || "Error" };
        }
      })(),
      (async () => {
        try {
          const data = await retryWithBackoff(() => getBybitBasis(sym), 1, 250);
          return { ok: true as const, data };
        } catch (err: any) {
          return { ok: false as const, exchange: "Bybit", reason: err?.message?.slice(0, 120) || "Error" };
        }
      })(),
    ]);

    const fallbacks: BasisData[] = [];
    const failed: { exchange: string; reason: string }[] = [];
    let primary: BasisData | null = null;

    for (const r of results) {
      if (r.ok) {
        if (!primary) primary = r.data;
        else fallbacks.push(r.data);
      } else {
        failed.push({ exchange: r.exchange, reason: r.reason });
      }
    }

    const out = {
      primary,
      fallbacks,
      failed,
      updatedAt: Date.now(),
    };

    setCached(cacheKey(sym), out, TTL);
    return out;
  });
}
