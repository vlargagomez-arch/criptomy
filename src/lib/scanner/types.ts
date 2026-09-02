// ============================================================
// SMART WEB3 SEARCH & SCANNER — Types
// ============================================================
// Tipos centrales del motor de búsqueda y escaneo.
// Toda la complejidad ocurre detrás; el usuario solo ve un buscador.
// ============================================================

// Intent interpretado por QueryInterpreter
export interface SearchIntent {
  operation: Operation;
  asset: string;           // "USDT", "BTC", "ETH", "USDC"
  amount?: number;          // 1000
  fiat?: string;            // "COP", "MXN", "USD"
  country?: string;         // "CO", "MX"
  paymentMethod?: string;   // "PSE", "BANK_TRANSFER"
  mode?: ScanMode;          // Si usuario lo especifica
  raw: string;              // query original
}

export type Operation = "BUY" | "SELL" | "SEND" | "ARBITRAGE" | "COMPARE" | "FIND_P2P" | "UNKNOWN";
export type ScanMode = "EXCHANGE" | "P2P" | "ANY";

// Resultado normalizado de market data de cualquier exchange
export interface MarketQuote {
  provider: string;          // "binance", "okx", ...
  providerName: string;      // "Binance", "OKX"
  symbol: string;            // "BTCUSDT" o "BTC-USDT"
  asset: string;             // "BTC"
  quoteCurrency: string;     // "USDT", "USD"
  lastPrice: number;
  bidPrice?: number;
  askPrice?: number;
  spread?: number;           // ask - bid
  spreadPercent?: number;    // spread / mid * 100
  volume24h?: number;        // volumen base 24h
  quoteVolume24h?: number;   // volumen quote 24h
  changePercent24h?: number;
  high24h?: number;
  low24h?: number;
  timestamp: number;         // ms epoch
  latencyMs: number;         // tiempo de respuesta del provider
  status: ProviderStatus;
  error?: string;
}

// Oferta P2P normalizada (de cualquier exchange con P2P)
export interface P2POffer {
  provider: string;
  providerName: string;
  advertiser: string;        // nickname del vendedor
  advertiserId?: string;
  asset: string;             // "USDT"
  fiat: string;              // "COP"
  tradeType: "BUY" | "SELL"; // desde la perspectiva del usuario
  price: number;             // precio en fiat
  minAmount: number;         // fiat
  maxAmount: number;         // fiat
  available: number;         // cantidad disponible del activo
  paymentMethods: string[];  // ["PSE", "Bancolombia"]
  tradeCount: number;        // trades históricos del advertiser
  completionRate?: number;   // % trades completados
  timestamp: number;
  latencyMs: number;
  status: ProviderStatus;
  error?: string;
}

// Resultado con costo total calculado
export interface RankedResult {
  rank: number;              // 1 = mejor
  badge?: "BEST" | "CHEAPEST" | "FASTEST" | "MOST_LIQUID";
  reason: string;            // por qué este ranking
  provider: string;
  providerName: string;
  operation: Operation;
  asset: string;
  fiat?: string;
  price: number;             // precio unitario
  amount: number;            // cantidad cripto
  grossCost: number;         // precio * cantidad (en fiat o quote)
  fee: number;               // comisión estimada
  feeCurrency?: string;
  networkCost?: number;      // costo de red (gas) si aplica
  totalCost: number;         // grossCost + fee + networkCost
  totalCostCurrency?: string;
  effectivePrice: number;    // totalCost / amount
  spread?: number;
  liquidity?: number;
  estimatedTime?: string;
  kycRequired?: boolean;
  kycNote?: string;
  paymentMethods?: string[];
  countries?: string[];
  timestamp: number;
  source: string;            // "Binance API"
  latencyMs: number;
  status: ProviderStatus;
}

export type ProviderStatus = "ONLINE" | "OFFLINE" | "RATE_LIMITED" | "ERROR" | "DISABLED" | "REQUIRES_API_KEY";

export interface ProviderHealth {
  provider: string;
  name: string;
  status: ProviderStatus;
  latencyMs: number;
  lastCheck: number;
  lastError?: string;
  endpointsTested: number;
  endpointsOk: number;
}

// Configuración de cada provider connector
export interface ProviderConfig {
  id: string;
  name: string;
  baseUrl: string;
  logoUrl?: string;
  websiteUrl: string;
  documentationUrl?: string;
  requiresApiKey: boolean;     // Si true, sin API key solo funciona market data público
  supportsP2P: boolean;
  supportsMarketData: boolean;
  countries: string[];          // Países soportados
  kycRequired: boolean;
  rateLimitPerMin: number;
  notes?: string;
}

// Respuesta del endpoint /api/search
export interface SearchResponse {
  intent: SearchIntent;
  results: RankedResult[];
  bestOption?: RankedResult;
  alternatives: RankedResult[];
  p2pOffers: P2POffer[];
  arbitrageOpportunities: ArbitrageOpportunity[];
  providersChecked: number;
  providersOk: number;
  errors: { provider: string; error: string }[];
  timestamp: number;
  queryId: string;
  executionTimeMs: number;
}

// Oportunidad de arbitraje detectada
export interface ArbitrageOpportunity {
  asset: string;
  buyAt: { provider: string; price: number };
  sellAt: { provider: string; price: number };
  spreadPercent: number;
  estimatedProfit: number;       // en USD por unidad
  estimatedRoiPercent: number;
  feesEstimated: number;
  netProfit: number;
  capital: number;
  assumptions: string[];
  timestamp: number;
}

// Ruta posible (multi-hop)
export interface RouteOption {
  from: string;
  to: string;
  hops: RouteHop[];
  totalCost: number;
  totalCostCurrency: string;
  estimatedTime: string;
  providers: string[];
  recommended: boolean;
  reason: string;
}

export interface RouteHop {
  from: string;
  to: string;
  provider: string;
  rate: number;
  fee?: number;
}
