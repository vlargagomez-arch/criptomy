// ============================================================
// COINGECKO PROVIDER — Market data (sin API key, con rate limit)
// ============================================================
// Docs: https://docs.coingecko.com/
// GET /api/v3/simple/price?ids=bitcoin&vs_currencies=usd — público
// Rate limit: ~10-30 calls/min (frágil, mejor como fallback)
// Es agregador, no exchange — no tiene order book.
// ============================================================

import { fetchWithCache } from "../cache";
import type { MarketQuote, ProviderStatus } from "../types";

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

// Mapping activo → CoinGecko coin id
const COINGECKO_IDS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  USDT: "tether",
  USDC: "usd-coin",
  SOL: "solana",
  BNB: "binancecoin",
  XRP: "ripple",
  ADA: "cardano",
  DOT: "polkadot",
  LINK: "chainlink",
  MATIC: "matic-network",
  AVAX: "avalanche-2",
};

// CoinGecko no soporta COP u otras fiats locales en simple/price. Usamos USD como puente.
const COINGECKO_QUOTES = ["USD", "EUR"];

export function coingeckoId(asset: string): string | null {
  return COINGECKO_IDS[asset.toUpperCase()] || null;
}

// Response: { "bitcoin": { "usd": 65000.42, "usd_24h_change": 2.5, "usd_24h_vol": 25000000000 } }
type CoingeckoPriceResponse = Record<string, Record<string, number>>;

export async function fetchCoingeckoTicker(asset: string, quote: string): Promise<MarketQuote> {
  const coinId = coingeckoId(asset);
  if (!coinId) {
    return {
      provider: "coingecko",
      providerName: "CoinGecko",
      symbol: "",
      asset,
      quoteCurrency: quote,
      lastPrice: 0,
      timestamp: Date.now(),
      latencyMs: 0,
      status: "ERROR",
      error: `Asset no soportado: ${asset}`,
    };
  }
  const quoteUpper = quote.toUpperCase();
  if (!COINGECKO_QUOTES.includes(quoteUpper)) {
    return {
      provider: "coingecko",
      providerName: "CoinGecko",
      symbol: "",
      asset,
      quoteCurrency: quote,
      lastPrice: 0,
      timestamp: Date.now(),
      latencyMs: 0,
      status: "ERROR",
      error: `Quote no soportado: ${quote} (solo USD y EUR)`,
    };
  }

  const url = `${COINGECKO_BASE}/simple/price?ids=${coinId}&vs_currencies=${quoteUpper.toLowerCase()}&include_24hr_vol=true&include_24hr_change=true`;
  const { data, latencyMs, status, error } = await fetchWithCache<CoingeckoPriceResponse>(url, {
    provider: "coingecko",
    ttlMs: 30_000,
    cacheKey: `coingecko:price:${coinId}:${quoteUpper}`,
  });

  if (!data || !data[coinId]) {
    return {
      provider: "coingecko",
      providerName: "CoinGecko",
      symbol: coinId,
      asset,
      quoteCurrency: quote,
      lastPrice: 0,
      timestamp: Date.now(),
      latencyMs,
      status: status as ProviderStatus,
      error: error || "Respuesta vacía",
    };
  }

  const coinData = data[coinId];
  const quoteLower = quoteUpper.toLowerCase();
  const last = coinData[quoteLower];
  if (!last) {
    return {
      provider: "coingecko",
      providerName: "CoinGecko",
      symbol: coinId,
      asset,
      quoteCurrency: quote,
      lastPrice: 0,
      timestamp: Date.now(),
      latencyMs,
      status: "ERROR",
      error: `Sin precio para ${quoteUpper}`,
    };
  }

  return {
    provider: "coingecko",
    providerName: "CoinGecko",
    symbol: coinId,
    asset,
    quoteCurrency: quoteUpper,
    lastPrice: last,
    volume24h: coinData[`${quoteLower}_24h_vol`],
    changePercent24h: coinData[`${quoteLower}_24h_change`],
    timestamp: Date.now(),
    latencyMs,
    status: "ONLINE",
  };
}
