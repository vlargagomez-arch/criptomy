// ============================================================
// GATE.IO PROVIDER — Market data (sin API key)
// ============================================================
// Docs: https://www.gate.io/docs/developers/apiv4/en/
// GET /api/v4/spot/tickers?currency_pair=BTC_USDT — público
// Rate limit: 300 req/s (muy generoso)
// ============================================================

import { fetchWithCache } from "../cache";
import type { MarketQuote, ProviderStatus } from "../types";

const GATE_BASE = "https://api.gateio.ws";

const GATE_SYMBOLS: Record<string, Record<string, string>> = {
  BTC: { USDT: "BTC_USDT", USD: "BTC_USDT", USDC: "BTC_USDC" },
  ETH: { USDT: "ETH_USDT", USD: "ETH_USDT", USDC: "ETH_USDC" },
  USDT: { USD: "USDT_USD" },
  USDC: { USDT: "USDC_USDT", USD: "USDC_USD" },
  SOL: { USDT: "SOL_USDT", USD: "SOL_USDT" },
  BNB: { USDT: "BNB_USDT" },
  XRP: { USDT: "XRP_USDT" },
  DOGE: { USDT: "DOGE_USDT" },
};

export function gateSymbol(asset: string, quote: string): string | null {
  return GATE_SYMBOLS[asset.toUpperCase()]?.[quote.toUpperCase()] || null;
}

interface GateTicker {
  currency_pair: string;
  last: string;
  lowest_ask: string;
  highest_bid: string;
  change_percentage: string;
  base_volume: string;
  quote_volume: string;
  high_24h: string;
  low_24h: string;
}

export async function fetchGateTicker(asset: string, quote: string): Promise<MarketQuote> {
  const symbol = gateSymbol(asset, quote);
  if (!symbol) {
    return {
      provider: "gate",
      providerName: "Gate.io",
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

  const url = `${GATE_BASE}/api/v4/spot/tickers?currency_pair=${symbol}`;
  const { data, latencyMs, status, error } = await fetchWithCache<GateTicker[]>(url, {
    provider: "gate",
    ttlMs: 15_000,
    cacheKey: `gate:ticker:${symbol}`,
  });

  if (!data || data.length === 0) {
    return {
      provider: "gate",
      providerName: "Gate.io",
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

  const t = data[0];
  const last = parseFloat(t.last);
  const bid = parseFloat(t.highest_bid);
  const ask = parseFloat(t.lowest_ask);

  return {
    provider: "gate",
    providerName: "Gate.io",
    symbol,
    asset,
    quoteCurrency: quote,
    lastPrice: last,
    bidPrice: bid,
    askPrice: ask,
    spread: ask - bid,
    spreadPercent: last > 0 ? ((ask - bid) / last) * 100 : undefined,
    volume24h: parseFloat(t.base_volume),
    quoteVolume24h: parseFloat(t.quote_volume),
    changePercent24h: parseFloat(t.change_percentage),
    high24h: parseFloat(t.high_24h),
    low24h: parseFloat(t.low_24h),
    timestamp: Date.now(),
    latencyMs,
    status: "ONLINE",
  };
}
