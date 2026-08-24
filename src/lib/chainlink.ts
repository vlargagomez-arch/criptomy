"use client";

// Cliente del oráculo Chainlink (vía API backend para evitar CORS)

export interface PriceData {
  pair: string;
  price: number;
  updatedAt: number; // timestamp seconds
  source: string;
}

// Lee precio de un par desde la API backend (que sí puede alcanzar los RPCs)
export async function fetchChainlinkPrice(pair: string): Promise<PriceData | null> {
  try {
    const res = await fetch(`/api/price?pair=${encodeURIComponent(pair)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      pair: data.pair,
      price: data.price,
      updatedAt: data.updatedAt,
      source: data.source,
    };
  } catch (e) {
    console.error("[chainlink client]", e);
    return null;
  }
}

// Lee múltiples precios en paralelo
export async function fetchMultiplePrices(
  pairs: string[]
): Promise<Record<string, PriceData | null>> {
  try {
    const res = await fetch(`/api/price?pairs=${pairs.join(",")}`);
    if (!res.ok) return {};
    const data = await res.json();
    return data.prices || {};
  } catch (e) {
    console.error("[chainlink client multiple]", e);
    return {};
  }
}

// Convierte USD a fiat usando Chainlink (o fallback)
export async function convertUsdToFiat(
  usdAmount: number,
  targetCurrency: string
): Promise<number> {
  if (targetCurrency === "USD") return usdAmount;
  const pair = `${targetCurrency}/USD`;
  const price = await fetchChainlinkPrice(pair);
  if (!price) {
    const fallbackRates: Record<string, number> = {
      COP: 4100,
      EUR: 0.92,
      MXN: 18.5,
      ARS: 950,
      BRL: 5.05,
      PEN: 3.75,
      CLP: 950,
      VES: 36,
    };
    return usdAmount * (fallbackRates[targetCurrency] || 1);
  }
  return usdAmount / price.price;
}

// Calcula precio de mercado cripto → fiat usando Chainlink
export async function getMarketPrice(
  cryptoSymbol: string,
  fiatCurrency: string
): Promise<{ price: number; source: string; updatedAt: number } | null> {
  const cryptoPair = `${cryptoSymbol}/USD`;
  const cryptoUsd = await fetchChainlinkPrice(cryptoPair);
  if (!cryptoUsd) return null;

  if (fiatCurrency === "USD") {
    return {
      price: cryptoUsd.price,
      source: `Chainlink ${cryptoPair}`,
      updatedAt: cryptoUsd.updatedAt,
    };
  }

  const fiatUsd = await fetchChainlinkPrice(`${fiatCurrency}/USD`);
  if (fiatUsd) {
    return {
      price: cryptoUsd.price / fiatUsd.price,
      source: `Chainlink ${cryptoPair} ÷ ${fiatCurrency}/USD`,
      updatedAt: Math.min(cryptoUsd.updatedAt, fiatUsd.updatedAt),
    };
  }

  // Fallback para fiat no soportado por Chainlink
  const fallbackRate = await convertUsdToFiat(1, fiatCurrency);
  return {
    price: cryptoUsd.price * fallbackRate,
    source: `Chainlink ${cryptoPair} × fallback ${fiatCurrency}`,
    updatedAt: cryptoUsd.updatedAt,
  };
}

export function timeSinceUpdate(timestamp: number): string {
  const sec = Math.floor(Date.now() / 1000) - timestamp;
  if (sec < 60) return `hace ${sec}s`;
  if (sec < 3600) return `hace ${Math.floor(sec / 60)} min`;
  if (sec < 86400) return `hace ${Math.floor(sec / 3600)} h`;
  return `hace ${Math.floor(sec / 86400)} días`;
}

// Pares soportados (para mostrar en UI)
export const SUPPORTED_PAIRS = [
  "ETH/USD",
  "BTC/USD",
  "USDT/USD",
  "USDC/USD",
  "LINK/USD",
  "EUR/USD",
];
