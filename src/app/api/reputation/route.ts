import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/reputation - dejar feedback a la contraparte
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tradeId, fromUserId, rating, comment, trustScore } = body;

    if (!tradeId || !fromUserId || !rating) {
      return NextResponse.json(
        { error: "Faltan campos obligatorios" },
        { status: 400 }
      );
    }
    if (rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "Rating debe estar entre 1 y 5" },
        { status: 400 }
      );
    }

    const trade = await db.trade.findUnique({
      where: { id: tradeId },
      include: { buyer: true, seller: true },
    });
    if (!trade) {
      return NextResponse.json({ error: "Trade no encontrado" }, { status: 404 });
    }
    if (trade.status !== "COMPLETED") {
      return NextResponse.json(
        { error: "Solo se puede dejar feedback en trades completados" },
        { status: 400 }
      );
    }

    const isBuyer = fromUserId === trade.buyerId;
    const isSeller = fromUserId === trade.sellerId;
    if (!isBuyer && !isSeller) {
      return NextResponse.json(
        { error: "No es parte del trade" },
        { status: 403 }
      );
    }
    const toUserId = isBuyer ? trade.sellerId : trade.buyerId;

    // Verificar que no haya ya feedback de este usuario para este trade
    const existing = await db.feedback.findUnique({
      where: { tradeId_fromUserId: { tradeId, fromUserId } },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Ya dejó feedback para este trade" },
        { status: 400 }
      );
    }

    const feedback = await db.feedback.create({
      data: {
        tradeId,
        fromUserId,
        toUserId,
        rating: parseInt(rating),
        comment: comment || null,
        trustScore: trustScore ? parseInt(trustScore) : 50,
      },
    });

    // Recalcular reputationScore del destinatario (promedio ponderado)
    const allFeedbacks = await db.feedback.findMany({
      where: { toUserId },
    });
    const avgRating =
      allFeedbacks.reduce((s, f) => s + f.rating, 0) / allFeedbacks.length;
    const newScore = (avgRating / 5) * 100;
    await db.user.update({
      where: { id: toUserId },
      data: { reputationScore: newScore },
    });

    return NextResponse.json({ feedback }, { status: 201 });
  } catch (err) {
    console.error("[reputation POST]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// GET /api/reputation?userId=...
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "userId requerido" }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        alias: true,
        reputationScore: true,
        totalTrades: true,
        completedTrades: true,
        disputedTrades: true,
        createdAt: true,
        torOnly: true,
        avatarSeed: true,
        bio: true,
      },
    });
    if (!user) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    const feedbacks = await db.feedback.findMany({
      where: { toUserId: userId },
      include: {
        fromUser: { select: { alias: true, avatarSeed: true } },
        trade: {
          select: {
            id: true,
            cryptoAmount: true,
            escrowAsset: true,
            offer: { select: { asset: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json({ user, feedbacks });
  } catch (err) {
    console.error("[reputation GET]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
