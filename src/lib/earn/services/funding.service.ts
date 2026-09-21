// ============================================================
// Service: Funding — Multi-provider con fallback
// ============================================================
// Orden: Binance → Bybit → OKX → Gate.io
// Si Binance falla, registramos el fallo y probamos el siguiente.
// El resultado SIEMPRE trae `failed: [{exchange, reason}]` para
// que la UI pueda explicar "Binance no respondió, usando Bybit".
// ============================================================

import { getCached, setCached, dedupe, retryWithBackoff } from "../cache";
import { getBinanceFunding } from "../providers/binance-funding";
import { getBybitFunding } from "../providers/bybit-funding";
import { getOKXFunding } from "../providers/okx-funding";
import { getGateFunding } from "../providers/gate-funding";
import type { FundingData, FundingMultiResponse } from "../types";

const TTL = 30_000; // 30s
const cacheKey = (sym: string) => `funding:${sym}`;

type ProviderResult = { ok: true; data: FundingData } | { ok: false; exchange: string; reason: string };

async function tryProvider(
  exchange: string,
  fn: () => Promise<FundingData>,
): Promise<ProviderResult> {
  try {
    const data = await retryWithBackoff(fn, 1, 250);
    return { ok: true, data };
  } catch (err: any) {
    return {
      ok: false,
      exchange,
      reason: err?.message?.slice(0, 120) || "Error desconocido",
    };
  }
}

export async function getFundingMulti(symbol: string): Promise<FundingMultiResponse> {
  const sym = symbol.toUpperCase();
  const cached = getCached<FundingMultiResponse>(cacheKey(sym));
  if (cached) return cached;

  return dedupe(cacheKey(sym), async () => {
    // Probar en paralelo para minimizar latencia (a veces todos responden).
    const [binance, bybit, okx, gate] = await Promise.all([
      tryProvider("Binance", () => getBinanceFunding(sym)),
      tryProvider("Bybit", () => getBybitFunding(sym)),
      tryProvider("OKX", () => getOKXFunding(sym)),
      tryProvider("Gate.io", () => getGateFunding(sym)),
    ]);

    const fallbacks: FundingData[] = [];
    const failed: { exchange: string; reason: string }[] = [];
    let primary: FundingData | null = null;

    for (const r of [binance, bybit, okx, gate]) {
      if (r.ok) {
        if (!primary) primary = r.data;
        else fallbacks.push(r.data);
      } else {
        failed.push({ exchange: r.exchange, reason: r.reason });
      }
    }

    const result: FundingMultiResponse = {
      symbol: sym,
      primary,
      fallbacks,
      failed,
      updatedAt: Date.now(),
    };

    setCached(cacheKey(sym), result, TTL);
    return result;
  });
}
