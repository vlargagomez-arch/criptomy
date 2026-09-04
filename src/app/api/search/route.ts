import { NextRequest, NextResponse } from "next/server";
import { interpretQuery } from "@/lib/scanner/interpreter";
import { scanMarketData, scanP2P } from "@/lib/scanner/engine";
import { calculateQuoteResult, calculateP2PResult, rankResults, detectArbitrage } from "@/lib/scanner/comparison";
import { findRoutes } from "@/lib/scanner/route-engine";
import type { SearchResponse, RankedResult, P2POffer, MarketQuote } from "@/lib/scanner/types";

// POST /api/search
// Body: { query: "Quiero comprar 1000 USDT con COP" }
// Respuesta: SearchResponse con intent + results + best + alternatives + p2pOffers + arbitrage

export async function POST(req: NextRequest) {
  const start = Date.now();
  try {
    const body = await req.json();
    const rawQuery = (body.query || "").trim();

    if (!rawQuery) {
      return NextResponse.json({ error: "query requerido" }, { status: 400 });
    }

    // 1) Interpretar la query
    const intent = interpretQuery(rawQuery);

    if (intent.operation === "UNKNOWN") {
      return NextResponse.json({
        intent,
        results: [],
        alternatives: [],
        p2pOffers: [],
        arbitrageOpportunities: [],
        providersChecked: 0,
        providersOk: 0,
        errors: [{ provider: "interpreter", error: "No se pudo interpretar la intención" }],
        timestamp: Date.now(),
        queryId: `q_${Date.now()}`,
        executionTimeMs: Date.now() - start,
        message: "No entendí qué quieres hacer. Prueba con: 'Quiero comprar 1000 USDT con COP' o 'Quiero vender 500 USDT'.",
      } as SearchResponse);
    }

    // 2) Escanear según operación
    const errors: { provider: string; error: string }[] = [];
    let results: RankedResult[] = [];
    let p2pOffers: P2POffer[] = [];
    let arbitrageOpportunities = [];
    let providersChecked = 0;
    let providersOk = 0;

    const asset = intent.asset || "USDT";
    const fiat = intent.fiat || "USD";
    const amount = intent.amount || 100;

    // Si fiat es local (COP, MXN, ARS, BRL, etc.), escanear contra USD
    // y luego convertir. Solo Binance tiene pares como USDT/COP en spot.
    const LOCAL_FIATS = ["COP", "MXN", "ARS", "BRL", "CLP", "PEN", "VES", "DOP"];
    const isLocalFiat = LOCAL_FIATS.includes(fiat);
    const scanQuote = isLocalFiat ? "USD" : fiat; // escanear contra USD si fiat es local

    // Market data scan: para BUY/SELL/COMPARE/ARBITRAGE
    if (["BUY", "SELL", "COMPARE", "ARBITRAGE"].includes(intent.operation)) {
      // Escanear contra USD (o la fiat original si no es local)
      const quotes = await scanMarketData(asset, scanQuote);
      providersChecked = quotes.length;
      providersOk = quotes.filter((q) => q.status === "ONLINE").length;

      // Log errors solo de providers que respondieron pero fallaron
      // (no de los que simplemente no tienen el par)
      quotes.filter((q) => q.status !== "ONLINE" && !q.error?.includes("Symbol no soportado")).forEach((q) => {
        if (q.error) errors.push({ provider: q.provider, error: q.error });
      });

      // Si fiat es local, convertir precios USD → fiat usando Chainlink o tasa aproximada
      if (isLocalFiat && fiat !== "USD") {
        // Tasa aproximada (en producción se podría obtener de Chainlink o API de cambio)
        const fiatRates: Record<string, number> = {
          COP: 4100, MXN: 18.5, ARS: 950, BRL: 5.05, CLP: 950, PEN: 3.75, VES: 36, DOP: 58,
        };
        const rate = fiatRates[fiat] || 1;
        // Convertir cada quote a la fiat local
        quotes.forEach((q) => {
          if (q.status === "ONLINE" && q.lastPrice > 0) {
            q.lastPrice *= rate;
            q.bidPrice = q.bidPrice ? q.bidPrice * rate : undefined;
            q.askPrice = q.askPrice ? q.askPrice * rate : undefined;
            q.spread = q.spread ? q.spread * rate : undefined;
            q.spreadPercent = q.spreadPercent;
            q.quoteCurrency = fiat;
            q.quoteVolume24h = q.quoteVolume24h ? q.quoteVolume24h * rate : undefined;
          }
        });
      }

      // Convertir quotes a RankedResults con costo total
      if (intent.operation === "BUY" || intent.operation === "SELL" || intent.operation === "COMPARE") {
        results = quotes.map((q) => calculateQuoteResult(q, intent.operation as "BUY" | "SELL", amount));
        results = rankResults(results, "totalCost");
      }

      // Arbitraje: detectar oportunidades entre providers
      // Para arbitraje, escanear BTC y ETH además del asset pedido
      // (donde hay más diferencia de precio entre exchanges)
      if (intent.operation === "ARBITRAGE") {
        const arbitrageAssets = [asset, "BTC", "ETH"].filter((a, i, arr) => arr.indexOf(a) === i);
        const allArbQuotes: MarketQuote[] = [];
        for (const arbAsset of arbitrageAssets) {
          const arbQuotes = await scanMarketData(arbAsset, scanQuote === "USD" ? "USDT" : scanQuote);
          // Filtrar solo los que tienen bid y ask válidos
          const valid = arbQuotes.filter((q) => q.status === "ONLINE" && q.bidPrice && q.askPrice && q.bidPrice > 0 && q.askPrice > 0);
          if (valid.length >= 2) {
            // Convertir a fiat local si es necesario
            if (isLocalFiat && fiat !== "USD") {
              const fiatRates: Record<string, number> = {
                COP: 4100, MXN: 18.5, ARS: 950, BRL: 5.05, CLP: 950, PEN: 3.75, VES: 36, DOP: 58,
              };
              const rate = fiatRates[fiat] || 1;
              valid.forEach((q) => {
                q.lastPrice *= rate;
                q.bidPrice = q.bidPrice ? q.bidPrice * rate : undefined;
                q.askPrice = q.askPrice ? q.askPrice * rate : undefined;
                q.spread = q.spread ? q.spread * rate : undefined;
                q.quoteCurrency = fiat;
              });
            }
            allArbQuotes.push(...valid);
            const arbOpps = detectArbitrage(valid, amount * (intent.fiat ? 1 : 1000));
            arbitrageOpportunities.push(...arbOpps);
          }
        }
        // Ordenar por ROI descendente
        arbitrageOpportunities.sort((a, b) => b.estimatedRoiPercent - a.estimatedRoiPercent);
        // Limitar a 8 oportunidades
        arbitrageOpportunities = arbitrageOpportunities.slice(0, 8);
      }
    }

    // P2P scan: para BUY/SELL/FIND_P2P en fiat local (COP, MXN, etc.)
    if (["BUY", "SELL", "FIND_P2P"].includes(intent.operation) && fiat !== "USD" && fiat !== "EUR") {
      const tradeType: "BUY" | "SELL" = intent.operation === "SELL" ? "SELL" : "BUY";
      p2pOffers = await scanP2P({ asset, fiat, tradeType });

      if (p2pOffers.length > 0) {
        // Convertir P2P offers a RankedResults
        const p2pResults = p2pOffers.slice(0, 5).map((o) => calculateP2PResult(o, amount));
        results = [...results, ...p2pResults];
        results = rankResults(results, "totalCost");
      }
    }

    // SEND: usar route engine para rutas
    if (intent.operation === "SEND") {
      // El motor de rutas se invoca por separado (no es parte del SearchResponse estándar)
      // Lo dejamos documentado en la respuesta
    }

    const executionTimeMs = Date.now() - start;
    // Solo incluir en bestOption/alternatives los que tienen rank > 0 (ONLINE)
    const rankedResults = results.filter((r) => r.rank > 0);
    const bestOption = rankedResults[0] || undefined;
    const alternatives = rankedResults.slice(1, 6);
    // Pero en `results` mantener TODOS (incluye offline/error) para mostrar estado a usuario
    // Ordenar: primero los ONLINE con rank, luego los demás con status visible
    const sortedResults = [
      ...rankedResults,
      ...results.filter((r) => r.rank === 0),
    ];

    const response: SearchResponse = {
      intent,
      results: sortedResults,
      bestOption,
      alternatives,
      p2pOffers,
      arbitrageOpportunities,
      providersChecked,
      providersOk,
      errors,
      timestamp: Date.now(),
      queryId: `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      executionTimeMs,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("[/api/search POST]", err);
    return NextResponse.json(
      { error: "Error interno: " + (err as Error).message },
      { status: 500 }
    );
  }
}

// GET /api/search?query=... (alternativa sin body)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query");
  if (!query) {
    return NextResponse.json({ error: "query requerido" }, { status: 400 });
  }

  // Reusar POST
  const req2 = new NextRequest("https://internal/api/search", {
    method: "POST",
    body: JSON.stringify({ query }),
    headers: { "Content-Type": "application/json" },
  });
  return POST(req2);
}
