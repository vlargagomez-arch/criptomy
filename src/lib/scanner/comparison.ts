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
  bingx: { makerPercent: 0.05, takerPercent: 0.1, notes: "Spot 0.1% taker / 0.05% maker base." },
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
  const grossCost = isBuy ? price * amount : price * amount;
  const fee = (grossCost * feeInfo.takerPercent) / 100;

  // Costo de red: para spot en exchanges no aplica (es off-chain). 0 para estos providers.
  const networkCost = 0;

  // Costo total: para BUY, el usuario paga precio + fee. Para SELL, recibe precio - fee.
  const totalCost = isBuy ? grossCost + fee : grossCost - fee;
  const effectivePrice = totalCost / amount;

  // --- Campos humanos ---
  const currency = quote.quoteCurrency;
  const youPay = isBuy ? totalCost : amount;
  const youReceive = isBuy ? amount : totalCost;
  const feeHuman = `${fee.toFixed(2)} ${currency}`;
  const totalCostHuman = `${totalCost.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}`;
  const exchangeRateHuman = `1 ${quote.asset} ≈ ${effectivePrice.toFixed(4)} ${currency}`;

  // Explicación
  const feePct = feeInfo.takerPercent;
  let explanation = "";
  if (isBuy) {
    explanation = `Pagas ${totalCostHuman} y recibes ${amount} ${quote.asset}. `;
    if (feePct === 0) explanation += `Sin comisión de exchange. `;
    else explanation += `Comisión del ${feePct}% incluida (${feeHuman}). `;
    if (quote.kycLevel === "NO_KYC" || quote.kycLevel === "OPTIONAL") explanation += `No requiere KYC obligatorio. `;
    else if (quote.kycLevel === "MANDATORY") explanation += `Requiere verificación KYC. `;
  } else {
    explanation = `Entregas ${amount} ${quote.asset} y recibes ${totalCostHuman}. `;
    if (feePct === 0) explanation += `Sin comisión. `;
    else explanation += `Comisión del ${feePct}% descontada (${feeHuman}). `;
  }

  // Warnings
  const warnings: string[] = [];
  if (quote.liquidityTier === "LOW") warnings.push("Liquidez baja — el precio real puede variar para montos grandes.");
  if (quote.kycLevel === "MANDATORY") warnings.push("Requiere KYC (verificación de identidad).");
  if (quote.spreadPercent && quote.spreadPercent > 0.5) warnings.push(`Spread alto (${quote.spreadPercent.toFixed(2)}%) — diferencia entre precio de compra y venta.`);

  // Pasos
  const steps = isBuy ? [
    `Vas a ${quote.providerName} y creas una cuenta.`,
    `Verificas tu identidad (KYC) si es requerido.`,
    `Depositas ${totalCostHuman} via transferencia/tarjeta.`,
    `Compras ${amount} ${quote.asset} al precio de mercado.`,
    `Retiras los ${quote.asset} a tu wallet personal.`,
  ] : [
    `Vas a ${quote.providerName} y creas una cuenta.`,
    `Depositas ${amount} ${quote.asset} desde tu wallet.`,
    `Vendes al precio de mercado.`,
    `Recibes ${totalCostHuman} (después de comisiones).`,
    `Retiras el dinero a tu banco.`,
  ];

  return {
    rank: 0,
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
    youPay,
    youReceive,
    feeHuman,
    totalCostHuman,
    exchangeRateHuman,
    explanation,
    warnings,
    steps,
  };
}

export function calculateP2PResult(offer: P2POffer, amount: number): RankedResult {
  const grossCost = offer.price * amount;
  const fee = 0;
  const networkCost = 0;
  const currency = offer.fiat;
  const isBuy = offer.tradeType === "BUY";

  const totalCostHuman = `${grossCost.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}`;
  const feeHuman = `0 ${currency} (gratis)`;
  const exchangeRateHuman = `1 ${offer.asset} ≈ ${offer.price.toFixed(4)} ${currency}`;

  let explanation = "";
  if (isBuy) {
    explanation = `Pagas ${totalCostHuman} directamente al vendedor y recibes ${amount} ${offer.asset}. Sin comisión de exchange. `;
    explanation += `No necesitas KYC — el vendedor ya está verificado por ${offer.providerName}. `;
    if (offer.completionRate && offer.completionRate >= 0.95) explanation += `Vendedor con ${(offer.completionRate * 100).toFixed(0)}% de completion rate. `;
  } else {
    explanation = `Entregas ${amount} ${offer.asset} y recibes ${totalCostHuman}. Sin comisión. `;
    explanation += `El comprador te paga por tu método de pago preferido. `;
  }

  const warnings: string[] = [];
  warnings.push("El precio puede cambiar entre que inicias y completas la transacción.");
  if (offer.completionRate && offer.completionRate < 0.9) warnings.push(`Vendedor con completion rate bajo (${(offer.completionRate * 100).toFixed(0)}%).`);
  if (offer.tradeCount < 100) warnings.push("Vendedor con pocas órdenes completadas.");

  const steps = isBuy ? [
    `Seleccionas esta oferta en ${offer.providerName} P2P.`,
    `El vendedor te da sus datos bancarios (${offer.paymentMethods.join(", ")}).`,
    `Haces la transferencia de ${totalCostHuman}.`,
    `Marcas "ya pagé" en la plataforma.`,
    `El vendedor confirma y libera los ${offer.asset} a tu wallet.`,
  ] : [
    `Publicas tu oferta de venta en ${offer.providerName} P2P.`,
    `Un comprador la acepta y te transfiere ${totalCostHuman}.`,
    `Confirmas receipt del pago.`,
    `Liberas los ${offer.asset} al comprador.`,
  ];

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
    estimatedTime: "15-60 min (negociación P2P)",
    kycRequired: false,
    kycLevel: "NO_KYC",
    kycNote: "P2P: el advertiser está verificado. Tú no necesitas KYC.",
    liquidityTier: "MEDIUM",
    timestamp: offer.timestamp,
    source: `${offer.providerName} P2P API`,
    latencyMs: offer.latencyMs,
    status: offer.status,
    youPay: isBuy ? grossCost : amount,
    youReceive: isBuy ? amount : grossCost,
    feeHuman,
    totalCostHuman,
    exchangeRateHuman,
    explanation,
    warnings,
    steps,
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
      const buyFeePct = PROVIDER_FEES[buyAt.provider]?.takerPercent || 0;
      const sellFeePct = PROVIDER_FEES[sellAt.provider]?.takerPercent || 0;
      const totalFeePct = buyFeePct + sellFeePct;

      // Solo mostrar si hay spread bruto positivo (> 0.01%)
      if (spreadPercent <= 0.01) continue;

      const buyFee = (buyPrice * buyFeePct) / 100;
      const sellFee = (sellPrice * sellFeePct) / 100;

      const unitsBought = capital / (buyPrice + buyFee);
      const grossSell = unitsBought * sellPrice;
      const feesTotal = buyFee * unitsBought + sellFee * unitsBought;

      const grossProfit = grossSell - capital;
      const netProfit = grossProfit - feesTotal;
      const roiPercent = (netProfit / capital) * 100;

      // Determinar si es rentable después de comisiones
      const isProfitable = netProfit > 0;

      const assumptions = [
        `Capital: $${capital} USD`,
        `Compra al ask en ${buyAt.providerName} ($${buyPrice.toFixed(2)})`,
        `Venta al bid en ${sellAt.providerName} ($${sellPrice.toFixed(2)})`,
        `Spread bruto: ${spreadPercent.toFixed(3)}%`,
        `Comisiones taker: ${totalFeePct.toFixed(2)}% total (${buyFeePct}% + ${sellFeePct}%)`,
        isProfitable
          ? `✅ Rentable después de comisiones`
          : `❌ NO rentable después de comisiones (spread ${spreadPercent.toFixed(3)}% < comisiones ${totalFeePct.toFixed(2)}%)`,
        `No incluye costos de transferencia entre exchanges`,
        `No incluye slippage real`,
        `Los precios son del momento del escaneo y cambian constantemente`,
      ];

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
        assumptions,
        timestamp: Date.now(),
      });
    }
  }

  // Ordenar por spread descendente (mayor spread primero)
  return opportunities.sort((a, b) => b.spreadPercent - a.spreadPercent);
}
