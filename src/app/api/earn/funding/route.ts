import { NextRequest, NextResponse } from "next/server";

// ============================================================
// API: /api/earn/funding — Funding rates reales de Binance
// ============================================================
// GET /api/earn/funding?symbol=BTCUSDT
//
// Binance Futures API:
//   /fapi/v1/premiumIndex — mark price, index price, funding rate actual
//   /fapi/v1/fundingRate — historial de funding rates
//
// Normalizamos a:
// { exchange, symbol, spotPrice, futuresPrice, fundingRate,
//   fundingIntervalHours, nextFundingTime, historical7d, historical30d,
//   annualizedFunding, basis, annualizedBasis, updatedAt }
// ============================================================

interface BinancePremiumIndex {
  symbol: string;
  markPrice: string;
  indexPrice: string;
  lastFundingRate: string;
  nextFundingTime: number;
  time: number;
}

interface BinanceFundingRate {
  symbol: string;
  fundingRate: string;
  fundingTime: number;
  markPrice: string;
}

interface NormalizedFunding {
  exchange: string;
  symbol: string;
  markPrice: number;
  indexPrice: number;
  fundingRate: number;
  fundingIntervalHours: number;
  nextFundingTime: number;
  historical7d: number;
  historical30d: number;
  annualizedFunding: number;
  basis: number;
  annualizedBasis: number;
  updatedAt: number;
}

// Cache
let cachedFunding: Record<string, { data: NormalizedFunding; timestamp: number }> = {};
const CACHE_TTL = 30_000; // 30s

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get("symbol") || "BTCUSDT").toUpperCase();

  try {
    // Check cache
    if (cachedFunding[symbol] && Date.now() - cachedFunding[symbol].timestamp < CACHE_TTL) {
      return NextResponse.json({ funding: cachedFunding[symbol].data, cached: true });
    }

    // Fetch premiumIndex (current funding)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const [premiumRes, historyRes] = await Promise.all([
      fetch(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${symbol}`, {
        signal: controller.signal,
        headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0" },
      }),
      fetch(`https://fapi.binance.com/fapi/v1/fundingRate?symbol=${symbol}&limit=90`, {
        signal: controller.signal,
        headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0" },
      }),
    ]);

    clearTimeout(timeoutId);

    if (!premiumRes.ok || !historyRes.ok) {
      return NextResponse.json({ error: "Binance no respondió", funding: null }, { status: 502 });
    }

    const premium = (await premiumRes.json()) as BinancePremiumIndex;
    const history = (await historyRes.json()) as BinanceFundingRate[];

    // Parse
    const markPrice = parseFloat(premium.markPrice);
    const indexPrice = parseFloat(premium.indexPrice);
    const fundingRate = parseFloat(premium.lastFundingRate);
    const fundingIntervalHours = 8; // Binance: cada 8 horas

    // Historical funding
    const last7d = history.slice(-21); // ~7 días * 3 por día
    const last30d = history.slice(-90); // ~30 días * 3 por día

    const avg7d = last7d.length > 0
      ? last7d.reduce((s, r) => s + parseFloat(r.fundingRate), 0) / last7d.length
      : 0;
    const avg30d = last30d.length > 0
      ? last30d.reduce((s, r) => s + parseFloat(r.fundingRate), 0) / last30d.length
      : 0;

    // Annualized: fundingRate * (365*24 / intervalHours) * 100
    const periodsPerYear = (365 * 24) / fundingIntervalHours;
    const annualizedFunding = fundingRate * periodsPerYear * 100;
    const annualized7d = avg7d * periodsPerYear * 100;
    const annualized30d = avg30d * periodsPerYear * 100;

    // Basis = (futures - spot) / spot * 100
    const basis = indexPrice > 0 ? ((markPrice - indexPrice) / indexPrice) * 100 : 0;
    const annualizedBasis = basis * periodsPerYear;

    const result: NormalizedFunding = {
      exchange: "Binance",
      symbol,
      markPrice,
      indexPrice,
      fundingRate: fundingRate * 100, // a porcentaje
      fundingIntervalHours,
      nextFundingTime: premium.nextFundingTime,
      historical7d: avg7d * 100,
      historical30d: avg30d * 100,
      annualizedFunding,
      basis,
      annualizedBasis,
      updatedAt: Date.now(),
    };

    cachedFunding[symbol] = { data: result, timestamp: Date.now() };

    return NextResponse.json({ funding: result, cached: false });
  } catch (err) {
    return NextResponse.json({ error: "Esta fuente no respondió en este momento.", funding: null }, { status: 502 });
  }
}
