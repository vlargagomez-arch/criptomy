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
        let lastPrice = 0;
        let body = "";
        try {
          const data = await res.json();
          lastPrice = data?.result?.list?.[0]?.lastPrice ? parseFloat(data.result.list[0].lastPrice) : 0;
          body = JSON.stringify(data).slice(0, 300);
        } catch {
          body = (await res.text()).slice(0, 300);
        }
        return { url, status: res.status, latencyMs, lastPrice, bodyPreview: body };
      } catch (err) {
        return { url, status: 0, latencyMs: Date.now() - start, lastPrice: 0, error: (err as Error).message };
      }
    })
  );
  return NextResponse.json({ results, timestamp: Date.now() });
}
