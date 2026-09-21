// ============================================================
// Provider: OKX — Funding (fallback secundario)
// ============================================================
// Endpoints públicos:
//   GET /api/v5/public/funding-rate?instId=BTC-USDT-SWAP
//       → tasa actual, próximo funding, método
//   GET /api/v5/public/funding-rate-history?instId=BTC-USDT-SWAP&limit=90
//       → historial
//   GET /api/v5/public/mark-price?instId=BTC-USDT-SWAP
//       → mark price e index price
// ============================================================

import { fetchJsonWithTimeout } from "../cache";
import type { FundingData } from "../types";

interface OKXResponse<T> {
  code: string;
  msg: string;
  data: T[];
}

interface OKXFundingRate {
  instId: string;
  fundingRate: string;
  nextFundingTime: string;
  fundingTime: string;
  method: string;
}

interface OKXMarkPrice {
  instId: string;
  markPx: string;
  idxPx: string;
}

export async function getOKXFunding(symbol: string): Promise<FundingData> {
  // BTCUSDT → BTC-USDT-SWAP
  const base = symbol.replace("USDT", "").replace("USD", "");
  const instId = `${base}-USDT-SWAP`;

  const [fundRes, histRes, markRes] = await Promise.all([
    fetchJsonWithTimeout<OKXResponse<OKXFundingRate>>(
      `https://www.okx.com/api/v5/public/funding-rate?instId=${instId}`,
      {},
      8000,
    ),
    fetchJsonWithTimeout<OKXResponse<OKXFundingRate>>(
      `https://www.okx.com/api/v5/public/funding-rate-history?instId=${instId}&limit=90`,
      {},
      8000,
    ),
    fetchJsonWithTimeout<OKXResponse<OKXMarkPrice>>(
      `https://www.okx.com/api/v5/public/mark-price?instId=${instId}`,
      {},
      8000,
    ),
  ]);

  if (fundRes.code !== "0" || !fundRes.data?.length) {
    throw new Error(`OKX code ${fundRes.code}: ${fundRes.msg}`);
  }

  const fund = fundRes.data[0];
  const mark = markRes.data?.[0];

  // OKX usa intervalo de 8h por defecto
  const fundingIntervalHours = 8;

  const fundingRate = parseFloat(fund.fundingRate) * 100;
  const markPrice = mark ? parseFloat(mark.markPx) : 0;
  const indexPrice = mark ? parseFloat(mark.idxPx) : 0;

  const histList = histRes.data || [];
  const last7entries = histList.slice(-Math.ceil((7 * 24) / fundingIntervalHours));
  const last30entries = histList.slice(-Math.ceil((30 * 24) / fundingIntervalHours));

  const avg = (arr: OKXFundingRate[]) =>
    arr.length ? arr.reduce((s, r) => s + parseFloat(r.fundingRate), 0) / arr.length : 0;

  const avg7d = avg(last7entries) * 100;
  const avg30d = avg(last30entries) * 100;

  const periodsPerYear = (365 * 24) / fundingIntervalHours;
  const annualizedFunding = fundingRate * periodsPerYear;

  const series = histList.slice(-30).map(r => ({
    t: parseInt(r.fundingTime, 10),
    v: parseFloat(r.fundingRate) * 100,
  }));

  return {
    exchange: "OKX",
    symbol,
    asset: base,
    fundingRate,
    fundingIntervalHours,
    nextFundingTime: parseInt(fund.nextFundingTime, 10) || 0,
    markPrice,
    indexPrice,
    historical: { "7d": avg7d, "30d": avg30d, series },
    annualizedFunding,
    updatedAt: Date.now(),
    source: "OKX Public API V5",
    notes: "Endpoints /api/v5/public/funding-rate y funding-rate-history.",
  };
}
