// ============================================================
// P2P ARBITRAGE ENGINE — Arbitraje entre exchanges P2P y spot
// ============================================================
// Combina datos de:
//   - Binance P2P (BUY + SELL) — el mayor mercado P2P de LATAM
//   - Kraken spot — precio referencia regulado
//   - Bitvavo spot — exchange holandés con buena liquidez EU
//   - Coinbase spot — referencia USD
//
// Detecta oportunidades de arbitraje entre:
//   1. Comprar P2P barato (BUY offer más baja) en exchange A
//   2. Vender P2P caro (SELL offer más alta) en exchange B
//   3. Solo incluye pares donde las cantidades (min-max) se cruzan
//      para que la operación sea realmente ejecutable
//
// El matching de cantidades es crítico: si el BUY en A acepta
// 100-500 USDT y el SELL en B acepta 50-200 USDT, el rango ejecutable
// es 100-200 USDT (intersección). El usuario solicitó EXPLICITAMENTE
// que las cantidades de compra y venta coincidan.
// ============================================================

import { fetchBinanceP2P } from "../scanner/providers/binance";
import { fetchKrakenTicker } from "../scanner/providers/kraken";
import { fetchCoinbaseTicker } from "../scanner/providers/coinbase";
import type { P2POffer, MarketQuote, ProviderStatus } from "../scanner/types";

// ============================================================
// BITVAVO PROVIDER — Exchange holandés, regulado EU, buena liquidez
// ============================================================
// Docs: https://docs.bitvavo.com/
// GET /v2/ticker/24hour?market=BTC-EUR — público, sin auth
// Rate limit: 1000 req/min por IP (muy generoso)
// ============================================================

const BITVAVO_BASE = "https://api.bitvavo.com/v2";

const BITVAVO_SYMBOLS: Record<string, Record<string, string>> = {
  BTC: { EUR: "BTC-EUR", USD: "BTC-EUR" },
  ETH: { EUR: "ETH-EUR", USD: "ETH-EUR" },
  USDT: { EUR: "USDT-EUR", USD: "USDT-EUR" },
  USDC: { EUR: "USDC-EUR", USD: "USDC-EUR" },
  SOL: { EUR: "SOL-EUR", USD: "SOL-EUR" },
  XRP: { EUR: "XRP-EUR", USD: "XRP-EUR" },
};

export function bitvavoSymbol(asset: string, quote: string): string | null {
  return BITVAVO_SYMBOLS[asset.toUpperCase()]?.[quote.toUpperCase()] || null;
}

interface BitvavoTicker {
  market: string;
  lastPrice: string;
  bidPrice: string;
  askPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  priceChangePercent: string;
}

export async function fetchBitvavoTicker(asset: string, quote: string): Promise<MarketQuote> {
  const symbol = bitvavoSymbol(asset, quote);
  if (!symbol) {
    return {
      provider: "bitvavo",
      providerName: "Bitvavo",
      symbol: "",
      asset,
      quoteCurrency: quote,
      lastPrice: 0,
      timestamp: Date.now(),
      latencyMs: 0,
      status: "ERROR" as ProviderStatus,
      error: `Symbol no soportado: ${asset}${quote}`,
    };
  }

  const url = `${BITVAVO_BASE}/ticker/24hour?market=${symbol}`;
  const start = Date.now();
  try {
    const { isCircuitOpen, recordSuccess, recordFailure, cacheGet, cacheSet } = await import("../scanner/cache");
    if (isCircuitOpen("bitvavo")) {
      return {
        provider: "bitvavo", providerName: "Bitvavo", symbol, asset, quoteCurrency: quote,
        lastPrice: 0, timestamp: Date.now(), latencyMs: 0,
        status: "DISABLED" as ProviderStatus, error: "Circuit breaker abierto",
      };
    }
    const cacheKey = `bitvavo:ticker:${symbol}`;
    const cached = cacheGet<MarketQuote>(cacheKey);
    if (cached) return cached;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    const latencyMs = Date.now() - start;

    if (!res.ok) {
      recordFailure("bitvavo");
      return {
        provider: "bitvavo", providerName: "Bitvavo", symbol, asset, quoteCurrency: quote,
        lastPrice: 0, timestamp: Date.now(), latencyMs,
        status: "ERROR" as ProviderStatus, error: `HTTP ${res.status}`,
      };
    }
    const data = (await res.json()) as BitvavoTicker;
    const last = parseFloat(data.lastPrice);
    const bid = parseFloat(data.bidPrice);
    const ask = parseFloat(data.askPrice);

    const q: MarketQuote = {
      provider: "bitvavo",
      providerName: "Bitvavo",
      symbol,
      asset,
      quoteCurrency: quote,
      lastPrice: last,
      bidPrice: bid,
      askPrice: ask,
      spread: ask - bid,
      spreadPercent: last > 0 ? ((ask - bid) / last) * 100 : undefined,
      volume24h: parseFloat(data.volume),
      changePercent24h: parseFloat(data.priceChangePercent),
      high24h: parseFloat(data.highPrice),
      low24h: parseFloat(data.lowPrice),
      timestamp: Date.now(),
      latencyMs,
      status: "ONLINE" as ProviderStatus,
    };
    cacheSet(cacheKey, q, 15_000);
    recordSuccess("bitvavo");
    return q;
  } catch (err) {
    const { recordFailure } = await import("../scanner/cache");
    recordFailure("bitvavo");
    return {
      provider: "bitvavo", providerName: "Bitvavo", symbol, asset, quoteCurrency: quote,
      lastPrice: 0, timestamp: Date.now(), latencyMs: Date.now() - start,
      status: "ERROR" as ProviderStatus, error: (err as Error).message,
    };
  }
}

// ============================================================
// TIPO DE DATO: Oportunidad de arbitraje P2P
// ============================================================
export interface P2PArbitrageOpportunity {
  asset: string;       // "USDT"
  fiat: string;        // "COP"
  // Compra (BUY) — donde el usuario compra cripto pagando fiat
  buyAt: {
    provider: string;          // "Binance P2P"
    advertiser: string;
    price: number;             // precio por unidad en fiat
    minAmount: number;         // fiat
    maxAmount: number;         // fiat
    paymentMethods: string[];
    tradeCount: number;
    completionRate?: number;
  };
  // Venta (SELL) — donde el usuario vende cripto recibiendo fiat
  sellAt: {
    provider: string;
    advertiser: string;
    price: number;
    minAmount: number;
    maxAmount: number;
    paymentMethods: string[];
    tradeCount: number;
    completionRate?: number;
  };
  // Matching de cantidades — rango ejecutable real
  matchedRange: {
    min: number;              // max(buyMin, sellMin)
    max: number;              // min(buyMax, sellMax)
    executable: boolean;       // true si hay intersección
  };
  // Métricas
  spread: number;             // sellPrice - buyPrice (en fiat por unidad)
  spreadPercent: number;      // (spread / buyPrice) * 100
  estimatedProfit: number;    // ganancia neta estimada al operar el monto máximo del rango matched
  estimatedRoiPercent: number;
  // Referencia spot (para contexto, no para operar)
  spotReference: {
    provider: string;         // "Kraken" o "Bitvavo" o "Coinbase"
    price: number;
    note: string;             // "Precio spot USD/EUR de referencia"
  } | null;
  timestamp: number;
  warnings: string[];
}

// ============================================================
// MOTOR PRINCIPAL: Detectar oportunidades de arbitraje P2P
// ============================================================
// Estrategia:
// 1. Escanea P2P BUY offers (precios ASK — usuario paga para comprar cripto)
// 2. Escanea P2P SELL offers (precios BID — usuario recibe por vender cripto)
// 3. Para cada par (BUY_i, SELL_j) donde SELL > BUY:
//    - Calcula el rango ejecutable (intersección de min/max)
//    - Si hay intersección, es una oportunidad real
//    - Estima ganancia operando el monto máximo del rango matched
// 4. Ordena por ROI descendente

export async function scanP2PArbitrage(params: {
  asset: string;
  fiat: string;
  capital?: number;
}): Promise<{
  opportunities: P2PArbitrageOpportunity[];
  buyOffers: P2POffer[];
  sellOffers: P2POffer[];
  spotRef: MarketQuote | null;
  spotProviders: MarketQuote[];
}> {
  const { asset, fiat } = params;

  // 1. Escanear P2P en paralelo (Binance BUY + SELL)
  const [buyOffers, sellOffers] = await Promise.all([
    fetchBinanceP2P({ asset, fiat, tradeType: "BUY", rows: 20 }),
    fetchBinanceP2P({ asset, fiat, tradeType: "SELL", rows: 20 }),
  ]);

  // 2. Escanear spot de referencia (Kraken, Bitvavo, Coinbase) en paralelo
  let spotRef: MarketQuote | null = null;
  const spotProviders: MarketQuote[] = [];

  const LOCAL_FIATS = ["COP", "MXN", "ARS", "BRL", "CLP", "PEN", "VES", "DOP"];
  const isLocalFiat = LOCAL_FIATS.includes(fiat);

  if (isLocalFiat) {
    // Para fiats locales LATAM, no hay spot directo. Usamos USDT/USD como referencia
    // y convertimos a fiat local con tasa aproximada.
    const [kraken, coinbase, bitvavo] = await Promise.all([
      fetchKrakenTicker(asset, "USD").catch(() => null),
      fetchCoinbaseTicker(asset, "USD").catch(() => null),
      fetchBitvavoTicker(asset, "EUR").catch(() => null),
    ]);
    spotProviders.push(...[kraken, coinbase, bitvavo].filter((q): q is MarketQuote => q !== null && q.status === "ONLINE"));
    spotRef = spotProviders[0] || null;
  } else {
    // fiat es USD o EUR — usamos el par directo
    const [kraken, coinbase, bitvavo] = await Promise.all([
      fetchKrakenTicker(asset, fiat).catch(() => null),
      fetchCoinbaseTicker(asset, fiat).catch(() => null),
      fetchBitvavoTicker(asset, fiat).catch(() => null),
    ]);
    spotProviders.push(...[kraken, coinbase, bitvavo].filter((q): q is MarketQuote => q !== null && q.status === "ONLINE"));
    spotRef = spotProviders[0] || null;
  }

  // 3. Detectar oportunidades de arbitraje
  // BUY offer = precio que el usuario paga para COMPRAR cripto (ASK)
  // SELL offer = precio que el usuario recibe para VENDER cripto (BID)
  // Arbitraje: comprar barato (BUY bajo) en un advertiser y vender caro (SELL alto) en otro
  const opportunities: P2PArbitrageOpportunity[] = [];

  for (const buy of buyOffers) {
    for (const sell of sellOffers) {
      if (sell.price <= buy.price) continue;
      const spread = sell.price - buy.price;
      const spreadPercent = (spread / buy.price) * 100;

      // Solo considerar spreads > 0.5% (mínimo realista)
      if (spreadPercent < 0.5) continue;

      // MATCHING DE CANTIDADES — el usuario solicitó EXPLÍCITAMENTE que coincidan
      const buyMin = buy.minAmount || 0;
      const buyMax = buy.maxAmount || 0;
      const sellMin = sell.minAmount || 0;
      const sellMax = sell.maxAmount || 0;
      const matchedMin = Math.max(buyMin, sellMin);
      const matchedMax = Math.min(buyMax, sellMax);
      const executable = matchedMin > 0 && matchedMax >= matchedMin;

      if (!executable) continue;

      // Estimar ganancia operando el monto máximo del rango matched
      const unitsBought = matchedMax / buy.price;
      const grossSell = unitsBought * sell.price;
      const estimatedProfit = grossSell - matchedMax;
      const estimatedRoiPercent = (estimatedProfit / matchedMax) * 100;

      // Convertir spot reference a fiat local si es necesario
      let spotReference: P2PArbitrageOpportunity["spotReference"] = null;
      if (spotRef && spotRef.lastPrice > 0) {
        if (isLocalFiat) {
          const fiatRates: Record<string, number> = {
            COP: 4100, MXN: 18.5, ARS: 950, BRL: 5.05, CLP: 950, PEN: 3.75, VES: 36, DOP: 58,
          };
          const rate = fiatRates[fiat] || 1;
          spotReference = {
            provider: spotRef.providerName,
            price: spotRef.lastPrice * rate,
            note: `Precio spot ${asset}/USD convertido a ${fiat} (~${rate} ${fiat}/USD)`,
          };
        } else {
          spotReference = {
            provider: spotRef.providerName,
            price: spotRef.lastPrice,
            note: `Precio spot ${asset}/${fiat}`,
          };
        }
      }

      const warnings: string[] = [
        "El arbitraje P2P implica hacer 2 transacciones con 2 personas distintas.",
        "El precio puede cambiar entre que inicias la compra y la venta.",
        "El advertiser de venta debe estar ONLINE y disponible.",
        "Si usas la misma red de pago, tu identidad queda expuesta al advertiser.",
      ];
      if (spreadPercent < 2) {
        warnings.push("⚠️ Spread bajo: una fluctuación pequeña puede eliminar la ganancia.");
      }
      if (buy.completionRate !== undefined && buy.completionRate < 0.95) {
        warnings.push(`⚠️ Comprador con completion rate bajo (${(buy.completionRate * 100).toFixed(0)}%).`);
      }
      if (sell.completionRate !== undefined && sell.completionRate < 0.95) {
        warnings.push(`⚠️ Vendedor con completion rate bajo (${(sell.completionRate * 100).toFixed(0)}%).`);
      }

      opportunities.push({
        asset,
        fiat,
        buyAt: {
          provider: buy.providerName,
          advertiser: buy.advertiser,
          price: buy.price,
          minAmount: buy.minAmount,
          maxAmount: buy.maxAmount,
          paymentMethods: buy.paymentMethods,
          tradeCount: buy.tradeCount,
          completionRate: buy.completionRate,
        },
        sellAt: {
          provider: sell.providerName,
          advertiser: sell.advertiser,
          price: sell.price,
          minAmount: sell.minAmount,
          maxAmount: sell.maxAmount,
          paymentMethods: sell.paymentMethods,
          tradeCount: sell.tradeCount,
          completionRate: sell.completionRate,
        },
        matchedRange: {
          min: matchedMin,
          max: matchedMax,
          executable,
        },
        spread,
        spreadPercent,
        estimatedProfit,
        estimatedRoiPercent,
        spotReference,
        timestamp: Date.now(),
        warnings,
      });
    }
  }

  // Ordenar por ROI descendente
  opportunities.sort((a, b) => b.estimatedRoiPercent - a.estimatedRoiPercent);

  return {
    opportunities: opportunities.slice(0, 15),
    buyOffers,
    sellOffers,
    spotRef,
    spotProviders,
  };
}
