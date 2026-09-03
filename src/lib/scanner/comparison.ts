// ============================================================
// COMPARISON + COST CALCULATOR + RANKING ENGINE
// ============================================================
// Calcula costo total (precio + comisión + costo de red)
// Rankea opciones según mejor precio, comisión, liquidez, etc.
// ============================================================

import type { MarketQuote, P2POffer, RankedResult, ArbitrageOpportunity } from "./types";

// Comisiones estimadas por provider (data de documentación oficial pública).
// Estos son valores promedio para spot trading. Cambian según tier de usuario.
// En una implementación más sofisticada, se podrían obtener dinámicamente.
const PROVIDER_FEES: Record<string, { makerPercent: number; takerPercent: number; notes: string }> = {
  binance: { makerPercent: 0.1, takerPercent: 0.1, notes: "Spot taker/maker 0.1%. P2P sin comisión de Binance." },
  okx: { makerPercent: 0.08, takerPercent: 0.1, notes: "Spot 0.08-0.1% según tier." },
  bybit: { makerPercent: 0.1, takerPercent: 0.1, notes: "Spot 0.1% (cuando está disponible — geo-blocked en Vercel)." },
  kraken: { makerPercent: 0.16, takerPercent: 0.26, notes: "Spot 0.16% maker / 0.26% taker base." },
  coinbase: { makerPercent: 0.4, takerPercent: 0.6, notes: "Coinbase Advanced base. Coinbase App tiene fees más altos." },
  kucoin: { makerPercent: 0.1, takerPercent: 0.1, notes: "Spot 0.1% base. KuCoin Level 0 sin KYC = 0.1%." },
  gate: { makerPercent: 0.1, takerPercent: 0.2, notes: "Spot 0.2% taker / 0.1% maker base." },
  mexc: { makerPercent: 0.1, takerPercent: 0.2, notes: "Spot 0.2% taker / 0.1% maker base. Sin KYC = mismos fees." },
  htx: { makerPercent: 0.2, takerPercent: 0.2, notes: "Spot 0.2% base. Maker discount disponible." },
  bitget: { makerPercent: 0.02, takerPercent: 0.05, notes: "Spot 0.05% taker / 0.02% maker — uno de los más baratos." },
  coingecko: { makerPercent: 0, takerPercent: 0, notes: "Agregador, no aplica comisión (solo referencia)." },
};

// Para BUY: el usuario paga el ask. Para SELL: el usuario recibe el bid.
// P2P no tiene ask/bid; usa el precio del advertiser directamente.

export function calculateQuoteResult(quote: MarketQuote, operation: "BUY" | "SELL", amount: number): RankedResult {
  const provider = quote.provider;
  const feeInfo = PROVIDER_FEES[provider] || { makerPercent: 0, takerPercent: 0, notes: "Comisión no disponible" };

  // Precio efectivo: ask si BUY, bid si SELL. Si no hay bid/ask, usar lastPrice.
  const isBuy = operation === "BUY";
  const price = isBuy
    ? quote.askPrice || quote.lastPrice
    : quote.bidPrice || quote.lastPrice;

  // Comisión: taker si compra/vende inmediatamente al libro
  const grossCost = isBuy ? price * amount : price * amount; // mismo cálculo, dirección cambia el efecto
  const fee = (grossCost * feeInfo.takerPercent) / 100;

  // Costo de red: para spot en exchanges no aplica (es off-chain). 0 para estos providers.
  const networkCost = 0;

  // Costo total: para BUY, el usuario paga precio + fee. Para SELL, recibe precio - fee.
  const totalCost = isBuy ? grossCost + fee : grossCost - fee;
  const effectivePrice = totalCost / amount;

  return {
    rank: 0, // se asigna después
    provider: quote.provider,
    providerName: quote.providerName,
    operation,
    asset: quote.asset,
    fiat: quote.quoteCurrency,
    price,
    amount,
    grossCost,
    fee,
    feeCurrency: quote.quoteCurrency,
    networkCost,
    totalCost,
    totalCostCurrency: quote.quoteCurrency,
    effectivePrice,
    spread: quote.spread,
    spreadPercent: quote.spreadPercent,
    liquidity: quote.quoteVolume24h,
    estimatedTime: "Inmediato (spot)",
    kycRequired: quote.kycLevel === "MANDATORY",
    kycLevel: quote.kycLevel,
    kycNote: feeInfo.notes,
    liquidityTier: quote.liquidityTier,
    timestamp: quote.timestamp,
    source: `${quote.providerName} API`,
    latencyMs: quote.latencyMs,
    status: quote.status,
  };
}

export function calculateP2PResult(offer: P2POffer, amount: number): RankedResult {
  // P2P: el advertiser fija el precio. Sin comisión de exchange (Binance no cobra P2P).
  const grossCost = offer.price * amount;
  const fee = 0; // Binance P2P no cobra al usuario (es advertiser quien paga eventualmente)
  const networkCost = 0; // off-blockchain hasta que retiren, el usuario paga gas local luego

  return {
    rank: 0,
    provider: offer.provider,
    providerName: offer.providerName,
    operation: offer.tradeType,
    asset: offer.asset,
    fiat: offer.fiat,
    price: offer.price,
    amount,
    grossCost,
    fee,
    feeCurrency: offer.fiat,
    networkCost,
    totalCost: grossCost,
    totalCostCurrency: offer.fiat,
    effectivePrice: offer.price,
    paymentMethods: offer.paymentMethods,
    estimatedTime: "15-60 min (negociación con advertiser)",
    kycRequired: false, // P2P: el advertiser está verificado, tú no necesitas KYC
    kycLevel: "NO_KYC", // P2P desde la perspectiva del usuario final
    kycNote: "P2P: el advertiser está verificado por Binance. Tú no necesitas KYC de Binance.",
    liquidityTier: "MEDIUM", // Binance P2P tiene alta liquidez
    timestamp: offer.timestamp,
    source: `${offer.providerName} P2P API`,
    latencyMs: offer.latencyMs,
    status: offer.status,
  };
}

// Ranking engine: ordena y asigna badges según criterios
export function rankResults(results: RankedResult[], sortBy: "totalCost" | "fee" | "liquidity" = "totalCost"): RankedResult[] {
  // Solo ranker los que están ONLINE
  const valid = results.filter((r) => r.status === "ONLINE" && r.totalCost > 0);
  const invalid = results.filter((r) => r.status !== "ONLINE" || r.totalCost <= 0);

  // Sort
  const sorted = [...valid].sort((a, b) => {
    if (sortBy === "fee") return a.fee - b.fee;
    if (sortBy === "liquidity") return (b.liquidity || 0) - (a.liquidity || 0);
    // default: totalCost ascendente (menor costo = mejor)
    return a.totalCost - b.totalCost;
  });

  // Asignar rank + badges
  const ranked = sorted.map((r, idx) => {
    let badge: RankedResult["badge"] = undefined;
    let reason = "";

    if (idx === 0) {
      badge = "BEST";
      reason = `Mejor costo total: ${r.totalCost.toFixed(2)} ${r.totalCostCurrency}. Comisión ${r.fee.toFixed(2)} ${r.feeCurrency || ""}. Fuente: ${r.source}.`;
    } else {
      reason = `Costo total: ${r.totalCost.toFixed(2)} ${r.totalCostCurrency}. ${r.providerName} (${r.latencyMs}ms).`;
    }

    return {
      ...r,
      rank: idx + 1,
      badge,
      reason,
    };
  });

  // Marcar extras: cheapest fee, most liquid, no kyc
  if (ranked.length > 1) {
    const minFee = Math.min(...valid.map((r) => r.fee));
    const cheapest = ranked.find((r) => r.fee === minFee && r.rank > 1);
    if (cheapest && cheapest.fee < (ranked[0]?.fee || Infinity)) {
      cheapest.badge = "CHEAPEST";
      cheapest.reason = `Menor comisión: ${cheapest.fee.toFixed(2)} ${cheapest.feeCurrency}. Costo total: ${cheapest.totalCost.toFixed(2)} ${cheapest.totalCostCurrency}.`;
    }

    const maxLiq = Math.max(...valid.map((r) => r.liquidity || 0));
    const mostLiquid = ranked.find((r) => r.liquidity === maxLiq && r.rank > 1);
    if (mostLiquid) {
      mostLiquid.badge = "MOST_LIQUID";
      mostLiquid.reason = `Mayor liquidez 24h: ${(mostLiquid.liquidity || 0).toLocaleString()} ${mostLiquid.totalCostCurrency}.`;
    }

    // Badge NO_KYC: si el rank 1 NO es NO_KYC pero hay otros que sí, marcar el primero
    const firstNoKyc = ranked.find((r) => (r.kycLevel === "NO_KYC" || r.kycLevel === "OPTIONAL") && r.rank > 1);
    if (firstNoKyc && ranked[0]?.kycLevel === "MANDATORY") {
      firstNoKyc.badge = "NO_KYC";
      firstNoKyc.reason = `Mejor opción SIN KYC obligatorio: ${firstNoKyc.providerName}. ${firstNoKyc.kycLevel === "OPTIONAL" ? "KYC opcional para límites más altos." : "No requiere KYC."} Costo total: ${firstNoKyc.totalCost.toFixed(2)} ${firstNoKyc.totalCostCurrency}.`;
    }
  }

  return [...ranked, ...invalid];
}

// ============================================================
// Arbitrage Scanner
// ============================================================
// Detecta diferencias de precio entre providers para un mismo activo.
// No promete ganancia; muestra supuestos.
// ============================================================

export function detectArbitrage(quotes: MarketQuote[], capital: number = 1000): ArbitrageOpportunity[] {
  // Para arbitraje necesitamos al menos 2 providers con ask y bid válidos
  const valid = quotes.filter((q) => q.status === "ONLINE" && q.bidPrice && q.askPrice && q.bidPrice > 0 && q.askPrice > 0);
  if (valid.length < 2) return [];

  const opportunities: ArbitrageOpportunity[] = [];

  for (let i = 0; i < valid.length; i++) {
    for (let j = 0; j < valid.length; j++) {
      if (i === j) continue;
      const buyAt = valid[i]; // comprar en i
      const sellAt = valid[j]; // vender en j
      // comprar al ask (precio más alto), vender al bid (precio más bajo)
      const buyPrice = buyAt.askPrice!;
      const sellPrice = sellAt.bidPrice!;
      if (sellPrice <= buyPrice) continue;

      const spreadPercent = ((sellPrice - buyPrice) / buyPrice) * 100;
      // Fees: taker en ambos extremos
      const buyFee = (buyPrice * (PROVIDER_FEES[buyAt.provider]?.takerPercent || 0)) / 100;
      const sellFee = (sellPrice * (PROVIDER_FEES[sellAt.provider]?.takerPercent || 0)) / 100;

      const unitsBought = capital / (buyPrice + buyFee);
      const grossSell = unitsBought * sellPrice;
      const feesTotal = buyFee * unitsBought + sellFee * unitsBought;

      const grossProfit = grossSell - capital;
      const netProfit = grossProfit - feesTotal;
      const roiPercent = (netProfit / capital) * 100;

      if (spreadPercent > 0.05) { // solo mostrar si spread > 0.05%
        opportunities.push({
          asset: buyAt.asset,
          buyAt: { provider: buyAt.providerName, price: buyPrice },
          sellAt: { provider: sellAt.providerName, price: sellPrice },
          spreadPercent,
          estimatedProfit: grossProfit,
          estimatedRoiPercent: roiPercent,
          feesEstimated: feesTotal,
          netProfit,
          capital,
          assumptions: [
            `Capital: $${capital} USD`,
            `Compra al ask en ${buyAt.providerName} ($${buyPrice.toFixed(2)})`,
            `Venta al bid en ${sellAt.providerName} ($${sellPrice.toFixed(2)})`,
            `Comisiones taker aplicadas en ambos extremos`,
            `No incluye costos de transferencia entre exchanges`,
            `No incluye slippage real`,
            `Los precios son del momento del escaneo y cambian constantemente`,
          ],
          timestamp: Date.now(),
        });
      }
    }
  }

  // Ordenar por ROI descendente
  return opportunities.sort((a, b) => b.estimatedRoiPercent - a.estimatedRoiPercent);
}
