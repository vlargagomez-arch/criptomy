// ============================================================
// Provider: Bybit Basis (derivado de tickers + spot)
// ============================================================
// Bybit no expone un endpoint directo de basis como Binance,
// pero podemos calcular basis = (futures - index) / index.
// Para anualizar, usamos el intervalo de funding del contrato
// (cada 8h por defecto en Bybit). Si falta el intervalo,
// asumimos 8h. Esto se documenta en `notes`.
// ============================================================

import { fetchJsonWithTimeout } from "../cache";
import type { BasisData } from "../types";

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
      fundingRate: string;
      fundingInterval: string; // minutos
    }>;
  };
}

export async function getBybitBasis(symbol: string): Promise<BasisData> {
  const res = await fetchJsonWithTimeout<BybitTickersResponse>(
    `https://api.bybit.com/v5/market/tickers?category=linear&symbol=${symbol}`,
    {},
    8000,
  );
  if (res.retCode !== 0 || !res.result?.list?.length) {
    throw new Error(`Bybit basis retCode ${res.retCode}: ${res.retMsg}`);
  }
  const t = res.result.list[0];

  const futuresPrice = parseFloat(t.lastPrice);
  const indexPrice = parseFloat(t.indexPrice);
  if (!futuresPrice || !indexPrice) {
    throw new Error("Bybit sin precios válidos");
  }

  const basisRate = (futuresPrice - indexPrice) / indexPrice;
  const basis = basisRate * 100;
  const fundingIntervalHours = t.fundingInterval
    ? parseInt(t.fundingInterval, 10) / 60
    : 8;
  const periodsPerYear = (365 * 24) / fundingIntervalHours;
  const annualizedBasisRate = basisRate * periodsPerYear * 100;

  return {
    exchange: "Bybit",
    symbol,
    asset: symbol.replace("USDT", "").replace("USD", ""),
    spotPrice: indexPrice,
    indexPrice,
    futuresPrice,
    basis,
    basisRate,
    annualizedBasisRate,
    contractType: "PERPETUAL",
    period: `${fundingIntervalHours}h`,
    timestamp: Date.now(),
    source: "Bybit Derivatives V5 (cálculo)",
    notes: "Basis = (futures - index)/index. Anualizado por intervalo de funding del contrato.",
  };
}
