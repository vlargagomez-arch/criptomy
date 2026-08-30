"use client";

// ============================================================
// Lightning Network — micropagos instantáneos de Bitcoin
// ============================================================
// Lightning Network permite pagos BTC instantáneos con comisiones
// de fracciones de centavo. Se usa para trades pequeños (< $100).
//
// En MVP usamos LNURL y APIs públicas de Lightning:
// - LNURL-auth para login sin password
// - LNURL-pay para generar invoices
// - LNURL-withdraw para retirar
//
// Para producción completa: correr un nodo LND propio o usar
// servicios como Voltage, Lightning Fairy, o OpenNode.

export interface LightningInvoice {
  paymentHash: string;
  paymentRequest: string; // BOLT11 invoice string (lnbc...)
  amountSats: number;
  description: string;
  createdAt: number;
  expiresAt: number; // timestamp
  status: "pending" | "paid" | "expired";
}

export interface LNURLPayParams {
  callback: string; // URL del servidor que genera la invoice
  minSendable: number; // msat
  maxSendable: number; // msat
  metadata: string; // JSON string
  commentAllowed?: number;
  tag: "payRequest";
}

// ============================================================
// Generar invoice BOLT11 (simulado para MVP)
// ============================================================
// En producción: usar la API de un nodo LND o servicio como OpenNode
// POST https://api.opennode.com/v1/charges
// { amount: 1000, currency: "btc", description: "..." }
// { data: { id, lightning_invoice: { pays_req: "lnbc10..." } } }

export function generateMockInvoice(amountSats: number, description: string): LightningInvoice {
  const paymentHash = generateRandomHex(32);
  const timestamp = Math.floor(Date.now() / 1000);
  const expiresAt = timestamp + 3600; // 1 hora

  // Generar BOLT11 invoice mock (en producción viene de LND)
  const amountMsat = amountSats * 1000;
  const invoice = `lnbc${amountSats}n1p${generateRandomHex(20)}1q${generateRandomHex(8)}q${generateRandomHex(40)}`;

  return {
    paymentHash,
    paymentRequest: invoice,
    amountSats,
    description,
    createdAt: timestamp,
    expiresAt,
    status: "pending",
  };
}

// ============================================================
// Decodificar invoice BOLT11 (básico)
// ============================================================
export interface DecodedInvoice {
  amountSats: number;
  description: string;
  paymentHash: string;
  expiry: number;
  timestamp: number;
  valid: boolean;
}

export function decodeBolt11(invoice: string): DecodedInvoice | null {
  // En MVP: parse simple del invoice
  // En producción: usar 'light-bolt11-decoder' o 'bolt11'
  if (!invoice.startsWith("lnbc")) return null;

  // Extraer monto (formato: lnbc1234n = 1234 msat = 1.234 sats)
  const amountMatch = invoice.match(/lnbc(\d+)([munp]?)/);
  let amountSats = 0;
  if (amountMatch) {
    const num = parseInt(amountMatch[1]);
    const unit = amountMatch[2];
    const multipliers: Record<string, number> = {
      "": 1, // sats
      m: 100000000, // 1 mBTC = 0.001 BTC
      u: 100000, // 1 µBTC = 0.000001 BTC
      n: 100, // 1 nBTC = 0.000000001 BTC
      p: 1, // 1 pBTC
    };
    if (unit === "") {
      amountSats = num; // ya está en sats
    } else {
      // mBTC = 100000000 sats, nBTC = 0.1 sats, pBTC = 0.0001 sats
      const satMult: Record<string, number> = {
        m: 100000000, // mBTC
        u: 100000, // µBTC
        n: 100, // nBTC → msat
        p: 1, // pBTC
      };
      amountSats = Math.floor((num * satMult[unit]) / 1000); // convertir msat → sats
    }
  }

  return {
    amountSats,
    description: "Invoice decodificado (parse básico)",
    paymentHash: generateRandomHex(32),
    expiry: 3600,
    timestamp: Math.floor(Date.now() / 1000),
    valid: true,
  };
}

// ============================================================
// LNURL-pay: resolver y pagar
// ============================================================

export async function resolveLNURL(lnurl: string): Promise<LNURLPayParams | null> {
  // LNURL puede ser:
  // 1. LNURL-encode (empieza con LNURL1...)
  // 2. bech32-encoded URL (decodificar a URL https://...)
  // 3. URL directa @user@domain.com (Lightning Address)

  let url = lnurl;

  // Lightning Address (user@domain.com)
  if (lnurl.includes("@")) {
    const [user, domain] = lnurl.split("@");
    url = `https://${domain}/.well-known/lnurlp/${user}`;
  } else if (lnurl.toUpperCase().startsWith("LNURL1")) {
    // En producción: decodificar bech32 a URL
    // Aquí pedimos al usuario la URL directa
    return null;
  }

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return data as LNURLPayParams;
  } catch (e) {
    console.error("[lightning] resolveLNURL error:", e);
    return null;
  }
}

export async function fetchInvoiceFromLNURL(
  payParams: LNURLPayParams,
  amountMsat: number,
  comment?: string
): Promise<string | null> {
  try {
    const url = new URL(payParams.callback);
    url.searchParams.set("amount", amountMsat.toString());
    if (comment && payParams.commentAllowed) {
      url.searchParams.set("comment", comment);
    }
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const data = await res.json();
    return data.pr as string; // payment request BOLT11
  } catch (e) {
    console.error("[lightning] fetchInvoice error:", e);
    return null;
  }
}

// ============================================================
// Verificar estado de pago (vía API del nodo)
// ============================================================
export async function checkInvoiceStatus(paymentHash: string): Promise<"pending" | "paid" | "expired"> {
  // En producción: GET https://api.opennode.com/v1/charge/{id}
  // o WebSocket para actualización real-time
  // MVP: simular
  return "pending";
}

// ============================================================
// Conexión con servicios Lightning públicos
// ============================================================

export const LIGHTNING_SERVICES = [
  {
    id: "opennode",
    name: "OpenNode",
    description: "API fácil de usar, gratis hasta $1000/mes",
    docs: "https://developers.opennode.com",
    requiresApiKey: true,
  },
  {
    id: "voltage",
    name: "Voltage",
    description: "Nodo LND administrado, control total",
    docs: "https://voltage.cloud",
    requiresApiKey: true,
  },
  {
    id: "lnbits",
    name: "LNBits",
    description: "Self-hosted, gratis, open source",
    docs: "https://lnbits.com",
    requiresApiKey: false,
  },
  {
    id: "alby",
    name: "Alby",
    description: "Wallet browser extension + API",
    docs: "https://getalby.com",
    requiresApiKey: false,
  },
] as const;

// ============================================================
// Helpers
// ============================================================

function generateRandomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function formatSats(sats: number): string {
  if (sats >= 100_000_000) {
    return `${(sats / 100_000_000).toFixed(8)} BTC`;
  }
  if (sats >= 1000) {
    return `${sats.toLocaleString()} sats`;
  }
  return `${sats} sats`;
}

export function satsToUSD(sats: number, btcPriceUSD: number): number {
  return (sats / 100_000_000) * btcPriceUSD;
}

export function usdToSats(usd: number, btcPriceUSD: number): number {
  return Math.round((usd / btcPriceUSD) * 100_000_000);
}

// Detectar si una wallet Lightning está disponible (Alby, etc.)
export function hasLightningWallet(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window as { webbtc?: unknown; webln?: unknown }).webln;
}

// Conectar con WebLN (Alby, etc.)
export async function enableWebLN(): Promise<boolean> {
  if (!hasLightningWallet()) return false;
  try {
    const webln = (window as { webln?: { enable: () => Promise<void> } }).webln;
    await webln!.enable();
    return true;
  } catch (e) {
    console.error("[lightning] WebLN enable failed:", e);
    return false;
  }
}

// Pagar invoice vía WebLN
export async function payInvoiceWebLN(invoice: string): Promise<{
  preimage: string;
  paymentHash: string;
} | null> {
  if (!hasLightningWallet()) return null;
  try {
    const webln = (window as { webln?: { sendPayment: (pr: string) => Promise<{ preimage: string; paymentHash: string }> } }).webln;
    const result = await webln!.sendPayment(invoice);
    return result;
  } catch (e) {
    console.error("[lightning] payInvoice error:", e);
    return null;
  }
}
