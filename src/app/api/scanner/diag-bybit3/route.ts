import { NextResponse } from "next/server";

const PROXIES = [
  "https://api.codetabs.com/v1/proxy/?quest=https://api.bybit.com/v5/market/tickers?category=spot&symbol=BTCUSDT",
  "https://jsonp.afeld.me/?url=https%3A%2F%2Fapi.bybit.com%2Fv5%2Fmarket%2Ftickers%3Fcategory%3Dspot%26symbol%3DBTCUSDT",
  "https://whateverorigin.org/get?url=https%3A%2F%2Fapi.bybit.com%2Fv5%2Fmarket%2Ftickers%3Fcategory%3Dspot%26symbol%3DBTCUSDT",
  "https://api.bybit.com/v5/market/tickers?category=spot&symbol=BTCUSDT"
];

export async function GET() {
  const results = await Promise.all(
    PROXIES.map(async (url) => {
      const start = Date.now();
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const res = await fetch(url, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        clearTimeout(timeoutId);
        const latencyMs = Date.now() - start;
        const text = await res.text();
        let lastPrice = 0;
        try {
          const data = JSON.parse(text);
          lastPrice = data?.result?.list?.[0]?.lastPrice ? parseFloat(data.result.list[0].lastPrice) : 0;
          if (!lastPrice && data?.contents) {
            const inner = JSON.parse(data.contents);
            lastPrice = inner?.result?.list?.[0]?.lastPrice ? parseFloat(inner.result.list[0].lastPrice) : 0;
          }
        } catch {}
        return { url, status: res.status, latencyMs, lastPrice, bodyPreview: text.slice(0, 200) };
      } catch (err) {
        return { url, status: 0, latencyMs: Date.now() - start, lastPrice: 0, error: (err as Error).message };
      }
    })
  );
  return NextResponse.json({ results, timestamp: Date.now() });
}
