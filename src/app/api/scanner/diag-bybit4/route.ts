import { NextResponse } from "next/server";

const ENDPOINTS = [
  // v5 market tickers
  "https://api.bybit.com/v5/market/tickers?category=spot&symbol=BTCUSDT",
  "https://api.bytick.com/v5/market/tickers?category=spot&symbol=BTCUSDT",
  // v5 market kline
  "https://api.bybit.com/v5/market/kline?category=spot&symbol=BTCUSDT&interval=1",
  // v2 public tickers (legacy endpoint)
  "https://api.bybit.com/v2/public/tickers?symbol=BTCUSD",
  // v2 public ticker (legacy)
  "https://api.bybit.com/spot/quote/v1/ticker?symbol=BTCUSDT",
  //衍生的:derivatives
  "https://api.bybit.com/derivatives/v3/public/tickers?symbol=BTCUSDT",
  // Otros mirrors conocidos
  "https://api2.bybit.com/v5/market/tickers?category=spot&symbol=BTCUSDT",
  // Con User-Agent de browser
  "https://api.bybit.com/v5/market/tickers?category=spot&symbol=BTCUSDT&withHeaders=1",
];

const HEADERS = {
  "Accept": "application/json",
  "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
};

export async function GET() {
  const results = await Promise.all(
    ENDPOINTS.map(async (url) => {
      const start = Date.now();
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(url, { signal: controller.signal, headers: HEADERS });
        clearTimeout(timeoutId);
        const latencyMs = Date.now() - start;
        const text = await res.text();
        let lastPrice = 0;
        let parsed: any = null;
        try {
          parsed = JSON.parse(text);
          // v5 format
          if (parsed?.result?.list?.[0]?.lastPrice) {
            lastPrice = parseFloat(parsed.result.list[0].lastPrice);
          }
          // v2 format
          else if (parsed?.result?.[0]?.last_price) {
            lastPrice = parseFloat(parsed.result[0].last_price);
          }
          else if (parsed?.result?.[0]?.last_price) {
            lastPrice = parseFloat(parsed.result[0].last_price);
          }
        } catch {}
        return { url, status: res.status, latencyMs, lastPrice, bodyPreview: text.slice(0, 200), parsed };
      } catch (err) {
        return { url, status: 0, latencyMs: Date.now() - start, lastPrice: 0, error: (err as Error).message };
      }
    })
  );
  return NextResponse.json({ results, timestamp: Date.now() });
}
