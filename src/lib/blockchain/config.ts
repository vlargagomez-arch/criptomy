// Configuración multi-chain para la plataforma P2P.
// Soporta Ethereum, Bitcoin, Tron y Monero.

export type ChainId = "ETHEREUM" | "BITCOIN" | "TRON" | "MONERO";

export interface ChainConfig {
  id: ChainId;
  name: string;
  symbol: string;
  color: string;
  // RPC público para lectura (sin API key)
  rpcUrl: string;
  // Explorer
  explorerUrl: string;
  // Tiempo promedio de bloque
  blockTimeSec: number;
  // Soporta smart contracts?
  hasSmartContracts: boolean;
  // ¿Recomendado para Tor?
  torFriendly: boolean;
  // Testnet correspondiente
  testnet: {
    name: string;
    rpcUrl: string;
    explorerUrl: string;
    faucetUrl: string;
  };
}

export const CHAINS: Record<ChainId, ChainConfig> = {
  ETHEREUM: {
    id: "ETHEREUM",
    name: "Ethereum",
    symbol: "ETH",
    color: "#627EEA",
    rpcUrl: "https://eth.llamarpc.com",
    explorerUrl: "https://etherscan.io",
    blockTimeSec: 12,
    hasSmartContracts: true,
    torFriendly: false, // RPC públicas suelen bloquear Tor
    testnet: {
      name: "Sepolia",
      rpcUrl: "https://rpc.sepolia.org",
      explorerUrl: "https://sepolia.etherscan.io",
      faucetUrl: "https://sepoliafaucet.com",
    },
  },
  BITCOIN: {
    id: "BITCOIN",
    name: "Bitcoin",
    symbol: "BTC",
    color: "#F7931A",
    rpcUrl: "https://blockstream.info/api",
    explorerUrl: "https://mempool.space",
    blockTimeSec: 600,
    hasSmartContracts: false, // Bitcoin Script limitado; escrow se hace con HTLC/multisig P2SH
    torFriendly: true,
    testnet: {
      name: "Testnet4",
      rpcUrl: "https://blockstream.info/testnet/api",
      explorerUrl: "https://mempool.space/testnet",
      faucetUrl: "https://bitcoinfaucet.uo1.net",
    },
  },
  TRON: {
    id: "TRON",
    name: "Tron",
    symbol: "TRX",
    color: "#FF060A",
    rpcUrl: "https://api.trongrid.io",
    explorerUrl: "https://tronscan.org",
    blockTimeSec: 3,
    hasSmartContracts: true,
    torFriendly: false,
    testnet: {
      name: "Nile",
      rpcUrl: "https://nile.trongrid.io",
      explorerUrl: "https://nile.tronscan.org",
      faucetUrl: "https://nileex.io/join/getJoinPage",
    },
  },
  MONERO: {
    id: "MONERO",
    name: "Monero",
    symbol: "XMR",
    color: "#FF6600",
    rpcUrl: "https://xmr-node.cakewallet.com:18089", // nodo público
    explorerUrl: "https://xmrchain.net",
    blockTimeSec: 120,
    hasSmartContracts: false, // Monero no tiene smart contracts
    torFriendly: true,
    testnet: {
      name: "Stagenet",
      rpcUrl: "https://stagenet.community.rino.io:38089",
      explorerUrl: "https://stagenet.xmrchain.net",
      faucetUrl: "https://discoalien.github.io/xmrfaucet",
    },
  },
};

// Tokens por chain (ERC20 en Ethereum, TRC20 en Tron, etc.)
export interface TokenConfig {
  symbol: string;
  name: string;
  chain: ChainId;
  contractAddress: string | null; // null = nativo (ETH, BTC, TRX, XMR)
  decimals: number;
  isStablecoin: boolean;
}

export const TOKENS: TokenConfig[] = [
  // Ethereum
  { symbol: "ETH", name: "Ether", chain: "ETHEREUM", contractAddress: null, decimals: 18, isStablecoin: false },
  { symbol: "USDT", name: "Tether USD", chain: "ETHEREUM", contractAddress: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6, isStablecoin: true },
  { symbol: "USDC", name: "USD Coin", chain: "ETHEREUM", contractAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6, isStablecoin: true },
  { symbol: "WBTC", name: "Wrapped BTC", chain: "ETHEREUM", contractAddress: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", decimals: 8, isStablecoin: false },
  // Bitcoin
  { symbol: "BTC", name: "Bitcoin", chain: "BITCOIN", contractAddress: null, decimals: 8, isStablecoin: false },
  // Tron
  { symbol: "TRX", name: "Tron", chain: "TRON", contractAddress: null, decimals: 6, isStablecoin: false },
  { symbol: "USDT", name: "Tether USD (TRC20)", chain: "TRON", contractAddress: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t", decimals: 6, isStablecoin: true },
  // Monero
  { symbol: "XMR", name: "Monero", chain: "MONERO", contractAddress: null, decimals: 12, isStablecoin: false },
];

// Métodos de pago fiat soportados
export interface PaymentMethodConfig {
  id: string;
  label: string;
  category: "BANCARIO_COP" | "EFECTIVO_MOBILE" | "INTERNACIONAL" | "CRIPTO_CRIPTO";
  countries: string[];
  icon: string;
}

export const PAYMENT_METHODS: PaymentMethodConfig[] = [
  // Bancario COP (Colombia)
  { id: "NEQUI", label: "Nequi", category: "BANCARIO_COP", countries: ["CO"], icon: "📱" },
  { id: "DAVIPLATA", label: "Daviplata", category: "BANCARIO_COP", countries: ["CO"], icon: "💳" },
  { id: "PSE", label: "PSE", category: "BANCARIO_COP", countries: ["CO"], icon: "🏦" },
  { id: "BANCOLOMBIA", label: "Bancolombia", category: "BANCARIO_COP", countries: ["CO"], icon: "🏛️" },
  { id: "BBVA_CO", label: "BBVA Colombia", category: "BANCARIO_COP", countries: ["CO"], icon: "🏛️" },
  { id: "DAVIVIENDA", label: "Davivienda", category: "BANCARIO_COP", countries: ["CO"], icon: "🏛️" },
  // Efectivo / Mobile money LATAM
  { id: "CASH_IN_PERSON", label: "Efectivo en persona", category: "EFECTIVO_MOBILE", countries: ["ALL"], icon: "💵" },
  { id: "WESTERN_UNION", label: "Western Union", category: "EFECTIVO_MOBILE", countries: ["ALL"], icon: "🌍" },
  { id: "MERCADO_PAGO", label: "Mercado Pago", category: "EFECTIVO_MOBILE", countries: ["AR", "BR", "MX", "CL", "CO"], icon: "💰" },
  { id: "PIX", label: "Pix (Brasil)", category: "EFECTIVO_MOBILE", countries: ["BR"], icon: "⚡" },
  { id: "YMONEY", label: "Yape / Plin (Perú)", category: "EFECTIVO_MOBILE", countries: ["PE"], icon: "📱" },
  // Internacional
  { id: "PAYPAL", label: "PayPal", category: "INTERNACIONAL", countries: ["ALL"], icon: "🅿️" },
  { id: "WISE", label: "Wise", category: "INTERNACIONAL", countries: ["ALL"], icon: "🔄" },
  { id: "PAYONEER", label: "Payoneer", category: "INTERNACIONAL", countries: ["ALL"], icon: "💳" },
  { id: "SEPA", label: "SEPA (UE)", category: "INTERNACIONAL", countries: ["EU"], icon: "🇪🇺" },
  // Cripto-a-cripto
  { id: "CRYPTO_TRANSFER", label: "Transferencia cripto (otra chain)", category: "CRIPTO_CRIPTO", countries: ["ALL"], icon: "🔗" },
];

// Monedas fiat soportadas
export const FIAT_CURRENCIES = [
  { code: "COP", name: "Peso Colombiano", flag: "🇨🇴" },
  { code: "USD", name: "Dólar EE.UU.", flag: "🇺🇸" },
  { code: "EUR", name: "Euro", flag: "🇪🇺" },
  { code: "MXN", name: "Peso Mexicano", flag: "🇲🇽" },
  { code: "ARS", name: "Peso Argentino", flag: "🇦🇷" },
  { code: "BRL", name: "Real Brasileño", flag: "🇧🇷" },
  { code: "PEN", name: "Sol Peruano", flag: "🇵🇪" },
  { code: "CLP", name: "Peso Chileno", flag: "🇨🇱" },
  { code: "VES", name: "Bolívar Venezolano", flag: "🇻🇪" },
];

export function getChain(chainId: ChainId): ChainConfig {
  return CHAINS[chainId];
}

export function getTokensByChain(chainId: ChainId): TokenConfig[] {
  return TOKENS.filter((t) => t.chain === chainId);
}

export function getPaymentMethodsByCategory(
  category: PaymentMethodConfig["category"]
): PaymentMethodConfig[] {
  return PAYMENT_METHODS.filter((p) => p.category === category);
}
