// ============================================================
// ROUTE ENGINE — Calcula rutas multi-hop para conversión
// ============================================================
// Ej: USDT → COP directo vs USDT → USD → COP
// Por ahora solo calcula con datos de CoinGecko (USD como puente)
// ============================================================

import type { RouteOption } from "./types";
import { fetchCoingeckoTicker } from "./providers/coingecko";

const COUNTRY_FIAT: Record<string, string> = {
  CO: "COP", MX: "MXN", AR: "ARS", BR: "BRL", CL: "CLP", PE: "PEN", VE: "VES",
};

export async function findRoutes(from: string, to: string, amount: number): Promise<RouteOption[]> {
  const routes: RouteOption[] = [];

  // Ruta directa: cripto → fiat (vía CoinGecko como referencia)
  if (isCrypto(from) && !isCrypto(to)) {
    try {
      const quote = await fetchCoingeckoTicker(from, "USD");
      if (quote.status === "ONLINE" && quote.lastPrice > 0) {
        // CoinGecko no da COP directo en muchos casos; intentamos
        // Para fines demo: ruta USDT → USD como puente
        const usdPrice = quote.lastPrice;
        const fiatQuote = await fetchCoingeckoTicker("USDT", to);
        const usdToFiat = fiatQuote.lastPrice || (await getFiatApprox("USD", to));

        const totalCost = amount * usdPrice * usdToFiat;
        routes.push({
          from,
          to,
          hops: [
            { from, to: "USD", provider: "CoinGecko", rate: usdPrice, fee: 0 },
            { from: "USD", to, provider: "CoinGecko (approx)", rate: usdToFiat, fee: 0 },
          ],
          totalCost,
          totalCostCurrency: to,
          estimatedTime: "Variable según provider final",
          providers: ["CoinGecko"],
          recommended: true,
          reason: "Ruta puente USD. En la ejecución real se usaría un on-ramp/off-ramp.",
        });
      }
    } catch (e) {
      // ignore
    }
  }

  return routes;
}

function isCrypto(asset: string): boolean {
  return ["BTC", "ETH", "USDT", "USDC", "SOL", "BNB", "XRP", "ADA", "DOT", "LINK", "MATIC", "AVAX"].includes(asset.toUpperCase());
}

async function getFiatApprox(from: string, to: string): Promise<number> {
  // Fallback: tasas aproximadas (NO para trading, solo para mostrar rutas conceptuales)
  const approxRates: Record<string, number> = {
    COP: 4100, MXN: 18.5, ARS: 950, BRL: 5.05, CLP: 950, PEN: 3.75, VES: 36,
  };
  return approxRates[to] || 1;
}
