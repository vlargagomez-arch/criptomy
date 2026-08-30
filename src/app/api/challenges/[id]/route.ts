import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getGameAdapter, verifyMatchResult } from "@/lib/games";

// PATCH /api/challenges/[id] — aceptar, cancelar, verificar resultado
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { action, userId, opponentGameAccountId, matchId } = body;

    const challenge = await db.challenge.findUnique({
      where: { id },
      include: { creator: true, opponent: true },
    });
    if (!challenge) {
      return NextResponse.json({ error: "Reto no encontrado" }, { status: 404 });
    }

    // ACEPTAR reto
    if (action === "accept") {
      if (challenge.status !== "OPEN") {
        return NextResponse.json(
          { error: "El reto ya no está disponible" },
          { status: 400 }
        );
      }
      if (challenge.creatorId === userId) {
        return NextResponse.json(
          { error: "No puedes aceptar tu propio reto" },
          { status: 400 }
        );
      }
      if (!opponentGameAccountId) {
        return NextResponse.json(
          { error: "Debe vincular su cuenta de juego" },
          { status: 400 }
        );
      }

      const gameAccount = await db.gameAccount.findFirst({
        where: { id: opponentGameAccountId, userId, game: challenge.game },
      });
      if (!gameAccount) {
        return NextResponse.json(
          { error: "Cuenta de juego no válida" },
          { status: 403 }
        );
      }

      const updated = await db.challenge.update({
        where: { id },
        data: {
          opponentId: userId,
          opponentGameAccountId,
          status: "ACCEPTED",
        },
        include: {
          creator: { select: { id: true, alias: true, avatarSeed: true } },
          opponent: { select: { id: true, alias: true, avatarSeed: true } },
        },
      });
      return NextResponse.json({ challenge: updated });
    }

    // FONDEAR escrow (simulado en MVP)
    if (action === "fund") {
      if (challenge.status !== "ACCEPTED") {
        return NextResponse.json(
          { error: "El reto debe estar aceptado primero" },
          { status: 400 }
        );
      }
      const updated = await db.challenge.update({
        where: { id },
        data: {
          status: "ESCROW_FUNDED",
          escrowAddress: `0x${Math.random().toString(16).slice(2).padStart(40, "0")}`,
          escrowTxHash: `0x${Math.random().toString(16).slice(2).padStart(64, "0")}`,
        },
      });
      return NextResponse.json({ challenge: updated });
    }

    // INICIAR partido
    if (action === "start") {
      if (challenge.status !== "ESCROW_FUNDED") {
        return NextResponse.json(
          { error: "El escrow debe estar fondeado" },
          { status: 400 }
        );
      }
      const updated = await db.challenge.update({
        where: { id },
        data: { status: "IN_PROGRESS" },
      });
      return NextResponse.json({ challenge: updated });
    }

    // VERIFICAR resultado
    if (action === "verify") {
      if (challenge.status !== "IN_PROGRESS") {
        return NextResponse.json(
          { error: "El reto debe estar en progreso" },
          { status: 400 }
        );
      }
      if (!matchId) {
        return NextResponse.json(
          { error: "matchId requerido" },
          { status: 400 }
        );
      }

      await db.challenge.update({
        where: { id },
        data: { status: "PENDING_RESULT", matchId },
      });

      const result = await verifyMatchResult(
        challenge.game,
        matchId,
        challenge.creatorGameAccountId,
        challenge.opponentGameAccountId || ""
      );

      const winnerId =
        result.winner === "creator"
          ? challenge.creatorId
          : result.winner === "opponent"
          ? challenge.opponentId
          : null;

      const updated = await db.challenge.update({
        where: { id },
        data: {
          status: winnerId ? "COMPLETED" : "DISPUTED",
          winnerId,
          matchData: JSON.stringify(result),
          matchVerifiedAt: new Date(),
        },
        include: {
          winner: { select: { id: true, alias: true } },
        },
      });

      return NextResponse.json({
        challenge: updated,
        result,
        message: winnerId
          ? `Ganador: ${updated.winner?.alias}. Pago liberado automáticamente.`
          : "Empate o sin resultado claro. Se abre disputa.",
      });
    }

    // CANCELAR reto
    if (action === "cancel") {
      if (!["OPEN", "ACCEPTED", "ESCROW_FUNDED"].includes(challenge.status)) {
        return NextResponse.json(
          { error: "No se puede cancelar en este estado" },
          { status: 400 }
        );
      }
      if (challenge.creatorId !== userId && challenge.opponentId !== userId) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      }
      const updated = await db.challenge.update({
        where: { id },
        data: { status: "CANCELLED" },
      });
      return NextResponse.json({ challenge: updated });
    }

    return NextResponse.json(
      { error: `Acción no soportada: ${action}` },
      { status: 400 }
    );
  } catch (err) {
    console.error("[challenges PATCH]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// GET /api/challenges/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const challenge = await db.challenge.findUnique({
      where: { id },
      include: {
        creator: {
          select: { id: true, alias: true, avatarSeed: true, reputationScore: true },
        },
        opponent: {
          select: { id: true, alias: true, avatarSeed: true, reputationScore: true },
        },
        winner: { select: { id: true, alias: true } },
      },
    });
    if (!challenge) {
      return NextResponse.json({ error: "Reto no encontrado" }, { status: 404 });
    }
    return NextResponse.json({ challenge });
  } catch (err) {
    console.error("[challenges GET id]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
