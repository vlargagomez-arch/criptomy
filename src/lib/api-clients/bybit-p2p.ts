// ============================================================
// BYBIT P2P — API Client
// ============================================================
// Endpoint: POST https://api2.bybit.com/fiat/otc/item/online
// Auth: ninguna (público)
// Content-Type: application/x-www-form-urlencoded (NO JSON — Bybit rechaza JSON)
// ============================================================
//
// Convención de side (espejo respecto a usuario):
//   side: "0" = BUY ads (usuario compra crypto de merchants que venden)
//   side: "1" = SELL ads (usuario vende crypto a merchants que compran)
// ============================================================

export interface BybitP2PAd {
  exchange: "Bybit";
  side: "BUY" | "SELL";
  price: number;
  advertiserName: string;
  completionRate: number | null; // 0-1
  minAmount: number; // fiat
  maxAmount: number; // fiat
  availableQty: number; // asset
  paymentMethods: string[]; // numeric IDs as strings
  tradeCount: number;
}

interface BybitResponseItem {
  price: string;
  nickName: string;
  recentExecuteRate?: string; // "0.95"
  orderNum?: number;
  payments?: number[];
  minAmount: string;
  maxAmount: string;
  quantity: string;
  lastQuantity?: string;
}

interface BybitResponse {
  ret_code: number;
  ret_msg: string;
  result?: { items: BybitResponseItem[]; count: number } | null;
}

export async function fetchBybitP2PAds(params: {
  asset: string;
  fiat: string;
  side: "BUY" | "SELL";
  size?: number;
}): Promise<BybitP2PAd[]> {
  const { asset, fiat, side, size = 15 } = params;
  // side: "0" = BUY (usuario compra), "1" = SELL (usuario vende)
  const sideParam = side === "BUY" ? "0" : "1";
  const url = "https://api2.bybit.com/fiat/otc/item/online/";

  // IMPORTANTE: NO enviar el campo 'payment' si no hay filtro específico.
  // Enviar payment: "" (vacío) hace que la API devuelva ret_code 912000004 con 0 ads.
  // Solo se incluye el campo si hay un paymentMethod específico.
  const formDataObj: Record<string, string> = {
    userId: "",
    tokenId: asset,
    currencyId: fiat,
    side: sideParam,
    size: String(size),
    page: "1",
    amount: "",
    authMaker: "false",
    canTrade: "false",
  };
  const formData = new URLSearchParams(formDataObj).toString();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
        "Origin": "https://www.bybit.com",
        "Referer": "https://www.bybit.com/",
      },
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) return [];

    const data = (await res.json()) as BybitResponse;
    if (data.ret_code !== 0 || !data.result?.items) return [];

    return data.result.items.map((it) => ({
      exchange: "Bybit" as const,
      side,
      price: parseFloat(it.price),
      advertiserName: it.nickName || "anónimo",
      // Bybit recentExecuteRate: integer 0-100 (ej: 98 = 98%, NO 0.98)
      // Convertimos a fracción 0-1 para consistencia con Binance/OKX
      completionRate: it.recentExecuteRate !== undefined && it.recentExecuteRate !== null
        ? parseFloat(String(it.recentExecuteRate)) / 100
        : null,
      minAmount: parseFloat(it.minAmount || "0"),
      maxAmount: parseFloat(it.maxAmount || "0"),
      availableQty: parseFloat(it.lastQuantity || it.quantity || "0"),
      paymentMethods: (it.payments || []).map((p) => String(p)),
      tradeCount: it.orderNum ?? 0,
    }));
  } catch {
    clearTimeout(timeoutId);
    return [];
  }
}

export function buildBybitDirectUrl(params: {
  asset: string;
  fiat: string;
  side: "BUY" | "SELL";
}): string {
  // Bybit URL: https://www.bybit.com/fiat/otc/transaction/sell (or buy)
  const sidePath = params.side === "BUY" ? "buy" : "sell";
  return `https://www.bybit.com/fiat/otc/transaction/${sidePath}?token=${params.asset}&fiat=${params.fiat}`;
}
