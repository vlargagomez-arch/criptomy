// ============================================================
// BITGET PROVIDER — Market data (sin API key)
// ============================================================
// Docs: https://www.bitget.com/api-doc/spot/intro
// GET /api/v2/spot/market/tickers?symbol=BTCUSDT — público
// Rate limit: 100 req/2s por IP (muy generoso)
// Reemplaza a Bybit que está geo-blocked desde Vercel.
// ============================================================

import { fetchWithCache } from "../cache";
import type { MarketQuote, ProviderStatus } from "../types";

const BITGET_BASE = "https://api.bitget.com";

const BITGET_SYMBOLS: Record<string, Record<string, string>> = {
  BTC: { USDT: "BTCUSDT", USDC: "BTCUSDC" },
  ETH: { USDT: "ETHUSDT", USDC: "ETHUSDC" },
  USDT: { USD: "USDTUSD" },
  USDC: { USDT: "USDCUSDT" },
  SOL: { USDT: "SOLUSDT", USDC: "SOLUSDC" },
  BNB: { USDT: "BNBUSDT" },
  XRP: { USDT: "XRPUSDT" },
  DOGE: { USDT: "DOGEUSDT" },
  ADA: { USDT: "ADAUSDT" },
  AVAX: { USDT: "AVAXUSDT" },
  LINK: { USDT: "LINKUSDT" },
};

export function bitgetSymbol(asset: string, quote: string): string | null {
  return BITGET_SYMBOLS[asset.toUpperCase()]?.[quote.toUpperCase()] || null;
}

interface BitgetTicker {
  symbol: string;
  lastPr: string;
  bidPr: string;
  askPr: string;
  bidSz: string;
  askSz: string;
  high24h: string;
  low24h: string;
  change24h: string;
  baseVolume: string;
  quoteVolume: string;
  usdtVolume: string;
  openUtc: string;
  changeUtc24h: string;
}

interface BitgetResponse {
  code: string;
  msg: string;
  data: BitgetTicker[];
}

export async function fetchBitgetTicker(asset: string, quote: string): Promise<MarketQuote> {
  const symbol = bitgetSymbol(asset, quote);
  if (!symbol) {
    return {
      provider: "bitget",
      providerName: "Bitget",
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

  const url = `${BITGET_BASE}/api/v2/spot/market/tickers?symbol=${symbol}`;
  const { data, latencyMs, status, error } = await fetchWithCache<BitgetResponse>(url, {
    provider: "bitget",
    ttlMs: 15_000,
    cacheKey: `bitget:ticker:${symbol}`,
  });

  if (!data || data.code !== "00000" || !data.data || data.data.length === 0) {
    return {
      provider: "bitget",
      providerName: "Bitget",
      symbol,
      asset,
      quoteCurrency: quote,
      lastPrice: 0,
      timestamp: Date.now(),
      latencyMs,
      status: status as ProviderStatus,
      error: error || (data ? data.msg : "Respuesta vacía"),
    };
  }

  const t = data.data[0];
  const last = parseFloat(t.lastPr);
  const bid = parseFloat(t.bidPr);
  const ask = parseFloat(t.askPr);

  return {
    provider: "bitget",
    providerName: "Bitget",
    symbol,
    asset,
    quoteCurrency: quote,
    lastPrice: last,
    bidPrice: bid,
    askPrice: ask,
    spread: ask - bid,
    spreadPercent: last > 0 ? ((ask - bid) / last) * 100 : undefined,
    volume24h: parseFloat(t.baseVolume),
    quoteVolume24h: parseFloat(t.quoteVolume),
    changePercent24h: parseFloat(t.change24h) * 100,
    high24h: parseFloat(t.high24h),
    low24h: parseFloat(t.low24h),
    timestamp: Date.now(),
    latencyMs,
    status: "ONLINE",
  };
}
