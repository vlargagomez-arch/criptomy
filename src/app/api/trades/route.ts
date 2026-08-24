import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/trades - lista trades del usuario (como comprador o vendedor)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const role = searchParams.get("role"); // buyer | seller | all

    if (!userId) {
      return NextResponse.json(
        { error: "userId requerido" },
        { status: 400 }
      );
    }

    const where: Record<string, unknown> = {};
    if (role === "buyer") where.buyerId = userId;
    else if (role === "seller") where.sellerId = userId;
    else
      where.OR = [{ buyerId: userId }, { sellerId: userId }];

    const trades = await db.trade.findMany({
      where,
      include: {
        offer: { include: { creator: true } },
        buyer: { select: { id: true, alias: true, reputationScore: true, avatarSeed: true } },
        seller: { select: { id: true, alias: true, reputationScore: true, avatarSeed: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({ trades });
  } catch (err) {
    console.error("[trades GET]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// POST /api/trades - crea un trade a partir de una oferta
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      offerId,
      buyerId,
      cryptoAmount,
      paymentMethod,
      paymentDetails, // cifrado con la clave pública del vendedor
    } = body;

    if (!offerId || !buyerId || !cryptoAmount || !paymentMethod) {
      return NextResponse.json(
        { error: "Faltan campos obligatorios" },
        { status: 400 }
      );
    }

    const offer = await db.offer.findUnique({
      where: { id: offerId },
      include: { creator: true },
    });
    if (!offer) {
      return NextResponse.json({ error: "Oferta no existe" }, { status: 404 });
    }
    if (offer.status !== "ACTIVE") {
      return NextResponse.json({ error: "Oferta inactiva" }, { status: 400 });
    }
    if (offer.creatorId === buyerId) {
      return NextResponse.json(
        { error: "No puede comprar su propia oferta" },
        { status: 400 }
      );
    }

    // Determinar comprador/vendedor según el tipo de oferta
    // Si la oferta es SELL, el creador es el vendedor; el que acepta es comprador.
    // Si la oferta es BUY, el creador es el comprador; el que acepta es vendedor.
    const isCreatorSeller = offer.type === "SELL";
    const sellerId = isCreatorSeller ? offer.creatorId : buyerId;
    const buyerIdFinal = isCreatorSeller ? buyerId : offer.creatorId;

    const fiatAmount = cryptoAmount * offer.pricePerUnit;

    const trade = await db.trade.create({
      data: {
        offerId,
        buyerId: buyerIdFinal,
        sellerId,
        cryptoAmount: parseFloat(cryptoAmount),
        fiatAmount,
        pricePerUnit: offer.pricePerUnit,
        paymentMethod,
        paymentDetails: paymentDetails || "",
        escrowChain: offer.chain,
        escrowAsset: offer.asset,
        status: "PENDING_ESCROW",
      },
      include: {
        buyer: { select: { id: true, alias: true, reputationScore: true, avatarSeed: true } },
        seller: { select: { id: true, alias: true, reputationScore: true, avatarSeed: true } },
        offer: true,
      },
    });

    return NextResponse.json({ trade }, { status: 201 });
  } catch (err) {
    console.error("[trades POST]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
