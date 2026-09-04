// ============================================================
// P2P PROVIDERS — APIs P2P públicas de varios exchanges
// ============================================================
// Esta es la reality-check de cada API (testeado Sept 2024):
//
// ✅ Binance P2P: API web pública, funciona desde server
//    POST https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search
//
// ⚠️ Bybit P2P: API web existe pero requiere parámetros exactos.
//    Intentamos múltiples variantes. Devuelve 10001 "param error".
//    Cloudflare+WAF la defienden. Probamos desde server.
//    POST https://api2.bybit.com/fiat/otc/item/online
//
// ⚠️ OKX P2P: No hay API pública oficial. Endpoint interno
//    requiere auth/session. Probamos variantes; ninguna funciona
//    sin cookies de sesión. 404 / Method Not Allowed.
//
// ⚠️ HTX (Huobi) P2P: Endpoint histórico otc-api.huobi.com
//    dejó de responder (timeout). El nuevo requiere auth.
//
// ⚠️ KuCoin P2P: Bloqueado por Cloudflare desde server (challenge).
//
// ⚠️ Gate.io P2P: Bloqueado por Akamai (403 Access Denied).
//
// ⚠️ MEXC P2P: Bloqueado por Akamai (403 Access Denied).
//
// ⚠️ Bitget P2P: Endpoint no documentado. Probamos múltiples;
//    todos devuelven HTML (la página, no JSON).
//
// CONCLUSIÓN HONESTA: La mayoría de exchanges P2P bloquean
// llamadas server-side desde Vercel (es la misma razón que
// Bybit spot está bloqueado). Único confiable: Binance P2P.
//
// ESTRATEGIA: Implementamos todos los providers de manera
// defensiva. Si responden, los incluimos. Si no, los marcamos
// como DISABLED con razón clara en el UI. El usuario ve qué
// exchanges intentamos y por qué no están disponibles.
// ============================================================

import type { P2POffer, ProviderStatus } from "../scanner/types";

// ============================================================
// HELPER: Fetch con timeout y manejo de errores
// ============================================================
async function fetchP2PJson(
  url: string,
  body: object | null,
  headers: Record<string, string>,
  timeoutMs = 8000
): Promise<{ data: any; status: number } | { error: string; status: number }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const opts: RequestInit = {
      method: body ? "POST" : "GET",
      headers: {
        "User-Agent": "CriptoMy/1.0 (https://criptomy.app)",
        "Accept": "application/json",
        ...headers,
      },
      signal: controller.signal,
    };
    if (body) {
      opts.body = JSON.stringify(body);
      (opts.headers as Record<string, string>)["Content-Type"] = "application/json";
    }
    const res = await fetch(url, opts);
    clearTimeout(timeoutId);
    const text = await res.text();
    // Si la respuesta es HTML, no es JSON — error de WAF
    if (text.trim().startsWith("<!") || text.trim().startsWith("<html") || text.trim().startsWith("<HTML")) {
      return { error: "Respuesta HTML (probablemente WAF/Cloudflare bloqueando)", status: res.status };
    }
    try {
      const data = JSON.parse(text);
      return { data, status: res.status };
    } catch {
      return { error: "Respuesta no es JSON válido", status: res.status };
    }
  } catch (err) {
    clearTimeout(timeoutId);
    return { error: (err as Error).message, status: 0 };
  }
}

// ============================================================
// Estructura del status de cada provider
// ============================================================
export interface P2PProviderResult {
  providerId: string;
  providerName: string;
  offers: P2POffer[];
  status: ProviderStatus;
  error?: string;
  latencyMs: number;
}

// ============================================================
// 1. BINANCE P2P — funciona ✅
// ============================================================
import { fetchBinanceP2P } from "../scanner/providers/binance";

export async function scanBinanceP2P(params: {
  asset: string;
  fiat: string;
  tradeType: "BUY" | "SELL";
}): Promise<P2PProviderResult> {
  const start = Date.now();
  try {
    const offers = await fetchBinanceP2P({ ...params, rows: 20 });
    return {
      providerId: "binance-p2p",
      providerName: "Binance P2P",
      offers,
      status: "ONLINE",
      latencyMs: Date.now() - start,
    };
  } catch (err) {
    return {
      providerId: "binance-p2p",
      providerName: "Binance P2P",
      offers: [],
      status: "ERROR",
      error: (err as Error).message,
      latencyMs: Date.now() - start,
    };
  }
}

// ============================================================
// 2. BYBIT P2P — intentamos, puede fallar por geo-block ⚠️
// ============================================================
// POST https://api2.bybit.com/fiat/otc/item/online
// Body con varios formatos conocidos. Si todos fallan, DISABLED.
interface BybitP2PItem {
  nickname?: string;
  userName?: string;
  price: string;
  minAmount: string;
  maxAmount: string;
  lastQuantity?: string;
  surplusAmount?: string;
  paymentMethods?: { paymentName: string }[];
  recentOrderNum?: number;
  recentExecuteRate?: number;
}

interface BybitP2PResponse {
  ret_code: number;
  ret_msg: string;
  result?: { items: BybitP2PItem[]; totalCount: number } | null;
}

export async function scanBybitP2P(params: {
  asset: string;
  fiat: string;
  tradeType: "BUY" | "SELL";
}): Promise<P2PProviderResult> {
  const start = Date.now();
  const side = params.tradeType === "BUY" ? "1" : "0"; // Bybit: 1=buy, 0=sell
  const url = "https://api2.bybit.com/fiat/otc/item/online";

  // Intentamos varios payloads (Bybit cambia su API frecuentemente)
  const payloads = [
    { userId: "", tokenId: params.asset, currencyId: params.fiat, payment: [], side, size: 20, page: 1, amountType: "", amount: "", searchType: 0, authFlag: false, isAdvanced: false, canTrade: false },
    { userId: "", tokenId: params.asset, currencyId: params.fiat, payment: [], side, size: 20, page: 1, amountType: null, amount: null, searchType: "0", authFlag: false, isAdvanced: false, canTrade: false },
    { tokenId: params.asset, currencyId: params.fiat, payment: [], side, size: 20, page: 1 },
  ];

  for (const payload of payloads) {
    const result = await fetchP2PJson(url, payload, {
      "Origin": "https://www.bybit.com",
      "Referer": "https://www.bybit.com/",
    });
    if ("error" in result) continue;
    if (result.status !== 200) continue;

    const data = result.data as BybitP2PResponse;
    if (data.ret_code !== 0 || !data.result?.items) continue;

    const offers: P2POffer[] = data.result.items
      .filter((it) => it.price && parseFloat(it.price) > 0)
      .map((it) => ({
        provider: "bybit-p2p",
        providerName: "Bybit P2P",
        advertiser: it.nickname || it.userName || "anónimo",
        asset: params.asset,
        fiat: params.fiat,
        tradeType: params.tradeType,
        price: parseFloat(it.price),
        minAmount: parseFloat(it.minAmount || "0"),
        maxAmount: parseFloat(it.maxAmount || "0"),
        available: parseFloat(it.surplusAmount || it.lastQuantity || "0"),
        paymentMethods: (it.paymentMethods || []).map((p) => p.paymentName),
        tradeCount: it.recentOrderNum || 0,
        completionRate: it.recentExecuteRate !== undefined ? it.recentExecuteRate / 100 : undefined,
        timestamp: Date.now(),
        latencyMs: Date.now() - start,
        status: "ONLINE" as ProviderStatus,
      }));

    return {
      providerId: "bybit-p2p",
      providerName: "Bybit P2P",
      offers,
      status: "ONLINE",
      latencyMs: Date.now() - start,
    };
  }

  return {
    providerId: "bybit-p2p",
    providerName: "Bybit P2P",
    offers: [],
    status: "DISABLED",
    error: "Bybit P2P API no responde (requiere parámetros exactos o geo-block desde server). La sección P2P de Bybit web funciona pero su API interna no es pública.",
    latencyMs: Date.now() - start,
  };
}

// ============================================================
// 3. OKX P2P — intentamos, API no documentada ⚠️
// ============================================================
export async function scanOkxP2P(params: {
  asset: string;
  fiat: string;
  tradeType: "BUY" | "SELL";
}): Promise<P2PProviderResult> {
  const start = Date.now();
  const side = params.tradeType === "BUY" ? "buy" : "sell";
  const url = "https://www.okx.com/v2/c2c/trading/adv/list";

  const payloads = [
    { side, quoteCurrency: params.fiat, baseCurrency: params.asset, quoteType: "price", page: 1, size: 20 },
    { side, quoteCurrency: params.fiat, baseCurrency: params.asset, page: 1, size: 20 },
  ];

  for (const payload of payloads) {
    const result = await fetchP2PJson(url, payload, {});
    if ("error" in result) continue;
    if (result.status !== 200) continue;

    const data = result.data;
    // Estructura puede variar — ser defensivos
    if (!data || (data.code && data.code !== "0" && data.code !== 0)) continue;
    const items = data.data?.items || data.data?.advList || data.data || [];
    if (!Array.isArray(items) || items.length === 0) continue;

    const offers: P2POffer[] = items
      .filter((it: any) => it.price || it.adv?.price)
      .slice(0, 20)
      .map((it: any) => {
        const adv = it.adv || it;
        const advertiser = it.advertiser || it.userInfo || {};
        return {
          provider: "okx-p2p",
          providerName: "OKX P2P",
          advertiser: advertiser.nickName || advertiser.userName || "anónimo",
          asset: params.asset,
          fiat: params.fiat,
          tradeType: params.tradeType,
          price: parseFloat(adv.price || "0"),
          minAmount: parseFloat(adv.minQuotePricePerOrder || adv.minAmount || "0"),
          maxAmount: parseFloat(adv.maxQuotePricePerOrder || adv.maxAmount || "0"),
          available: parseFloat(adv.availableAmount || adv.surplusAmount || "0"),
          paymentMethods: (adv.paymentMethods || []).map((p: any) => p.name || p),
          tradeCount: advertiser.completedOrderCount || advertiser.monthOrderCount || 0,
          completionRate: advertiser.completedRate ? advertiser.completedRate / 100 : undefined,
          timestamp: Date.now(),
          latencyMs: Date.now() - start,
          status: "ONLINE" as ProviderStatus,
        } as P2POffer;
      })
      .filter((o: P2POffer) => o.price > 0);

    if (offers.length > 0) {
      return {
        providerId: "okx-p2p",
        providerName: "OKX P2P",
        offers,
        status: "ONLINE",
        latencyMs: Date.now() - start,
      };
    }
  }

  return {
    providerId: "okx-p2p",
    providerName: "OKX P2P",
    offers: [],
    status: "DISABLED",
    error: "OKX P2P no tiene API pública documentada. El endpoint interno requiere cookies de sesión del navegador.",
    latencyMs: Date.now() - start,
  };
}

// ============================================================
// 4. HTX (Huobi) P2P — endpoint histórico ⚠️
// ============================================================
export async function scanHtxP2P(params: {
  asset: string;
  fiat: string;
  tradeType: "BUY" | "SELL";
}): Promise<P2PProviderResult> {
  const start = Date.now();
  const tradeType = params.tradeType === "BUY" ? "BUY" : "SELL";
  // Endpoint histórico (puede que ya no funcione)
  const url = `https://otc-api.huobi.com/v1/data/trade-market?coinName=${params.asset}&currFiat=${params.fiat}&tradeType=${tradeType}&currPage=1&pageSize=20&paymentMethod=&onlyTradable=true&isThumbsUp=false&isOnline=true&sortBy=price`;

  const result = await fetchP2PJson(url, null, { "Referer": "https://www.htx.com/" });

  if ("data" in result && result.data) {
    const data = result.data;
    if (data.code === 200 && Array.isArray(data.data)) {
      const offers: P2POffer[] = data.data
        .filter((it: any) => it.price && parseFloat(it.price) > 0)
        .map((it: any) => ({
          provider: "htx-p2p",
          providerName: "HTX P2P",
          advertiser: it.userName || it.nickname || "anónimo",
          asset: params.asset,
          fiat: params.fiat,
          tradeType: params.tradeType,
          price: parseFloat(it.price),
          minAmount: parseFloat(it.minTradeAmount || it.minAmount || "0"),
          maxAmount: parseFloat(it.maxTradeAmount || it.maxAmount || "0"),
          available: parseFloat(it.tradeCount || it.availableAmount || "0"),
          paymentMethods: (it.payments || []).map((p: any) => p.name || p),
          tradeCount: it.orderCount || it.tradeMonthCount || 0,
          completionRate: undefined,
          timestamp: Date.now(),
          latencyMs: Date.now() - start,
          status: "ONLINE" as ProviderStatus,
        }))
        .filter((o: P2POffer) => o.price > 0);

      if (offers.length > 0) {
        return {
          providerId: "htx-p2p",
          providerName: "HTX P2P",
          offers,
          status: "ONLINE",
          latencyMs: Date.now() - start,
        };
      }
    }
  }

  return {
    providerId: "htx-p2p",
    providerName: "HTX P2P",
    offers: [],
    status: "DISABLED",
    error: "HTX P2P endpoint histórico ya no responde. HTX migró su P2P a una API interna que requiere auth.",
    latencyMs: Date.now() - start,
  };
}

// ============================================================
// 5. KUCOIN P2P — bloqueado por Cloudflare ⚠️
// ============================================================
export async function scanKucoinP2P(params: {
  asset: string;
  fiat: string;
  tradeType: "BUY" | "SELL";
}): Promise<P2PProviderResult> {
  const start = Date.now();
  // KuCoin P2P endpoint interno — probablemente bloqueado por Cloudflare
  const url = "https://www.kucoin.com/_api/p2p/advertise/advertisement/list";
  const side = params.tradeType === "BUY" ? "BUY" : "SELL";
  const body = {
    currency: params.asset,
    side,
    legal: params.fiat,
    page: 1,
    pageSize: 20,
    pay: [],
    tradeType: 0,
  };

  const result = await fetchP2PJson(url, body, {
    "Origin": "https://www.kucoin.com",
    "Referer": "https://www.kucoin.com/p2p",
  });

  if ("data" in result && result.data) {
    const data = result.data;
    if (data.code === "200000" && Array.isArray(data.data?.items)) {
      const offers: P2POffer[] = data.data.items
        .filter((it: any) => it.price && parseFloat(it.price) > 0)
        .map((it: any) => ({
          provider: "kucoin-p2p",
          providerName: "KuCoin P2P",
          advertiser: it.advertiser?.nickName || it.userName || "anónimo",
          asset: params.asset,
          fiat: params.fiat,
          tradeType: params.tradeType,
          price: parseFloat(it.price),
          minAmount: parseFloat(it.minAmount || "0"),
          maxAmount: parseFloat(it.maxAmount || "0"),
          available: parseFloat(it.surplusAmount || "0"),
          paymentMethods: (it.payments || []).map((p: any) => p.payName || p),
          tradeCount: it.advertiser?.tradeCount || 0,
          completionRate: undefined,
          timestamp: Date.now(),
          latencyMs: Date.now() - start,
          status: "ONLINE" as ProviderStatus,
        }))
        .filter((o: P2POffer) => o.price > 0);

      if (offers.length > 0) {
        return {
          providerId: "kucoin-p2p",
          providerName: "KuCoin P2P",
          offers,
          status: "ONLINE",
          latencyMs: Date.now() - start,
        };
      }
    }
  }

  return {
    providerId: "kucoin-p2p",
    providerName: "KuCoin P2P",
    offers: [],
    status: "DISABLED",
    error: "KuCoin bloqueado por Cloudflare desde server (Akamai-like challenge).",
    latencyMs: Date.now() - start,
  };
}

// ============================================================
// 6. BITGET P2P — endpoint no documentado ⚠️
// ============================================================
export async function scanBitgetP2P(params: {
  asset: string;
  fiat: string;
  tradeType: "BUY" | "SELL";
}): Promise<P2PProviderResult> {
  const start = Date.now();
  const advertiseType = params.tradeType === "BUY" ? "BUY" : "SELL";
  // Bitget P2P endpoint público — intentamos varias variantes
  const urls = [
    `https://www.bitget.com/api/v2/p2p/merchant/advertise/list?advertiseType=${advertiseType}&asset=${params.asset}&legal=${params.fiat}&pageNo=1&pageSize=20`,
    `https://www.bitget.com/v2/p2p/online/advertise/list?asset=${params.asset}&fiat=${params.fiat}&side=${advertiseType}&pageNo=1&pageSize=20`,
  ];

  for (const url of urls) {
    const result = await fetchP2PJson(url, null, {});
    if ("error" in result) continue;
    if (result.status !== 200) continue;

    const data = result.data;
    if (!data || data.code !== "00000") continue;
    const items = data.data?.list || data.data?.items || data.data || [];
    if (!Array.isArray(items) || items.length === 0) continue;

    const offers: P2POffer[] = items
      .filter((it: any) => it.price && parseFloat(it.price) > 0)
      .slice(0, 20)
      .map((it: any) => ({
        provider: "bitget-p2p",
        providerName: "Bitget P2P",
        advertiser: it.nickName || it.userName || "anónimo",
        asset: params.asset,
        fiat: params.fiat,
        tradeType: params.tradeType,
        price: parseFloat(it.price),
        minAmount: parseFloat(it.minAmount || "0"),
        maxAmount: parseFloat(it.maxAmount || "0"),
        available: parseFloat(it.surplusAmount || "0"),
        paymentMethods: (it.payments || []).map((p: any) => p.payName || p),
        tradeCount: it.recentOrderNum || 0,
        completionRate: undefined,
        timestamp: Date.now(),
        latencyMs: Date.now() - start,
        status: "ONLINE" as ProviderStatus,
      }))
      .filter((o: P2POffer) => o.price > 0);

    if (offers.length > 0) {
      return {
        providerId: "bitget-p2p",
        providerName: "Bitget P2P",
        offers,
        status: "ONLINE",
        latencyMs: Date.now() - start,
      };
    }
  }

  return {
    providerId: "bitget-p2p",
    providerName: "Bitget P2P",
    offers: [],
    status: "DISABLED",
    error: "Bitget P2P endpoint no es público. Su página web usa API interna no documentada.",
    latencyMs: Date.now() - start,
  };
}

// ============================================================
// 7. GATE.IO P2P — bloqueado por Akamai ⚠️
// ============================================================
export async function scanGateP2P(params: {
  asset: string;
  fiat: string;
  tradeType: "BUY" | "SELL";
}): Promise<P2PProviderResult> {
  const start = Date.now();
  const side = params.tradeType === "BUY" ? "buy" : "sell";
  const url = "https://www.gate.io/p2p/api/v1/online_advert_items";
  const body = { currency: params.asset, fiat: params.fiat, side, page: 1, size: 20 };

  const result = await fetchP2PJson(url, body, {
    "Origin": "https://www.gate.io",
    "Referer": "https://www.gate.io/p2p",
  });

  if ("data" in result && result.data) {
    const data = result.data;
    if (Array.isArray(data.data)) {
      const offers: P2POffer[] = data.data
        .filter((it: any) => it.price && parseFloat(it.price) > 0)
        .map((it: any) => ({
          provider: "gate-p2p",
          providerName: "Gate.io P2P",
          advertiser: it.user?.username || it.nickname || "anónimo",
          asset: params.asset,
          fiat: params.fiat,
          tradeType: params.tradeType,
          price: parseFloat(it.price),
          minAmount: parseFloat(it.min_amount || it.minAmount || "0"),
          maxAmount: parseFloat(it.max_amount || it.maxAmount || "0"),
          available: parseFloat(it.surplus_amount || "0"),
          paymentMethods: (it.payment_methods || []).map((p: any) => p.name || p),
          tradeCount: it.user?.trade_count || 0,
          completionRate: undefined,
          timestamp: Date.now(),
          latencyMs: Date.now() - start,
          status: "ONLINE" as ProviderStatus,
        }))
        .filter((o: P2POffer) => o.price > 0);

      if (offers.length > 0) {
        return {
          providerId: "gate-p2p",
          providerName: "Gate.io P2P",
          offers,
          status: "ONLINE",
          latencyMs: Date.now() - start,
        };
      }
    }
  }

  return {
    providerId: "gate-p2p",
    providerName: "Gate.io P2P",
    offers: [],
    status: "DISABLED",
    error: "Gate.io bloqueado por Akamai (403 Access Denied desde server).",
    latencyMs: Date.now() - start,
  };
}

// ============================================================
// ORQUESTADOR: Llama a todos los providers en paralelo
// ============================================================
export async function scanAllP2PProviders(params: {
  asset: string;
  fiat: string;
  tradeType: "BUY" | "SELL";
}): Promise<{
  results: P2PProviderResult[];
  totalOffers: number;
}> {
  // Ejecutamos todos en paralelo — los que fallen se marcan DISABLED pero no bloquean a los demás
  const results = await Promise.all([
    scanBinanceP2P(params),
    scanBybitP2P(params),
    scanOkxP2P(params),
    scanHtxP2P(params),
    scanKucoinP2P(params),
    scanBitgetP2P(params),
    scanGateP2P(params),
  ]);

  const totalOffers = results.reduce((sum, r) => sum + r.offers.length, 0);
  return { results, totalOffers };
}
