// ============================================================
// SCANNER PROVIDERS REGISTRY
// ============================================================
// Catálogo central de providers del scanner. Cada uno con metadata
// real verificada: qué soporta, qué requiere, rate limit, etc.
// ============================================================

import type { ProviderConfig } from "./types";

export const SCANNER_PROVIDERS: ProviderConfig[] = [
  {
    id: "binance",
    name: "Binance",
    baseUrl: "https://data-api.binance.vision",
    logoUrl: "🟧",
    websiteUrl: "https://www.binance.com",
    documentationUrl: "https://binance-docs.github.io/apidocs/",
    requiresApiKey: false,
    supportsP2P: true,
    supportsMarketData: true,
    countries: ["ALL"],
    kycRequired: true, // KYC de Binance, no nuestro
    rateLimitPerMin: 6000,
    notes: "Market data público (6000 weight/min). P2P endpoint web sin auth, sin CORS (solo backend).",
  },
  {
    id: "okx",
    name: "OKX",
    baseUrl: "https://www.okx.com",
    logoUrl: "⚫",
    websiteUrl: "https://www.okx.com",
    documentationUrl: "https://www.okx.com/docs-v5/",
    requiresApiKey: false,
    supportsP2P: false, // P2P requiere advertiser role
    supportsMarketData: true,
    countries: ["ALL"],
    kycRequired: true,
    rateLimitPerMin: 600,
    notes: "Market data público. P2P no disponible vía API (requiere advertiser role).",
  },
  {
    id: "bybit",
    name: "Bybit",
    baseUrl: "https://api.bybit.com",
    logoUrl: "🟡",
    websiteUrl: "https://www.bybit.com",
    documentationUrl: "https://bybit-exchange.github.io/docs/v5/intro",
    requiresApiKey: false,
    supportsP2P: false, // P2P requiere advertiser role
    supportsMarketData: true,
    countries: ["ALL"],
    kycRequired: true,
    rateLimitPerMin: 600,
    notes: "Market data público (600 req/5s). P2P no disponible vía API.",
  },
  {
    id: "kraken",
    name: "Kraken",
    baseUrl: "https://api.kraken.com",
    logoUrl: "🟪",
    websiteUrl: "https://www.kraken.com",
    documentationUrl: "https://docs.kraken.com/rest/",
    requiresApiKey: false,
    supportsP2P: false,
    supportsMarketData: true,
    countries: ["ALL"],
    kycRequired: true,
    rateLimitPerMin: 60,
    notes: "Market data público. Sin CORS (solo backend). Usa XBT en vez de BTC.",
  },
  {
    id: "coinbase",
    name: "Coinbase",
    baseUrl: "https://api.exchange.coinbase.com",
    logoUrl: "🔵",
    websiteUrl: "https://www.coinbase.com",
    documentationUrl: "https://docs.cloud.coinbase.com/exchange/docs/",
    requiresApiKey: false,
    supportsP2P: false,
    supportsMarketData: true,
    countries: ["ALL"],
    kycRequired: true,
    rateLimitPerMin: 600,
    notes: "Market data público (10 req/s burst 15).",
  },
  {
    id: "coingecko",
    name: "CoinGecko",
    baseUrl: "https://api.coingecko.com/api/v3",
    logoUrl: "🦎",
    websiteUrl: "https://www.coingecko.com",
    documentationUrl: "https://docs.coingecko.com/",
    requiresApiKey: false,
    supportsP2P: false,
    supportsMarketData: true,
    countries: ["ALL"],
    kycRequired: false,
    rateLimitPerMin: 30,
    notes: "Agregador (no exchange). Sin order book. Rate limit frágil. Usar como fallback.",
  },
];

export function getScannerProvider(id: string): ProviderConfig | undefined {
  return SCANNER_PROVIDERS.find((p) => p.id === id);
}

export function getActiveProviders(): ProviderConfig[] {
  return SCANNER_PROVIDERS.filter((p) => p.supportsMarketData);
}
