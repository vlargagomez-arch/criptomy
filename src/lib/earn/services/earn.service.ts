// ============================================================
// Service: Earn — DeFiLlama aggregator
// ============================================================
// Llama al provider DeFiLlama y aplica filtros por activo/tipo.
// Cache agresivo de 60s (los APYs no cambian cada segundo).
// ============================================================

import { getCached, setCached, dedupe } from "../cache";
import { getDefiLlamaPools } from "../providers/defillama";
import type { EarnOpportunity } from "../types";

const TTL = 60_000;
const ALL_KEY = "earn:all";

export interface EarnFilter {
  asset?: string;  // "BTC" | "ETH" | "USDT" | "USDC" | "ALL"
  type?: "lending" | "staking" | "lp" | "restaking" | "vault" | "ALL";
}

function matchesAsset(opp: EarnOpportunity, asset: string): boolean {
  if (asset === "ALL") return true;
  if (opp.asset === asset) return true;
  // Coincidencias amplias
  if (asset === "BTC") return /BTC|WBTC|CBBTC|tBTC/i.test(opp.asset);
  if (asset === "ETH") return /ETH|WETH|stETH|wstETH|rETH|ETHx/i.test(opp.asset);
  if (asset === "USDT") return /USDT/i.test(opp.asset);
  if (asset === "USDC") return /USDC/i.test(opp.asset);
  if (asset === "SOL") return /SOL|JitoSOL|bSOL/i.test(opp.asset);
  return opp.asset.includes(asset);
}

export async function getEarnOpportunities(filter: EarnFilter = {}): Promise<{
  opportunities: EarnOpportunity[];
  total: number;
  cached: boolean;
  updatedAt: number;
  source: string;
}> {
  const asset = (filter.asset || "ALL").toUpperCase();
  const type = filter.type || "ALL";

  // Cargar todo (con cache)
  let all = getCached<EarnOpportunity[]>(ALL_KEY);
  let cached = true;
  if (!all) {
    all = await dedupe(ALL_KEY, async () => {
      const fresh = await getDefiLlamaPools();
      setCached(ALL_KEY, fresh, TTL);
      return fresh;
    });
    cached = false;
  }

  let filtered = all.filter(o => matchesAsset(o, asset));
  if (type !== "ALL") {
    filtered = filtered.filter(o => o.productType === type);
  }

  // Top 30
  const opportunities = filtered.slice(0, 30);

  return {
    opportunities,
    total: filtered.length,
    cached,
    updatedAt: all[0]?.updatedAt || Date.now(),
    source: "DeFiLlama",
  };
}
