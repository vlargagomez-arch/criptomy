// ============================================================
// BINANCE PROVIDER — Market data + P2P (public endpoints)
// ============================================================
// Docs: https://binance-docs.github.io/apidocs/
// Market data: público, sin API key.
// P2P: endpoint web público (no oficial) — sin auth pero sin CORS.
// Rate limit: 6000 weight/min en market data (price ticker = weight 2).
// ============================================================

import { fetchWithCache } from "../cache";
import type { MarketQuote, P2POffer, ProviderStatus } from "../types";

const BINANCE_BASE = "https://data-api.binance.vision"; // endpoint público sin restricciones regionales
const BINANCE_P2P_URL = "https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search";

// Mapping activo → symbol de Binance
const BINANCE_SYMBOLS: Record<string, Record<string, string>> = {
  BTC: { USDT: "BTCUSDT", USD: "BTCUSDT", USDC: "BTCUSDC", EUR: "BTCEUR" },
  ETH: { USDT: "ETHUSDT", USD: "ETHUSDT", USDC: "ETHUSDC", EUR: "ETHEUR" },
  USDT: { USD: "USDTUSD", EUR: "USDTEUR", COP: "USDTCOP" },
  USDC: { USDT: "USDCUSDT", USD: "USDCUSD", EUR: "USDCEUR" },
  SOL: { USDT: "SOLUSDT", USD: "SOLUSDT" },
  BNB: { USDT: "BNBUSDT", USD: "BNBUSDT" },
  XRP: { USDT: "XRPUSDT", USD: "XRPUSDT" },
};

export function binanceSymbol(asset: string, quote: string): string | null {
  return BINANCE_SYMBOLS[asset.toUpperCase()]?.[quote.toUpperCase()] || null;
}

interface BinanceTicker24hr {
  lastPrice: string;
  bidPrice: string;
  askPrice: string;
  volume: string;
  quoteVolume: string;
  priceChangePercent: string;
  highPrice: string;
  lowPrice: string;
  symbol: string;
}

// Market data: GET /api/v3/ticker/24hr?symbol=BTCUSDT
export async function fetchBinanceTicker(asset: string, quote: string): Promise<MarketQuote> {
  const symbol = binanceSymbol(asset, quote);
  if (!symbol) {
    return {
      provider: "binance",
      providerName: "Binance",
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

  const url = `${BINANCE_BASE}/api/v3/ticker/24hr?symbol=${symbol}`;
  const { data, latencyMs, status, error } = await fetchWithCache<BinanceTicker24hr>(url, {
    provider: "binance",
    ttlMs: 15_000,
    cacheKey: `binance:ticker:${symbol}`,
  });

  if (!data) {
    return {
      provider: "binance",
      providerName: "Binance",
      symbol,
      asset,
      quoteCurrency: quote,
      lastPrice: 0,
      timestamp: Date.now(),
      latencyMs,
      status: status as ProviderStatus,
      error,
    };
  }

  const last = parseFloat(data.lastPrice);
  const bid = parseFloat(data.bidPrice);
  const ask = parseFloat(data.askPrice);

  return {
    provider: "binance",
    providerName: "Binance",
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

// ============================================================
// BINANCE P2P — POST /bapi/c2c/v2/friendly/c2c/adv/search
// ============================================================
// Sin API key. Sin CORS (solo backend).
// Body: {
//   asset: "USDT", fiat: "COP", tradeType: "BUY"|"SELL",
//   page: 1, rows: 10, payTypes: []
// }
// tradeType: BUY = el usuario quiere comprar; SELL = el usuario quiere vender.

interface BinanceP2PAdv {
  advNo: number;
  advOwnerNickName: string;
  advertiserNickName: string;
  asset: string;
  fiatUnit: string;
  price: string;
  surAmountWithTag: string;
  minSingleTransAmount: string;
  maxSingleTransAmount: string;
  tradableQuantity: string;
  tradeMethods: { identifier: string; tradeMethodName: string; tradeMethodShortName: string }[];
  tradeType: string; // "BUY" | "SELL" (desde perspectiva advertiser)
}

interface BinanceP2PResponse {
  data: BinanceP2PAdv[];
  total: number;
}

export async function fetchBinanceP2P(params: {
  asset: string;
  fiat: string;
  tradeType: "BUY" | "SELL";  // perspectiva del usuario
  page?: number;
  rows?: number;
  payTypes?: string[];
}): Promise<P2POffer[]> {
  const body = JSON.stringify({
    asset: params.asset,
    fiat: params.fiat,
    tradeType: params.tradeType, // OJO: Binance usa la misma perspectiva (BUY=comprar por usuario)
    page: params.page || 1,
    rows: params.rows || 20,
    payTypes: params.payTypes || [],
    publisherType: null,
    merchantCheck: false,
  });

  const cacheKey = `binance:p2p:${params.asset}:${params.fiat}:${params.tradeType}:${params.page || 1}:${(params.payTypes || []).join(",")}`;
  const url = BINANCE_P2P_URL;

  // fetchWithCache no soporta body, lo hacemos manualmente
  const start = Date.now();
  try {
    // Check circuit breaker
    const { isCircuitOpen, recordSuccess, recordFailure, cacheGet, cacheSet } = await import("../cache");
    if (isCircuitOpen("binance-p2p")) {
      return [];
    }
    const cached = cacheGet<P2POffer[]>(cacheKey);
    if (cached) return cached;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const latencyMs = Date.now() - start;

    if (res.status === 429) {
      recordFailure("binance-p2p");
      return [];
    }
    if (!res.ok) {
      recordFailure("binance-p2p");
      return [];
    }

    const data = (await res.json()) as BinanceP2PResponse;
    if (!data.data) return [];

    const offers: P2POffer[] = data.data.map((adv) => {
      const price = parseFloat(adv.price);
      const minAmount = parseFloat(adv.minSingleTransAmount);
      const maxAmount = parseFloat(adv.maxSingleTransAmount);
      const available = parseFloat(adv.tradableQuantity);

      return {
        provider: "binance",
        providerName: "Binance",
        advertiser: adv.advertiserNickName || adv.advOwnerNickName || "anónimo",
        asset: adv.asset,
        fiat: adv.fiatUnit,
        tradeType: params.tradeType,
        price,
        minAmount,
        maxAmount,
        available,
        paymentMethods: (adv.tradeMethods || []).map((m) => m.tradeMethodShortName || m.tradeMethodName || m.identifier),
        tradeCount: 0,
        timestamp: Date.now(),
        latencyMs,
        status: "ONLINE" as ProviderStatus,
      };
    });

    cacheSet(cacheKey, offers, 15_000);
    recordSuccess("binance-p2p");
    return offers;
  } catch (err) {
    const { recordFailure } = await import("../cache");
    recordFailure("binance-p2p");
    return [];
  }
}
