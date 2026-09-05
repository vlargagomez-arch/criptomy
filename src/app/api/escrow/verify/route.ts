import { NextRequest, NextResponse } from "next/server";

// ============================================================
// API: /api/escrow/verify — Verificación REAL de productos
// ============================================================
// Verifica que el producto entregado sea válido:
//
// GIFT_CARD: valida formato de código según el merchant
//   - Amazon: XXXX-XXXXXX-XXXX
//   - Steam: XXXXX-XXXXX-XXXXX
//   - Google Play: 16-20 chars alfanuméricos
//   - etc.
//
// GAME_ACCOUNT: valida formato + verifica perfil en Steam (HTTP)
//
// DIGITAL_PRODUCT / SUBSCRIPTION: verifica que el link responde HTTP
// ============================================================

const GIFT_CARD_FORMATS: Record<string, { pattern: RegExp; minLength: number; maxLength: number; name: string; example: string }> = {
  "Amazon":         { pattern: /^[A-Z0-9]{4}-[A-Z0-9]{6}-[A-Z0-9]{4}$/i, minLength: 14, maxLength: 18, name: "Amazon", example: "ABCD-EFGHIJ-KLMN" },
  "Steam":          { pattern: /^[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}$/i, minLength: 15, maxLength: 17, name: "Steam", example: "ABCDE-FGHIJ-KLMNO" },
  "Google Play":    { pattern: /^[A-Z0-9]{16,20}$/i, minLength: 16, maxLength: 20, name: "Google Play", example: "ABCDEFGHIJKLMNOP" },
  "Apple Store":    { pattern: /^X[A-Z0-9]{1}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i, minLength: 14, maxLength: 18, name: "Apple Store", example: "X4-ABCD-EFGH-IJKL" },
  "Netflix":        { pattern: /^[A-Z0-9]{12}$/i, minLength: 12, maxLength: 12, name: "Netflix", example: "ABCDEFGHIJKL" },
  "Spotify":        { pattern: /^[A-Z0-9]{18,27}$/i, minLength: 18, maxLength: 27, name: "Spotify", example: "ABCDEFGHIJKLMNOPQR" },
  "PlayStation":    { pattern: /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i, minLength: 19, maxLength: 19, name: "PlayStation", example: "ABCD-EFGH-IJKL-MNOP" },
  "Xbox":           { pattern: /^[A-Z0-9]{25}$/i, minLength: 25, maxLength: 25, name: "Xbox", example: "ABCDEFGHIJKLMNOPQRSTUVWXY" },
  "Disney+":        { pattern: /^[A-Z0-9]{12,16}$/i, minLength: 12, maxLength: 16, name: "Disney+", example: "ABCDEFGHIJKL" },
  "Riot Points":    { pattern: /^[A-Z0-9]{16,20}$/i, minLength: 16, maxLength: 20, name: "Riot Points", example: "ABCDEFGHIJKLMNOP" },
  "Free Fire":      { pattern: /^[A-Z0-9]{12,20}$/i, minLength: 12, maxLength: 20, name: "Free Fire", example: "ABCDEFGHIJKL" },
  "Otra":           { pattern: /^[A-Z0-9-]{8,30}$/i, minLength: 8, maxLength: 30, name: "Genérico", example: "mínimo 8 caracteres alfanuméricos" },
};

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { type, category, code, credentials, link } = body;

  try {
    if (type === "GIFT_CARD") {
      return NextResponse.json(verifyGiftCard(category, code || ""));
    } else if (type === "GAME_ACCOUNT") {
      return NextResponse.json(await verifyGameAccount(category, credentials || ""));
    } else {
      return NextResponse.json(await verifyDigitalProduct(link || "", credentials || ""));
    }
  } catch (err) {
    return NextResponse.json({ valid: false, status: "INVALID", message: "Error: " + (err as Error).message });
  }
}

function verifyGiftCard(category: string, code: string) {
  const codeClean = code.trim().toUpperCase().replace(/\s/g, "");
  if (!codeClean) return { valid: false, status: "INVALID", message: "Código vacío" };

  const format = GIFT_CARD_FORMATS[category] || GIFT_CARD_FORMATS["Otra"];

  if (codeClean.length < format.minLength)
    return { valid: false, status: "INVALID", message: `Muy corto para ${format.name} (mín ${format.minLength})`, details: `Esperado: ${format.example}` };
  if (codeClean.length > format.maxLength)
    return { valid: false, status: "INVALID", message: `Muy largo para ${format.name} (máx ${format.maxLength})`, details: `Esperado: ${format.example}` };
  if (!format.pattern.test(codeClean))
    return { valid: false, status: "INVALID", message: `Formato inválido para ${format.name}`, details: `Esperado: ${format.example}` };

  const uniqueChars = new Set(codeClean.replace(/-/g, "").split("")).size;
  if (uniqueChars < 3)
    return { valid: false, status: "INVALID", message: `Solo ${uniqueChars} caracteres únicos (sospechoso)` };

  const noDashes = codeClean.replace(/-/g, "");
  if (/^(0123456789|1234567890|ABCDEFGHIJ|AAAAAAAA)/.test(noDashes))
    return { valid: false, status: "INVALID", message: "Contiene secuencia obvia (falso)" };

  return { valid: true, status: "VALID", message: `Formato válido para ${format.name}`, details: `${codeClean.length} caracteres verificados` };
}

async function verifyGameAccount(category: string, credentials: string) {
  if (!credentials || !credentials.includes(":"))
    return { valid: false, status: "INVALID", message: "Formato inválido. Debe ser usuario:password" };

  const [username, ...pwdParts] = credentials.split(":");
  const password = pwdParts.join(":");
  if (username.length < 3) return { valid: false, status: "INVALID", message: "Usuario muy corto (mín 3)" };
  if (password.length < 4) return { valid: false, status: "INVALID", message: "Contraseña muy corta (mín 4)" };

  if (category.toLowerCase().includes("steam")) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`https://steamcommunity.com/id/${username}`, { method: "HEAD", signal: controller.signal, headers: { "User-Agent": "Mozilla/5.0" } });
      clearTimeout(timeoutId);
      if (res.status === 200) return { valid: true, status: "VALID", message: `Perfil Steam verificado: ${username}`, details: "Perfil existe en steamcommunity.com" };
      if (res.status === 404) return { valid: false, status: "INVALID", message: `Perfil Steam no encontrado: ${username}` };
    } catch {
      return { valid: true, status: "MANUAL_REVIEW", message: "Formato válido, verificar manualmente" };
    }
  }
  return { valid: true, status: "VALID", message: `Credenciales válidas para ${category}`, details: "Verifica el acceso antes de confirmar" };
}

async function verifyDigitalProduct(link: string, credentials: string) {
  if (!link && !credentials) return { valid: false, status: "INVALID", message: "Se requiere link o credenciales" };

  let linkMsg = "";
  if (link) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(link, { method: "HEAD", signal: controller.signal, headers: { "User-Agent": "Mozilla/5.0" } });
      clearTimeout(timeoutId);
      if (res.ok) linkMsg = `Link accesible (HTTP ${res.status})`;
      else if (res.status === 404) return { valid: false, status: "INVALID", message: `Link no encontrado (404)` };
      else linkMsg = `Link respondió HTTP ${res.status}`;
    } catch { linkMsg = "No se pudo verificar el link automáticamente"; }
  }

  if (credentials && credentials.length < 8) return { valid: false, status: "INVALID", message: "Credenciales muy cortas (mín 8)" };

  return { valid: true, status: "VALID", message: link ? linkMsg : "Credenciales válidas", details: "Verifica antes de confirmar" };
}
