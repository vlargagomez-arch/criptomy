import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/disputes - lista disputas (en MVP: todas; en producción: solo las del user o árbitro)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    const where: Record<string, unknown> = {};
    if (userId) {
      where.OR = [{ openerId: userId }, { defendantId: userId }];
    }

    const disputes = await db.dispute.findMany({
      where,
      include: {
        trade: {
          include: {
            buyer: { select: { id: true, alias: true, avatarSeed: true } },
            seller: { select: { id: true, alias: true, avatarSeed: true } },
          },
        },
        opener: { select: { alias: true, avatarSeed: true } },
        defendant: { select: { alias: true, avatarSeed: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ disputes });
  } catch (err) {
    console.error("[disputes GET]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// POST /api/disputes - abre disputa
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tradeId, openerId, reason, evidence } = body;

    if (!tradeId || !openerId || !reason) {
      return NextResponse.json(
        { error: "Faltan campos obligatorios" },
        { status: 400 }
      );
    }

    const trade = await db.trade.findUnique({
      where: { id: tradeId },
    });
    if (!trade) {
      return NextResponse.json({ error: "Trade no encontrado" }, { status: 404 });
    }

    const isBuyer = openerId === trade.buyerId;
    const isSeller = openerId === trade.sellerId;
    if (!isBuyer && !isSeller) {
      return NextResponse.json(
        { error: "No es parte del trade" },
        { status: 403 }
      );
    }
    const defendantId = isBuyer ? trade.sellerId : trade.buyerId;

    // Verificar que no haya disputa ya abierta
    const existing = await db.dispute.findUnique({ where: { tradeId } });
    if (existing) {
      return NextResponse.json(
        { error: "Ya existe disputa para este trade" },
        { status: 400 }
      );
    }

    const dispute = await db.dispute.create({
      data: {
        tradeId,
        openerId,
        defendantId,
        reason,
        evidence: evidence || null,
        status: "OPEN",
      },
    });

    // Marcar trade como disputado
    await db.trade.update({
      where: { id: tradeId },
      data: { status: "DISPUTED", disputeStarted: true },
    });

    // Incrementar contador de disputas en ambos usuarios
    await db.user.update({
      where: { id: trade.buyerId },
      data: { disputedTrades: { increment: 1 } },
    });
    await db.user.update({
      where: { id: trade.sellerId },
      data: { disputedTrades: { increment: 1 } },
    });

    return NextResponse.json({ dispute }, { status: 201 });
  } catch (err) {
    console.error("[disputes POST]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
