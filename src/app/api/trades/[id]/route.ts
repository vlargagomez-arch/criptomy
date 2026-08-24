import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/trades/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const trade = await db.trade.findUnique({
      where: { id },
      include: {
        offer: { include: { creator: true } },
        buyer: { select: { id: true, alias: true, reputationScore: true, avatarSeed: true, publicKey: true } },
        seller: { select: { id: true, alias: true, reputationScore: true, avatarSeed: true, publicKey: true } },
        messages: { include: { sender: { select: { id: true, alias: true, avatarSeed: true } } }, orderBy: { createdAt: "asc" } },
        feedbacks: true,
        dispute: true,
      },
    });
    if (!trade) {
      return NextResponse.json({ error: "Trade no encontrado" }, { status: 404 });
    }
    return NextResponse.json({ trade });
  } catch (err) {
    console.error("[trades/[id] GET]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// PATCH /api/trades/[id] - actualiza estado del trade
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const {
      status,
      escrowAddress,
      escrowTxHash,
      releaseTxHash,
      paymentDetails,
    } = body;

    const existing = await db.trade.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Trade no encontrado" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (status) {
      data.status = status;
      // Timestamps por etapa
      if (status === "ESCROW_FUNDED") data.escrowFundedAt = new Date();
      if (status === "PAYMENT_SENT") data.paymentSentAt = new Date();
      if (status === "PAYMENT_CONFIRMED") data.paymentConfirmedAt = new Date();
      if (status === "COMPLETED") {
        data.releasedAt = new Date();
        data.completedAt = new Date();
      }
      if (status === "CANCELLED") data.cancelledAt = new Date();
    }
    if (escrowAddress !== undefined) data.escrowAddress = escrowAddress;
    if (escrowTxHash !== undefined) data.escrowTxHash = escrowTxHash;
    if (releaseTxHash !== undefined) data.releaseTxHash = releaseTxHash;
    if (paymentDetails !== undefined) data.paymentDetails = paymentDetails;

    const trade = await db.trade.update({
      where: { id },
      data,
      include: {
        buyer: { select: { id: true, alias: true, reputationScore: true, avatarSeed: true } },
        seller: { select: { id: true, alias: true, reputationScore: true, avatarSeed: true } },
      },
    });

    // Si el trade se completó, actualizar contadores de usuarios
    if (status === "COMPLETED") {
      await db.user.update({
        where: { id: trade.buyerId },
        data: {
          completedTrades: { increment: 1 },
          totalTrades: { increment: 1 },
        },
      });
      await db.user.update({
        where: { id: trade.sellerId },
        data: {
          completedTrades: { increment: 1 },
          totalTrades: { increment: 1 },
        },
      });
    }

    return NextResponse.json({ trade });
  } catch (err) {
    console.error("[trades/[id] PATCH]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
