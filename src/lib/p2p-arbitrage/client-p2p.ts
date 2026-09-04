// ============================================================
// CLIENT-SIDE P2P FETCHER — Se ejecuta en el navegador del usuario
// ============================================================
// Para exchanges que bloquean server-side (OKX, HTX, KuCoin, Bitget):
// El navegador del usuario SÍ puede acceder a sus APIs internas
// porque su IP no está en listas negras de Cloudflare/Akamai.
//
// Esta función se ejecuta CLIENT-SIDE. El usuario hace click en
// "Escanear con mi navegador" y su navegador hace fetch directo
// a los exchanges bloqueados. Los resultados se muestran en su UI.
//
// IMPORTANTE: Esto es para uso del usuario final — su IP, su
// responsabilidad. No automatizamos scraping agresivo.
// ============================================================

import type { P2POffer } from "../scanner/types";

interface P2PProviderResult {
  providerId: string;
  providerName: string;
  offers: P2POffer[];
  status: "ONLINE" | "ERROR" | "DISABLED";
  error?: string;
  latencyMs: number;
}

// ============================================================
// Helper: fetch client-side con timeout
// ============================================================
async function clientFetch(
  url: string,
  options: RequestInit = {},
  timeoutMs = 8000
): Promise<{ data: any; status: number } | { error: string; status: number }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const text = await res.text();
    if (text.trim().startsWith("<!") || text.trim().startsWith("<html") || text.trim().startsWith("<HTML")) {
      return { error: "Respuesta HTML (WAF bloqueando)", status: res.status };
    }
    try {
      const data = JSON.parse(text);
      return { data, status: res.status };
    } catch {
      return { error: "Respuesta no es JSON", status: res.status };
    }
  } catch (err) {
    clearTimeout(timeoutId);
    return { error: (err as Error).message, status: 0 };
  }
}

// ============================================================
// OKX P2P — desde el navegador
// ============================================================
// OKX usa session cookies+CSRF. Para acceder a su API P2P desde el navegador,
// el usuario necesita visitar okx.com/p2p una vez para que se seteen las
// cookies. Luego el navegador puede hacer fetch al endpoint interno.
// Como no podemos saber la cookie exacta, probamos los endpoints internos
// conocidos. Si el navegador tiene cookies OKX (visitó el sitio), funcionará.
export async function scanOkxP2PFromBrowser(params: {
  asset: string;
  fiat: string;
  tradeType: "BUY" | "SELL";
}): Promise<P2PProviderResult> {
  const start = Date.now();
  const side = params.tradeType === "BUY" ? "buy" : "sell";

  // Endpoint interno de OKX (probado con el navegador del usuario)
  // Si el usuario visitó okx.com antes, las cookies CSRF estarán seteadas
  const endpoints = [
    {
      url: "https://www.okx.com/v3/c2c/otc-trade/advertisement/list",
      body: {
        side,
        cryptoCurrency: params.asset,
        fiatCurrency: params.fiat,
        quoteType: "price",
        page: 1,
        size: 20,
      },
    },
    {
      url: "https://www.okx.com/v2/c2c/trading/adv/list",
      body: {
        side,
        quoteCurrency: params.fiat,
        baseCurrency: params.asset,
        quoteType: "price",
        page: 1,
        size: 20,
      },
    },
  ];

  for (const ep of endpoints) {
    // Client-side fetch usa credenciales: 'include' para enviar cookies OKX
    const result = await clientFetch(ep.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ep.body),
      credentials: "include",
    });

    if ("error" in result) continue;
    if (result.status !== 200) continue;

    const data = result.data;
    if (!data || (data.code && data.code !== "0" && data.code !== 0 && data.code !== "200")) continue;

    const items = data.data?.items || data.data?.advList || data.data?.advertiserList || (Array.isArray(data.data) ? data.data : []);
    if (!Array.isArray(items) || items.length === 0) continue;

    const offers: P2POffer[] = items
      .filter((it: any) => {
        const p = it.price || it.adv?.price;
        return p && parseFloat(p) > 0;
      })
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
          price: parseFloat(adv.price),
          minAmount: parseFloat(adv.minQuotePricePerOrder || adv.minAmount || "0"),
          maxAmount: parseFloat(adv.maxQuotePricePerOrder || adv.maxAmount || "0"),
          available: parseFloat(adv.availableAmount || adv.surplusAmount || "0"),
          paymentMethods: (adv.paymentMethods || []).map((p: any) => p.name || p),
          tradeCount: advertiser.completedOrderCount || advertiser.monthOrderCount || 0,
          completionRate: advertiser.completedRate ? advertiser.completedRate / 100 : undefined,
          timestamp: Date.now(),
          latencyMs: Date.now() - start,
          status: "ONLINE" as const,
        } as P2POffer;
      });

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
    error: "OKX P2P requiere sesión iniciada en okx.com. Visita https://www.okx.com/p2p en otra pestaña, inicia sesión, y vuelve a intentar.",
    latencyMs: Date.now() - start,
  };
}

// ============================================================
// HTX (Huobi) P2P — desde el navegador
// ============================================================
export async function scanHtxP2PFromBrowser(params: {
  asset: string;
  fiat: string;
  tradeType: "BUY" | "SELL";
}): Promise<P2PProviderResult> {
  const start = Date.now();
  const tradeType = params.tradeType === "BUY" ? "BUY" : "SELL";
  // HTX nuevo endpoint — puede que desde el navegador funcione
  const urls = [
    `https://otc-api.huobi.com/v1/data/trade-market?coinName=${params.asset}&currFiat=${params.fiat}&tradeType=${tradeType}&currPage=1&pageSize=20`,
    `https://otc-api.huobi.pro/v1/data/trade-market?coinName=${params.asset}&currFiat=${params.fiat}&tradeType=${tradeType}&currPage=1&pageSize=20`,
    `https://c2c-api.htx.com/v1/data/trade-market?coinName=${params.asset}&currFiat=${params.fiat}&tradeType=${tradeType}&currPage=1&pageSize=20`,
  ];

  for (const url of urls) {
    const result = await clientFetch(url, {
      method: "GET",
      credentials: "include",
    });

    if ("error" in result) continue;
    if (result.status !== 200) continue;

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
          status: "ONLINE" as const,
        }))
        .filter((o) => o.price > 0);

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
    error: "HTX no responde desde tu navegador tampoco. Probablemente HTX descontinuó su API pública P2P.",
    latencyMs: Date.now() - start,
  };
}

// ============================================================
// KuCoin P2P — desde el navegador
// ============================================================
export async function scanKucoinP2PFromBrowser(params: {
  asset: string;
  fiat: string;
  tradeType: "BUY" | "SELL";
}): Promise<P2PProviderResult> {
  const start = Date.now();
  const side = params.tradeType === "BUY" ? "BUY" : "SELL";

  const endpoints = [
    {
      url: "https://www.kucoin.com/_api/p2p/advertise/advertisement/list",
      body: { currency: params.asset, side, legal: params.fiat, page: 1, pageSize: 20, pay: [], tradeType: 0 },
    },
    {
      url: "https://www.kucoin.com/api/v1/p2p/adv/list",
      body: { currency: params.asset, side, legal: params.fiat, page: 1, pageSize: 20 },
    },
  ];

  for (const ep of endpoints) {
    const result = await clientFetch(ep.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ep.body),
      credentials: "include",
    });

    if ("error" in result) continue;
    if (result.status !== 200) continue;

    const data = result.data;
    if (!data || (data.code && data.code !== "200000")) continue;
    const items = data.data?.items || data.data?.list || [];
    if (!Array.isArray(items) || items.length === 0) continue;

    const offers: P2POffer[] = items
      .filter((it: any) => it.price && parseFloat(it.price) > 0)
      .slice(0, 20)
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
        status: "ONLINE" as const,
      }))
      .filter((o) => o.price > 0);

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

  return {
    providerId: "kucoin-p2p",
    providerName: "KuCoin P2P",
    offers: [],
    status: "DISABLED",
    error: "KuCoin bloquea las llamadas desde servidores cloud. Tu navegador también puede estar bloqueado — intenta visitar kucoin.com/p2p primero.",
    latencyMs: Date.now() - start,
  };
}

// ============================================================
// Bitget P2P — desde el navegador
// ============================================================
export async function scanBitgetP2PFromBrowser(params: {
  asset: string;
  fiat: string;
  tradeType: "BUY" | "SELL";
}): Promise<P2PProviderResult> {
  const start = Date.now();
  const advertiseType = params.tradeType === "BUY" ? "BUY" : "SELL";

  const urls = [
    `https://www.bitget.com/api/v2/p2p/merchant/advertise/list?advertiseType=${advertiseType}&asset=${params.asset}&legal=${params.fiat}&pageNo=1&pageSize=20`,
    `https://www.bitget.com/v2/p2p/online/advertise/list?asset=${params.asset}&fiat=${params.fiat}&side=${advertiseType}&pageNo=1&pageSize=20`,
  ];

  for (const url of urls) {
    const result = await clientFetch(url, {
      method: "GET",
      credentials: "include",
    });

    if ("error" in result) continue;
    if (result.status !== 200) continue;

    const data = result.data;
    if (!data || data.code !== "00000") continue;
    const items = data.data?.list || data.data?.items || [];
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
        status: "ONLINE" as const,
      }))
      .filter((o) => o.price > 0);

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
    error: "Bitget P2P no expone su API internamente en paths públicos. La web usa una API protegida que requiere sesión.",
    latencyMs: Date.now() - start,
  };
}

// ============================================================
// MEXC P2P — desde el navegador
// ============================================================
export async function scanMexcP2PFromBrowser(params: {
  asset: string;
  fiat: string;
  tradeType: "BUY" | "SELL";
}): Promise<P2PProviderResult> {
  const start = Date.now();
  const side = params.tradeType === "BUY" ? "BUY" : "SELL";

  const endpoints = [
    {
      url: "https://www.mexc.com/api/p2p/online/list",
      body: { asset: params.asset, fiat: params.fiat, side, page: 1, size: 20 },
    },
    {
      url: "https://www.mexc.com/api/p2p/adv/list",
      body: { asset: params.asset, fiat: params.fiat, side, page: 1, size: 20 },
    },
    {
      url: "https://www.mexc.com/api/p2p/ads/online",
      body: { asset: params.asset, fiat: params.fiat, side, page: 1, size: 20 },
    },
  ];

  for (const ep of endpoints) {
    const result = await clientFetch(ep.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ep.body),
      credentials: "include",
    });

    if ("error" in result) continue;
    if (result.status !== 200) continue;

    const data = result.data;
    if (!data || (data.code && data.code !== 0 && data.code !== "200" && data.code !== "200000")) continue;
    const items = data.data?.list || data.data?.items || data.data?.advertisements || (Array.isArray(data.data) ? data.data : []);
    if (!Array.isArray(items) || items.length === 0) continue;

    const offers: P2POffer[] = items
      .filter((it: any) => it.price && parseFloat(it.price) > 0)
      .slice(0, 20)
      .map((it: any) => ({
        provider: "mexc-p2p",
        providerName: "MEXC P2P",
        advertiser: it.nickName || it.userName || it.user?.nickname || "anónimo",
        asset: params.asset,
        fiat: params.fiat,
        tradeType: params.tradeType,
        price: parseFloat(it.price),
        minAmount: parseFloat(it.minAmount || it.min_limit || "0"),
        maxAmount: parseFloat(it.maxAmount || it.max_limit || "0"),
        available: parseFloat(it.surplusAmount || it.available_amount || "0"),
        paymentMethods: (it.payments || it.payment_methods || []).map((p: any) => p.name || p.payName || p),
        tradeCount: it.recentOrderNum || it.user?.tradeCount || 0,
        completionRate: (it.user?.completionRate !== undefined ? it.user.completionRate / 100 : undefined),
        timestamp: Date.now(),
        latencyMs: Date.now() - start,
        status: "ONLINE" as const,
      }))
      .filter((o) => o.price > 0);

    if (offers.length > 0) {
      return {
        providerId: "mexc-p2p",
        providerName: "MEXC P2P",
        offers,
        status: "ONLINE",
        latencyMs: Date.now() - start,
      };
    }
  }

  return {
    providerId: "mexc-p2p",
    providerName: "MEXC P2P",
    offers: [],
    status: "DISABLED",
    error: "MEXC bloquea las llamadas desde servidores cloud (Akamai). Tu navegador puede acceder — visita mexc.com/p2p primero para setear cookies.",
    latencyMs: Date.now() - start,
  };
}

// ============================================================
// ORQUESTADOR CLIENT-SIDE — ejecuta todos desde el navegador
// ============================================================
export async function scanAllP2PFromBrowser(params: {
  asset: string;
  fiat: string;
  tradeType: "BUY" | "SELL";
}): Promise<P2PProviderResult[]> {
  const results = await Promise.all([
    scanOkxP2PFromBrowser(params),
    scanHtxP2PFromBrowser(params),
    scanKucoinP2PFromBrowser(params),
    scanBitgetP2PFromBrowser(params),
    scanMexcP2PFromBrowser(params),
  ]);
  return results;
}
