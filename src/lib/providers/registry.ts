// ============================================================
// REGISTRY — Catálogo de providers
// ============================================================
// Lista todos los providers conocidos, su estado de integración
// real, países, KYC, y si tenemos API key o no.
// La UI y el admin usan esta metadata. Los adapters deciden cuál
// usar en runtime según configuración.
// ============================================================

import type { ProviderMetadata } from "./types";

export const PROVIDER_REGISTRY: ProviderMetadata[] = [
  // ============================================================
  // WALLETS
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
    notes: "Inyectado en navegador vía EIP-1193. Mobile vía deep link a MetaMask browser.",
  },
  {
    id: "walletconnect",
    name: "WalletConnect",
    category: "WALLET",
    logoUrl: "🔗",
    websiteUrl: "https://walletconnect.com",
    documentationUrl: "https://docs.walletconnect.com",
    countries: ["ALL"],
    cryptos: ["ETH", "USDT", "USDC", "MATIC", "BNB", "BTC", "SOL"],
    networks: ["ETHEREUM", "POLYGON", "BSC", "BASE", "ARBITRUM", "SOLANA"],
    kycRequired: false,
    isReal: true,
    isLive: false, // requiere NEXT_PUBLIC_WC_PROJECT_ID
    apiKeyRequired: true,
    integrationType: "SDK",
    notes: "Protocolo estándar. Requiere projectId de WalletConnect Cloud.",
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
    notes: "Mobile deep link a Trust Wallet browser. Compatible EIP-1193.",
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
    notes: "Desktop. Compatible EIP-1193.",
  },

  // ============================================================
  // ON-RAMP (Comprar cripto)
  // ============================================================
  {
    id: "moonpay",
    name: "MoonPay",
    category: "ON_RAMP",
    logoUrl: "🌙",
    websiteUrl: "https://moonpay.com",
    documentationUrl: "https://moonpay.com/business/developer-docs",
    countries: ["CO", "MX", "AR", "BR", "CL", "PE", "EC", "VE", "DO"],
    cryptos: ["BTC", "ETH", "USDT", "USDC", "SOL"],
    networks: ["ETHEREUM", "POLYGON", "SOLANA", "BITCOIN"],
    kycRequired: true,
    isReal: true,
    isLive: false, // requiere MOONPAY_API_KEY + MOONPAY_SECRET
    apiKeyRequired: true,
    integrationType: "SDK",
    notes: "Widget SDK. Disponible en Colombia. KYC lo hace MoonPay, no nosotros.",
  },
  {
    id: "transak",
    name: "Transak",
    category: "ON_RAMP",
    logoUrl: "🎯",
    websiteUrl: "https://transak.com",
    documentationUrl: "https://docs.transak.com",
    countries: ["CO", "MX", "AR", "BR", "CL", "PE", "EC"],
    cryptos: ["BTC", "ETH", "USDT", "USDC", "MATIC"],
    networks: ["ETHEREUM", "POLYGON", "BITCOIN"],
    kycRequired: true,
    isReal: true,
    isLive: false, // requiere TRANSAK_API_KEY
    apiKeyRequired: true,
    integrationType: "SDK",
    notes: "SDK iframe. Soporta PSE y Bancolombia en Colombia. KYC Transak.",
  },
  {
    id: "ramp",
    name: "Ramp Network",
    category: "ON_RAMP",
    logoUrl: "🚀",
    websiteUrl: "https://ramp.network",
    documentationUrl: "https://docs.ramp.network",
    countries: ["CO", "MX", "BR"],
    cryptos: ["BTC", "ETH", "USDT", "USDC"],
    networks: ["ETHEREUM", "POLYGON", "BITCOIN"],
    kycRequired: true,
    isReal: true,
    isLive: false, // requiere RAMP_API_KEY
    apiKeyRequired: true,
    integrationType: "SDK",
    notes: "Widget SDK. Verificar disponibilidad actual en Colombia.",
  },
  {
    id: "coinbase-onramp",
    name: "Coinbase Onramp",
    category: "ON_RAMP",
    logoUrl: "🔵",
    websiteUrl: "https://www.coinbase.com/onramp",
    documentationUrl: "https://docs.cdp.coinbase.com/onramp",
    countries: ["CO", "MX", "AR", "BR"],
    cryptos: ["BTC", "ETH", "USDC"],
    networks: ["ETHEREUM", "BASE", "BITCOIN"],
    kycRequired: true,
    isReal: true,
    isLive: false,
    apiKeyRequired: true,
    integrationType: "SDK",
    notes: "Requiere cuenta de developer Coinbase.",
  },

  // ============================================================
  // OFF-RAMP (Vender cripto)
  // ============================================================
  {
    id: "moonpay-offramp",
    name: "MoonPay (Sell)",
    category: "OFF_RAMP",
    logoUrl: "🌙",
    websiteUrl: "https://moonpay.com",
    documentationUrl: "https://moonpay.com/business/developer-docs",
    countries: ["CO", "MX", "AR", "BR"],
    cryptos: ["BTC", "ETH", "USDT", "USDC"],
    networks: ["ETHEREUM", "POLYGON"],
    kycRequired: true,
    isReal: true,
    isLive: false,
    apiKeyRequired: true,
    integrationType: "SDK",
    notes: "Disponibilidad off-ramp varía. Verificar antes de activar.",
  },
  {
    id: "transak-offramp",
    name: "Transak (Sell)",
    category: "OFF_RAMP",
    logoUrl: "🎯",
    websiteUrl: "https://transak.com",
    documentationUrl: "https://docs.transak.com",
    countries: ["CO", "MX", "BR"],
    cryptos: ["BTC", "ETH", "USDT", "USDC"],
    networks: ["ETHEREUM", "POLYGON"],
    kycRequired: true,
    isReal: true,
    isLive: false,
    apiKeyRequired: true,
    integrationType: "SDK",
    notes: "Off-ramp disponible en LATAM. Verificar payout methods Colombia.",
  },

  // ============================================================
  // CARDS (Tarjetas crypto) — TODOS requieren verificación
  // ============================================================
  {
    id: "crypto-com-card",
    name: "Crypto.com Card",
    category: "CARD",
    logoUrl: "💳",
    websiteUrl: "https://crypto.com/card",
    countries: ["CO", "MX", "AR", "BR", "CL", "PE"],
    cryptos: ["BTC", "ETH", "USDC", "CRO"],
    networks: ["ETHEREUM", "CRONOS"],
    kycRequired: true,
    isReal: true,
    isLive: false,
    apiKeyRequired: true,
    integrationType: "REDIRECT",
    notes: "Sin API pública para integradores. Solo redirect a su app. Verificar disponibilidad Colombia.",
  },
  {
    id: "wirex",
    name: "Wirex",
    category: "CARD",
    logoUrl: "💳",
    websiteUrl: "https://wirexapp.com",
    countries: ["MX", "BR"],  // verificar Colombia
    cryptos: ["BTC", "ETH", "USDT", "USDC"],
    networks: ["ETHEREUM", "POLYGON"],
    kycRequired: true,
    isReal: true,
    isLive: false,
    apiKeyRequired: true,
    integrationType: "REDIRECT",
    notes: "Verificar disponibilidad Colombia. Sin API pública documentada.",
  },
  {
    id: "gnosis-pay",
    name: "Gnosis Pay",
    category: "CARD",
    logoUrl: "💳",
    websiteUrl: "https://gnosispay.com",
    countries: ["MX", "BR"],  // NO Colombia confirmado
    cryptos: ["ETH", "USDC", "GNO"],
    networks: ["ETHEREUM", "GNOSIS"],
    kycRequired: true,
    isReal: true,
    isLive: false,
    apiKeyRequired: true,
    integrationType: "REDIRECT",
    notes: "No confirmado en Colombia. Solo Europa y algunos países LATAM.",
  },

  // ============================================================
  // REMITTANCE (Remesas) — requieren licencia
  // ============================================================
  {
    id: "moneygram-crypto",
    name: "MoneyGram Crypto",
    category: "REMITTANCE",
    logoUrl: "💸",
    websiteUrl: "https://moneygram.com",
    countries: ["CO", "MX", "AR", "BR", "CL", "PE", "EC", "DO"],
    cryptos: ["USDT", "USDC"],
    networks: ["ETHEREUM", "POLYGON", "STELLAR"],
    kycRequired: true,
    isReal: true,
    isLive: false,
    apiKeyRequired: true,
    integrationType: "REDIRECT",
    notes: "MoneyGram × Stellar. Cash pickup. Sin API pública para integradores. Verificar regulación remesas COL.",
  },
  {
    id: "bitso-bridge",
    name: "Bitso Bridge",
    category: "REMITTANCE",
    logoUrl: "🌐",
    websiteUrl: "https://bitso.com",
    countries: ["MX", "AR", "BR", "CO"],
    cryptos: ["USDT", "USDC", "BTC", "ETH"],
    networks: ["ETHEREUM", "POLYGON", "RIPPLE"],
    kycRequired: true,
    isReal: true,
    isLive: false,
    apiKeyRequired: true,
    integrationType: "API",
    notes: "Bitso ofrece pago cross-border en LATAM. Requiere partnership comercial. Verificar API access.",
  },

  // ============================================================
  // MARKET DATA
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
    notes: "On-chain price feeds. Gratis vía RPC público. Usado para alertas de precio.",
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
    isLive: false, // requiere COINGECKO_API_KEY para producción
    apiKeyRequired: false, // gratis con rate limit
    integrationType: "API",
    notes: "Free tier: 50 calls/min. Buen fallback para assets no soportados por Chainlink.",
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
