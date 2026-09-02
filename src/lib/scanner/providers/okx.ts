// ============================================================
// OKX PROVIDER — Market data (sin API key)
// ============================================================
// Docs: https://www.okx.com/docs-v5/
// GET /api/v5/market/ticker?instId=BTC-USDT — público, sin auth
// Rate limit: 20 req/2s para ticker
// ============================================================

import { fetchWithCache } from "../cache";
import type { MarketQuote, ProviderStatus } from "../types";

const OKX_BASE = "https://www.okx.com";

const OKX_SYMBOLS: Record<string, Record<string, string>> = {
  BTC: { USDT: "BTC-USDT", USD: "BTC-USDT", USDC: "BTC-USDC" },
  ETH: { USDT: "ETH-USDT", USD: "ETH-USDT", USDC: "ETH-USDC" },
  USDT: { USD: "USDT-USD" },
  USDC: { USDT: "USDC-USDT", USD: "USDC-USD" },
  SOL: { USDT: "SOL-USDT", USD: "SOL-USDT" },
};

export function okxSymbol(asset: string, quote: string): string | null {
  return OKX_SYMBOLS[asset.toUpperCase()]?.[quote.toUpperCase()] || null;
}

interface OKXTicker {
  instId: string;
  last: string;
  bidPx: string;
  askPx: string;
  spread: string;
  baseVol24h: string;
  vol24h: string;
  open24h: string;
  high24h: string;
  low24h: string;
  ts: string;
}

interface OKXResponse {
  code: string;
  msg: string;
  data: OKXTicker[];
}

export async function fetchOkxTicker(asset: string, quote: string): Promise<MarketQuote> {
  const symbol = okxSymbol(asset, quote);
  if (!symbol) {
    return {
      provider: "okx",
      providerName: "OKX",
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

  const url = `${OKX_BASE}/api/v5/market/ticker?instId=${symbol}`;
  const { data, latencyMs, status, error } = await fetchWithCache<OKXResponse>(url, {
    provider: "okx",
    ttlMs: 15_000,
    cacheKey: `okx:ticker:${symbol}`,
  });

  if (!data || !data.data || data.data.length === 0) {
    return {
      provider: "okx",
      providerName: "OKX",
      symbol,
      asset,
      quoteCurrency: quote,
      lastPrice: 0,
      timestamp: Date.now(),
      latencyMs,
      status: status as ProviderStatus,
      error: error || "Respuesta vacía",
    };
  }

  const t = data.data[0];
  const last = parseFloat(t.last);
  const bid = parseFloat(t.bidPx);
  const ask = parseFloat(t.askPx);

  return {
    provider: "okx",
    providerName: "OKX",
    symbol,
    asset,
    quoteCurrency: quote,
    lastPrice: last,
    bidPrice: bid,
    askPrice: ask,
    spread: ask - bid,
    spreadPercent: last > 0 ? ((ask - bid) / last) * 100 : undefined,
    volume24h: parseFloat(t.baseVol24h),
    quoteVolume24h: parseFloat(t.vol24h),
    high24h: parseFloat(t.high24h),
    low24h: parseFloat(t.low24h),
    timestamp: Date.now(),
    latencyMs,
    status: "ONLINE",
  };
}
