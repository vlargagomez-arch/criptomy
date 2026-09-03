// ============================================================
// REGISTRY — Catálogo de providers
// ============================================================
// CRITERIO: SOLO providers que funcionan 100% SIN API key externa.
// Si un provider requiere API key que no tenemos, NO está aquí.
// El usuario no sale de la web. Todo es control 100% nuestro.
//
// Eliminados (requieren API key que no tenemos):
// - MoonPay, Transak, Ramp, Coinbase Onramp (ON_RAMP)
// - MoonPay Sell, Transak Sell (OFF_RAMP)
// - Crypto.com Card, Wirex, Gnosis Pay (CARD)
// - MoneyGram, Bitso (REMITTANCE)
// - WalletConnect (requiere projectId)
//
// Cuando se consigan las API keys, se agregan de vuelta aquí.
// ============================================================

import type { ProviderMetadata } from "./types";

export const PROVIDER_REGISTRY: ProviderMetadata[] = [
  // ============================================================
  // WALLETS — 100% sin API key
  // ============================================================
  {
    id: "metamask",
    name: "MetaMask",
    category: "WALLET",
    logoUrl: "🦊",
    websiteUrl: "https://metamask.io",
    documentationUrl: "https://docs.metamask.io",
    countries: ["ALL"],
    cryptos: ["ETH", "USDT", "USDC", "MATIC", "BNB", "BTC"],
    networks: ["ETHEREUM", "POLYGON", "BSC", "BASE", "ARBITRUM"],
    kycRequired: false,
    isReal: true,
    isLive: true,
    apiKeyRequired: false,
    integrationType: "SDK",
    notes: "Inyectado en navegador vía EIP-1193. Mobile vía deep link a MetaMask browser. 100% sin API key.",
  },
  {
    id: "trustwallet",
    name: "Trust Wallet",
    category: "WALLET",
    logoUrl: "🛡️",
    websiteUrl: "https://trustwallet.com",
    countries: ["ALL"],
    cryptos: ["ETH", "USDT", "USDC", "BNB", "BTC"],
    networks: ["ETHEREUM", "BSC", "POLYGON"],
    kycRequired: false,
    isReal: true,
    isLive: true,
    apiKeyRequired: false,
    integrationType: "SDK",
    notes: "Mobile deep link a Trust Wallet browser. Compatible EIP-1193. Sin API key.",
  },
  {
    id: "rabby",
    name: "Rabby Wallet",
    category: "WALLET",
    logoUrl: "🐰",
    websiteUrl: "https://rabby.io",
    countries: ["ALL"],
    cryptos: ["ETH", "USDT", "USDC"],
    networks: ["ETHEREUM", "POLYGON", "BASE", "ARBITRUM"],
    kycRequired: false,
    isReal: true,
    isLive: true,
    apiKeyRequired: false,
    integrationType: "SDK",
    notes: "Desktop. Compatible EIP-1193. Sin API key.",
  },

  // ============================================================
  // MARKET DATA — 100% sin API key (APIs públicas)
  // ============================================================
  {
    id: "chainlink",
    name: "Chainlink Price Feeds",
    category: "MARKET_DATA",
    logoUrl: "⬡",
    websiteUrl: "https://chain.link",
    documentationUrl: "https://data.chain.link",
    countries: ["ALL"],
    cryptos: ["BTC", "ETH", "USDT", "USDC", "LINK"],
    networks: ["ETHEREUM"],
    kycRequired: false,
    isReal: true,
    isLive: true,
    apiKeyRequired: false,
    integrationType: "API",
    notes: "On-chain price feeds. Gratis vía RPC público. Usado para alertas de precio. Sin API key.",
  },
  {
    id: "coingecko",
    name: "CoinGecko",
    category: "MARKET_DATA",
    logoUrl: "🦎",
    websiteUrl: "https://coingecko.com",
    documentationUrl: "https://www.coingecko.com/api/documentation",
    countries: ["ALL"],
    cryptos: ["ALL"],
    networks: ["ALL"],
    kycRequired: false,
    isReal: true,
    isLive: true,
    apiKeyRequired: false,
    integrationType: "API",
    notes: "Free tier: 50 calls/min. Sin API key. Usado para trending, gainers, losers, staking yields.",
  },
];

// ============================================================
// Helpers
// ============================================================
export function getProvidersByCategory(category: ProviderMetadata["category"]): ProviderMetadata[] {
  return PROVIDER_REGISTRY.filter((p) => p.category === category);
}

export function getProvidersByCountry(country: string): ProviderMetadata[] {
  return PROVIDER_REGISTRY.filter(
    (p) => p.countries.includes("ALL") || p.countries.includes(country.toUpperCase())
  );
}

export function getLiveProviders(): ProviderMetadata[] {
  return PROVIDER_REGISTRY.filter((p) => p.isLive && p.isReal);
}

export function getProviderById(id: string): ProviderMetadata | undefined {
  return PROVIDER_REGISTRY.find((p) => p.id === id);
}
