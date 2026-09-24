import { NextRequest, NextResponse } from "next/server";

// ============================================================
// API: /api/market-price?asset=BTC&currency=COP
// ============================================================
// Devuelve el precio de mercado real cripto→fiat usando múltiples
// fuentes con fallback:
//   1. Binance ticker (BTCUSDT, BTCEUR, etc.) — más confiable
//   2. CoinGecko simple/price (multi-currency directo)
//   3. Chainlink fallback vía /api/price
//   4. Hard fallback estático (sólo si todo falló)
//
// Cache de 60s en memoria.
// ============================================================

const BINANCE_SYMBOLS: Record<string, string[]> = {
  // asset → lista de currencies soportadas directamente por Binance
  BTC: ["USDT", "EUR", "BRL", "ARS", "MXN", "COP"], // COP vía FX
  ETH: ["USDT", "EUR", "BRL", "ARS", "MXN"],
  USDT: ["USD"],
  USDC: ["USD"],
};

const COINGECKO_IDS: Record<string, string> = {
  BTC: "bitcoin", ETH: "ethereum", USDT: "tether", USDC: "usd-coin",
  XMR: "monero", TRX: "tron", LINK: "chainlink",
};

const SUPPORTED_FIAT = new Set(["USD", "EUR", "COP", "MXN", "ARS", "BRL", "PEN", "CLP", "VES"]);

const FALLBACK_RATES: Record<string, number> = {
  COP: 4100, EUR: 0.92, MXN: 18.5, ARS: 950, BRL: 5.05,
  PEN: 3.75, CLP: 950, VES: 36,
};
const FALLBACK_USD: Record<string, number> = {
  BTC: 84000, ETH: 2700, USDT: 1, USDC: 1, XMR: 150, TRX: 0.15, LINK: 15,
};

// ---- Cache en memoria ---------------------------------------
interface CachedEntry { price: number; source: string; updatedAt: number; warning?: string }
const cache = new Map<string, { data: CachedEntry; expires: number }>();
const TTL = 60_000;

function getCached(key: string): CachedEntry | null {
  const e = cache.get(key);
  if (!e) return null;
  if (Date.now() > e.expires) { cache.delete(key); return null; }
  return e.data;
}
function setCached(key: string, data: CachedEntry) {
  cache.set(key, { data, expires: Date.now() + TTL });
}

// ---- Source 1: Binance --------------------------------------
async function fetchBinancePrice(asset: string, currency: string): Promise<{ price: number; source: string } | null> {
  // Binance no soporta todos los pares directamente. Para COP/CLP/PEN/VES
  // usamos USDT como puente + FX rate real de Yadio.
  if (["COP", "CLP", "PEN", "VES"].includes(currency)) {
    const usdtPair = await fetchBinanceTicker(`${asset}USDT`);
    if (!usdtPair) return null;
    const fx = await fetchYadioFx(currency);
    if (!fx) return null;
    return { price: usdtPair * fx, source: `Binance ${asset}/USDT × Yadio USD/${currency}` };
  }
  // USD = USDT en Binance
  const binanceCurrency = currency === "USD" ? "USDT" : currency;
  const symbol = `${asset}${binanceCurrency}`;
  const price = await fetchBinanceTicker(symbol);
  if (price === null) return null;
  return { price, source: `Binance ${symbol}` };
}

async function fetchBinanceTicker(symbol: string): Promise<number | null> {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`, {
      signal: controller.signal,
      headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0" },
    });
    clearTimeout(id);
    if (!res.ok) return null;
    const data = await res.json();
    const price = parseFloat(data.price);
    return price > 0 ? price : null;
  } catch {
    return null;
  }
}

// FX rates reales para LATAM (Yadio) con cache 5 min
const yadioCache = new Map<string, { rate: number; expires: number }>();
async function fetchYadioFx(currency: string): Promise<number | null> {
  const cached = yadioCache.get(currency);
  if (cached && Date.now() < cached.expires) return cached.rate;
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`https://api.yadio.io/rate/${currency}/USD`, {
      signal: controller.signal,
      headers: { "Accept": "application/json" },
    });
    clearTimeout(id);
    if (!res.ok) return FALLBACK_RATES[currency] || null;
    const data = await res.json();
    const rate = data.rate;
    if (!rate || rate <= 0) return FALLBACK_RATES[currency] || null;
    yadioCache.set(currency, { rate, expires: Date.now() + 300_000 }); // 5 min cache
    return rate;
  } catch {
    return FALLBACK_RATES[currency] || null;
  }
}

// ---- Source 2: CoinGecko ------------------------------------
async function fetchCoinGeckoPrice(asset: string, currency: string): Promise<{ price: number; source: string } | null> {
  const cgId = COINGECKO_IDS[asset];
  if (!cgId) return null;
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${cgId}&vs_currencies=${currency.toLowerCase()}`,
      { signal: controller.signal, headers: { "Accept": "application/json" } }
    );
    clearTimeout(id);
    if (!res.ok) return null;
    const data = await res.json();
    const price = data[cgId]?.[currency.toLowerCase()];
    return price && price > 0 ? { price, source: `CoinGecko` } : null;
  } catch {
    return null;
  }
}

// ---- Source 3: Chainlink (vía /api/price interno) -----------
async function fetchChainlinkPrice(pair: string): Promise<number | null> {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 5000);
    // Llamada interna al endpoint existente
    const baseUrl = `http://localhost:3000`;
    const res = await fetch(`${baseUrl}/api/price?pair=${encodeURIComponent(pair)}`, {
      signal: controller.signal,
    });
    clearTimeout(id);
    if (!res.ok) return null;
    const data = await res.json();
    return data.price || null;
  } catch {
    return null;
  }
}

// ============================================================
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const asset = (searchParams.get("asset") || "BTC").toUpperCase();
  const currency = (searchParams.get("currency") || "USD").toUpperCase();

  const cacheKey = `${asset}/${currency}`;
  const cached = getCached(cacheKey);
  if (cached) {
    return NextResponse.json({ asset, currency, ...cached, cached: true });
  }

  // 1. Binance
  const binance = await fetchBinancePrice(asset, currency);
  if (binance) {
    const entry: CachedEntry = { price: binance.price, source: binance.source, updatedAt: Date.now() };
    setCached(cacheKey, entry);
    return NextResponse.json({ asset, currency, ...entry, cached: false });
  }

  // 2. CoinGecko
  const cg = await fetchCoinGeckoPrice(asset, currency);
  if (cg) {
    const entry: CachedEntry = { price: cg.price, source: cg.source, updatedAt: Date.now() };
    setCached(cacheKey, entry);
    return NextResponse.json({ asset, currency, ...entry, cached: false });
  }

  // 3. Chainlink
  const cryptoUsd = await fetchChainlinkPrice(`${asset}/USD`);
  if (cryptoUsd) {
    let finalPrice = cryptoUsd;
    let source = `Chainlink ${asset}/USD`;
    if (currency !== "USD") {
      const fiatUsd = await fetchChainlinkPrice(`${currency}/USD`);
      if (fiatUsd) {
        finalPrice = cryptoUsd / fiatUsd;
        source = `Chainlink ${asset}/USD ÷ ${currency}/USD`;
      } else {
        const fx = FALLBACK_RATES[currency] || 1;
        finalPrice = cryptoUsd * fx;
        source = `Chainlink ${asset}/USD × FX ${currency}`;
      }
    }
    const entry: CachedEntry = { price: finalPrice, source, updatedAt: Date.now() };
    setCached(cacheKey, entry);
    return NextResponse.json({ asset, currency, ...entry, cached: false });
  }

  // 4. Fallback estático
  const usdPrice = FALLBACK_USD[asset] || 0;
  const fxRate = currency === "USD" ? 1 : (FALLBACK_RATES[currency] || 1);
  const fallbackPrice = usdPrice * fxRate;
  const entry: CachedEntry = {
    price: fallbackPrice,
    source: "Fallback estático (offline)",
    updatedAt: Date.now(),
    warning: "Precio de respaldo. Binance, CoinGecko y Chainlink no respondieron.",
  };
  // No cachear el fallback por mucho tiempo
  cache.set(cacheKey, { data: entry, expires: Date.now() + 10_000 });
  return NextResponse.json({ asset, currency, ...entry, cached: false });
}
