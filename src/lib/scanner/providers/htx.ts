// ============================================================
// HTX (HUOBI) PROVIDER — Market data (sin API key)
// ============================================================
// Docs: https://www.htx.com/en-us/opend/newApiHome/
// GET /market/detail/merged?symbol=btcusdt — público
// Nota: HTX usa símbolos en minúscula
// Rate limit: 4 req/s por URL (concurrente)
// ============================================================

import { fetchWithCache } from "../cache";
import type { MarketQuote, ProviderStatus } from "../types";

const HTX_BASE = "https://api.huobi.pro";

const HTX_SYMBOLS: Record<string, Record<string, string>> = {
  BTC: { USDT: "btcusdt", USDC: "btcusdc", USD: "btcusdt" },
  ETH: { USDT: "ethusdt", USDC: "ethusdc", USD: "ethusdt" },
  USDT: { USD: "usdtusd" },
  USDC: { USDT: "usdcusdt" },
  SOL: { USDT: "solusdt", USD: "solusdt" },
  BNB: { USDT: "bnbusdt", USD: "bnbusdt" },
  XRP: { USDT: "xrpusdt", USD: "xrpusdt" },
  DOGE: { USDT: "dogeusdt", USD: "dogeusdt" },
  ADA: { USDT: "adausdt", USD: "adausdt" },
};

export function htxSymbol(asset: string, quote: string): string | null {
  return HTX_SYMBOLS[asset.toUpperCase()]?.[quote.toUpperCase()] || null;
}

interface HtxTick {
  open: number;
  close: number;
  low: number;
  high: number;
  amount: number;  // volumen base 24h
  vol: number;     // volumen quote 24h
  count: number;
  bid: [number, number]; // [price, size]
  ask: [number, number];
}

interface HtxResponse {
  status: string;
  ch: string;
  ts: number;
  tick: HtxTick;
}

export async function fetchHtxTicker(asset: string, quote: string): Promise<MarketQuote> {
  const symbol = htxSymbol(asset, quote);
  if (!symbol) {
    return {
      provider: "htx",
      providerName: "HTX",
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

  const url = `${HTX_BASE}/market/detail/merged?symbol=${symbol}`;
  const { data, latencyMs, status, error } = await fetchWithCache<HtxResponse>(url, {
    provider: "htx",
    ttlMs: 15_000,
    cacheKey: `htx:ticker:${symbol}`,
  });

  if (!data || data.status !== "ok" || !data.tick) {
    return {
      provider: "htx",
      providerName: "HTX",
      symbol,
      asset,
      quoteCurrency: quote,
      lastPrice: 0,
      timestamp: Date.now(),
      latencyMs,
      status: status as ProviderStatus,
      error: error || (data ? data.status : "Respuesta vacía"),
    };
  }

  const t = data.tick;
  const last = t.close;
  const bid = t.bid?.[0] || last;
  const ask = t.ask?.[0] || last;

  return {
    provider: "htx",
    providerName: "HTX",
    symbol,
    asset,
    quoteCurrency: quote,
    lastPrice: last,
    bidPrice: bid,
    askPrice: ask,
    spread: ask - bid,
    spreadPercent: last > 0 ? ((ask - bid) / last) * 100 : undefined,
    volume24h: t.amount,
    quoteVolume24h: t.vol,
    high24h: t.high,
    low24h: t.low,
    changePercent24h: t.open > 0 ? ((t.close - t.open) / t.open) * 100 : undefined,
    timestamp: Date.now(),
    latencyMs,
    status: "ONLINE",
  };
}
