// ============================================================
// Provider: Bybit Derivatives — Funding (fallback primario)
// ============================================================
// Endpoints públicos:
//   GET /v5/market/tickers?category=linear&symbol=BTCUSDT
//       → lastPrice, indexPrice, markPrice, fundingRate, nextFundingTime, fundingInterval
//   GET /v5/market/funding/history?category=linear&symbol=BTCUSDT&limit=90
//       → historial de funding rate
// ============================================================

import { fetchJsonWithTimeout } from "../cache";
import type { FundingData } from "../types";

interface BybitTickersResponse {
  retCode: number;
  retMsg: string;
  result: {
    category: string;
    list: Array<{
      symbol: string;
      lastPrice: string;
      indexPrice: string;
      markPrice: string;
      prevPrice24h: string;
      fundingRate: string;
      nextFundingTime: string;
      fundingInterval: string; // minutos, ej "480"
    }>;
  };
}

interface BybitFundingHistoryResponse {
  retCode: number;
  retMsg: string;
  result: {
    category: string;
    list: Array<{
      symbol: string;
      fundingRate: string;
      fundingRateTimestamp: string;
    }>;
  };
}

export async function getBybitFunding(symbol: string): Promise<FundingData> {
  const [tickersRes, histRes] = await Promise.all([
    fetchJsonWithTimeout<BybitTickersResponse>(
      `https://api.bybit.com/v5/market/tickers?category=linear&symbol=${symbol}`,
      {},
      8000,
    ),
    fetchJsonWithTimeout<BybitFundingHistoryResponse>(
      `https://api.bybit.com/v5/market/funding/history?category=linear&symbol=${symbol}&limit=90`,
      {},
      8000,
    ),
  ]);

  if (tickersRes.retCode !== 0 || !tickersRes.result?.list?.length) {
    throw new Error(`Bybit retCode ${tickersRes.retCode}: ${tickersRes.retMsg}`);
  }
  const t = tickersRes.result.list[0];

  const fundingIntervalHours = t.fundingInterval
    ? parseInt(t.fundingInterval, 10) / 60
    : 8;

  const fundingRate = parseFloat(t.fundingRate) * 100;
  const markPrice = parseFloat(t.markPrice);
  const indexPrice = parseFloat(t.indexPrice);

  const histList = histRes.result?.list || [];
  const last7entries = histList.slice(-Math.ceil((7 * 24) / fundingIntervalHours));
  const last30entries = histList.slice(-Math.ceil((30 * 24) / fundingIntervalHours));

  const avg = (arr: BybitFundingHistoryResponse["result"]["list"]) =>
    arr.length ? arr.reduce((s, r) => s + parseFloat(r.fundingRate), 0) / arr.length : 0;

  const avg7d = avg(last7entries) * 100;
  const avg30d = avg(last30entries) * 100;

  const periodsPerYear = (365 * 24) / fundingIntervalHours;
  const annualizedFunding = fundingRate * periodsPerYear;

  const series = histList.slice(-30).map(r => ({
    t: parseInt(r.fundingRateTimestamp, 10),
    v: parseFloat(r.fundingRate) * 100,
  }));

  return {
    exchange: "Bybit",
    symbol,
    asset: symbol.replace("USDT", "").replace("USD", ""),
    fundingRate,
    fundingIntervalHours,
    nextFundingTime: parseInt(t.nextFundingTime, 10) || 0,
    markPrice,
    indexPrice,
    historical: { "7d": avg7d, "30d": avg30d, series },
    annualizedFunding,
    updatedAt: Date.now(),
    source: "Bybit Derivatives V5",
    notes: "Endpoints públicos /v5/market/tickers y /v5/market/funding/history.",
  };
}
