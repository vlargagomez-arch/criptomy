// ============================================================
// BINGX PROVIDER — Market data (sin API key)
// ============================================================
// Docs: https://bingx-api.github.io/docs/
// GET /openApi/spot/v1/ticker/price?symbol=BTC-USDT — público
// Rate limit: 100 req/s (muy generoso)
// No bloquea Vercel (a diferencia de Bybit)
// ============================================================

import { fetchWithCache } from "../cache";
import type { MarketQuote, ProviderStatus } from "../types";

const BINGX_BASE = "https://open-api.bingx.com";

const BINGX_SYMBOLS: Record<string, Record<string, string>> = {
  BTC: { USDT: "BTC-USDT", USDC: "BTC-USDC", USD: "BTC-USDT" },
  ETH: { USDT: "ETH-USDT", USDC: "ETH-USDC", USD: "ETH-USDT" },
  USDT: { USD: "USDT-USD" },
  USDC: { USDT: "USDC-USDT" },
  SOL: { USDT: "SOL-USDT", USD: "SOL-USDT" },
  BNB: { USDT: "BNB-USDT", USD: "BNB-USDT" },
  XRP: { USDT: "XRP-USDT", USD: "XRP-USDT" },
  DOGE: { USDT: "DOGE-USDT", USD: "DOGE-USDT" },
  ADA: { USDT: "ADA-USDT", USD: "ADA-USDT" },
  AVAX: { USDT: "AVAX-USDT", USD: "AVAX-USDT" },
  LINK: { USDT: "LINK-USDT", USD: "LINK-USDT" },
};

export function bingxSymbol(asset: string, quote: string): string | null {
  return BINGX_SYMBOLS[asset.toUpperCase()]?.[quote.toUpperCase()] || null;
}

interface BingxTicker {
  symbol: string;
  trades: {
    timestamp: number;
    tradeId: string;
    price: string;
    amount: string;
    type: number;
    volume: string;
  }[];
}

interface BingxResponse {
  code: number;
  timestamp: number;
  data: BingxTicker[];
}

export async function fetchBingxTicker(asset: string, quote: string): Promise<MarketQuote> {
  const symbol = bingxSymbol(asset, quote);
  if (!symbol) {
    return {
      provider: "bingx",
      providerName: "BingX",
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

  const url = `${BINGX_BASE}/openApi/spot/v1/ticker/price?symbol=${symbol}`;
  const { data, latencyMs, status, error } = await fetchWithCache<BingxResponse>(url, {
    provider: "bingx",
    ttlMs: 15_000,
    cacheKey: `bingx:ticker:${symbol}`,
  });

  if (!data || data.code !== 0 || !data.data || data.data.length === 0) {
    return {
      provider: "bingx",
      providerName: "BingX",
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
  // BingX devuelve trades, tomamos el último precio
  const lastTrade = t.trades && t.trades.length > 0 ? t.trades[0] : null;
  const last = lastTrade ? parseFloat(lastTrade.price) : 0;

  if (last === 0) {
    return {
      provider: "bingx",
      providerName: "BingX",
      symbol,
      asset,
      quoteCurrency: quote,
      lastPrice: 0,
      timestamp: Date.now(),
      latencyMs,
      status: "ERROR",
      error: "Sin precio en el ticker",
    };
  }

  // BingX no da bid/ask en este endpoint, solo precio del último trade
  return {
    provider: "bingx",
    providerName: "BingX",
    symbol,
    asset,
    quoteCurrency: quote,
    lastPrice: last,
    // bid/ask no disponibles en este endpoint público
    spread: 0,
    spreadPercent: 0,
    timestamp: Date.now(),
    latencyMs,
    status: "ONLINE",
  };
}
