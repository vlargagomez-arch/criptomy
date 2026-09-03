// ============================================================
// SCANNER PROVIDERS REGISTRY
// ============================================================
// Catálogo central de providers del scanner. Cada uno con metadata
// real verificada: qué soporta, qué requiere, rate limit, etc.
//
// KYC HONESTO (verificado en docs oficiales y TOS de cada exchange):
//   - MANDATORY: el exchange REQUIERE KYC para usar la plataforma
//   - OPTIONAL: KYC para límites más altos (pero trading sí permitido sin KYC)
//   - NO_KYC: no requiere KYC (normalmente DEX o agregadores)
//   - UNKNOWN: no confirmado
//
// LIQUIDITY TIER (basado en CoinGecko volume rankings, Sept 2024):
//   - TOP: top 10 exchanges por volumen
//   - MEDIUM: top 50
//   - LOW: top 200
//   - AGGREGATOR: no es exchange (es agregador)
// ============================================================

import type { ProviderConfig } from "./types";

export const SCANNER_PROVIDERS: ProviderConfig[] = [
  // ============================================================
  // TOP LIQUIDITY — Exchanges principales
  // ============================================================
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
    kycRequired: true,
    kycLevel: "MANDATORY",
    kycNote: "Binance exige KYC desde 2021 para todos los usuarios. P2P requiere verificación. Market data público sin auth.",
    liquidityTier: "TOP",
    rateLimitPerMin: 6000,
    notes: "Top 1 por volumen global. Market data público (6000 weight/min). P2P sin auth vía API web.",
  },
  {
    id: "okx",
    name: "OKX",
    baseUrl: "https://www.okx.com",
    logoUrl: "⚫",
    websiteUrl: "https://www.okx.com",
    documentationUrl: "https://www.okx.com/docs-v5/",
    requiresApiKey: false,
    supportsP2P: false,
    supportsMarketData: true,
    countries: ["ALL"],
    kycRequired: true,
    kycLevel: "MANDATORY",
    kycNote: "OKX exige KYC desde 2022 para trading. Market data público.",
    liquidityTier: "TOP",
    rateLimitPerMin: 600,
    notes: "Top 5 por volumen. P2P no disponible vía API (requiere advertiser role).",
  },
  {
    id: "bybit",
    name: "Bybit",
    baseUrl: "https://api.bybit.com",
    logoUrl: "🟡",
    websiteUrl: "https://www.bybit.com",
    documentationUrl: "https://bybit-exchange.github.io/docs/v5/intro",
    requiresApiKey: false,
    supportsP2P: false,
    supportsMarketData: true,
    countries: ["ALL"],
    kycRequired: true,
    kycLevel: "MANDATORY",
    kycNote: "Bybit exige KYC desde 2023 para todos los usuarios.",
    liquidityTier: "TOP",
    rateLimitPerMin: 600,
    notes: "Top 5 por volumen. ⚠️ BLOQUEADO desde Vercel — Bybit devuelve HTTP 403 a rangos IP de cloud providers (incluido Vercel). Probé 5 mirrors oficiales y todos fallan desde el servidor. Reemplazado por Bitget como alternativa TOP liquidez. En el front-end se mostrará 'Deshabilitado' en lugar de intentar cada 30s y fallar.",
  },
  {
    id: "bitget",
    name: "Bitget",
    baseUrl: "https://api.bitget.com",
    logoUrl: "🟪",
    websiteUrl: "https://www.bitget.com",
    documentationUrl: "https://www.bitget.com/api-doc/spot/intro",
    requiresApiKey: false,
    supportsP2P: false,
    supportsMarketData: true,
    countries: ["ALL"],
    kycRequired: true,
    kycLevel: "MANDATORY",
    kycNote: "Bitget requiere KYC desde 2024. Market data público.",
    liquidityTier: "TOP",
    rateLimitPerMin: 3000,
    notes: "Top 10 por volumen. Reemplaza a Bybit (que está geo-blocked en Vercel). 100 req/2s rate limit. CORS enabled.",
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
    kycLevel: "MANDATORY",
    kycNote: "Coinbase requiere KYC completo (SSN/government ID) para cualquier cuenta. Mercado más regulado de USA.",
    liquidityTier: "TOP",
    rateLimitPerMin: 600,
    notes: "Top 3 por volumen. Exchange regulado en USA. Market data público (10 req/s).",
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
    kycLevel: "MANDATORY",
    kycNote: "Kraken requiere KYC (Intermediate/Pro) para trading. Market data público. Sin CORS (solo backend).",
    liquidityTier: "TOP",
    rateLimitPerMin: 60,
    notes: "Top 10. Exchange regulado en USA/Europa. Usa XBT en vez de BTC.",
  },
  {
    id: "kucoin",
    name: "KuCoin",
    baseUrl: "https://api.kucoin.com",
    logoUrl: "🟢",
    websiteUrl: "https://www.kucoin.com",
    documentationUrl: "https://docs.kucoin.com/",
    requiresApiKey: false,
    supportsP2P: false,
    supportsMarketData: true,
    countries: ["ALL"],
    kycRequired: true,
    kycLevel: "MANDATORY",
    kycNote: "KuCoin introdujo KYC obligatorio en julio 2023. Antes era 'no KYC'. Market data público.",
    liquidityTier: "TOP",
    rateLimitPerMin: 6000,
    notes: "Top 10 por volumen. 3000 req/30s. API muy generosa.",
  },
  {
    id: "gate",
    name: "Gate.io",
    baseUrl: "https://api.gateio.ws",
    logoUrl: "🟦",
    websiteUrl: "https://www.gate.io",
    documentationUrl: "https://www.gate.io/docs/developers/apiv4/en/",
    requiresApiKey: false,
    supportsP2P: false,
    supportsMarketData: true,
    countries: ["ALL"],
    kycRequired: true,
    kycLevel: "MANDATORY",
    kycNote: "Gate.io introdujo KYC obligatorio en 2023. Market data público.",
    liquidityTier: "MEDIUM",
    rateLimitPerMin: 18000,
    notes: "Top 20 por volumen. 300 req/s — rate limit muy generoso.",
  },
  {
    id: "mexc",
    name: "MEXC",
    baseUrl: "https://api.mexc.com",
    logoUrl: "🟠",
    websiteUrl: "https://www.mexc.com",
    documentationUrl: "https://mexcdevelop.github.io/apidocs/spot-api-v3/",
    requiresApiKey: false,
    supportsP2P: false,
    supportsMarketData: true,
    countries: ["ALL"],
    kycRequired: false,
    kycLevel: "OPTIONAL",
    kycNote: "MEXC sigue permitiendo trading básico sin KYC (con límites). KYC para límites más altos. Market data público.",
    liquidityTier: "TOP",
    rateLimitPerMin: 12000,
    notes: "Top 10. Conocido por listado rápido de tokens. KYC OPTIONAL (pocos exchanges quedan así).",
  },
  {
    id: "htx",
    name: "HTX (Huobi)",
    baseUrl: "https://api.huobi.pro",
    logoUrl: "🟥",
    websiteUrl: "https://www.htx.com",
    documentationUrl: "https://www.htx.com/en-us/opend/newApiHome/",
    requiresApiKey: false,
    supportsP2P: false,
    supportsMarketData: true,
    countries: ["ALL"],
    kycRequired: true,
    kycLevel: "MANDATORY",
    kycNote: "HTX (antes Huobi) introdujo KYC obligatorio en 2023. Símbolos en minúscula.",
    liquidityTier: "MEDIUM",
    rateLimitPerMin: 240,
    notes: "Top 20. Rebranded de Huobi. 4 req/s concurrente.",
  },

  // ============================================================
  // AGREGADORES
  // ============================================================
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
    kycLevel: "NO_KYC",
    kycNote: "CoinGecko es agregador. No requiere KYC (no es exchange). Datos de miles de fuentes.",
    liquidityTier: "AGGREGATOR",
    rateLimitPerMin: 30,
    notes: "Agregador (no exchange). Sin order book. Rate limit frágil (~30 calls/min). Usar como fallback.",
  },
  {
    id: "bingx",
    name: "BingX",
    baseUrl: "https://open-api.bingx.com",
    logoUrl: "🔷",
    websiteUrl: "https://www.bingx.com",
    documentationUrl: "https://bingx-api.github.io/docs/",
    requiresApiKey: false,
    supportsP2P: false,
    supportsMarketData: true,
    countries: ["ALL"],
    kycRequired: true,
    kycLevel: "MANDATORY",
    kycNote: "BingX requiere KYC. Market data público.",
    liquidityTier: "TOP",
    rateLimitPerMin: 6000,
    notes: "Top 20 por volumen. API pública sin key. No bloquea Vercel (a diferencia de Bybit). 100 req/s. Reemplazo de Bybit.",
  },
];

export function getScannerProvider(id: string): ProviderConfig | undefined {
  return SCANNER_PROVIDERS.find((p) => p.id === id);
}

export function getActiveProviders(): ProviderConfig[] {
  return SCANNER_PROVIDERS.filter((p) => p.supportsMarketData);
}

// Helpers nuevos
export function getNoKycProviders(): ProviderConfig[] {
  return SCANNER_PROVIDERS.filter((p) => p.kycLevel === "NO_KYC" || p.kycLevel === "OPTIONAL");
}

export function getTopLiquidityProviders(): ProviderConfig[] {
  return SCANNER_PROVIDERS.filter((p) => p.liquidityTier === "TOP");
}
