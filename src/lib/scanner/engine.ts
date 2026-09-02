// ============================================================
// SCAN ENGINE — Orquesta todos los provider connectors
// ============================================================
// Llama en paralelo a todos los providers activos, normaliza
// respuestas y maneja errores individuales (fallback).
// ============================================================

import { fetchBinanceTicker, fetchBinanceP2P } from "./providers/binance";
import { fetchOkxTicker } from "./providers/okx";
import { fetchBybitTicker } from "./providers/bybit";
import { fetchKrakenTicker } from "./providers/kraken";
import { fetchCoinbaseTicker } from "./providers/coinbase";
import { fetchCoingeckoTicker } from "./providers/coingecko";
import type { MarketQuote, P2POffer, ProviderHealth, ProviderStatus } from "./types";

// Escanear market data de TODOS los providers para un par asset/quote
export async function scanMarketData(asset: string, quote: string): Promise<MarketQuote[]> {
  const tasks: Promise<MarketQuote>[] = [
    fetchBinanceTicker(asset, quote),
    fetchOkxTicker(asset, quote),
    fetchBybitTicker(asset, quote),
    fetchKrakenTicker(asset, quote),
    fetchCoinbaseTicker(asset, quote),
    fetchCoingeckoTicker(asset, quote),
  ];

  const results = await Promise.allSettled(tasks);
  return results.map((r) => (r.status === "fulfilled" ? r.value : null)).filter((q): q is MarketQuote => q !== null);
}

// Escanear P2P offers (solo Binance por ahora; OKX/Bybit requieren advertiser role)
export async function scanP2P(params: {
  asset: string;
  fiat: string;
  tradeType: "BUY" | "SELL";
  payTypes?: string[];
}): Promise<P2POffer[]> {
  return await fetchBinanceP2P({
    asset: params.asset,
    fiat: params.fiat,
    tradeType: params.tradeType,
    payTypes: params.payTypes,
    rows: 20,
  });
}

// Verificar health de todos los providers (con una llamada simple)
export async function scanProvidersHealth(): Promise<ProviderHealth[]> {
  const checks = [
    { provider: "binance", fn: () => fetchBinanceTicker("BTC", "USDT") },
    { provider: "okx", fn: () => fetchOkxTicker("BTC", "USDT") },
    { provider: "bybit", fn: () => fetchBybitTicker("BTC", "USDT") },
    { provider: "kraken", fn: () => fetchKrakenTicker("BTC", "USDT") },
    { provider: "coinbase", fn: () => fetchCoinbaseTicker("BTC", "USDT") },
    { provider: "coingecko", fn: () => fetchCoingeckoTicker("BTC", "USD") },
  ];

  const results = await Promise.allSettled(checks.map((c) => c.fn()));
  return checks.map((c, idx) => {
    const r = results[idx];
    if (r.status === "fulfilled") {
      return {
        provider: c.provider,
        name: c.provider.charAt(0).toUpperCase() + c.provider.slice(1),
        status: r.value.status as ProviderStatus,
        latencyMs: r.value.latencyMs,
        lastCheck: Date.now(),
        lastError: r.value.error,
        endpointsTested: 1,
        endpointsOk: r.value.status === "ONLINE" ? 1 : 0,
      };
    }
    return {
      provider: c.provider,
      name: c.provider.charAt(0).toUpperCase() + c.provider.slice(1),
      status: "OFFLINE" as ProviderStatus,
      latencyMs: 0,
      lastCheck: Date.now(),
      lastError: (r.reason as Error)?.message,
      endpointsTested: 1,
      endpointsOk: 0,
    };
  });
}
