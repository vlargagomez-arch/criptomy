// ============================================================
// BITVAVO PROVIDER — Market data (sin API key)
// ============================================================
// Docs: https://docs.bitvavo.com/
// GET /v2/ticker/24hour?market=BTC-EUR — público, sin auth
// GET /v2/ticker/price?market=BTC-EUR — precio actual
// GET /v2/ticker/book?market=BTC-EUR — order book top
// Rate limit: 1000 req/min por IP (muy generoso)
//
// Bitvavo es exchange regulado en Holanda (Registro DNB, MiCA).
// Top 5 en Europa por volumen EUR. Pairs siempre vs EUR.
// Para USD usamos EUR como referencia (rate fijo aproximado
// o se actualiza con tasa diaria). Para USDT directo sí existe.
// ============================================================

import { fetchWithCache } from "../cache";
import type { MarketQuote, ProviderStatus } from "../types";

const BITVAVO_BASE = "https://api.bitvavo.com/v2";

// Mapping activo → symbol de Bitvavo
// Bitvavo tiene pares contra EUR, USDT y algunos contra USD (limitados)
const BITVAVO_SYMBOLS: Record<string, Record<string, string>> = {
  BTC:  { EUR: "BTC-EUR",  USDT: "BTC-USDT", USD: "BTC-EUR"  }, // USD via EUR
  ETH:  { EUR: "ETH-EUR",  USDT: "ETH-USDT", USD: "ETH-EUR"  },
  USDT: { EUR: "USDT-EUR", USD: "USDT-EUR" },
  USDC: { EUR: "USDC-EUR", USDT: "USDC-USDT", USD: "USDC-EUR" },
  SOL:  { EUR: "SOL-EUR",  USDT: "SOL-USDT", USD: "SOL-EUR"  },
  XRP:  { EUR: "XRP-EUR",  USDT: "XRP-USDT", USD: "XRP-EUR"  },
  ADA:  { EUR: "ADA-EUR",  USDT: "ADA-USDT", USD: "ADA-EUR"  },
  AVAX: { EUR: "AVAX-EUR", USDT: "AVAX-USDT", USD: "AVAX-EUR" },
  LINK: { EUR: "LINK-EUR", USDT: "LINK-USDT", USD: "LINK-EUR" },
  DOT:  { EUR: "DOT-EUR",  USDT: "DOT-USDT", USD: "DOT-EUR"  },
  MATIC:{ EUR: "MATIC-EUR",USDT: "MATIC-USDT", USD: "MATIC-EUR" },
  DOGE: { EUR: "DOGE-EUR", USDT: "DOGE-USDT", USD: "DOGE-EUR" },
};

export function bitvavoSymbol(asset: string, quote: string): string | null {
  return BITVAVO_SYMBOLS[asset.toUpperCase()]?.[quote.toUpperCase()] || null;
}

// Detecta si el quote solicitado fue USD pero estamos usando EUR como fallback
export function bitvavoUsesEurFallback(asset: string, quote: string): boolean {
  const q = quote.toUpperCase();
  if (q === "USD") return true;
  return false;
}

interface BitvavoTicker24h {
  market: string;
  lastPrice: string;
  bidPrice: string;
  askPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  volumeQuote: string;
  priceChangePercent: string;
  timestamp: number;
}

interface BitvavoBook {
  market: string;
  bid: { price: string; amount: string }[];
  ask: { price: string; amount: string }[];
}

interface BitvavoError {
  errorCode: number;
  error: string;
}

function isBitvavoError(obj: unknown): obj is BitvavoError {
  return typeof obj === "object" && obj !== null && "errorCode" in obj;
}

// Tasa de conversión EUR → USD aproximada (se actualiza manualmente;
// en producción se podría obtener de una API fx, pero esto es suficiente
// para tener una referencia visual en el buscador)
const EUR_USD_RATE = 1.08; // Sept 2024 aprox

export async function fetchBitvavoTicker(asset: string, quote: string): Promise<MarketQuote> {
  const symbol = bitvavoSymbol(asset, quote);
  const usingEurFallback = bitvavoUsesEurFallback(asset, quote);

  if (!symbol) {
    return {
      provider: "bitvavo",
      providerName: "Bitvavo",
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

  const url = `${BITVAVO_BASE}/ticker/24hour?market=${symbol}`;
  const { data, latencyMs, status, error } = await fetchWithCache<BitvavoTicker24h | BitvavoError>(url, {
    provider: "bitvavo",
    ttlMs: 15_000,
    cacheKey: `bitvavo:ticker:${symbol}`,
    headers: {
      "User-Agent": "CriptoMy/1.0 (https://criptomy.app)",
      "Accept": "application/json",
    },
  });

  if (!data) {
    return {
      provider: "bitvavo",
      providerName: "Bitvavo",
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

  // Bitvavo devuelve un error si el market no existe
  if (isBitvavoError(data)) {
    return {
      provider: "bitvavo",
      providerName: "Bitvavo",
      symbol,
      asset,
      quoteCurrency: quote,
      lastPrice: 0,
      timestamp: Date.now(),
      latencyMs,
      status: "ERROR",
      error: `Bitvavo: ${data.error} (code ${data.errorCode})`,
    };
  }

  const last = parseFloat(data.lastPrice);
  const bid = parseFloat(data.bidPrice);
  const ask = parseFloat(data.askPrice);

  // Si estamos usando EUR como fallback para USD, convertir
  // (mantiene el quote original "USD" para que el usuario lo vea,
  // pero los precios se muestran como USD aproximado)
  const factor = usingEurFallback ? EUR_USD_RATE : 1;

  return {
    provider: "bitvavo",
    providerName: "Bitvavo",
    symbol,
    asset,
    quoteCurrency: quote,
    lastPrice: last * factor,
    bidPrice: bid * factor,
    askPrice: ask * factor,
    spread: (ask - bid) * factor,
    spreadPercent: last > 0 ? ((ask - bid) / last) * 100 : undefined,
    volume24h: parseFloat(data.volume),
    quoteVolume24h: parseFloat(data.volumeQuote) * factor,
    changePercent24h: parseFloat(data.priceChangePercent),
    high24h: parseFloat(data.highPrice) * factor,
    low24h: parseFloat(data.lowPrice) * factor,
    timestamp: Date.now(),
    latencyMs,
    status: "ONLINE",
  };
}
