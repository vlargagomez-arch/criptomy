// ============================================================
// BYBIT PROVIDER — Market data (sin API key)
// ============================================================
// Docs: https://bybit-exchange.github.io/docs/v5/market/tickers
//
// IMPORTANTE: Bybit usa Amazon CloudFront y bloquea IPs de cloud
// providers (Vercel, AWS, etc.) con HTTP 403:
//   "The Amazon CloudFront distribution is configured to block access
//    from your country"
//
// Solución: si BYBIT_PROXY_URL está configurada (Cloudflare Worker),
// usar ese proxy. Si no, devolver status DISABLED con error claro.
// Documentación del proxy en docs/bybit-proxy/README.md.
// ============================================================

import { fetchWithCache } from "../cache";
import type { MarketQuote, ProviderStatus } from "../types";

const BYBIT_DIRECT = "https://api.bybit.com";
const BYBIT_MIRRORS = ["https://api.bybit.com", "https://api.bytick.com"];

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

// Si BYBIT_PROXY_URL está configurada, construir la URL usando el proxy
function buildBybitUrl(symbol: string): string {
  const proxy = process.env.BYBIT_PROXY_URL;
  const path = `/v5/market/tickers?category=spot&symbol=${symbol}`;

  if (proxy) {
    // Sin trailing slash en la env var, lo añadimos al path
    return `${proxy.replace(/\/$/, "")}${path}`;
  }

  // Sin proxy: intento directo (sabrá Dios desde dónde). En Vercel falla con 403.
  return `${BYBIT_DIRECT}${path}`;
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

  const proxy = process.env.BYBIT_PROXY_URL;

  // Si no hay proxy configurado, devolver DISABLED con mensaje claro
  // (sabemos que el directo fallará en Vercel — evita latencia innecesaria)
  if (!proxy) {
    return {
      provider: "bybit",
      providerName: "Bybit",
      symbol,
      asset,
      quoteCurrency: quote,
      lastPrice: 0,
      timestamp: Date.now(),
      latencyMs: 0,
      status: "DISABLED" as ProviderStatus,
      error: "Geo-blocked desde Vercel (HTTP 403). Configura BYBIT_PROXY_URL con un Cloudflare Worker (ver docs/bybit-proxy/README.md).",
    };
  }

  // Con proxy: hacer la llamada
  const url = buildBybitUrl(symbol);
  const { data, latencyMs, status, error } = await fetchWithCache<BybitResponse>(url, {
    provider: "bybit",
    ttlMs: 15_000,
    cacheKey: `bybit:ticker:${symbol}`,
    timeoutMs: 8000,
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
      error: error || (data ? data.retMsg : "Sin datos del proxy"),
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
