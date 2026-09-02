// ============================================================
// KRAKEN PROVIDER — Market data (sin API key)
// ============================================================
// Docs: https://docs.kraken.com/rest/
// GET /0/public/Ticker?pair=XBTUSD — público
// Nota: Kraken usa "XBT" en vez de "BTC"
// CORS bloqueado → solo backend (nuestro caso)
// ============================================================

import { fetchWithCache } from "../cache";
import type { MarketQuote, ProviderStatus } from "../types";

const KRAKEN_BASE = "https://api.kraken.com";

const KRAKEN_SYMBOLS: Record<string, Record<string, string>> = {
  BTC: { USD: "XBTUSD", USDT: "XBTUSDT", EUR: "XBTEUR" },
  ETH: { USD: "ETHUSD", USDT: "ETHUSDT", EUR: "ETHEUR" },
  USDT: { USD: "USDTZUSD", EUR: "USDTEUR" },
  USDC: { USD: "USDCUSD", EUR: "USDCEUR" },
  SOL: { USD: "SOLUSD", USDT: "SOLUSDT" },
  XRP: { USD: "XRPUSD", USDT: "XRPUSDT" },
};

export function krakenSymbol(asset: string, quote: string): string | null {
  return KRAKEN_SYMBOLS[asset.toUpperCase()]?.[quote.toUpperCase()] || null;
}

// Kraken response: { result: { "XXBTZUSD": { a: [...], b: [...], c: [...], v: [...], p: [...], h: [...], l: [...] } } }
interface KrakenResult {
  a: string[]; // ask array
  b: string[]; // bid array
  c: string[]; // last trade [price, volume]
  v: string[]; // volume [today, 24h]
  p: string[]; // vwap [today, 24h]
  h: string[]; // high
  l: string[]; // low
  t: number[]; // trades count
}
type KrakenResponse = { error: string[]; result?: Record<string, KrakenResult> };

export async function fetchKrakenTicker(asset: string, quote: string): Promise<MarketQuote> {
  const symbol = krakenSymbol(asset, quote);
  if (!symbol) {
    return {
      provider: "kraken",
      providerName: "Kraken",
      symbol: "",
      asset,
      quoteCurrency: quote,
      lastPrice: 0,
      timestamp: Date.now(),
      latencyMs: 0,
      status: "ERROR",
      error: `Symbol no soportado: ${asset}${quote}`,
    };
  }

  const url = `${KRAKEN_BASE}/0/public/Ticker?pair=${symbol}`;
  const { data, latencyMs, status, error } = await fetchWithCache<KrakenResponse>(url, {
    provider: "kraken",
    ttlMs: 30_000, // kraken recomienda 1 req/s; cacheamos 30s
    cacheKey: `kraken:ticker:${symbol}`,
  });

  if (!data || data.error.length > 0 || !data.result) {
    return {
      provider: "kraken",
      providerName: "Kraken",
      symbol,
      asset,
      quoteCurrency: quote,
      lastPrice: 0,
      timestamp: Date.now(),
      latencyMs,
      status: status as ProviderStatus,
      error: error || (data?.error[0] || "Respuesta vacía"),
    };
  }

  // tomar el primer par (en caso de que el key sea diferente al solicitado)
  const key = Object.keys(data.result)[0];
  const t = data.result[key];
  const last = parseFloat(t.c[0]);
  const bid = parseFloat(t.b[0]);
  const ask = parseFloat(t.a[0]);

  return {
    provider: "kraken",
    providerName: "Kraken",
    symbol,
    asset,
    quoteCurrency: quote,
    lastPrice: last,
    bidPrice: bid,
    askPrice: ask,
    spread: ask - bid,
    spreadPercent: last > 0 ? ((ask - bid) / last) * 100 : undefined,
    volume24h: parseFloat(t.v[1]),
    quoteVolume24h: parseFloat(t.v[1]) * last,
    high24h: parseFloat(t.h[1]),
    low24h: parseFloat(t.l[1]),
    timestamp: Date.now(),
    latencyMs,
    status: "ONLINE",
  };
}
