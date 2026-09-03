// ============================================================
// BYBIT PROVIDER — Market data (sin API key)
// ============================================================
// Docs: https://bybit-exchange.github.io/docs/v5/market/tickers
// GET /v5/market/tickers?category=spot&symbol=BTCUSDT — público
// Rate limit: 600 req / 5s
// ============================================================

import { fetchWithCache } from "../cache";
import type { MarketQuote, ProviderStatus } from "../types";

const BYBIT_BASE = "https://api.bybit.com";

const BYBIT_SYMBOLS: Record<string, Record<string, string>> = {
  BTC: { USDT: "BTCUSDT", USD: "BTCUSDT", USDC: "BTCUSDC" },
  ETH: { USDT: "ETHUSDT", USD: "ETHUSDT", USDC: "ETHUSDC" },
  USDT: { USD: "USDTUSD" },
  USDC: { USDT: "USDCUSDT", USD: "USDCUSD" },
  SOL: { USDT: "SOLUSDT", USD: "SOLUSDT" },
};

export function bybitSymbol(asset: string, quote: string): string | null {
  return BYBIT_SYMBOLS[asset.toUpperCase()]?.[quote.toUpperCase()] || null;
}

interface BybitTicker {
  symbol: string;
  lastPrice: string;
  bid1Price: string;
  ask1Price: string;
  volume24h: string;
  turnover24h: string;
  highPrice24h: string;
  lowPrice24h: string;
  price24hPcnt: string;
}

interface BybitResponse {
  retCode: number;
  retMsg: string;
  result: { list: BybitTicker[]; category: string };
}

export async function fetchBybitTicker(asset: string, quote: string): Promise<MarketQuote> {
  const symbol = bybitSymbol(asset, quote);
  if (!symbol) {
    return {
      provider: "bybit",
      providerName: "Bybit",
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

  const url = `${BYBIT_BASE}/v5/market/tickers?category=spot&symbol=${symbol}`;
  const { data, latencyMs, status, error } = await fetchWithCache<BybitResponse>(url, {
    provider: "bybit",
    ttlMs: 15_000,
    cacheKey: `bybit:ticker:${symbol}`,
  });

  if (!data || data.retCode !== 0 || !data.result.list || data.result.list.length === 0) {
    return {
      provider: "bybit",
      providerName: "Bybit",
      symbol,
      asset,
      quoteCurrency: quote,
      lastPrice: 0,
      timestamp: Date.now(),
      latencyMs,
      status: status as ProviderStatus,
      error: error || (data ? data.retMsg : "Respuesta vacía"),
    };
  }

  const t = data.result.list[0];
  const last = parseFloat(t.lastPrice);
  const bid = parseFloat(t.bid1Price);
  const ask = parseFloat(t.ask1Price);

  return {
    provider: "bybit",
    providerName: "Bybit",
    symbol,
    asset,
    quoteCurrency: quote,
    lastPrice: last,
    bidPrice: bid,
    askPrice: ask,
    spread: ask - bid,
    spreadPercent: last > 0 ? ((ask - bid) / last) * 100 : undefined,
    volume24h: parseFloat(t.volume24h),
    quoteVolume24h: parseFloat(t.turnover24h),
    changePercent24h: parseFloat(t.price24hPcnt) * 100,
    high24h: parseFloat(t.highPrice24h),
    low24h: parseFloat(t.lowPrice24h),
    timestamp: Date.now(),
    latencyMs,
    status: "ONLINE",
  };
}
