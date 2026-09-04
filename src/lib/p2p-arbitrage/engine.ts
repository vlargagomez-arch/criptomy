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
import { fetchBitvavoTicker } from "../scanner/providers/bitvavo";
import type { P2POffer, MarketQuote } from "../scanner/types";

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
