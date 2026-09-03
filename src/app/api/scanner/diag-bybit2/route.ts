import { NextResponse } from "next/server";

const ENDPOINTS = [
  "https://api.bybit.com/v5/market/tickers?category=spot&symbol=BTCUSDT",
  "https://api.bytick.com/v5/market/tickers?category=spot&symbol=BTCUSDT",
  "https://api-demo.bybit.com/v5/market/tickers?category=spot&symbol=BTCUSDT",
  "https://api-testnet.bybit.com/v5/market/tickers?category=spot&symbol=BTCUSDT",
];

export async function GET() {
  const results = await Promise.all(
    ENDPOINTS.map(async (url) => {
      const start = Date.now();
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(url, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        clearTimeout(timeoutId);
        const latencyMs = Date.now() - start;

        // Leer body una sola vez como texto
        const text = await res.text();
        let lastPrice = 0;
        let bodyPreview = text.slice(0, 300);
        try {
          const data = JSON.parse(text);
          lastPrice = data?.result?.list?.[0]?.lastPrice ? parseFloat(data.result.list[0].lastPrice) : 0;
        } catch {
          // body wasn't JSON, keep as text preview
        }
        return { url, status: res.status, latencyMs, lastPrice, bodyPreview };
      } catch (err) {
        return { url, status: 0, latencyMs: Date.now() - start, lastPrice: 0, error: (err as Error).message };
      }
    })
  );
  return NextResponse.json({ results, timestamp: Date.now() });
}
