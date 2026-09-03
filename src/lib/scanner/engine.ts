// ============================================================
// SCAN ENGINE — Orquesta todos los provider connectors
// ============================================================
// Llama en paralelo a todos los providers activos, normaliza
// respuestas y maneja errores individuales (fallback).
// ============================================================

import { fetchBinanceTicker, fetchBinanceP2P } from "./providers/binance";
import { fetchOkxTicker } from "./providers/okx";
import { fetchBitgetTicker } from "./providers/bitget";
import { fetchKrakenTicker } from "./providers/kraken";
import { fetchCoinbaseTicker } from "./providers/coinbase";
import { fetchCoingeckoTicker } from "./providers/coingecko";
import { fetchGateTicker } from "./providers/gate";
import { fetchMexcTicker } from "./providers/mexc";
import { fetchKucoinTicker } from "./providers/kucoin";
import { fetchHtxTicker } from "./providers/htx";
import { fetchBingxTicker } from "./providers/bingx";
import { getScannerProvider } from "./providers/registry";
import type { MarketQuote, P2POffer, ProviderHealth, ProviderStatus } from "./types";

// Bybit está geo-blocked desde Vercel (HTTP 403 a todos los mirrors oficiales).
// Si BYBIT_PROXY_URL está configurada (Cloudflare Worker), intentamos llamar
// al proxy. Si no, devolvemos DISABLED con mensaje claro.
// Documentación del proxy en docs/bybit-proxy/README.md.
const ENABLE_BYBIT = true; // ahora sí, usa proxy si configurado, DISABLED si no

// Quote placeholder para Bybit deshabilitado (no llama al API, evita bloqueos)
function bybitDisabledQuote(asset: string, quote: string): MarketQuote {
  return {
    provider: "bybit",
    providerName: "Bybit",
    symbol: "",
    asset,
    quoteCurrency: quote,
    lastPrice: 0,
    timestamp: Date.now(),
    latencyMs: 0,
    status: "DISABLED" as ProviderStatus,
    error: "No disponible desde el servidor (geo-block de Bybit). Visible en el panel admin vía navegador.",
  };
}

// Enriquecer quote con metadata del registry (kycLevel, liquidityTier)
function enrichQuote(q: MarketQuote): MarketQuote {
  const config = getScannerProvider(q.provider);
  return {
    ...q,
    kycLevel: config?.kycLevel,
    liquidityTier: config?.liquidityTier,
  };
}

// Escanear market data de TODOS los providers para un par asset/quote
export async function scanMarketData(asset: string, quote: string): Promise<MarketQuote[]> {
  // Bybit: usa proxy si configurado, si no, DISABLED con razón
  const bybitProxy = process.env.BYBIT_PROXY_URL;
  const bybitTask: Promise<MarketQuote> = bybitProxy
    ? (await import("./providers/bybit")).fetchBybitTicker(asset, quote)
    : Promise.resolve(bybitDisabledQuote(asset, quote));

  const tasks: Promise<MarketQuote>[] = [
    fetchBinanceTicker(asset, quote),
    fetchOkxTicker(asset, quote),
    bybitTask,
    fetchKrakenTicker(asset, quote),
    fetchCoinbaseTicker(asset, quote),
    fetchGateTicker(asset, quote),
    fetchMexcTicker(asset, quote),
    fetchKucoinTicker(asset, quote),
    fetchHtxTicker(asset, quote),
    fetchBitgetTicker(asset, quote),
    fetchBingxTicker(asset, quote),
    fetchCoingeckoTicker(asset, quote),
  ];

  const results = await Promise.allSettled(tasks);
  return results
    .map((r) => (r.status === "fulfilled" ? r.value : null))
    .filter((q): q is MarketQuote => q !== null)
    .map(enrichQuote);
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
  // Para Bybit: si hay proxy configurado, llamar al API; si no, devolver DISABLED
  const bybitProxy = process.env.BYBIT_PROXY_URL;
  const bybitFn = bybitProxy
    ? async () => (await import("./providers/bybit")).fetchBybitTicker("BTC", "USDT")
    : async () => ({
        provider: "bybit",
        providerName: "Bybit",
        symbol: "BTCUSDT",
        asset: "BTC",
        quoteCurrency: "USDT",
        lastPrice: 0,
        timestamp: Date.now(),
        latencyMs: 0,
        status: "DISABLED" as ProviderStatus,
        error: "Geo-blocked desde Vercel. Configura BYBIT_PROXY_URL (Cloudflare Worker — ver docs/bybit-proxy/README.md).",
      });

  const checks: { provider: string; fn: () => Promise<MarketQuote> }[] = [
    { provider: "binance", fn: () => fetchBinanceTicker("BTC", "USDT") },
    { provider: "okx", fn: () => fetchOkxTicker("BTC", "USDT") },
    { provider: "bybit", fn: bybitFn },
    { provider: "kraken", fn: () => fetchKrakenTicker("BTC", "USDT") },
    { provider: "coinbase", fn: () => fetchCoinbaseTicker("BTC", "USDT") },
    { provider: "gate", fn: () => fetchGateTicker("BTC", "USDT") },
    { provider: "mexc", fn: () => fetchMexcTicker("BTC", "USDT") },
    { provider: "kucoin", fn: () => fetchKucoinTicker("BTC", "USDT") },
    { provider: "htx", fn: () => fetchHtxTicker("BTC", "USDT") },
    { provider: "bitget", fn: () => fetchBitgetTicker("BTC", "USDT") },
    { provider: "bingx", fn: () => fetchBingxTicker("BTC", "USDT") },
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
