import { NextRequest, NextResponse } from "next/server";

// ============================================================
// API: /api/escrow — CRUD de transacciones escrow
// ============================================================
// Tipos de productos:
//   - GIFT_CARD: Gift cards (Amazon, Steam, Google Play, Netflix, etc.)
//   - DIGITAL_PRODUCT: Productos digitales (cursos, ebooks, software, licencias)
//   - SUBSCRIPTION: Suscripciones (Netflix, Spotify, etc.)
//   - GAME_ACCOUNT: Cuentas de juegos (Steam, Epic, Riot, etc.)
//
// Estados:
//   - CREATED: Oferta creada, esperando comprador
//   - FUNDED: Comprador pagó (USDT al escrow), esperando entrega
//   - DELIVERED: Vendedor entregó el producto, esperando confirmación
//   - COMPLETED: Comprador confirmó, fondos liberados al vendedor
//   - DISPUTED: Disputa abierta, requiere arbitraje
//   - CANCELLED: Cancelada por el creador
// ============================================================

interface EscrowOffer {
  id: string;
  type: "GIFT_CARD" | "DIGITAL_PRODUCT" | "SUBSCRIPTION" | "GAME_ACCOUNT";
  title: string;
  description: string;
  category: string; // Amazon, Steam, Netflix, etc.
  price: number; // en USDT
  seller: string; // wallet address
  sellerAlias: string;
  buyer?: string;
  buyerAlias?: string;
  status: "CREATED" | "FUNDED" | "DELIVERED" | "COMPLETED" | "DISPUTED" | "CANCELLED";
  // Datos del producto (solo visibles después de FUNDED)
  productData?: {
    code?: string; // código de gift card
    credentials?: string; // usuario:password de cuenta
    link?: string; // link de descarga
    instructions?: string; // instrucciones de uso
  };
  // Validación
  validationStatus: "PENDING" | "VALIDATED" | "INVALID";
  validationNote?: string;
  escrowAmount: number; // USDT retenido en escrow
  createdAt: number;
  updatedAt: number;
  fundedAt?: number;
  deliveredAt?: number;
  completedAt?: number;
}

// En producción esto iría en una DB. Por ahora usamos un Map en memoria.
// Persistimos en /tmp para no perder datos entre requests en dev.
const DB_FILE = "/tmp/escrow-db.json";

function loadDB(): Record<string, EscrowOffer> {
  try {
    const fs = require("fs");
    if (fs.existsSync(DB_FILE)) {
      return JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
    }
  } catch {}
  return {};
}

function saveDB(db: Record<string, EscrowOffer>) {
  try {
    const fs = require("fs");
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  } catch {}
}

function generateId(): string {
  return `esc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// GET /api/escrow — listar ofertas (solo CREATED, públicas)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const filter = searchParams.get("filter"); // "all" | "mine" | "created" | "funded" | "completed"
  const wallet = searchParams.get("wallet");
  const db = loadDB();

  let offers = Object.values(db);

  if (filter === "mine" && wallet) {
    offers = offers.filter(o => o.seller === wallet || o.buyer === wallet);
  } else if (filter === "created") {
    offers = offers.filter(o => o.status === "CREATED");
  } else if (filter === "funded") {
    offers = offers.filter(o => o.status === "FUNDED" || o.status === "DELIVERED");
  } else if (filter === "completed") {
    offers = offers.filter(o => o.status === "COMPLETED");
  } else {
    // Default: solo CREATED (ofertas disponibles)
    offers = offers.filter(o => o.status === "CREATED");
  }

  // Ocultar productData si no está FUNDED/DELIVERED/COMPLETED
  offers = offers.map(o => {
    if (o.status === "CREATED") {
      const { productData, ...publicOffer } = o;
      return publicOffer;
    }
    return o;
  });

  return NextResponse.json({ offers, count: offers.length });
}

// POST /api/escrow — crear oferta o ejecutar acción
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action } = body;

  if (action === "create") {
    // Crear nueva oferta
    const offer: EscrowOffer = {
      id: generateId(),
      type: body.type,
      title: body.title,
      description: body.description,
      category: body.category,
      price: parseFloat(body.price),
      seller: body.seller,
      sellerAlias: body.sellerAlias || "anónimo",
      status: "CREATED",
      validationStatus: "PENDING",
      escrowAmount: parseFloat(body.price),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const db = loadDB();
    db[offer.id] = offer;
    saveDB(db);

    return NextResponse.json({ success: true, offer });

  } else if (action === "fund") {
    // Comprador financia el escrow (paga USDT)
    const db = loadDB();
    const offer = db[body.offerId];
    if (!offer) return NextResponse.json({ error: "Oferta no encontrada" }, { status: 404 });
    if (offer.status !== "CREATED") return NextResponse.json({ error: "Oferta no disponible" }, { status: 400 });

    offer.buyer = body.buyer;
    offer.buyerAlias = body.buyerAlias || "anónimo";
    offer.status = "FUNDED";
    offer.fundedAt = Date.now();
    offer.updatedAt = Date.now();
    db[offer.id] = offer;
    saveDB(db);

    return NextResponse.json({ success: true, offer });

  } else if (action === "deliver") {
    // Vendedor entrega el producto
    const db = loadDB();
    const offer = db[body.offerId];
    if (!offer) return NextResponse.json({ error: "Oferta no encontrada" }, { status: 404 });
    if (offer.status !== "FUNDED") return NextResponse.json({ error: "Oferta no está fundada" }, { status: 400 });
    if (offer.seller !== body.seller) return NextResponse.json({ error: "Solo el vendedor puede entregar" }, { status: 403 });

    offer.productData = {
      code: body.code,
      credentials: body.credentials,
      link: body.link,
      instructions: body.instructions,
    };
    offer.status = "DELIVERED";
    offer.deliveredAt = Date.now();
    offer.updatedAt = Date.now();

    // Validación automática básica
    if (offer.type === "GIFT_CARD" && body.code) {
      // Validar formato de gift card (longitud mínima, caracteres alfanuméricos)
      const code = body.code.trim().toUpperCase().replace(/\s/g, "");
      if (code.length >= 8 && /^[A-Z0-9]+$/.test(code)) {
        offer.validationStatus = "VALIDATED";
        offer.validationNote = "Formato de código válido. Verifica el saldo en la plataforma oficial.";
      } else {
        offer.validationStatus = "INVALID";
        offer.validationNote = "Formato de código inválido (mínimo 8 caracteres alfanuméricos).";
      }
    } else if (offer.type === "GAME_ACCOUNT" && body.credentials) {
      if (body.credentials.includes(":") && body.credentials.length >= 10) {
        offer.validationStatus = "VALIDATED";
        offer.validationNote = "Credenciales con formato válido (usuario:password). Verifica el acceso antes de confirmar.";
      } else {
        offer.validationStatus = "INVALID";
        offer.validationNote = "Credenciales con formato inválido. Debe ser usuario:password.";
      }
    } else {
      offer.validationStatus = "VALIDATED";
      offer.validationNote = "Producto entregado. Verifica antes de confirmar la recepción.";
    }

    db[offer.id] = offer;
    saveDB(db);

    return NextResponse.json({ success: true, offer });

  } else if (action === "confirm") {
    // Comprador confirma recepción → libera fondos al vendedor
    const db = loadDB();
    const offer = db[body.offerId];
    if (!offer) return NextResponse.json({ error: "Oferta no encontrada" }, { status: 404 });
    if (offer.status !== "DELIVERED") return NextResponse.json({ error: "Oferta no entregada" }, { status: 400 });
    if (offer.buyer !== body.buyer) return NextResponse.json({ error: "Solo el comprador puede confirmar" }, { status: 403 });

    offer.status = "COMPLETED";
    offer.completedAt = Date.now();
    offer.updatedAt = Date.now();
    db[offer.id] = offer;
    saveDB(db);

    return NextResponse.json({ success: true, offer, message: "Fondos liberados al vendedor" });

  } else if (action === "dispute") {
    // Abrir disputa
    const db = loadDB();
    const offer = db[body.offerId];
    if (!offer) return NextResponse.json({ error: "Oferta no encontrada" }, { status: 404 });
    if (!["FUNDED", "DELIVERED"].includes(offer.status)) return NextResponse.json({ error: "No se puede disputar" }, { status: 400 });
    if (offer.buyer !== body.wallet && offer.seller !== body.wallet) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    offer.status = "DISPUTED";
    offer.updatedAt = Date.now();
    db[offer.id] = offer;
    saveDB(db);

    return NextResponse.json({ success: true, offer });

  } else if (action === "cancel") {
    // Cancelar oferta (solo CREATED)
    const db = loadDB();
    const offer = db[body.offerId];
    if (!offer) return NextResponse.json({ error: "Oferta no encontrada" }, { status: 404 });
    if (offer.status !== "CREATED") return NextResponse.json({ error: "No se puede cancelar" }, { status: 400 });
    if (offer.seller !== body.wallet) return NextResponse.json({ error: "Solo el vendedor puede cancelar" }, { status: 403 });

    offer.status = "CANCELLED";
    offer.updatedAt = Date.now();
    db[offer.id] = offer;
    saveDB(db);

    return NextResponse.json({ success: true, offer });
  }

  return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
}
