// ============================================================
// P2P ARBITRAGE ENGINE — Algoritmo completo según spec
// ============================================================
// 1. Fetch paralelo (8 requests): 4 exchanges × 2 lados (BUY/SELL)
//    - Binance P2P: BUY+SELL
//    - OKX P2P: BUY+SELL
//    - Bybit P2P: BUY+SELL
//    - Kraken Spot: solo si asset != USDT (GET ticker = 1 req en lugar de 2)
//
// 2. Filtro de reputación: solo completionRate >= 80%
//    - Si completionRate es null/undefined → excluir (anti-estafa)
//
// 3. Conversión de precios Kraken (USDT → fiat local)
//    - FX_rate = promedio P2P / 1 USDT
//    - precio_kraken_fiat = precio_kraken_USDT × FX_rate
//
// 4. Sort: BUY asc (más barato primero), SELL desc (más caro primero)
//
// 5. Cross-match: top 12 BUY × top 12 SELL = 144 combinaciones
//    - Skip mismo merchant y mismo exchange
//    - Skip si sellPrice <= buyPrice
//    - Calcular:
//      grossSpreadPct = (sellPrice - buyPrice) / buyPrice × 100
//      withdrawalFee = fee del exchange donde se compró
//      withdrawalFeeFiat = withdrawalFee × sellPrice
//      operationFiatAmount = min(buyMax, sellMax, buyLiquidity, sellLiquidity)
//      operationAssetAmount = operationFiatAmount / buyPrice
//      grossProfit = (sellPrice - buyPrice) × operationAssetAmount
//      netProfit = grossProfit - withdrawalFeeFiat
//      netSpreadPct = netProfit / (operationAssetAmount × buyPrice) × 100
//    - Filtrar: netSpreadPct >= 0.1% Y netProfit > 0
//    - Buscar método de pago común entre BUY y SELL
//
// 6. Ordenar por netSpreadPct desc, devolver top 30
// ============================================================

import { fetchBinanceP2PAds, buildBinanceDirectUrl, type BinanceP2PAd } from "../api-clients/binance-p2p";
import { fetchOkxP2PAds, buildOkxDirectUrl, type OkxP2PAd } from "../api-clients/okx-p2p";
import { fetchBybitP2PAds, buildBybitDirectUrl, type BybitP2PAd } from "../api-clients/bybit-p2p";
import { fetchKrakenSpot, krakenCanTrade, type KrakenQuote } from "../api-clients/kraken-spot";
import { getWithdrawalFee } from "../api-clients/catalog";

// ============================================================
// TIPOS
// ============================================================

export type Exchange = "Binance" | "OKX" | "Bybit" | "Kraken";

interface NormalizedAd {
  exchange: Exchange;
  side: "BUY" | "SELL";
  price: number;
  advertiserName: string;
  completionRate: number | null;
  minAmount: number;
  maxAmount: number;
  availableQty: number;
  paymentMethods: string[];
  tradeCount: number;
  proMerchant?: boolean;
  advertiserUserNo?: string;
}

export interface ArbitrageOpportunity {
  id: string;
  asset: string;
  fiat: string;
  // BUY side
  buyExchange: Exchange;
  buyPrice: number;
  buyMerchant: string;
  buyMerchantReputation: number;
  buyMerchantOrderCount: number;
  buyMerchantPro: boolean;
  buyPaymentMethods: string[];
  buyMinAmount: number;
  buyMaxAmount: number;
  buyAvailableQty: number;
  buyDirectUrl: string;
  // SELL side
  sellExchange: Exchange;
  sellPrice: number;
  sellMerchant: string;
  sellMerchantReputation: number;
  sellMerchantOrderCount: number;
  sellMerchantPro: boolean;
  sellPaymentMethods: string[];
  sellMinAmount: number;
  sellMaxAmount: number;
  sellAvailableQty: number;
  sellDirectUrl: string;
  // Métricas
  commonPaymentMethod: string | null;
  grossSpreadPct: number;
  withdrawalFee: number; // asset units
  withdrawalFeeFiat: number;
  feesPct: number;
  operationFiatAmount: number;
  operationAssetAmount: number;
  netSpreadPct: number;
  netProfitForOperation: number;
  netProfitOn1000: number; // profit per $1000 USD equivalent
  isProfitable: boolean;
  // Tipo
  type: "P2P-P2P" | "P2P-Spot" | "Spot-P2P";
}

export interface ArbitrageResponse {
  success: boolean;
  opportunities: ArbitrageOpportunity[];
  totalFound: number;
  quotes: Record<string, { buy: number; sell: number }>;
  exchangesScanned: string[];
  reputation: {
    minRequired: number;
    merchantsFilteredOut: number;
    merchantsBeforeFilter: number;
    merchantsAfterFilter: number;
  };
  asset: string;
  fiat: string;
  timestamp: number;
  // Debug info: cuántos ads trajo cada exchange ANTES del filtro de reputation
  rawAdsByExchange?: Record<string, number>;
  // Diversidad de exchanges en las opportunities finales
  exchangesInOpportunities?: {
    buy: string[];
    sell: string[];
    uniquePairs: string[];
  };
}

// ============================================================
// MOTOR PRINCIPAL
// ============================================================

const TOP_N = 12; // top 12 BUY × top 12 SELL = 144 combinaciones max
const MIN_NET_SPREAD_PCT = 0.1;
// FX rate aproximado: USD → cada fiat local. Se usa para calcular el mínimo
// de operación en fiat local (equivalente a $200 USD).
const FX_USD_TO_FIAT: Record<string, number> = {
  COP: 4100, ARS: 950, BRL: 5.05, MXN: 18.5, EUR: 0.92, USD: 1,
  PEN: 3.75, CLP: 950, VES: 36, DOP: 58,
};
const MIN_OPERATION_USD = 200; // mínimo $200 USD equiv o minAmount del merchant
const MAX_OPPORTUNITIES = 30;

export async function scanP2PArbitrage(params: {
  asset: string;
  fiat: string;
  rows?: number;
  payment?: string;
  exchanges?: string; // "binance,okx,bybit,kraken"
  minReputation?: number; // 0-100
  minNetSpread?: number;
}): Promise<ArbitrageResponse> {
  const {
    asset,
    fiat,
    rows = 15,
    payment,
    exchanges = "binance,okx,bybit,kraken",
    minReputation = 80,
    minNetSpread = MIN_NET_SPREAD_PCT,
  } = params;

  const enabledExchanges = exchanges.split(",").map((e) => e.trim().toLowerCase());
  const reputationThreshold = minReputation / 100;

  // === PASO 1: Fetch paralelo (8 requests) ===
  const tasks: Promise<NormalizedAd[]>[] = [];

  // Binance P2P: BUY + SELL
  if (enabledExchanges.includes("binance")) {
    tasks.push(fetchBinanceP2PAds({ asset, fiat, side: "BUY", rows, payment }).then(ads => ads.map(a => ({ ...a, proMerchant: a.proMerchant, advertiserUserNo: a.advertiserUserNo }))));
    tasks.push(fetchBinanceP2PAds({ asset, fiat, side: "SELL", rows, payment }).then(ads => ads.map(a => ({ ...a, proMerchant: a.proMerchant, advertiserUserNo: a.advertiserUserNo }))));
  }

  // OKX P2P: BUY + SELL
  if (enabledExchanges.includes("okx")) {
    tasks.push(fetchOkxP2PAds({ asset, fiat, side: "BUY", payment }).then(ads => ads.map(a => ({ ...a, proMerchant: a.creatorType === "merchant" || a.creatorType === "certified" }))));
    tasks.push(fetchOkxP2PAds({ asset, fiat, side: "SELL", payment }).then(ads => ads.map(a => ({ ...a, proMerchant: a.creatorType === "merchant" || a.creatorType === "certified" }))));
  }

  // Bybit P2P: BUY + SELL
  if (enabledExchanges.includes("bybit")) {
    tasks.push(fetchBybitP2PAds({ asset, fiat, side: "BUY", size: rows }));
    tasks.push(fetchBybitP2PAds({ asset, fiat, side: "SELL", size: rows }));
  }

  // Kraken Spot: 1 request (GET ticker) si asset != USDT
  let krakenQuote: KrakenQuote | null = null;
  if (enabledExchanges.includes("kraken") && krakenCanTrade(asset)) {
    krakenQuote = await fetchKrakenSpot(asset, "USDT");
  }

  const allResults = await Promise.all(tasks);
  const flatResults = allResults.flat();
  const merchantsBeforeFilter = flatResults.length;

  // === PASO 2: Filtro de reputación (completionRate >= 80%) ===
  // Excluir null/undefined (anti-estafa)
  const filteredAds = flatResults.filter((ad) => {
    // Kraken no tiene reputación, siempre se incluye
    if (ad.exchange === "Kraken") return true;
    if (ad.completionRate === null || ad.completionRate === undefined) return false;
    return ad.completionRate >= reputationThreshold;
  });
  const merchantsFilteredOut = merchantsBeforeFilter - filteredAds.length;
  const merchantsAfterFilter = filteredAds.length;

  // Separar BUY y SELL
  let buyAds = filteredAds.filter((a) => a.side === "BUY");
  let sellAds = filteredAds.filter((a) => a.side === "SELL");

  // === PASO 3: Conversión de precios Kraken (USDT → fiat local) ===
  // Si tenemos Kraken, su precio está en USDT. Convertir a fiat local usando
  // el FX implícito del mercado P2P (promedio precios P2P / 1 USDT).
  if (krakenQuote && krakenQuote.last > 0) {
    // FX_rate = promedio P2P / 1 USDT (solo para USDT; para otros assets
    // Kraken devuelve precio en USDT y necesitamos convertir a fiat local)
    // Para asset != USDT, el FX se calcula como: avgP2P / krakenSpotUSDT
    const allPrices = [...buyAds.map(a => a.price), ...sellAds.map(a => a.price)];
    const avgP2P = allPrices.length > 0 ? allPrices.reduce((s, p) => s + p, 0) / allPrices.length : 0;
    const krakenPriceUSDT = krakenQuote.last;

    if (asset.toUpperCase() === "USDT") {
      // Caso especial: kraken no debería estar aquí (krakenCanTrade=false para USDT)
      // Pero por seguridad lo dejamos
    } else {
      // FX_rate = avgP2P / krakenSpotUSDT (ej: 300M COP / 80K USDT = 3750 COP/USDT)
      const fxRate = avgP2P > 0 && krakenPriceUSDT > 0 ? avgP2P / krakenPriceUSDT : 0;
      if (fxRate > 0) {
        // Convertir bid y ask de Kraken a fiat local
        const krakenAskFiat = krakenQuote.ask * fxRate; // precio que pagas al comprar
        const krakenBidFiat = krakenQuote.bid * fxRate; // precio que recibes al vender
        // Como "BUY" en Kraken: pagas el ask (comprar al precio de venta)
        // Como "SELL" en Kraken: recibes el bid (vender al precio de compra)
        const krakenBuyAd: NormalizedAd = {
          exchange: "Kraken",
          side: "BUY",
          price: krakenAskFiat,
          advertiserName: "Kraken Spot",
          completionRate: null,
          minAmount: 0,
          maxAmount: Number.MAX_SAFE_INTEGER,
          availableQty: krakenQuote.volume24hBase,
          paymentMethods: [],
          tradeCount: 0,
        };
        const krakenSellAd: NormalizedAd = {
          ...krakenBuyAd,
          side: "SELL",
          price: krakenBidFiat,
        };
        buyAds.push(krakenBuyAd);
        sellAds.push(krakenSellAd);
      }
    }
  }

  // === PASO 4: Sort ===
  const sortedBuy = [...buyAds].sort((a, b) => a.price - b.price); // BUY asc
  const sortedSell = [...sellAds].sort((a, b) => b.price - a.price); // SELL desc

  // === PASO 5: Cross-match con DIVERSIDAD GARANTIZADA por exchange
  // Si solo usamos top 12 global, todos serían del exchange con precio más bajo/caros
  // (ej: OKX tiene 1719 COP fake que domina los 12 BUY, dejando Binance/Bybit fuera).
  //
  // SOLUCIÓN: Top N por EXCHANGE, no global.
  // - Si hay 4 exchanges habilitados → top 3 por exchange = 12 (garantiza 4 BUY de cada)
  // - Si hay 1 exchange habilitado → top 12 de ese exchange (mantiene comportamiento original)
  const EXCHANGES_PER_SIDE = Math.max(3, Math.ceil(TOP_N / enabledExchanges.length));
  const perExchangeBuy = TOP_N;
  const perExchangeSell = TOP_N;

  // Tomar top N por cada exchange, garantizando que cada exchange tenga representación
  const topBuy: NormalizedAd[] = [];
  const topSell: NormalizedAd[] = [];
  const buySeen = new Set<string>();
  const sellSeen = new Set<string>();
  const uniqueExchanges = [...new Set([
    ...sortedBuy.map(a => a.exchange),
    ...sortedSell.map(a => a.exchange),
  ])];

  // Round-robin: ir tomando de cada exchange
  // while topBuy.length < TOP_N o ya no haya más
  let added = true;
  while (added && (topBuy.length < TOP_N || topSell.length < TOP_N)) {
    added = false;
    for (const ex of uniqueExchanges) {
      if (topBuy.length >= TOP_N) break;
      const nextBuy = sortedBuy.find(a =>
        a.exchange === ex && !buySeen.has(`${ex}-${a.advertiserName}-${a.price}`)
      );
      if (nextBuy) {
        topBuy.push(nextBuy);
        buySeen.add(`${nextBuy.exchange}-${nextBuy.advertiserName}-${nextBuy.price}`);
        added = true;
      }
    }
    for (const ex of uniqueExchanges) {
      if (topSell.length >= TOP_N) break;
      const nextSell = sortedSell.find(a =>
        a.exchange === ex && !sellSeen.has(`${ex}-${a.advertiserName}-${a.price}`)
      );
      if (nextSell) {
        topSell.push(nextSell);
        sellSeen.add(`${nextSell.exchange}-${nextSell.advertiserName}-${nextSell.price}`);
        added = true;
      }
    }
  }

  // Fallback: si no hay suficientes con round-robin, llenar con los mejores globales
  if (topBuy.length < TOP_N) {
    for (const a of sortedBuy) {
      if (topBuy.length >= TOP_N) break;
      const key = `${a.exchange}-${a.advertiserName}-${a.price}`;
      if (!buySeen.has(key)) {
        topBuy.push(a);
        buySeen.add(key);
      }
    }
  }
  if (topSell.length < TOP_N) {
    for (const a of sortedSell) {
      if (topSell.length >= TOP_N) break;
      const key = `${a.exchange}-${a.advertiserName}-${a.price}`;
      if (!sellSeen.has(key)) {
        topSell.push(a);
        sellSeen.add(key);
      }
    }
  }

  const opportunities: ArbitrageOpportunity[] = [];

  for (const buy of topBuy) {
    for (const sell of topSell) {
      // Skip si mismo merchant y mismo exchange
      if (buy.exchange === sell.exchange && buy.advertiserName === sell.advertiserName) continue;
      // Skip si sellPrice <= buyPrice
      if (sell.price <= buy.price) continue;

      //grossSpreadPct
      const grossSpreadPct = ((sell.price - buy.price) / buy.price) * 100;

      // Withdrawal fee (del exchange donde se compró)
      const withdrawalFeeAsset = getWithdrawalFee(buy.exchange, asset);
      const withdrawalFeeFiat = withdrawalFeeAsset * sell.price;

      // operationFiatAmount = min(buyMax, sellMax, buyLiquidity, sellLiquidity)
      // buyLiquidity y sellLiquidity son los maxAmount disponibles en fiat
      // (convertir availableQty de asset a fiat)
      const buyLiquidityFiat = buy.availableQty * buy.price;
      const sellLiquidityFiat = sell.availableQty * sell.price;
      const opByLimits = Math.min(
        buy.maxAmount,
        sell.maxAmount,
        buyLiquidityFiat,
        sellLiquidityFiat,
      );
      // Si los maxAmount son MAX_SAFE_INTEGER (Kraken), usar min(buyMax, sellMax) = sellMax
      const operationFiatAmount = opByLimits > 0 ? opByLimits : 0;

      // Límite mínimo: $200 USD equivalente en fiat local, o minAmount de ambos merchants
      // CORRECCIÓN: antes comparaba 200 (USD) con operationFiatAmount (COP) directamente.
      // Ahora convertimos $200 USD a fiat local con FX_USD_TO_FIAT.
      const fxRate = FX_USD_TO_FIAT[fiat.toUpperCase()] || 1;
      const minOpFiat = MIN_OPERATION_USD * fxRate;
      const minAmountBoth = Math.max(buy.minAmount, sell.minAmount);
      const effectiveMin = Math.max(minAmountBoth, minOpFiat);
      if (operationFiatAmount < effectiveMin) continue;

      // operationAssetAmount = operationFiatAmount / buyPrice
      const operationAssetAmount = buy.price > 0 ? operationFiatAmount / buy.price : 0;
      if (operationAssetAmount <= 0) continue;

      // grossProfit = (sellPrice - buyPrice) × operationAssetAmount
      const grossProfit = (sell.price - buy.price) * operationAssetAmount;

      // netProfit = grossProfit - withdrawalFeeFiat
      const netProfit = grossProfit - withdrawalFeeFiat;

      // netSpreadPct = netProfit / (operationAssetAmount × buyPrice) × 100
      const netSpreadPct = operationAssetAmount * buy.price > 0
        ? (netProfit / (operationAssetAmount * buy.price)) * 100
        : 0;

      // feesPct = withdrawalFeeFiat / (operationAssetAmount × buyPrice) × 100
      const feesPct = operationAssetAmount * buy.price > 0
        ? (withdrawalFeeFiat / (operationAssetAmount * buy.price)) * 100
        : 0;

      // Filtrar: netSpreadPct >= 0.1% Y netProfit > 0
      if (netSpreadPct < minNetSpread) continue;
      if (netProfit <= 0) continue;

      // Buscar método de pago común (si ambos son P2P)
      let commonPaymentMethod: string | null = null;
      const isP2PBuy = buy.exchange !== "Kraken";
      const isP2PSell = sell.exchange !== "Kraken";
      if (isP2PBuy && isP2PSell) {
        const common = buy.paymentMethods.find((p) => sell.paymentMethods.includes(p));
        commonPaymentMethod = common || null;
        // Si payment filter activo y no hay método común, igual lo mostramos
        // (el usuario puede usar múltiples métodos)
      }

      // netProfitOn1000: profit per $1000 USD equivalent (in fiat)
      // Asumiendo que operationAssetAmount × buyPrice ~ operationFiatAmount
      // netProfitOn1000 = (netProfit / operationFiatAmount) × 1000 (en USD-fiat)
      const netProfitOn1000 = operationFiatAmount > 0
        ? (netProfit / operationFiatAmount) * 1000
        : 0;

      // Tipo de arbitraje
      let type: "P2P-P2P" | "P2P-Spot" | "Spot-P2P" = "P2P-P2P";
      if (buy.exchange === "Kraken" && isP2PSell) type = "Spot-P2P";
      else if (isP2PBuy && sell.exchange === "Kraken") type = "P2P-Spot";

      // URLs directas
      const buyDirectUrl = buildDirectUrl(buy.exchange, asset, fiat, "BUY", buy.advertiserUserNo, payment);
      const sellDirectUrl = buildDirectUrl(sell.exchange, asset, fiat, "SELL", sell.advertiserUserNo, payment);

      opportunities.push({
        id: `${buy.exchange}-${buy.advertiserName}-TO-${sell.exchange}-${sell.advertiserName}-${asset}-${fiat}`,
        asset,
        fiat,
        buyExchange: buy.exchange,
        buyPrice: buy.price,
        buyMerchant: buy.advertiserName,
        buyMerchantReputation: (buy.completionRate ?? 0) * 100,
        buyMerchantOrderCount: buy.tradeCount,
        buyMerchantPro: buy.proMerchant ?? false,
        buyPaymentMethods: buy.paymentMethods,
        buyMinAmount: buy.minAmount,
        buyMaxAmount: buy.maxAmount,
        buyAvailableQty: buy.availableQty,
        buyDirectUrl,
        sellExchange: sell.exchange,
        sellPrice: sell.price,
        sellMerchant: sell.advertiserName,
        sellMerchantReputation: (sell.completionRate ?? 0) * 100,
        sellMerchantOrderCount: sell.tradeCount,
        sellMerchantPro: sell.proMerchant ?? false,
        sellPaymentMethods: sell.paymentMethods,
        sellMinAmount: sell.minAmount,
        sellMaxAmount: sell.maxAmount,
        sellAvailableQty: sell.availableQty,
        sellDirectUrl,
        commonPaymentMethod,
        grossSpreadPct,
        withdrawalFee: withdrawalFeeAsset,
        withdrawalFeeFiat,
        feesPct,
        operationFiatAmount,
        operationAssetAmount,
        netSpreadPct,
        netProfitForOperation: netProfit,
        netProfitOn1000,
        isProfitable: netProfit > 0,
        type,
      });
    }
  }

  // === PASO 6: Ordenar por netSpreadPct desc, top 30 ===
  opportunities.sort((a, b) => b.netSpreadPct - a.netSpreadPct);
  const topOpportunities = opportunities.slice(0, MAX_OPPORTUNITIES);

  // Stats de quotes por exchange
  // IMPORTANTE: los ads tienen exchange: "Binance"|"OKX"|"Bybit"|"Kraken" (case-sensitive)
  // No usar toUpperCase genérico que rompe OKX → Okx
  const EXCHANGE_NAME_MAP: Record<string, Exchange> = {
    binance: "Binance",
    okx: "OKX",
    bybit: "Bybit",
    kraken: "Kraken",
  };
  const quotes: Record<string, { buy: number; sell: number }> = {};
  for (const ex of enabledExchanges) {
    const exName = EXCHANGE_NAME_MAP[ex.toLowerCase()] || (ex.charAt(0).toUpperCase() + ex.slice(1));
    const buyCount = buyAds.filter((a) => a.exchange === exName).length;
    const sellCount = sellAds.filter((a) => a.exchange === exName).length;
    quotes[exName] = { buy: buyCount, sell: sellCount };
  }
  // Kraken puede tener 1 quote
  if (krakenQuote) {
    quotes["Kraken"] = { buy: 1, sell: 1 };
  }

  // Debug: cuántos ads trajo cada exchange ANTES del filtro de reputation
  const rawAdsByExchange: Record<string, number> = {};
  for (const ad of flatResults) {
    rawAdsByExchange[ad.exchange] = (rawAdsByExchange[ad.exchange] || 0) + 1;
  }

  // Diversidad: qué exchanges aparecen en las opportunities finales
  const buySet = new Set<string>();
  const sellSet = new Set<string>();
  const pairSet = new Set<string>();
  for (const o of topOpportunities) {
    buySet.add(o.buyExchange);
    sellSet.add(o.sellExchange);
    pairSet.add(`${o.buyExchange}→${o.sellExchange}`);
  }

  return {
    success: true,
    opportunities: topOpportunities,
    totalFound: opportunities.length,
    quotes,
    exchangesScanned: enabledExchanges,
    reputation: {
      minRequired: minReputation,
      merchantsFilteredOut,
      merchantsBeforeFilter,
      merchantsAfterFilter,
    },
    asset,
    fiat,
    timestamp: Date.now(),
    rawAdsByExchange,
    exchangesInOpportunities: {
      buy: Array.from(buySet),
      sell: Array.from(sellSet),
      uniquePairs: Array.from(pairSet),
    },
  };
}

// ============================================================
// Helper: construir URL directa
// ============================================================
function buildDirectUrl(
  exchange: Exchange,
  asset: string,
  fiat: string,
  side: "BUY" | "SELL",
  advertiserUserNo?: string,
  payment?: string,
): string {
  switch (exchange) {
    case "Binance":
      return buildBinanceDirectUrl({ asset, fiat, side, payment });
    case "OKX":
      return buildOkxDirectUrl({ asset, fiat, side });
    case "Bybit":
      return buildBybitDirectUrl({ asset, fiat, side });
    case "Kraken":
      return `https://www.kraken.com/prices/${asset.toLowerCase()}`;
    default:
      return "#";
  }
}
