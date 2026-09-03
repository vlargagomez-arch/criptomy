// ============================================================
// MEXC PROVIDER — Market data (sin API key)
// ============================================================
// Docs: https://mexcdevelop.github.io/apidocs/spot-api-v3/
// GET /api/v3/ticker/24hr?symbol=BTCUSDT — público
// Rate limit: 12000 weight/min (muy generoso)
// ============================================================

import { fetchWithCache } from "../cache";
import type { MarketQuote, ProviderStatus } from "../types";

const MEXC_BASE = "https://api.mexc.com";

const MEXC_SYMBOLS: Record<string, Record<string, string>> = {
  BTC: { USDT: "BTCUSDT", USDC: "BTCUSDC", USD: "BTCUSDT" },
  ETH: { USDT: "ETHUSDT", USDC: "ETHUSDC", USD: "ETHUSDT" },
  USDT: { USD: "USDTUSDC", USDC: "USDTUSDC" },
  USDC: { USDT: "USDCUSDT", USD: "USDCUSDT" },
  SOL: { USDT: "SOLUSDT", USDC: "SOLUSDC", USD: "SOLUSDT" },
  BNB: { USDT: "BNBUSDT", USD: "BNBUSDT" },
  XRP: { USDT: "XRPUSDT", USD: "XRPUSDT" },
  DOGE: { USDT: "DOGEUSDT", USD: "DOGEUSDT" },
  ADA: { USDT: "ADAUSDT", USD: "ADAUSDT" },
};

export function mexcSymbol(asset: string, quote: string): string | null {
  return MEXC_SYMBOLS[asset.toUpperCase()]?.[quote.toUpperCase()] || null;
}

interface MexcTicker24hr {
  symbol: string;
  lastPrice: string;
  bidPrice: string;
  askPrice: string;
  priceChange: string;
  priceChangePercent: string;
  volume: string;
  quoteVolume: string;
  highPrice: string;
  lowPrice: string;
}

export async function fetchMexcTicker(asset: string, quote: string): Promise<MarketQuote> {
  const symbol = mexcSymbol(asset, quote);
  if (!symbol) {
    return {
      provider: "mexc",
      providerName: "MEXC",
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

  const url = `${MEXC_BASE}/api/v3/ticker/24hr?symbol=${symbol}`;
  const { data, latencyMs, status, error } = await fetchWithCache<MexcTicker24hr>(url, {
    provider: "mexc",
    ttlMs: 15_000,
    cacheKey: `mexc:ticker:${symbol}`,
  });

  if (!data || !data.lastPrice) {
    return {
      provider: "mexc",
      providerName: "MEXC",
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

  const last = parseFloat(data.lastPrice);
  const bid = parseFloat(data.bidPrice);
  const ask = parseFloat(data.askPrice);

  return {
    provider: "mexc",
    providerName: "MEXC",
    symbol,
    asset,
    quoteCurrency: quote,
    lastPrice: last,
    bidPrice: bid,
    askPrice: ask,
    spread: ask - bid,
    spreadPercent: last > 0 ? ((ask - bid) / last) * 100 : undefined,
    volume24h: parseFloat(data.volume),
    quoteVolume24h: parseFloat(data.quoteVolume),
    changePercent24h: parseFloat(data.priceChangePercent),
    high24h: parseFloat(data.highPrice),
    low24h: parseFloat(data.lowPrice),
    timestamp: Date.now(),
    latencyMs,
    status: "ONLINE",
  };
}
