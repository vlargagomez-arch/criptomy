// ============================================================
// QUERY INTERPRETER — Natural Language → SearchIntent
// ============================================================
// Convierte queries en español a parámetros estructurados.
// No es un chatbot. Es un parser determinista.
//
// Ejemplos que soporta:
//   "Quiero comprar 1000 USDT con COP"
//   "Quiero vender 500 USDT"
//   "Quiero enviar 500.000 COP a México"
//   "Quiero encontrar la mejor oferta P2P de USDT"
//   "Quiero encontrar una oportunidad de arbitraje de USDT"
//   "Quiero cambiar USDT por BTC"
//   "Quiero el mejor precio para BTC"
// ============================================================

import type { SearchIntent, Operation, ScanMode } from "./types";

const COUNTRY_CURRENCY: Record<string, string> = {
  colombia: "CO", colombiano: "CO", "pesos colombianos": "CO", cop: "CO",
  mexico: "MX", méxico: "MX", mexicano: "MX", "pesos mexicanos": "MX", mxn: "MX",
  argentina: "AR", argentino: "AR", "pesos argentinos": "AR", ars: "AR",
  brasil: "BR", brazil: "BR", real: "BR", brl: "BR",
  chile: "CL", chileno: "CL", "pesos chilenos": "CL", clp: "CL",
  peru: "PE", peruano: "PE", soles: "PE", pen: "PE",
  ecuador: "EC", venezuela: "VE", dominicana: "DO",
  europa: "EU", europe: "EU", "unión europea": "EU", "union europea": "EU",
  "estados unidos": "US", usa: "US", "united states": "US", eeaa: "US",
};

const CURRENCIES = ["USDT", "USDC", "BTC", "ETH", "SOL", "BNB", "XRP", "ADA", "DOT", "LINK", "MATIC", "AVAX"];
const FIATS = ["USD", "EUR", "COP", "MXN", "ARS", "BRL", "CLP", "PEN", "VES", "VES"];

const PAYMENT_METHODS: Record<string, string> = {
  pse: "PSE",
  nequi: "Nequi",
  daviplata: "Daviplata",
  bancolombia: "Bancolombia",
  "transferencia bancaria": "Bank transfer",
  "transferencia": "Bank transfer",
  paypal: "PayPal",
  "apple pay": "Apple Pay",
  "google pay": "Google Pay",
  tarjeta: "Card",
  tarjeta_de_credito: "Card",
  efectivo: "Cash",
  "cash": "Cash",
  "en persona": "Cash in person",
};

export function interpretQuery(raw: string): SearchIntent {
  const query = raw.toLowerCase().trim();
  const intent: SearchIntent = {
    operation: "UNKNOWN",
    asset: "",
    raw,
  };

  // 1) Detectar operación
  if (/\b(comprar|compra|compr[ao]?)\b/.test(query) || /\b(on[\s-]?ramp|conseguir)\b/.test(query)) {
    intent.operation = "BUY";
  } else if (/\b(vender|venta|vend[aeo]?)\b/.test(query) || /\b(off[\s-]?ramp|retirar|retiro|sacar)\b/.test(query)) {
    intent.operation = "SELL";
  } else if (/\b(enviar|env[íi]o|transferir|transferencia (a|al|hacia)|mandar|remitir)\b/.test(query)) {
    intent.operation = "SEND";
  } else if (/\barbitraje\b/.test(query)) {
    intent.operation = "ARBITRAGE";
  } else if (/\bcomparar|compar[ao]?\b/.test(query) || /\bmejor precio\b/.test(query)) {
    intent.operation = "COMPARE";
  } else if (/\bp2p\b/.test(query) || /\boferta\b/.test(query) || /\bofertas\b/.test(query)) {
    intent.operation = "FIND_P2P";
  }

  // 2) Detectar cantidad
  // Estrategia: buscar el primer número seguido (opcionalmente) de un token de cripto/fiat
  // Formatos soportados: "1000", "500.000", "500,000", "1000.50", "1000,50", "0.5"
  // Heurística para distinguir separador de miles vs decimal:
  //   - Si el número tiene un solo punto o coma y luego 1-2 dígitos al final → decimal
  //   - Si el número tiene un solo punto o coma y luego exactamente 3 dígitos → miles
  //   - Si tiene varios separadores → son miles
  const amountRegex = /(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d+[.,]\d{1,2}|\d+)/i;
  const amountMatch = query.match(amountRegex);
  if (amountMatch && amountMatch[1]) {
    const rawAmount = amountMatch[1];
    let normalized: string;

    // Caso: tiene varios separadores (1.234.567 o 1,234,567) → todos son miles
    if ((rawAmount.match(/[.,]/g) || []).length > 1) {
      normalized = rawAmount.replace(/[.,]/g, "");
    }
    // Caso: un solo separador
    else if (/[.,]/.test(rawAmount)) {
      const sep = rawAmount.match(/[.,]/)[0];
      const afterSep = rawAmount.split(sep)[1] || "";
      if (afterSep.length === 3 && /^\d{3}$/.test(afterSep)) {
        // Parece separador de miles (ej: "500.000" → 500000)
        normalized = rawAmount.replace(/[.,]/g, "");
      } else {
        // Parece decimal (ej: "1000.50" o "0.5")
        normalized = rawAmount.replace(/,/, ".");
      }
    } else {
      normalized = rawAmount;
    }

    const amount = parseFloat(normalized);
    if (!isNaN(amount) && amount > 0) {
      intent.amount = amount;
      // Buscar la unidad que sigue al número
      const afterNumber = query.slice(query.indexOf(amountMatch[1]) + amountMatch[1].length).trim();
      const unitMatch = afterNumber.match(/^(usdt|usdc|btc|eth|sol|cop|mxn|ars|brl|clp|pen|ves|usd|eur|bnb|xrp|ada|dot|link|matic|avax)\b/i);
      if (unitMatch) {
        const upper = unitMatch[1].toUpperCase();
        if (CURRENCIES.includes(upper)) intent.asset = upper;
        else if (FIATS.includes(upper)) intent.fiat = upper;
      }
    }
  }

  // 3) Detectar activo cripto (USDT, BTC, etc.)
  if (!intent.asset) {
    for (const cur of CURRENCIES) {
      const regex = new RegExp(`\\b${cur.toLowerCase()}\\b`, "i");
      if (regex.test(query)) {
        intent.asset = cur;
        break;
      }
    }
  }

  // 4) Detectar fiat (COP, MXN, USD, etc.)
  if (!intent.fiat) {
    for (const fiat of FIATS) {
      const regex = new RegExp(`\\b${fiat.toLowerCase()}\\b`, "i");
      if (regex.test(query)) {
        intent.fiat = fiat;
        break;
      }
    }
  }

  // 5) Detectar país ("en Colombia", "a México")
  const countryMatch = query.match(/\b(?:en|a|al|hacia)\s+(colombia|méxico|mexico|argentina|brasil|brazil|chile|peru|ecuador|venezuela|rep[uú]blica dominicana)\b/);
  if (countryMatch) {
    const c = countryMatch[1].toLowerCase();
    intent.country = COUNTRY_CURRENCY[c];
  } else {
    // Buscar directa en el mapping
    for (const [keyword, code] of Object.entries(COUNTRY_CURRENCY)) {
      const regex = new RegExp(`\\b${keyword}\\b`, "i");
      if (regex.test(query)) {
        intent.country = code;
        break;
      }
    }
  }

  // 6) Default fiat según país detectado
  if (!intent.fiat && intent.country) {
    const countryToFiat: Record<string, string> = {
      CO: "COP", MX: "MXN", AR: "ARS", BR: "BRL", CL: "CLP", PE: "PEN", VE: "VES", EC: "USD", DO: "DOP",
      EU: "EUR", US: "USD",
    };
    intent.fiat = countryToFiat[intent.country] || "USD";
  }

  // 6.5) Detectar región (Europa, LATAM, US)
  if (intent.country === "EU") intent.region = "EU";
  else if (["CO", "MX", "AR", "BR", "CL", "PE", "EC", "VE", "DO"].includes(intent.country || "")) intent.region = "LATAM";
  else if (intent.country === "US") intent.region = "US";

  // 6.6) Detectar prioridad del usuario
  if (/\b(m[áa]s barato|barato|menor costo|menor comisi[óo]n|m[áa]s econ[óo]mico|ahorrar|cheap)\b/i.test(query)) {
    intent.priority = "CHEAPEST";
  } else if (/\b(r[áa]pido|menor tiempo|inmediato|ya|fast|quick|velocidad)\b/i.test(query)) {
    intent.priority = "FASTEST";
  } else if (/\b(sin kyc|sin verificaci[óo]n|an[óo]nimo|no kyc|without kyc)\b/i.test(query)) {
    intent.priority = "NO_KYC";
  } else if (/\b(mejor (tipo de cambio|rate|cambio)|mejor precio)\b/i.test(query)) {
    intent.priority = "BEST_RATE";
  }

  // 7) Default asset si operation es SEND o ARBITRAGE
  if (!intent.asset && (intent.operation === "SEND" || intent.operation === "ARBITRAGE" || intent.operation === "COMPARE")) {
    intent.asset = "USDT"; // default para remesas y arbitraje
  }

  // 8) Detectar método de pago
  for (const [keyword, method] of Object.entries(PAYMENT_METHODS)) {
    const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (regex.test(query)) {
      intent.paymentMethod = method;
      break;
    }
  }

  // 9) Default asset: si solo menciona fiat y operation es BUY, asumimos USDT
  if (intent.operation === "BUY" && intent.fiat && !intent.asset) {
    intent.asset = "USDT";
  }

  // 10) Default: si no se detectó operación pero hay activo/cantidad, asumir COMPARE
  if (intent.operation === "UNKNOWN" && (intent.asset || intent.amount)) {
    intent.operation = "COMPARE";
  }

  return intent;
}

// Sugerencias rápidas para el UI
export const QUICK_SEARCHES = [
  { label: "Comprar 2000 USDT en Europa", query: "Quiero comprar 2000 USDT en Europa", icon: "🇪🇺" },
  { label: "Comprar 1000 USDT con COP", query: "Quiero comprar 1000 USDT con COP", icon: "🛒" },
  { label: "Comprar 500 USDT con euros", query: "Quiero comprar 500 USDT con euros", icon: "€" },
  { label: "Comprar BTC sin KYC", query: "Quiero comprar 0.01 BTC sin KYC", icon: "🔓" },
  { label: "Vender 3000 USDT y recibir EUR", query: "Quiero vender 3000 USDT y recibir EUR", icon: "💸" },
  { label: "Convertir 1000 euros a USDT", query: "Quiero convertir 1000 euros a USDT", icon: "🔄" },
  { label: "Forma más barata de comprar USDT", query: "Cuál es la forma más barata de comprar USDT", icon: "💰" },
  { label: "Comprar USDT que lleguen rápido", query: "Quiero comprar 2000 USDT y necesito que lleguen rápido", icon: "⚡" },
  { label: "Comprar BTC con tarjeta en Colombia", query: "Quiero comprar bitcoin con tarjeta en Colombia", icon: "💳" },
  { label: "Enviar 500.000 COP a México", query: "Quiero enviar 500.000 COP a México", icon: "🌐" },
];
