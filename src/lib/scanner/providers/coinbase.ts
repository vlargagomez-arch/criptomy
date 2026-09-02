// ============================================================
// COINBASE PROVIDER — Market data (sin API key)
// ============================================================
// Docs: https://docs.cloud.coinbase.com/exchange/docs/
// GET /products/BTC-USD/ticker — público
// Rate limit: 10 req/s burst 15
// ============================================================

import { fetchWithCache } from "../cache";
import type { MarketQuote, ProviderStatus } from "../types";

const COINBASE_BASE = "https://api.exchange.coinbase.com";

const COINBASE_SYMBOLS: Record<string, Record<string, string>> = {
  BTC: { USD: "BTC-USD", USDT: "BTC-USDT", USDC: "BTC-USDC", EUR: "BTC-EUR" },
  ETH: { USD: "ETH-USD", USDT: "ETH-USDT", USDC: "ETH-USDC", EUR: "ETH-EUR" },
  USDT: { USD: "USDT-USD", EUR: "USDT-EUR" },
  USDC: { USD: "USDC-USD", EUR: "USDC-EUR" },
  SOL: { USD: "SOL-USD", USDT: "SOL-USDT" },
};

export function coinbaseSymbol(asset: string, quote: string): string | null {
  return COINBASE_SYMBOLS[asset.toUpperCase()]?.[quote.toUpperCase()] || null;
}

interface CoinbaseTicker {
  bid: string;
  ask: string;
  volume: string;
  price: string;
  size: string;
  time: string;
  trade_id: number;
}

export async function fetchCoinbaseTicker(asset: string, quote: string): Promise<MarketQuote> {
  const symbol = coinbaseSymbol(asset, quote);
  if (!symbol) {
    return {
      provider: "coinbase",
      providerName: "Coinbase",
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

  const url = `${COINBASE_BASE}/products/${symbol}/ticker`;
  const { data, latencyMs, status, error } = await fetchWithCache<CoinbaseTicker>(url, {
    provider: "coinbase",
    ttlMs: 15_000,
    cacheKey: `coinbase:ticker:${symbol}`,
  });

  if (!data || !data.price) {
    return {
      provider: "coinbase",
      providerName: "Coinbase",
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

  const last = parseFloat(data.price);
  const bid = parseFloat(data.bid);
  const ask = parseFloat(data.ask);

  return {
    provider: "coinbase",
    providerName: "Coinbase",
    symbol,
    asset,
    quoteCurrency: quote,
    lastPrice: last,
    bidPrice: bid,
    askPrice: ask,
    spread: ask - bid,
    spreadPercent: last > 0 ? ((ask - bid) / last) * 100 : undefined,
    volume24h: parseFloat(data.volume),
    timestamp: new Date(data.time).getTime(),
    latencyMs,
    status: "ONLINE",
  };
}
