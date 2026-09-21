// ============================================================
// Provider: Binance Basis (COIN-M)
// ============================================================
// Endpoint público oficial:
//   GET /futures/data/basis?pair=BTCUSD&contractType=PERPETUAL&period=5m
//
// Devuelve:
//   pair, futuresPrice, indexPrice, basis, basisRate,
//   annualizedBasisRate, contractType, period, timestamp
//
// Si el endpoint no devuelve datos (algunos pares / period no existen),
// se lanza error para que el servicio pueda usar el fallback.
// ============================================================

import { fetchJsonWithTimeout } from "../cache";
import type { BasisData } from "../types";

interface BinanceBasisEntry {
  pair: string;
  futuresPrice: string;
  indexPrice: string;
  basis: string;
  basisRate: string;
  annualizedBasisRate: string;
  contractType: string;
  period: string;
  timestamp: number;
}

export async function getBinanceBasis(
  pair: string,
  contractType: "PERPETUAL" | "CURRENT_QUARTER" | "NEXT_QUARTER" = "PERPETUAL",
  period: "5m" | "15m" | "1h" | "4h" | "1d" = "1h",
): Promise<BasisData> {
  const data = await fetchJsonWithTimeout<BinanceBasisEntry[]>(
    `https://fapi.binance.com/futures/data/basis?pair=${pair}&contractType=${contractType}&period=${period}&limit=1`,
    {},
    8000,
  );
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(`Binance basis sin datos para ${pair}/${contractType}/${period}`);
  }
  const e = data[0];

  // Binance puede devolver annualizedBasisRate como "" → lo calculamos
  const basisRate = parseFloat(e.basisRate) || 0;
  // Para PERPETUAL el periodo de funding es 8h por defecto en Binance
  const periodsPerYear = (365 * 24) / 8;
  const annualizedBasisRate = e.annualizedBasisRate
    ? parseFloat(e.annualizedBasisRate) * 100
    : basisRate * periodsPerYear * 100;

  return {
    exchange: "Binance",
    symbol: `${pair}_PERPETUAL`,
    asset: pair.replace("USD", ""),
    spotPrice: parseFloat(e.indexPrice),
    indexPrice: parseFloat(e.indexPrice),
    futuresPrice: parseFloat(e.futuresPrice),
    basis: basisRate * 100,
    basisRate,
    annualizedBasisRate,
    contractType: e.contractType,
    period: e.period,
    timestamp: typeof e.timestamp === "number" && e.timestamp > 1e12 ? e.timestamp : e.timestamp * 1000,
    source: "Binance Futures COIN-M /futures/data/basis",
    notes: "Endpoint oficial de Binance para datos de basis en contratos COIN-M.",
  };
}
