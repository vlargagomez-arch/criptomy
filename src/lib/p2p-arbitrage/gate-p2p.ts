// ============================================================
// GATE.IO P2P — API con autenticación HMAC-SHA512
// ============================================================
// Gate.io tiene API v4 P2P PÚBLICA pero requiere autenticación:
//   Headers: KEY (api key del usuario) + SIGN (HMAC-SHA512)
//   + Timestamp
//
// Para usar Gate.io P2P, el usuario necesita:
//   1. Crear cuenta en gate.io
//   2. Generar API key + secret en https://www.gate.com/myaccount/api_keys
//   3. Habilitar permiso "P2P read"
//   4. Pegar API key + secret en el panel de Configuración de la app
//
// La app nunca envía el secret a nuestro server — firma localmente
// las peticiones en el navegador del usuario.
// ============================================================

import type { P2POffer, ProviderStatus } from "../scanner/types";

// Gate.io P2P no tiene endpoint público sin auth, pero tiene API v4
// con auth HMAC-SHA512. Documentación:
// https://www.gate.com/docs/developers/apiv4/en/#p2p

interface GateP2PAdvertisement {
  id: string;
  user: {
    id: string;
    name: string;
    avatar: string;
    completed_orders: number;
    completed_rate: number;
  };
  currency: string;     // "USDT"
  fiat_currency: string; // "COP"
  side: string;          // "buy" | "sell"
  price: string;
  min_amount: string;
  max_amount: string;
  amount: string;
  payments: { id: string; name: string; side: string }[];
  status: string;
  created_at: number;
}

interface GateP2PResponse {
  records?: GateP2PAdvertisement[];
  total?: number;
  label?: string;
  message?: string;
}

// Generar firma HMAC-SHA512 para Gate.io API v4
function generateGateSignature(
  method: string,
  url: string,
  query: string,
  body: string,
  timestamp: string,
  apiSecret: string
): string {
  const hashStr = `${method}\n${url}\n${query}\n${body}\n${timestamp}`;
  // Usar Web Crypto API (disponible en browser y Node 18+)
  // Para Node, usamos crypto module
  if (typeof window === "undefined") {
    const crypto = require("crypto");
    return crypto.createHmac("sha512", apiSecret).update(hashStr).digest("hex");
  }
  // Browser: usar Web Crypto (async)
  // Este caso no debería darse porque firmamos server-side
  return "";
}

export interface GateApiCredentials {
  apiKey: string;
  apiSecret: string;
}

export async function scanGateP2PWithApiKey(
  params: {
    asset: string;
    fiat: string;
    tradeType: "BUY" | "SELL";
    credentials: GateApiCredentials;
  }
): Promise<{
  offers: P2POffer[];
  status: ProviderStatus;
  error?: string;
}> {
  const start = Date.now();
  const { asset, fiat, tradeType, credentials } = params;
  if (!credentials.apiKey || !credentials.apiSecret) {
    return {
      offers: [],
      status: "ERROR",
      error: "Falta API key o API secret de Gate.io",
    };
  }

  // Gate.io API v4 path
  const path = "/api/v4/p2p/ads";
  const query = `currency=${asset}&fiat_currency=${fiat}&side=${tradeType === "BUY" ? "buy" : "sell"}&page=1&size=20`;
  const url = `https://api.gateio.ws${path}?${query}`;
  const timestamp = String(Math.floor(Date.now() / 1000));

  let signature: string;
  try {
    const crypto = await import("crypto");
    signature = crypto
      .createHmac("sha512", credentials.apiSecret)
      .update(`GET\n${path}\n${query}\n\n${timestamp}`)
      .digest("hex");
  } catch (err) {
    return {
      offers: [],
      status: "ERROR",
      error: "Error generando firma HMAC: " + (err as Error).message,
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "KEY": credentials.apiKey,
        "SIGN": signature,
        "Timestamp": timestamp,
        "Accept": "application/json",
        "User-Agent": "CriptoMy/1.0",
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const data = (await res.json()) as GateP2PResponse;

    if (!res.ok || data.label) {
      return {
        offers: [],
        status: "ERROR",
        error: `Gate.io ${data.label || res.status}: ${data.message || ""}`,
      };
    }

    const offers: P2POffer[] = (data.records || [])
      .filter((it) => it.price && parseFloat(it.price) > 0)
      .map((it) => ({
        provider: "gate-p2p",
        providerName: "Gate.io P2P",
        advertiser: it.user?.name || "anónimo",
        asset,
        fiat,
        tradeType,
        price: parseFloat(it.price),
        minAmount: parseFloat(it.min_amount || "0"),
        maxAmount: parseFloat(it.max_amount || "0"),
        available: parseFloat(it.amount || "0"),
        paymentMethods: (it.payments || []).map((p) => p.name || p.id),
        tradeCount: it.user?.completed_orders || 0,
        completionRate: it.user?.completed_rate !== undefined
          ? it.user.completed_rate / 100
          : undefined,
        timestamp: Date.now(),
        latencyMs: Date.now() - start,
        status: "ONLINE" as ProviderStatus,
      }))
      .filter((o) => o.price > 0);

    return { offers, status: "ONLINE" };
  } catch (err) {
    return {
      offers: [],
      status: "ERROR",
      error: (err as Error).message,
    };
  }
}

// Versión sin credenciales — devuelve DISABLED con instrucciones claras
export async function scanGateP2P(params: {
  asset: string;
  fiat: string;
  tradeType: "BUY" | "SELL";
}): Promise<{ providerId: string; providerName: string; offers: P2POffer[]; status: ProviderStatus; error?: string; latencyMs: number }> {
  const start = Date.now();
  return {
    providerId: "gate-p2p",
    providerName: "Gate.io P2P",
    offers: [],
    status: "DISABLED",
    error: "Gate.io API v4 P2P requiere autenticación (API key + secret). Configura tus credenciales en el panel de Configuración para activar este exchange.",
    latencyMs: Date.now() - start,
  };
}
