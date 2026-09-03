// ============================================================
// BYBIT PROVIDER — Market data (sin API key)
// ============================================================
// Docs: https://bybit-exchange.github.io/docs/v5/market/tickers
// GET /v5/market/tickers?category=spot&symbol=BTCUSDT — público
// Rate limit: 600 req / 5s
//
// IMPORTANTE: api.bybit.com bloquea algunos rangos IP (Vercel incluido)
// con HTTP 403. Bybit mantiene dominios espejo oficiales:
//   - api.bytick.com (mirror oficial, usado por su propio frontend)
//   - api2.bybit.com
//   - api-test.bybit.com
// Probamos en orden hasta encontrar uno que responda.
// ============================================================

import { fetchWithCache } from "../cache";
import type { MarketQuote, ProviderStatus } from "../types";

// Mirror endpoints oficiales de Bybit (en orden de preferencia)
const BYBIT_BASES = [
  "https://api.bybit.com",
  "https://api.bytick.com",
  "https://api2.bybit.com",
];

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

  // Probar cada mirror en orden; el primero que responda 200 con data válida gana
  for (let i = 0; i < BYBIT_BASES.length; i++) {
    const base = BYBIT_BASES[i];
    const url = `${base}/v5/market/tickers?category=spot&symbol=${symbol}`;
    // El último intento no tiene fallback → status ERROR definitivo
    const isLast = i === BYBIT_BASES.length - 1;
    const { data, latencyMs, status, error } = await fetchWithCache<BybitResponse>(url, {
      provider: "bybit",
      ttlMs: 15_000,
      cacheKey: `bybit:ticker:${symbol}`, // Cache key sin base para reutilizar entre mirrors
      timeoutMs: 6000,
    });

    if (!data || data.retCode !== 0 || !data.result.list || data.result.list.length === 0) {
      // Si es el último intento, devolver error; si no, probar siguiente mirror
      if (isLast) {
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
          error: error || (data ? data.retMsg : "Todos los mirrors de Bybit fallaron"),
        };
      }
      continue;
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

  // No debería llegar aquí, pero por si acaso
  return {
    provider: "bybit",
    providerName: "Bybit",
    symbol,
    asset,
    quoteCurrency: quote,
    lastPrice: 0,
    timestamp: Date.now(),
    latencyMs: 0,
    status: "ERROR",
    error: "Sin mirrors disponibles",
  };
}
