// ============================================================
// BINANCE P2P — API Client
// ============================================================
// Endpoint: POST https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search
// Auth: ninguna (público)
// ============================================================

export interface BinanceP2PAd {
  exchange: "Binance";
  side: "BUY" | "SELL";
  price: number;
  advertiserName: string;
  advertiserUserNo: string;
  completionRate: number | null; // 0-1
  proMerchant: boolean;
  minAmount: number; // fiat
  maxAmount: number; // fiat
  availableQty: number; // asset
  paymentMethods: string[];
  tradeCount: number;
}

interface BinanceResponseItem {
  adv: {
    price: string;
    minSingleTransAmount: string;
    maxSingleTransAmount: string;
    surplusAmount: string;
    tradeMethods?: { tradeMethodShortName: string }[];
  };
  advertiser: {
    nickName: string;
    userNo: string;
    monthFinishRate?: number;
    proMerchant?: boolean;
    monthOrderCount?: number;
  };
}

export async function fetchBinanceP2PAds(params: {
  asset: string;
  fiat: string;
  side: "BUY" | "SELL";
  rows?: number;
  payment?: string;
}): Promise<BinanceP2PAd[]> {
  const { asset, fiat, side, rows = 15, payment } = params;
  const url = "https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search";

  const body = JSON.stringify({
    fiat,
    page: 1,
    rows,
    tradeType: side,
    asset,
    countries: [],
    payTypes: payment ? [payment] : [],
    publisherType: null,
    transAmount: "",
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept-Language": "en-US,en;q=0.9,es;q=0.8",
      },
      body,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) return [];

    const data = (await res.json()) as { data?: BinanceResponseItem[] };
    if (!data.data) return [];

    return data.data.map((it) => ({
      exchange: "Binance" as const,
      side,
      price: parseFloat(it.adv.price),
      advertiserName: it.advertiser.nickName,
      advertiserUserNo: it.advertiser.userNo,
      completionRate: it.advertiser.monthFinishRate ?? null,
      proMerchant: it.advertiser.proMerchant ?? false,
      minAmount: parseFloat(it.adv.minSingleTransAmount || "0"),
      maxAmount: parseFloat(it.adv.maxSingleTransAmount || "0"),
      availableQty: parseFloat(it.adv.surplusAmount || "0"),
      paymentMethods: (it.adv.tradeMethods || []).map((m) => m.tradeMethodShortName),
      tradeCount: it.advertiser.monthOrderCount ?? 0,
    }));
  } catch {
    clearTimeout(timeoutId);
    return [];
  }
}

export function buildBinanceDirectUrl(params: {
  asset: string;
  fiat: string;
  side: "BUY" | "SELL";
  payment?: string;
}): string {
  const { asset, fiat, side, payment } = params;
  const base = `https://p2p.binance.com/en/?fiat=${fiat}&asset=${asset}&tradeType=${side}`;
  return payment ? `${base}&payTypes=${encodeURIComponent(payment)}` : base;
}

export function buildBinanceMerchantUrl(userNo: string): string {
  return `https://p2p.binance.com/en/advertiserDetail?advertiserNo=${userNo}`;
}
