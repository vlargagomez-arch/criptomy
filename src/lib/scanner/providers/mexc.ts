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
  // USDT/USD: MEXC no tiene este par. Usamos BTC como referencia y
  // ajustamos en el conector. Para USDT ≈ $1, devolvemos precio del BTC/USDT
  // dividido por precio BTC (que sería ~1). En la práctica, el engine ya
  // convierte correctamente. Aquí mapeamos USD → USDT (casi 1:1).
  USDT: { USD: "__USDT_USD_PROXY__", USDC: "__USDT_USD_PROXY__" },
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

  // USDT/USD proxy: MEXC no tiene par USDT/USD. Devolver precio ≈ 1.0
  // (USDT es stablecoin peggeada al USD).
  if (symbol === "__USDT_USD_PROXY__") {
    return {
      provider: "mexc",
      providerName: "MEXC",
      symbol: "USDTUSD",
      asset,
      quoteCurrency: quote,
      lastPrice: 1.0,
      bidPrice: 1.0,
      askPrice: 1.0,
      spread: 0.001,
      spreadPercent: 0.1,
      timestamp: Date.now(),
      latencyMs: 0,
      status: "ONLINE",
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
