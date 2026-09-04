// ============================================================
// OKX P2P — API Client
// ============================================================
// Endpoint: GET https://www.okx.com/v3/c2c/tradingOrders/books
// Auth: ninguna (público)
// Query params:
//   quoteCurrency=COP
//   baseCurrency=USDT
//   side=buy | sell
//   paymentMethod=all
//   userType=all
// ============================================================

export interface OkxP2PAd {
  exchange: "OKX";
  side: "BUY" | "SELL";
  price: number;
  advertiserName: string;
  completionRate: number | null; // 0-1
  creatorType: string; // "merchant" | "certified" | "common"
  minAmount: number; // fiat (quoteMinAmountPerOrder)
  maxAmount: number; // fiat (quoteMaxAmountPerOrder)
  availableQty: number; // asset
  paymentMethods: string[];
  tradeCount: number;
}

interface OkxResponseItem {
  price: string;
  nickName: string;
  completedRate?: string; // "0.9450"
  completedOrderQuantity?: number;
  creatorType?: string;
  paymentMethods?: string[];
  quoteMinAmountPerOrder?: string;
  quoteMaxAmountPerOrder?: string;
  availableAmount?: string;
}

interface OkxResponse {
  code: number;
  data: {
    buy?: OkxResponseItem[];
    sell?: OkxResponseItem[];
  };
}

export async function fetchOkxP2PAds(params: {
  asset: string;
  fiat: string;
  side: "BUY" | "SELL";
  payment?: string;
}): Promise<OkxP2PAd[]> {
  const { asset, fiat, side, payment } = params;
  const sideParam = side.toLowerCase();
  const queryParams = new URLSearchParams({
    quoteCurrency: fiat,
    baseCurrency: asset,
    side: sideParam,
    paymentMethod: payment || "all",
    userType: "all",
  });
  const url = `https://www.okx.com/v3/c2c/tradingOrders/books?${queryParams.toString()}`;

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
    if (!res.ok) return [];

    const data = (await res.json()) as OkxResponse;
    if (!data || data.code !== 0) return [];

    // La API devuelve buy[] y sell[] según el side solicitado, pero siempre
    // devuelve ambos (uno con data y el otro vacío). Tomamos el que corresponde.
    const items = sideParam === "buy" ? data.data?.buy || [] : data.data?.sell || [];
    if (!Array.isArray(items)) return [];

    return items.map((it) => ({
      exchange: "OKX" as const,
      side,
      price: parseFloat(it.price || "0"),
      advertiserName: it.nickName || "anónimo",
      completionRate: it.completedRate ? parseFloat(it.completedRate) : null,
      creatorType: it.creatorType || "common",
      minAmount: parseFloat(it.quoteMinAmountPerOrder || "0"),
      maxAmount: parseFloat(it.quoteMaxAmountPerOrder || "0"),
      availableQty: parseFloat(it.availableAmount || "0"),
      paymentMethods: it.paymentMethods || [],
      tradeCount: it.completedOrderQuantity ?? 0,
    }));
  } catch {
    clearTimeout(timeoutId);
    return [];
  }
}

export function buildOkxDirectUrl(params: {
  asset: string;
  fiat: string;
  side: "BUY" | "SELL";
}): string {
  return `https://www.okx.com/p2p-markets/${params.asset.toLowerCase()}-${params.fiat.toLowerCase()}-${params.side.toLowerCase()}`;
}
