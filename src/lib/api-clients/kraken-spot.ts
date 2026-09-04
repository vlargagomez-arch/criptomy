// ============================================================
// KRAKEN SPOT — API Client (para arbitraje P2P → Spot)
// ============================================================
// Endpoint: GET https://api.kraken.com/0/public/Ticker?pair=XBTUSDT
// Auth: ninguna (público)
// ============================================================
//
// IMPORTANTE: Kraken NO tiene par USDT/USDT (redundante).
// Para USDT, Kraken se omite automáticamente.
//
// Mapeo de assets:
//   BTC → XBT
//   USD → ZUSD
//   EUR → ZEUR
//   USDT → USDT (sin cambio)
//   ETH → ETH
//   SOL → SOL
// ============================================================

export interface KrakenQuote {
  exchange: "Kraken";
  bid: number; // mejor precio de venta (lo que recibes)
  ask: number; // mejor precio de compra (lo que pagas)
  last: number;
  volume24hBase: number;
  volume24hQuote: number;
  high24h: number;
  low24h: number;
  // Para hacer compatible con P2PAd
  side: "BUY" | "SELL";
  price: number;
  completionRate: null;
  advertiserName: "Kraken Spot";
  minAmount: number;
  maxAmount: number;
  availableQty: number;
  paymentMethods: string[];
  tradeCount: number;
}

const ASSET_MAP: Record<string, string> = {
  BTC: "XBT",
  USD: "ZUSD",
  EUR: "ZEUR",
  USDT: "USDT",
  USDC: "USDC",
  ETH: "ETH",
  SOL: "SOL",
  BNB: "BNB",
  XRP: "XRP",
  ADA: "ADA",
  DOT: "DOT",
  LINK: "LINK",
  MATIC: "MATIC",
};

interface KrakenResponse {
  error: string[];
  result?: Record<string, {
    a: string[]; // ask [price, wholeLotVolume, lotVolume]
    b: string[]; // bid [price, ...]
    c: string[]; // last trade [price, volume]
    v: string[]; // volume [today, 24h]
    q: string[]; // volume quote [today, 24h]
    h: string[]; // high [today, 24h]
    l: string[]; // low [today, 24h]
  }>;
}

export function krakenCanTrade(asset: string): boolean {
  // Kraken no tiene par USDT/USDT, solo funciona para assets != USDT
  return asset.toUpperCase() !== "USDT";
}

export async function fetchKrakenSpot(asset: string, quote = "USDT"): Promise<KrakenQuote | null> {
  const a = asset.toUpperCase();
  if (!krakenCanTrade(a)) return null;
  const krakenAsset = ASSET_MAP[a] || a;
  const krakenQuote = ASSET_MAP[quote.toUpperCase()] || quote.toUpperCase();
  const pair = `${krakenAsset}${krakenQuote}`;
  const url = `https://api.kraken.com/0/public/Ticker?pair=${pair}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) return null;

    const data = (await res.json()) as KrakenResponse;
    if (data.error && data.error.length > 0) return null;
    if (!data.result) return null;

    // Kraken devuelve un objeto con key dinámico (el pair solicitado)
    const tickerKey = Object.keys(data.result)[0];
    if (!tickerKey) return null;
    const t = data.result[tickerKey];

    const quote: KrakenQuote = {
      exchange: "Kraken",
      bid: parseFloat(t.b[0]),
      ask: parseFloat(t.a[0]),
      last: parseFloat(t.c[0]),
      volume24hBase: parseFloat(t.v[1]),
      // Kraken no siempre devuelve 'q' (volume quote). Si no existe, usar 0.
      volume24hQuote: t.q ? parseFloat(t.q[1]) : 0,
      high24h: parseFloat(t.h[1]),
      low24h: parseFloat(t.l[1]),
      // Compatibilidad con P2PAd (no es real P2P, pero lo normalizamos)
      side: "BUY",
      price: parseFloat(t.c[0]),
      completionRate: null,
      advertiserName: "Kraken Spot",
      minAmount: 0,
      maxAmount: Number.MAX_SAFE_INTEGER,
      availableQty: parseFloat(t.v[1]),
      paymentMethods: [],
      tradeCount: 0,
    };
    return quote;
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}
