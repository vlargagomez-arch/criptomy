import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/trades/[id]/messages - lista mensajes de un trade
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const messages = await db.message.findMany({
      where: { tradeId: id },
      include: {
        sender: {
          select: { id: true, alias: true, avatarSeed: true, publicKey: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ messages });
  } catch (err) {
    console.error("[messages GET]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// POST /api/trades/[id]/messages - envía un mensaje cifrado
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { senderId, ciphertext, nonce } = body;

    if (!senderId || !ciphertext || !nonce) {
      return NextResponse.json(
        { error: "Faltan campos: senderId, ciphertext, nonce" },
        { status: 400 }
      );
    }

    const trade = await db.trade.findUnique({ where: { id } });
    if (!trade) {
      return NextResponse.json({ error: "Trade no encontrado" }, { status: 404 });
    }
    if (senderId !== trade.buyerId && senderId !== trade.sellerId) {
      return NextResponse.json(
        { error: "No autorizado: no es parte del trade" },
        { status: 403 }
      );
    }

    const msg = await db.message.create({
      data: { tradeId: id, senderId, ciphertext, nonce },
      include: {
        sender: {
          select: { id: true, alias: true, avatarSeed: true, publicKey: true },
        },
      },
    });
    return NextResponse.json({ message: msg }, { status: 201 });
  } catch (err) {
    console.error("[messages POST]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
