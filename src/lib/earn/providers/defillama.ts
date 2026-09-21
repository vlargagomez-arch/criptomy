// ============================================================
// Provider: DeFiLlama Yields — Earn opportunities
// ============================================================
// Endpoint: GET https://yields.llama.fi/pools
// Devuelve TODOS los pools DeFi con APY, TVL, chain, project,
// tipo, base/reward, histórico 7d/30d, underlying tokens.
//
// Es la fuente primaria para "Poner crypto a trabajar".
// Filtramos: APY > 0, TVL > 100K, sin guion en symbol (no LP
// sintéticos), y proyectos reconocidos.
// ============================================================

import { fetchJsonWithTimeout } from "../cache";
import type { EarnOpportunity } from "../types";

export interface DefiLlamaPool {
  chain: string;
  project: string;
  symbol: string;
  tvlUsd: number;
  apyBase: number | null;
  apyReward: number | null;
  apy: number;
  rewardTokens: string[] | null;
  pool: string;
  apyPct1D: number | null;
  apyPct7D: number | null;
  apyPct30D: number | null;
  stablecoin: boolean;
  ilRisk: boolean | string;
  underlyingTokens: string[] | null;
}

const TRUSTED_PROJECTS = new Set([
  // Lending
  "aave-v3", "aave-v2", "aave-v4", "compound-v3", "compound-forks",
  "morpho-blue", "morpho-aave", "spark-v1", "spark-lend", "fluid",
  "benqi-lending", "kamino-lending", "fraxlend",
  // Staking / LSD
  "lido", "rocket-pool", "stader", "binance-staked-eth", "bybit-staked-sol",
  "binance-staked-sol", "coinbase-staked-eth", "jito", "jito-sol",
  "marinade-finance", "benqi-staked-avax", "amnis-finance",
  // Restaking
  "babylon", "babylon-btc-staking", "etherfi", "eigenlayer", "kelp-dao",
  "renzo", "swell-network",
  // LP / DEX
  "curve-dex", "curve-finance", "convex-finance", "uniswap-v3", "uniswap-v2",
  "balancer-v2", "balancer-v3", "aerodrome-slipstream", "aerodrome-v1",
  "camelot-v3", "camelot-v2", "pancakeswap-v3", "pancakeswap-v2",
  // Vaults
  "pendle", "sommelier", "beefy", "yearn-v3", "yearn-v2", "harvester",
]);

const PROJECT_DISPLAY: Record<string, string> = {
  "aave-v3": "Aave V3",
  "aave-v2": "Aave V2",
  "compound-v3": "Compound V3",
  "morpho-blue": "Morpho Blue",
  "morpho-aave": "Morpho Aave",
  "spark-lend": "Spark",
  "fluid": "Fluid",
  "lido": "Lido",
  "rocket-pool": "Rocket Pool",
  "stader": "Stader",
  "binance-staked-eth": "Binance Staked ETH",
  "bybit-staked-sol": "Bybit Staked SOL",
  "jito": "Jito",
  "marinade-finance": "Marinade",
  "babylon": "Babylon",
  "etherfi": "EtherFi",
  "eigenlayer": "EigenLayer",
  "kelp-dao": "Kelp DAO",
  "renzo": "Renzo",
  "curve-dex": "Curve",
  "convex-finance": "Convex",
  "uniswap-v3": "Uniswap V3",
  "balancer-v2": "Balancer V2",
  "aerodrome-slipstream": "Aerodrome",
  "camelot-v3": "Camelot V3",
  "pancakeswap-v3": "PancakeSwap V3",
  "pendle": "Pendle",
  "sommelier": "Sommelier",
  "beefy": "Beefy",
  "yearn-v3": "Yearn V3",
};

function inferProductType(p: DefiLlamaPool): EarnOpportunity["productType"] {
  if (["aave-v3", "aave-v2", "compound-v3", "compound-forks",
       "morpho-blue", "morpho-aave", "spark-lend", "fluid",
       "benqi-lending", "kamino-lending", "fraxlend"].includes(p.project)) return "lending";
  if (["lido", "rocket-pool", "stader", "binance-staked-eth",
       "bybit-staked-sol", "binance-staked-sol", "coinbase-staked-eth",
       "jito", "marinade-finance", "benqi-staked-avax", "amnis-finance"].includes(p.project)) return "staking";
  if (["babylon", "babylon-btc-staking", "etherfi", "eigenlayer",
       "kelp-dao", "renzo", "swell-network"].includes(p.project)) return "restaking";
  if (["curve-dex", "curve-finance", "convex-finance", "uniswap-v3",
       "uniswap-v2", "balancer-v2", "balancer-v3", "aerodrome-slipstream",
       "aerodrome-v1", "camelot-v3", "camelot-v2", "pancakeswap-v3",
       "pancakeswap-v2"].includes(p.project)) return "lp";
  if (["pendle", "sommelier", "beefy", "yearn-v3", "yearn-v2"].includes(p.project)) return "vault";
  return "vault";
}

function inferYieldSource(p: DefiLlamaPool, type: EarnOpportunity["productType"]): string {
  if (type === "lending") {
    return `Préstamos: los usuarios que piden prestado pagan un interés. Ese interés se reparte entre quienes aportan liquidez.`;
  }
  if (type === "staking" || type === "restaking") {
    return `Staking de la red: ayudas a asegurar la blockchain y recibes recompensas en tokens nativos.`;
  }
  if (type === "lp") {
    return `Comisiones de trading del pool: cada swap en el pool paga una pequeña comisión que se reparte entre los proveedores de liquidez.`;
  }
  if (type === "vault") {
    return `Estrategia automatizada del vault: el protocolo mueve el capital entre estrategias para optimizar el rendimiento.`;
  }
  return `Rendimiento generado por la estrategia del protocolo ${p.project}.`;
}

function inferRiskFactors(p: DefiLlamaPool, type: EarnOpportunity["productType"]): string[] {
  const risks: string[] = [];
  if (p.ilRisk === true) risks.push("Pérdida impermanente");
  if (type === "lending" || type === "cdp") risks.push("Riesgo de liquidación de prestatarios");
  if (type === "staking" || type === "restaking") risks.push("Slashing del validador");
  if (p.tvlUsd < 5_000_000) risks.push("Liquidez baja");
  if (p.apyReward && p.apyBase !== null && p.apyReward > p.apyBase) risks.push("Recompensas temporales en tokens");
  risks.push("Riesgo de smart contract");
  return risks;
}

function inferLiquidity(p: DefiLlamaPool, type: EarnOpportunity["productType"]): EarnOpportunity["liquidity"] {
  if (type === "staking" || type === "restaking") return "Bloqueado";
  if (p.ilRisk === true) return "Parcial";
  return "Flexible";
}

function inferLockPeriod(p: DefiLlamaPool, type: EarnOpportunity["productType"]): string {
  if (type === "staking" || type === "restaking") {
    if (p.project === "Lido" || p.project === "Rocket Pool") return "Flexible (stETH rLST)";
    if (p.project === "Babylon") return "Bloqueado ( BTCstaking )";
    return "Bloqueado";
  }
  return "Ninguno";
}

function inferFees(p: DefiLlamaPool): string {
  const parts: string[] = [];
  if (p.chain === "Ethereum") parts.push("Gas variable");
  if (p.chain === "Arbitrum" || p.chain === "Optimism" || p.chain === "Base") parts.push("Gas bajo");
  parts.push("Comisión del protocolo");
  return parts.join(" · ");
}

function inferRewards(p: DefiLlamaPool): string {
  if (p.rewardTokens && p.rewardTokens.length > 0) {
    return `Recompensas en ${p.rewardTokens.slice(0, 2).join(", ")}`;
  }
  return "Pago en el mismo activo depositado";
}

function buildUrl(p: DefiLlamaPool): string {
  return `https://defillama.com/yields/pool/${p.pool}`;
}

export async function getDefiLlamaPools(): Promise<EarnOpportunity[]> {
  const data = await fetchJsonWithTimeout<{ data: DefiLlamaPool[] }>(
    "https://yields.llama.fi/pools",
    {},
    15000,
  );
  if (!data.data || !Array.isArray(data.data)) {
    throw new Error("Formato inesperado de DeFiLlama");
  }

  const now = Date.now();
  const out: EarnOpportunity[] = data.data
    .filter(p =>
      p.apy > 0 &&
      p.apy < 500 &&            // descarta APYs absurdos
      p.tvlUsd > 100_000 &&
      !p.symbol.includes("-") &&
      !p.symbol.includes("/") &&
      p.symbol.length <= 12 &&
      TRUSTED_PROJECTS.has(p.project)
    )
    .map(p => {
      const type = inferProductType(p);
      const apy7d = p.apyPct7D !== null && p.apyPct7D !== undefined
        ? p.apy + p.apyPct7D
        : null;
      const apy30d = p.apyPct30D !== null && p.apyPct30D !== undefined
        ? p.apy + p.apyPct30D
        : null;
      return {
        asset: p.symbol,
        chain: p.chain,
        project: PROJECT_DISPLAY[p.project] || p.project,
        productType: type,
        apr: p.apyBase || p.apy,
        apy: p.apy,
        apyBase: p.apyBase,
        apyReward: p.apyReward,
        apy7d,
        apy30d,
        tvlUsd: p.tvlUsd,
        liquidity: inferLiquidity(p, type),
        lockPeriod: inferLockPeriod(p, type),
        fees: inferFees(p),
        rewards: inferRewards(p),
        yieldSource: inferYieldSource(p, type),
        riskFactors: inferRiskFactors(p, type),
        url: buildUrl(p),
        source: "DeFiLlama Yields",
        updatedAt: now,
      } as EarnOpportunity;
    })
    .sort((a, b) => b.apy - a.apy);

  return out;
}
