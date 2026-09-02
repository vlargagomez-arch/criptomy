import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/dashboard?userId=...
// Devuelve estadísticas para el dashboard del usuario
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
        torOnly: true,
        walletAddress: true,
        avatarSeed: true,
        bio: true,
        publicKey: true,
        createdAt: true,
        lastSeenAt: true,
      },
    });
    if (!user) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    const [activeOffers, activeTrades, openDisputes, recentFeedbacks] =
      await Promise.all([
        db.offer.count({
          where: { creatorId: userId, status: "ACTIVE" },
        }),
        db.trade.count({
          where: {
            OR: [{ buyerId: userId }, { sellerId: userId }],
            status: { notIn: ["COMPLETED", "CANCELLED"] },
          },
        }),
        db.dispute.count({
          where: {
            OR: [{ openerId: userId }, { defendantId: userId }],
            status: "OPEN",
          },
        }),
        db.feedback.findMany({
          where: { toUserId: userId },
          orderBy: { createdAt: "desc" },
          take: 5,
          include: {
            fromUser: { select: { alias: true, avatarSeed: true } },
          },
        }),
      ]);

    return NextResponse.json({
      user,
      stats: {
        activeOffers,
        activeTrades,
        openDisputes,
        reputation: user.reputationScore,
        totalTrades: user.totalTrades,
        completedTrades: user.completedTrades,
        disputedTrades: user.disputedTrades,
      },
      recentFeedbacks,
    });
  } catch (err) {
    console.error("[dashboard GET]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
