// ============================================================
// KUCOIN PROVIDER — Market data (sin API key)
// ============================================================
// Docs: https://docs.kucoin.com/
// GET /api/v1/market/orderbook/level1?symbol=BTC-USDT — público
// GET /api/v1/market/stats?symbol=BTC-USDT — stats 24h
// Rate limit: 3000 req/30s por IP (100 req/s sostenido)
// ============================================================

import { fetchWithCache } from "../cache";
import type { MarketQuote, ProviderStatus } from "../types";

const KUCOIN_BASE = "https://api.kucoin.com";

const KUCOIN_SYMBOLS: Record<string, Record<string, string>> = {
  BTC: { USDT: "BTC-USDT", USDC: "BTC-USDC", USD: "BTC-USDT" },
  ETH: { USDT: "ETH-USDT", USDC: "ETH-USDC", USD: "ETH-USDT" },
  USDT: { USD: "USDT-USD" },
  USDC: { USDT: "USDC-USDT", USD: "USDC-USD" },
  SOL: { USDT: "SOL-USDT", USDC: "SOL-USDC", USD: "SOL-USDT" },
  BNB: { USDT: "BNB-USDT", USD: "BNB-USDT" },
  XRP: { USDT: "XRP-USDT", USD: "XRP-USDT" },
  DOGE: { USDT: "DOGE-USDT", USD: "DOGE-USDT" },
  ADA: { USDT: "ADA-USDT", USD: "ADA-USDT" },
};

export function kucoinSymbol(asset: string, quote: string): string | null {
  return KUCOIN_SYMBOLS[asset.toUpperCase()]?.[quote.toUpperCase()] || null;
}

interface KucoinLevel1 {
  code: string;
  data: {
    time: number;
    price: string;
    size: string;
    bestBid: string;
    bestBidSize: string;
    bestAsk: string;
    bestAskSize: string;
  };
}

interface KucoinStats {
  code: string;
  data: {
    symbol: string;
    changeRate: string;
    changePrice: string;
    high: string;
    low: string;
    vol: string;
    volValue: string;
    last: string;
    buy: string;
    sell: string;
  };
}

export async function fetchKucoinTicker(asset: string, quote: string): Promise<MarketQuote> {
  const symbol = kucoinSymbol(asset, quote);
  if (!symbol) {
    return {
      provider: "kucoin",
      providerName: "KuCoin",
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

  // Llamada paralela: precio actual + stats 24h
  const [level1Result, statsResult] = await Promise.all([
    fetchWithCache<KucoinLevel1>(`${KUCOIN_BASE}/api/v1/market/orderbook/level1?symbol=${symbol}`, {
      provider: "kucoin",
      ttlMs: 10_000,
      cacheKey: `kucoin:l1:${symbol}`,
    }),
    fetchWithCache<KucoinStats>(`${KUCOIN_BASE}/api/v1/market/stats?symbol=${symbol}`, {
      provider: "kucoin",
      ttlMs: 15_000,
      cacheKey: `kucoin:stats:${symbol}`,
    }),
  ]);

  if (!level1Result.data || !level1Result.data.data) {
    return {
      provider: "kucoin",
      providerName: "KuCoin",
      symbol,
      asset,
      quoteCurrency: quote,
      lastPrice: 0,
      timestamp: Date.now(),
      latencyMs: level1Result.latencyMs,
      status: level1Result.status as ProviderStatus,
      error: level1Result.error || "Respuesta vacía",
    };
  }

  const l1 = level1Result.data.data;
  const last = parseFloat(l1.price);
  const bid = parseFloat(l1.bestBid);
  const ask = parseFloat(l1.bestAsk);

  const stats = statsResult.data?.data;
  return {
    provider: "kucoin",
    providerName: "KuCoin",
    symbol,
    asset,
    quoteCurrency: quote,
    lastPrice: last,
    bidPrice: bid,
    askPrice: ask,
    spread: ask - bid,
    spreadPercent: last > 0 ? ((ask - bid) / last) * 100 : undefined,
    volume24h: stats ? parseFloat(stats.vol) : undefined,
    quoteVolume24h: stats ? parseFloat(stats.volValue) : undefined,
    changePercent24h: stats ? parseFloat(stats.changeRate) * 100 : undefined,
    high24h: stats ? parseFloat(stats.high) : undefined,
    low24h: stats ? parseFloat(stats.low) : undefined,
    timestamp: Date.now(),
    latencyMs: Math.max(level1Result.latencyMs, statsResult.latencyMs),
    status: "ONLINE",
  };
}
