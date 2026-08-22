import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/offers - lista ofertas activas con filtros
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const chain = searchParams.get("chain");
    const asset = searchParams.get("asset");
    const currency = searchParams.get("currency");
    const type = searchParams.get("type"); // BUY | SELL
    const paymentMethod = searchParams.get("paymentMethod");
    const creatorId = searchParams.get("creatorId");

    const where: Record<string, unknown> = { status: "ACTIVE" };
    if (chain) where.chain = chain;
    if (asset) where.asset = asset;
    if (currency) where.currency = currency;
    if (type) where.type = type;
    if (creatorId) where.creatorId = creatorId;
    if (paymentMethod)
      where.paymentMethods = { contains: paymentMethod };

    const offers = await db.offer.findMany({
      where,
      include: {
        creator: {
          select: {
            id: true,
            alias: true,
            reputationScore: true,
            totalTrades: true,
            avatarSeed: true,
            torOnly: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({ offers });
  } catch (err) {
    console.error("[offers GET]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// POST /api/offers - crea una oferta nueva
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      creatorId,
      type,
      chain,
      asset,
      amount,
      minAmount,
      maxAmount,
      currency,
      pricePerUnit,
      priceType,
      marketMargin,
      paymentMethods, // array de IDs
      terms,
      paymentWindowMin,
    } = body;

    if (!creatorId || !type || !chain || !asset || !amount || !currency || !pricePerUnit) {
      return NextResponse.json(
        { error: "Faltan campos obligatorios" },
        { status: 400 }
      );
    }
    if (!Array.isArray(paymentMethods) || paymentMethods.length === 0) {
      return NextResponse.json(
        { error: "Seleccione al menos un método de pago" },
        { status: 400 }
      );
    }

    const offer = await db.offer.create({
      data: {
        creatorId,
        type,
        chain,
        asset,
        amount: parseFloat(amount),
        minAmount: minAmount ? parseFloat(minAmount) : null,
        maxAmount: maxAmount ? parseFloat(maxAmount) : null,
        currency,
        pricePerUnit: parseFloat(pricePerUnit),
        priceType: priceType || "FIXED",
        marketMargin: marketMargin ? parseFloat(marketMargin) : null,
        paymentMethods: paymentMethods.join(","),
        terms: terms || "",
        paymentWindowMin: paymentWindowMin || 60,
        escrowType: "SMART_CONTRACT",
        status: "ACTIVE",
      },
      include: {
        creator: {
          select: {
            id: true,
            alias: true,
            reputationScore: true,
            totalTrades: true,
            avatarSeed: true,
          },
        },
      },
    });

    return NextResponse.json({ offer }, { status: 201 });
  } catch (err) {
    console.error("[offers POST]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
