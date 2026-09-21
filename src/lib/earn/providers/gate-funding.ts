// ============================================================
// Provider: Gate.io — Funding (fallback terciario)
// ============================================================
// Endpoints públicos:
//   GET /api/v4/futures/usdt/contracts?contract=BTC_USDT
//       → funding_rate, funding_interval, mark_price, index_price,
//         funding_next_apply
//   GET /api/v4/futures/usdt/funding_rate?contract=BTC_USDT&limit=90
//       → historial
// ============================================================

import { fetchJsonWithTimeout } from "../cache";
import type { FundingData } from "../types";

interface GateContract {
  name: string;
  funding_rate: string;          // decimal (current)
  funding_rate_indicative: string; // decimal (next)
  funding_interval: number;      // segundos
  mark_price: string;
  index_price: string;
  funding_next_apply: number;    // epoch s
}

interface GateFundingHistory {
  r: string;       // rate decimal
  t: number;       // epoch s
}

function gateContractName(symbol: string): string {
  // BTCUSDT → BTC_USDT
  if (symbol.endsWith("USDT")) {
    return `${symbol.slice(0, -4)}_USDT`;
  }
  return symbol;
}

export async function getGateFunding(symbol: string): Promise<FundingData> {
  const contract = gateContractName(symbol);
  const [contractsArr, histRes] = await Promise.all([
    fetchJsonWithTimeout<GateContract[]>(
      `https://api.gateio.ws/api/v4/futures/usdt/contracts?contract=${contract}`,
      {},
      8000,
    ),
    fetchJsonWithTimeout<GateFundingHistory[]>(
      `https://api.gateio.ws/api/v4/futures/usdt/funding_rate?contract=${contract}&limit=90`,
      {},
      8000,
    ),
  ]);
  const contractRes = Array.isArray(contractsArr) ? contractsArr[0] : contractsArr;
  if (!contractRes) throw new Error('Gate.io contract not found');

  const fundingIntervalHours = (contractRes.funding_interval || 28800) / 3600;
  const fundingRate = parseFloat(contractRes.funding_rate) * 100;
  const markPrice = parseFloat(contractRes.mark_price);
  const indexPrice = parseFloat(contractRes.index_price);

  const histList = histRes || [];
  const last7entries = histList.slice(-Math.ceil((7 * 24) / fundingIntervalHours));
  const last30entries = histList.slice(-Math.ceil((30 * 24) / fundingIntervalHours));

  const avg = (arr: GateFundingHistory[]) =>
    arr.length ? arr.reduce((s, r) => s + parseFloat(r.r), 0) / arr.length : 0;

  const avg7d = avg(last7entries) * 100;
  const avg30d = avg(last30entries) * 100;

  const periodsPerYear = (365 * 24) / fundingIntervalHours;
  const annualizedFunding = fundingRate * periodsPerYear;

  const series = histList.slice(-30).map(r => ({
    t: r.t * 1000,
    v: parseFloat(r.r) * 100,
  }));

  return {
    exchange: "Gate.io",
    symbol,
    asset: symbol.replace("USDT", "").replace("USD", ""),
    fundingRate,
    fundingIntervalHours,
    nextFundingTime: contractRes.funding_next_apply * 1000,
    markPrice,
    indexPrice,
    historical: { "7d": avg7d, "30d": avg30d, series },
    annualizedFunding,
    updatedAt: Date.now(),
    source: "Gate.io Futures V4",
    notes: "Endpoints /api/v4/futures/usdt/contracts y funding_rate.",
  };
}
