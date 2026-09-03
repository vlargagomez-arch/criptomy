import { NextResponse } from "next/server";

// GET /api/scanner/diag-bybit
// Diagnóstico: prueba todos los mirrors de Bybit desde el servidor y muestra
// el status HTTP, latencia, y respuesta. NO usa cache ni circuit breaker,
// así podemos ver qué pasa real.

const BYBIT_BASES = [
  "https://api.bybit.com",
  "https://api.bytick.com",
  "https://api2.bybit.com",
  "https://api-cloudfront.bybit.com",
  "https://api-cloudflare.bybit.com",
];

export async function GET() {
  const results = await Promise.all(
    BYBIT_BASES.map(async (base) => {
      const start = Date.now();
      const url = `${base}/v5/market/tickers?category=spot&symbol=BTCUSDT`;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(url, {
          headers: {
            Accept: "application/json",
            "User-Agent": "Mozilla/5.0 (compatible; CriptoMy/1.0)",
          },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        const latencyMs = Date.now() - start;
        let body: string | null = null;
        let lastPrice = 0;
        try {
          const data = await res.json();
          lastPrice = data?.result?.list?.[0]?.lastPrice ? parseFloat(data.result.list[0].lastPrice) : 0;
          body = JSON.stringify(data).slice(0, 200);
        } catch {
          try {
            body = (await res.text()).slice(0, 200);
          } catch {
            // ignore
          }
        }
        return {
          base,
          status: res.status,
          latencyMs,
          lastPrice,
          bodyPreview: body,
        };
      } catch (err) {
        return {
          base,
          status: 0,
          latencyMs: Date.now() - start,
          lastPrice: 0,
          error: (err as Error).message,
        };
      }
    })
  );

  return NextResponse.json({
    results,
    timestamp: Date.now(),
  });
}
