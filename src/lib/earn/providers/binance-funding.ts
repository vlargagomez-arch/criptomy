// ============================================================
// Provider: Binance Futures (USDⓈ-M) — Funding
// ============================================================
// Endpoints públicos oficiales:
//   GET /fapi/v1/premiumIndex?symbol=BTCUSDT  → markPrice, indexPrice, lastFundingRate, nextFundingTime
//   GET /fapi/v1/fundingRate?symbol=BTCUSDT&limit=90 → historial
//   GET /fapi/v1/fundingInfo → intervalos personalizados por símbolo
//
// Notas:
//  - El intervalo por defecto es 8h pero Binance puede ajustarlo
//    por símbolo (fundingInfo). Lo respetamos.
//  - fundingRate viene en formato decimal (0.0001 = 0.01%).
// ============================================================

import { fetchJsonWithTimeout } from "../cache";
import type { FundingData } from "../types";

interface BinancePremiumIndex {
  symbol: string;
  markPrice: string;
  indexPrice: string;
  lastFundingRate: string;
  nextFundingTime: number;
  time: number;
}

interface BinanceFundingRateEntry {
  symbol: string;
  fundingRate: string;
  fundingTime: number;
  markPrice: string;
}

interface BinanceFundingInfo {
  symbol: string;
  adjustedFundingRateCap: string;
  adjustedFundingRateFloor: string;
  disadjustedFundingTime: number;
  fundingInterval: number; // en horas, usualmente 8
}

const intervalCache: Record<string, number> = {};

async function loadIntervals(): Promise<Record<string, number>> {
  try {
    const data = await fetchJsonWithTimeout<{ symbols: BinanceFundingInfo[] }>(
      "https://fapi.binance.com/fapi/v1/fundingInfo",
      {},
      6000,
    );
    const out: Record<string, number> = {};
    for (const s of data.symbols || []) {
      if (s.fundingInterval && s.fundingInterval > 0) {
        out[s.symbol] = s.fundingInterval;
      }
    }
    return out;
  } catch {
    return {};
  }
}

export async function getBinanceFunding(symbol: string): Promise<FundingData> {
  // Cargar intervalos (con cache de sesión)
  if (Object.keys(intervalCache).length === 0) {
    const intervals = await loadIntervals();
    Object.assign(intervalCache, intervals);
  }
  const intervalHours = intervalCache[symbol] || 8;

  const [premium, history] = await Promise.all([
    fetchJsonWithTimeout<BinancePremiumIndex>(
      `https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${symbol}`,
      {},
      8000,
    ),
    fetchJsonWithTimeout<BinanceFundingRateEntry[]>(
      `https://fapi.binance.com/fapi/v1/fundingRate?symbol=${symbol}&limit=90`,
      {},
      8000,
    ),
  ]);

  const markPrice = parseFloat(premium.markPrice);
  const indexPrice = parseFloat(premium.indexPrice);
  const fundingRate = parseFloat(premium.lastFundingRate) * 100; // a %

  const last7entries = history.slice(-Math.ceil((7 * 24) / intervalHours));
  const last30entries = history.slice(-Math.ceil((30 * 24) / intervalHours));

  const avg = (arr: BinanceFundingRateEntry[]) =>
    arr.length ? arr.reduce((s, r) => s + parseFloat(r.fundingRate), 0) / arr.length : 0;

  const avg7d = avg(last7entries) * 100;
  const avg30d = avg(last30entries) * 100;

  const periodsPerYear = (365 * 24) / intervalHours;
  const annualizedFunding = fundingRate * periodsPerYear;

  const series = history.slice(-30).map(r => ({
    t: r.fundingTime,
    v: parseFloat(r.fundingRate) * 100,
  }));

  return {
    exchange: "Binance",
    symbol,
    asset: symbol.replace("USDT", "").replace("USD", ""),
    fundingRate,
    fundingIntervalHours: intervalHours,
    nextFundingTime: premium.nextFundingTime,
    markPrice,
    indexPrice,
    historical: { "7d": avg7d, "30d": avg30d, series },
    annualizedFunding,
    updatedAt: Date.now(),
    source: "Binance Futures USDⓈ-M",
    notes: "Endpoint público oficial /fapi/v1/premiumIndex y /fapi/v1/fundingRate.",
  };
}
