// ============================================================
// EARN — Tipos normalizados
// ============================================================
// Toda la lógica de Earn, Funding, Basis, P2P y Arbitraje usa
// estos modelos comunes. Los providers (binance, bybit, okx,
// aave, morpho, lido, defillama, etc.) normalizan a estas
// estructuras para que los servicios y la UI no dependan de
// ningún exchange en particular.
// ============================================================

// ---- Earn (poner crypto a trabajar) -------------------------
export interface EarnOpportunity {
  asset: string;
  chain: string;
  project: string;
  productType: "lending" | "staking" | "lp" | "restaking" | "cdp" | "vault";
  apr: number;          // porcentaje, ej: 4.20
  apy: number;          // porcentaje, ej: 4.28
  apyBase: number | null;
  apyReward: number | null;
  apy7d: number | null;
  apy30d: number | null;
  tvlUsd: number;
  liquidity: "Flexible" | "Bloqueado" | "Parcial";
  lockPeriod: string;   // ej: "7 días", "Ninguno"
  fees: string;         // humano, ej: "0.09% gas + protocol fee"
  rewards: string;      // ej: "MATIC + intereses"
  yieldSource: string;  // explicación humana
  riskFactors: string[];
  url: string;
  source: string;       // "DeFiLlama" | "Aave" | "Morpho" | "Lido" | ...
  updatedAt: number;
}

// ---- Funding ------------------------------------------------
export interface FundingData {
  exchange: string;     // "Binance" | "Bybit" | "OKX" | ...
  symbol: string;       // "BTCUSDT"
  asset: string;        // "BTC"
  fundingRate: number;       // porcentaje, ej: 0.0045
  fundingIntervalHours: number;  // 8 / 4 / 1
  nextFundingTime: number;       // epoch ms
  markPrice: number;
  indexPrice: number;
  historical: {
    "7d": number;       // promedio %
    "30d": number;      // promedio %
    series: { t: number; v: number }[];  // últimos puntos
  };
  annualizedFunding: number;    // % anual
  updatedAt: number;
  source: string;
  notes?: string;
}

export interface FundingMultiResponse {
  symbol: string;
  primary: FundingData | null;
  fallbacks: FundingData[];
  failed: { exchange: string; reason: string }[];
  updatedAt: number;
}

// ---- Basis --------------------------------------------------
export interface BasisData {
  exchange: string;
  symbol: string;       // "BTCUSDT"
  asset: string;        // "BTC"
  spotPrice: number;
  indexPrice: number;
  futuresPrice: number;
  basis: number;             // % absoluto: (fut - spot)/spot * 100
  basisRate: number;         // idem pero en formato decimal
  annualizedBasisRate: number; // % anual
  contractType: string;      // "PERPETUAL" | "CURRENT_QUARTER" | ...
  period: string;            // "8h" | "1d" | ...
  timestamp: number;
  source: string;
  notes?: string;
}

// ---- P2P (resumen) ------------------------------------------
export interface P2PSummary {
  exchange: string;
  side: "BUY" | "SELL";
  price: number;
  available: number;
  min: number;
  max: number;
  methods: string[];
  advertiserName: string;
  advertiserReputation: number; // %
  advertiserOrders: number;
  timestamp: number;
}

// ---- Arbitrage ----------------------------------------------
export interface ArbitrageSummary {
  id: string;
  buyAt: { exchange: string; price: number };
  sellAt: { exchange: string; price: number };
  asset: string;
  fiat: string;
  grossSpreadPct: number;
  knownCosts: number;       // USD cuando se conoce
  estimatedNetPct: number | null;  // null cuando faltan costos
  marginLabel: "Ganancia" | "Margen potencial";
  warnings: string[];
  timestamp: number;
}
