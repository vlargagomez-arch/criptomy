// ============================================================
// P2P ARBITRAGE ENGINE — Arbitraje entre exchanges P2P
// ============================================================
// Combina datos de TODOS los exchanges P2P disponibles:
//   - Binance P2P  ✅ funciona
//   - Bybit P2P    ⚠️ intentamos (puede que no responda)
//   - OKX P2P      ⚠️ intentamos (API no documentada)
//   - HTX P2P      ⚠️ intentamos
//   - KuCoin P2P   ⚠️ intentamos (Cloudflare)
//   - Bitget P2P   ⚠️ intentamos
//   - Gate.io P2P  ⚠️ intentamos (Akamai)
//
// Y referencia spot de:
//   - Kraken, Coinbase, Bitvavo (spot)
//
// DETECCIÓN DE ARBITRAJE:
//   1. Toma TODAS las ofertas BUY (donde puedes comprar cripto) de TODOS los exchanges
//   2. Toma TODAS las ofertas SELL (donde puedes vender cripto) de TODOS los exchanges
//   3. Para cada par (BUY_i, SELL_j) donde SELL > BUY:
//      - Si son del MISMO exchange: arbitraje intra-exchange
//      - Si son de DIFERENTES exchanges: arbitraje cross-exchange (más complejo)
//        porque hay que transferir el cripto entre exchanges (5-30 min, fee de red)
//      - Calcula el rango ejecutable (intersección de min/max)
//      - Si hay intersección, es una oportunidad real
//      - Estima ganancia operando el monto máximo del rango matched
//   4. Ordena por ROI descendente
// ============================================================

import { fetchKrakenTicker } from "../scanner/providers/kraken";
import { fetchCoinbaseTicker } from "../scanner/providers/coinbase";
import { fetchBitvavoTicker } from "../scanner/providers/bitvavo";
import type { P2POffer, MarketQuote } from "../scanner/types";
import { scanAllP2PProviders, type P2PProviderResult } from "./p2p-providers";

// ============================================================
// TIPO DE DATO: Oportunidad de arbitraje P2P
// ============================================================
export interface P2PArbitrageOpportunity {
  asset: string;
  fiat: string;
  // Compra (BUY) — donde el usuario compra cripto pagando fiat
  buyAt: {
    provider: string;          // "Binance P2P" / "Bybit P2P" / etc.
    advertiser: string;
    price: number;
    minAmount: number;
    maxAmount: number;
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
    min: number;
    max: number;
    executable: boolean;
  };
  // Tipo de arbitraje
  type: "INTRA-EXCHANGE" | "CROSS-EXCHANGE";
  // Métricas
  spread: number;
  spreadPercent: number;
  estimatedProfit: number;
  estimatedRoiPercent: number;
  // Referencia spot
  spotReference: {
    provider: string;
    price: number;
    note: string;
  } | null;
  timestamp: number;
  warnings: string[];
}

// ============================================================
// MOTOR PRINCIPAL: Detectar oportunidades de arbitraje P2P multi-exchange
// ============================================================
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
  p2pProviders: P2PProviderResult[];
}> {
  const { asset, fiat } = params;

  // 1. Escanear TODOS los P2P providers en paralelo (BUY y SELL)
  const [buyResults, sellResults] = await Promise.all([
    scanAllP2PProviders({ asset, fiat, tradeType: "BUY" }),
    scanAllP2PProviders({ asset, fiat, tradeType: "SELL" }),
  ]);

  // Concatenar todas las ofertas BUY y SELL de todos los providers
  const buyOffers = buyResults.results.flatMap((r) => r.offers);
  const sellOffers = sellResults.results.flatMap((r) => r.offers);

  // Combinar la lista única de providers (BUY + SELL) para el UI
  const p2pProviderMap = new Map<string, P2PProviderResult>();
  for (const r of buyResults.results) {
    p2pProviderMap.set(r.providerId, r);
  }
  for (const r of sellResults.results) {
    const existing = p2pProviderMap.get(r.providerId);
    if (!existing) {
      p2pProviderMap.set(r.providerId, r);
    } else if (existing.status !== "ONLINE" && r.status === "ONLINE") {
      // Si BUY fue offline pero SELL online, usar el online
      p2pProviderMap.set(r.providerId, r);
    }
  }
  const p2pProviders = Array.from(p2pProviderMap.values());

  // 2. Escanear spot de referencia (Kraken, Bitvavo, Coinbase)
  let spotRef: MarketQuote | null = null;
  const spotProviders: MarketQuote[] = [];

  const LOCAL_FIATS = ["COP", "MXN", "ARS", "BRL", "CLP", "PEN", "VES", "DOP"];
  const isLocalFiat = LOCAL_FIATS.includes(fiat);

  if (isLocalFiat) {
    const [kraken, coinbase, bitvavo] = await Promise.all([
      fetchKrakenTicker(asset, "USD").catch(() => null),
      fetchCoinbaseTicker(asset, "USD").catch(() => null),
      fetchBitvavoTicker(asset, "EUR").catch(() => null),
    ]);
    spotProviders.push(...[kraken, coinbase, bitvavo].filter((q): q is MarketQuote => q !== null && q.status === "ONLINE"));
    spotRef = spotProviders[0] || null;
  } else {
    const [kraken, coinbase, bitvavo] = await Promise.all([
      fetchKrakenTicker(asset, fiat).catch(() => null),
      fetchCoinbaseTicker(asset, fiat).catch(() => null),
      fetchBitvavoTicker(asset, fiat).catch(() => null),
    ]);
    spotProviders.push(...[kraken, coinbase, bitvavo].filter((q): q is MarketQuote => q !== null && q.status === "ONLINE"));
    spotRef = spotProviders[0] || null;
  }

  // 3. Detectar oportunidades de arbitraje — matching CROSS-EXCHANGE
  // Para cada BUY offer (precio bajo), busca SELL offers (precio alto) de cualquier exchange
  // donde SELL > BUY + spread mínimo. Calcula matching de cantidades.
  const opportunities: P2PArbitrageOpportunity[] = [];

  for (const buy of buyOffers) {
    for (const sell of sellOffers) {
      if (sell.price <= buy.price) continue;
      const spread = sell.price - buy.price;
      const spreadPercent = (spread / buy.price) * 100;

      // Solo considerar spreads > 0.5% (mínimo realista)
      if (spreadPercent < 0.5) continue;

      // Tipo de arbitraje
      const isCrossExchange = buy.provider !== sell.provider;
      const type: "INTRA-EXCHANGE" | "CROSS-EXCHANGE" = isCrossExchange
        ? "CROSS-EXCHANGE"
        : "INTRA-EXCHANGE";

      // Para cross-exchange, exigir spread mayor (para cubrir transfer entre exchanges)
      if (isCrossExchange && spreadPercent < 1.0) continue;

      // MATCHING DE CANTIDADES
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

      // Warnings — más estrictos para cross-exchange
      const warnings: string[] = [];
      if (type === "INTRA-EXCHANGE") {
        warnings.push("Arbitraje INTRA-exchange: misma plataforma, 2 advertisers distintos.");
        warnings.push("Más simple — no hay transferencia entre exchanges.");
      } else {
        warnings.push("Arbitraje CROSS-exchange: 2 plataformas distintas.");
        warnings.push(`Después de comprar en ${buy.providerName}, transfieres el ${asset} a ${sell.providerName}.`);
        warnings.push("Toma 5-30 min + fee de retiro (~$1-5 USDT) + fee de depósito (~gratis).");
        warnings.push("Mientras la transferencia se confirma, el precio SELL puede cambiar.");
        warnings.push("Necesitas cuenta verificada (KYC) en ambos exchanges.");
      }
      warnings.push("El advertiser de venta debe estar ONLINE y disponible.");
      warnings.push("Si usas la misma red de pago, tu identidad queda expuesta al advertiser.");

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
        type,
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
    opportunities: opportunities.slice(0, 20),
    buyOffers,
    sellOffers,
    spotRef,
    spotProviders,
    p2pProviders,
  };
}
