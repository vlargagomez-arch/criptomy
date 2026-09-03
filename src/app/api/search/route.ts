import { NextRequest, NextResponse } from "next/server";
import { interpretQuery } from "@/lib/scanner/interpreter";
import { scanMarketData, scanP2P } from "@/lib/scanner/engine";
import { calculateQuoteResult, calculateP2PResult, rankResults, detectArbitrage } from "@/lib/scanner/comparison";
import { findRoutes } from "@/lib/scanner/route-engine";
import type { SearchResponse, RankedResult, P2POffer } from "@/lib/scanner/types";

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

    // Market data scan: para BUY/SELL/COMPARE/ARBITRAGE
    if (["BUY", "SELL", "COMPARE", "ARBITRAGE"].includes(intent.operation)) {
      const quotes = await scanMarketData(asset, fiat);
      providersChecked = quotes.length;
      providersOk = quotes.filter((q) => q.status === "ONLINE").length;

      // Log errors
      quotes.filter((q) => q.status !== "ONLINE").forEach((q) => {
        if (q.error) errors.push({ provider: q.provider, error: q.error });
      });

      // Convertir quotes a RankedResults con costo total
      if (intent.operation === "BUY" || intent.operation === "SELL" || intent.operation === "COMPARE") {
        results = quotes.map((q) => calculateQuoteResult(q, intent.operation as "BUY" | "SELL", amount));
        results = rankResults(results, "totalCost");
      }

      // Arbitraje: detectar oportunidades entre providers
      if (intent.operation === "ARBITRAGE") {
        arbitrageOpportunities = detectArbitrage(quotes, amount * (intent.fiat ? 1 : 1000));
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
    const sortedResults = results.filter((r) => r.rank > 0);
    const bestOption = sortedResults[0] || undefined;
    const alternatives = sortedResults.slice(1, 4);

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
