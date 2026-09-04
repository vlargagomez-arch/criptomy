// ============================================================
// P2P ARBITRAGE ENGINE v2 — Algoritmo de matching cross-exchange
// ============================================================
// Algoritmo (especificación del usuario):
//
// 1. Fetch paralelo: BUY ads + SELL ads de TODOS los exchanges (8 requests en paralelo)
//    - Binance P2P (server-side, funciona)
//    - Bybit P2P (server-side, funciona)
//    - OKX, HTX, KuCoin, Bitget, MEXC (client-side via user browser)
//    - Gate.io (con API key del usuario)
//
// 2. Filtro de reputación: solo merchants con completionRate ≥ 80%
//    (filtra estafadores y merchants con alto riesgo)
//
// 3. Sort: BUY ascendente (más barato primero),
//          SELL descendente (más caro primero)
//
// 4. Cross-match: top 12 BUY × top 12 SELL = 144 combinaciones máximo
//
// 5. Para cada combinación calcular:
//    - Spread bruto = sellPrice - buyPrice
//    - Fee de retiro crypto (flat: 1 USDT TRC20 por defecto)
//    - Spread neto después de fees (en %)
//    - Tamaño de operación (limitado por min/max de ambos merchants)
//    - Profit neto en fiat
//
// 6. Filtrar solo oportunidades con netSpread ≥ 0.1% y profit > 0
//
// 7. Ordenar por spread neto descendente
//
// 8. Devolver top 30 oportunidades
// ============================================================

import { fetchKrakenTicker } from "../scanner/providers/kraken";
import { fetchCoinbaseTicker } from "../scanner/providers/coinbase";
import { fetchBitvavoTicker } from "../scanner/providers/bitvavo";
import type { P2POffer, MarketQuote } from "../scanner/types";
import { scanAllP2PProviders, type P2PProviderResult } from "./p2p-providers";

// ============================================================
// Configuración del algoritmo
// ============================================================

// Fee de retiro crypto (flat, en unidades del activo)
// Ej: 1 USDT TRC20 = retiro típico de Binance/Bybit/OKX
const WITHDRAWAL_FEE_USDT_TRC20 = 1; // 1 USDT
const WITHDRAWAL_FEE_USDT_ERC20 = 10; // 10 USDT (caro, gas Ethereum)
const WITHDRAWAL_FEE_USDT_BSC = 0.5; // 0.5 USDT (BSC)
const WITHDRAWAL_FEE_BTC = 0.0001; // 0.0001 BTC
const WITHDRAWAL_FEE_ETH = 0.002; // 0.002 ETH

function getWithdrawalFee(asset: string, network: string = "TRC20"): number {
  const a = asset.toUpperCase();
  if (a === "USDT" || a === "USDC") {
    if (network === "ERC20") return WITHDRAWAL_FEE_USDT_ERC20;
    if (network === "BSC" || network === "BEP20") return WITHDRAWAL_FEE_USDT_BSC;
    return WITHDRAWAL_FEE_USDT_TRC20; // default TRC20
  }
  if (a === "BTC") return WITHDRAWAL_FEE_BTC;
  if (a === "ETH") return WITHDRAWAL_FEE_ETH;
  return 1; // default 1 unidad
}

// Parámetros del algoritmo
const REPUTATION_THRESHOLD = 0.80; // 80% completion rate mínimo
const TOP_N_PER_SIDE = 12; // top 12 BUY × top 12 SELL = 144 max
const MIN_NET_SPREAD_PERCENT = 0.1; // 0.1% mínimo
const MAX_OPPORTUNITIES = 30; // devolver top 30

// ============================================================
// TIPO DE DATO: Oportunidad de arbitraje P2P (v2)
// ============================================================
export interface P2PArbitrageOpportunityV2 {
  asset: string;
  fiat: string;
  rank: number;

  // Compra (BUY) — donde el usuario compra cripto pagando fiat
  buyAt: {
    provider: string;
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

  // Tipo de arbitraje
  type: "INTRA-EXCHANGE" | "CROSS-EXCHANGE";
  crossExchange: boolean;

  // Matching de cantidades (intersección de min/max)
  matchedRange: {
    min: number;
    max: number;
    executable: boolean;
  };

  // Tamaño de operación recomendado (limitado por max de ambos merchants)
  operationSize: number;

  // Métricas financieras
  grossSpread: number;          // sellPrice - buyPrice (por unidad)
  grossSpreadPercent: number;   // (grossSpread / buyPrice) * 100
  withdrawalFee: number;         // fee de retiro en unidades del activo
  withdrawalFeeFiat: number;    // fee de retiro en fiat
  netProfit: number;            // profit neto en fiat después de fees
  netSpreadPercent: number;    // profit neto como % del capital

  // Detalles del cálculo
  unitsBought: number;          // operationSize / buyPrice
  grossRevenue: number;         // unitsBought * sellPrice
  grossProfit: number;          // grossRevenue - operationSize

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
// MOTOR PRINCIPAL v2
// ============================================================
export async function scanP2PArbitrageV2(params: {
  asset: string;
  fiat: string;
  // Ofertas adicionales (del client-side fetch)
  clientBuyOffers?: P2POffer[];
  clientSellOffers?: P2POffer[];
  // Configuración
  withdrawalNetwork?: string; // default "TRC20"
  reputationThreshold?: number; // default 0.80
  topN?: number; // default 12
  minNetSpreadPercent?: number; // default 0.1
  maxOpportunities?: number; // default 30
}): Promise<{
  opportunities: P2PArbitrageOpportunityV2[];
  buyOffers: P2POffer[];
  sellOffers: P2POffer[];
  filteredBuy: P2POffer[];
  filteredSell: P2POffer[];
  spotRef: MarketQuote | null;
  spotProviders: MarketQuote[];
  p2pProviders: P2PProviderResult[];
  stats: {
    totalBuyOffers: number;
    totalSellOffers: number;
    afterReputationFilterBuy: number;
    afterReputationFilterSell: number;
    topNBuy: number;
    topNSell: number;
    crossMatched: number;
    afterNetSpreadFilter: number;
    finalOpportunities: number;
  };
}> {
  const {
    asset,
    fiat,
    clientBuyOffers = [],
    clientSellOffers = [],
    withdrawalNetwork = "TRC20",
    reputationThreshold = REPUTATION_THRESHOLD,
    topN = TOP_N_PER_SIDE,
    minNetSpreadPercent = MIN_NET_SPREAD_PERCENT,
    maxOpportunities = MAX_OPPORTUNITIES,
  } = params;

  // === PASO 1: Fetch paralelo BUY + SELL de TODOS los exchanges ===
  const [buyResults, sellResults] = await Promise.all([
    scanAllP2PProviders({ asset, fiat, tradeType: "BUY" }),
    scanAllP2PProviders({ asset, fiat, tradeType: "SELL" }),
  ]);

  // Concatenar ofertas server-side + client-side
  const serverBuyOffers = buyResults.results.flatMap((r) => r.offers);
  const serverSellOffers = sellResults.results.flatMap((r) => r.offers);
  const buyOffers = [...serverBuyOffers, ...clientBuyOffers];
  const sellOffers = [...serverSellOffers, ...clientSellOffers];

  // Combinar providers (server + client)
  const p2pProviderMap = new Map<string, P2PProviderResult>();
  for (const r of buyResults.results) p2pProviderMap.set(r.providerId, r);
  for (const r of sellResults.results) {
    const existing = p2pProviderMap.get(r.providerId);
    if (!existing) p2pProviderMap.set(r.providerId, r);
  }
  const p2pProviders = Array.from(p2pProviderMap.values());

  // === PASO 2: Filtro de reputación (completionRate >= 80%) ===
  const filterByReputation = (offers: P2POffer[]): P2POffer[] => {
    return offers.filter((o) => {
      // Si no hay completionRate (algunos exchanges no lo exponen), lo incluimos
      // pero marcamos advertencia. Si hay, exigimos >= threshold.
      if (o.completionRate === undefined || o.completionRate === null) return true;
      return o.completionRate >= reputationThreshold;
    });
  };

  const filteredBuy = filterByReputation(buyOffers);
  const filteredSell = filterByReputation(sellOffers);

  // === PASO 3: Sort BUY ascendente (más barato primero), SELL descendente (más caro primero) ===
  const sortedBuy = [...filteredBuy].sort((a, b) => a.price - b.price);
  const sortedSell = [...filteredSell].sort((a, b) => b.price - a.price);

  // === PASO 4: Cross-match: top 12 BUY × top 12 SELL = 144 max ===
  const topBuy = sortedBuy.slice(0, topN);
  const topSell = sortedSell.slice(0, topN);

  // === Spot reference (paralelo) ===
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

  // === PASO 5: Para cada combinación calcular métricas ===
  const withdrawalFeeAsset = getWithdrawalFee(asset, withdrawalNetwork);
  const opportunities: P2PArbitrageOpportunityV2[] = [];

  for (const buy of topBuy) {
    for (const sell of topSell) {
      // Skip si vendes más barato que compras
      if (sell.price <= buy.price) continue;

      // Tipo de arbitraje
      const crossExchange = buy.provider !== sell.provider;
      const type: "INTRA-EXCHANGE" | "CROSS-EXCHANGE" = crossExchange
        ? "CROSS-EXCHANGE"
        : "INTRA-EXCHANGE";

      // Matching de cantidades (intersección min-max)
      const matchedMin = Math.max(buy.minAmount || 0, sell.minAmount || 0);
      const matchedMax = Math.min(buy.maxAmount || 0, sell.maxAmount || 0);
      const executable = matchedMin > 0 && matchedMax >= matchedMin;
      if (!executable) continue;

      // Tamaño de operación: el máximo del rango matched
      const operationSize = matchedMax;

      // Cálculo financiero
      const grossSpread = sell.price - buy.price; // por unidad, en fiat
      const grossSpreadPercent = (grossSpread / buy.price) * 100;

      // Fee de retiro en fiat
      // (cross-exchange: hay que transferir el cripto de un exchange a otro)
      // (intra-exchange: no hay transferencia, withdrawalFee = 0)
      const withdrawalFeeFiat = crossExchange
        ? withdrawalFeeAsset * buy.price
        : 0;

      // Cálculo completo
      const unitsBought = operationSize / buy.price;
      const grossRevenue = unitsBought * sell.price;
      const grossProfit = grossRevenue - operationSize;
      const netProfit = grossProfit - withdrawalFeeFiat;
      const netSpreadPercent = (netProfit / operationSize) * 100;

      // === PASO 6: Filtrar netSpread ≥ 0.1% y profit > 0 ===
      if (netSpreadPercent < minNetSpreadPercent) continue;
      if (netProfit <= 0) continue;

      // Spot reference
      let spotReference: P2PArbitrageOpportunityV2["spotReference"] = null;
      if (spotRef && spotRef.lastPrice > 0) {
        if (isLocalFiat) {
          const fiatRates: Record<string, number> = {
            COP: 4100, MXN: 18.5, ARS: 950, BRL: 5.05, CLP: 950, PEN: 3.75, VES: 36, DOP: 58,
          };
          const rate = fiatRates[fiat] || 1;
          spotReference = {
            provider: spotRef.providerName,
            price: spotRef.lastPrice * rate,
            note: `Precio spot ${asset}/USD → ${fiat} (~${rate})`,
          };
        } else {
          spotReference = {
            provider: spotRef.providerName,
            price: spotRef.lastPrice,
            note: `Precio spot ${asset}/${fiat}`,
          };
        }
      }

      // Warnings
      const warnings: string[] = [];
      if (type === "INTRA-EXCHANGE") {
        warnings.push("Arbitraje INTRA-exchange: misma plataforma, 2 advertisers distintos.");
        warnings.push("Más simple — no hay transferencia entre exchanges (fee retiro = 0).");
      } else {
        warnings.push(`Arbitraje CROSS-exchange: comprar en ${buy.providerName}, vender en ${sell.providerName}.`);
        warnings.push(`Transfiere ${asset} vía ${withdrawalNetwork} (${withdrawalFeeAsset} ${asset} ≈ ${withdrawalFeeFiat.toFixed(2)} ${fiat} fee).`);
        warnings.push("Necesitas cuenta verificada (KYC) en ambos exchanges.");
        warnings.push("Mientras la transferencia se confirma (5-30 min), el precio SELL puede cambiar.");
      }
      warnings.push("El advertiser de venta debe estar ONLINE y disponible.");
      if (netSpreadPercent < 1) {
        warnings.push(`⚠️ Spread bajo (${netSpreadPercent.toFixed(2)}%): una fluctuación pequeña elimina la ganancia.`);
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
        rank: 0, // se asigna después del sort
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
        type,
        crossExchange,
        matchedRange: {
          min: matchedMin,
          max: matchedMax,
          executable,
        },
        operationSize,
        grossSpread,
        grossSpreadPercent,
        withdrawalFee: crossExchange ? withdrawalFeeAsset : 0,
        withdrawalFeeFiat,
        netProfit,
        netSpreadPercent,
        unitsBought,
        grossRevenue,
        grossProfit,
        spotReference,
        timestamp: Date.now(),
        warnings,
      });
    }
  }

  // === PASO 7: Ordenar por net spread descendente ===
  opportunities.sort((a, b) => b.netSpreadPercent - a.netSpreadPercent);

  // Asignar rank
  opportunities.forEach((o, i) => {
    o.rank = i + 1;
  });

  // === PASO 8: Devolver top 30 ===
  const finalOpportunities = opportunities.slice(0, maxOpportunities);

  return {
    opportunities: finalOpportunities,
    buyOffers,
    sellOffers,
    filteredBuy,
    filteredSell,
    spotRef,
    spotProviders,
    p2pProviders,
    stats: {
      totalBuyOffers: buyOffers.length,
      totalSellOffers: sellOffers.length,
      afterReputationFilterBuy: filteredBuy.length,
      afterReputationFilterSell: filteredSell.length,
      topNBuy: topBuy.length,
      topNSell: topSell.length,
      crossMatched: topBuy.length * topSell.length,
      afterNetSpreadFilter: opportunities.length,
      finalOpportunities: finalOpportunities.length,
    },
  };
}
