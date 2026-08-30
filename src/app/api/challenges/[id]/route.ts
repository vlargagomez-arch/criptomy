import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getGameAdapter, verifyMatchResult, isGameAPIConfigured } from "@/lib/games";

// PATCH /api/challenges/[id] — aceptar, cancelar, verificar resultado
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { action, userId, opponentGameAccountId, matchId, escrowAddress, escrowTxHash } = body;

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
          creator: { select: { id: true, alias: true, avatarSeed: true, walletAddress: true } },
          opponent: { select: { id: true, alias: true, avatarSeed: true, walletAddress: true } },
        },
      });
      return NextResponse.json({ challenge: updated });
    }

    // FONDEAR escrow — ahora guarda la tx real (firmada client-side)
    if (action === "fund") {
      if (challenge.status !== "ACCEPTED") {
        return NextResponse.json(
          { error: "El reto debe estar aceptado primero" },
          { status: 400 }
        );
      }
      if (!escrowAddress || !escrowTxHash) {
        return NextResponse.json(
          { error: "Faltan escrowAddress y escrowTxHash (transacción on-chain)" },
          { status: 400 }
        );
      }
      const updated = await db.challenge.update({
        where: { id },
        data: {
          status: "ESCROW_FUNDED",
          escrowAddress,
          escrowTxHash,
        },
      });
      return NextResponse.json({
        challenge: updated,
        message: "Escrow fondeado on-chain. Listo para iniciar el partido.",
      });
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

    // VERIFICAR resultado — usa API real del juego si está configurada
    if (action === "verify") {
      if (challenge.status !== "IN_PROGRESS") {
        return NextResponse.json(
          { error: "El reto debe estar en progreso" },
          { status: 400 }
        );
      }
      if (!matchId) {
        return NextResponse.json(
          { error: "matchId requerido (ID del partido en el juego)" },
          { status: 400 }
        );
      }

      await db.challenge.update({
        where: { id },
        data: { status: "PENDING_RESULT", matchId },
      });

      // Obtener las cuentas de juego de ambos jugadores
      const [creatorAccount, opponentAccount] = await Promise.all([
        db.gameAccount.findUnique({ where: { id: challenge.creatorGameAccountId } }),
        challenge.opponentGameAccountId
          ? db.gameAccount.findUnique({ where: { id: challenge.opponentGameAccountId } })
          : null,
      ]);

      // Verificar resultado (API real o mock fallback)
      const result = await verifyMatchResult(
        challenge.game,
        matchId,
        creatorAccount?.accountId || "",
        opponentAccount?.accountId || ""
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
          winner: { select: { id: true, alias: true, walletAddress: true } },
          creator: { select: { id: true, alias: true, walletAddress: true } },
          opponent: { select: { id: true, alias: true, walletAddress: true } },
        },
      });

      const apiConfigured = isGameAPIConfigured(challenge.game);
      const sourceLabel = apiConfigured
        ? `API real (${result.source})`
        : "Mock (sin API key — configurar RIOT_API_KEY o STEAM_API_KEY)";

      return NextResponse.json({
        challenge: updated,
        result: { ...result, source: sourceLabel },
        apiConfigured,
        message: winnerId
          ? `Ganador: ${updated.winner?.alias}. ${apiConfigured ? "Pago liberado automáticamente via smart contract." : "Verificado con mock. Configura API key para verificación real."}`
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
      return NextResponse.json({
        challenge: updated,
        message: "Reto cancelado. Si había depósitos on-chain, ejecuta cancel() en el contrato para reembolso.",
      });
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
          select: { id: true, alias: true, avatarSeed: true, reputationScore: true, walletAddress: true },
        },
        opponent: {
          select: { id: true, alias: true, avatarSeed: true, reputationScore: true, walletAddress: true },
        },
        winner: { select: { id: true, alias: true, walletAddress: true } },
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
