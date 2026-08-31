import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getGameAdapter, verifyMatchResult, isGameAPIConfigured } from "@/lib/games";

const SELF_REPORT_TIMEOUT_MIN = 10; // 10 minutos para confirmar/disputar

// PATCH /api/challenges/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { action, userId, opponentGameAccountId, matchId, escrowAddress, escrowTxHash, reportedWinner, screenshotCID, disputeReason, disputeEvidence } = body;

    const challenge = await db.challenge.findUnique({
      where: { id },
      include: { creator: true, opponent: true },
    });
    if (!challenge) {
      return NextResponse.json({ error: "Reto no encontrado" }, { status: 404 });
    }

    const adapter = getGameAdapter(challenge.game);

    // ACEPTAR reto
    if (action === "accept") {
      if (challenge.status !== "OPEN") {
        return NextResponse.json({ error: "El reto ya no está disponible" }, { status: 400 });
      }
      if (challenge.creatorId === userId) {
        return NextResponse.json({ error: "No puedes aceptar tu propio reto" }, { status: 400 });
      }
      if (!opponentGameAccountId) {
        return NextResponse.json({ error: "Debe vincular su cuenta de juego" }, { status: 400 });
      }
      const gameAccount = await db.gameAccount.findFirst({
        where: { id: opponentGameAccountId, userId, game: challenge.game },
      });
      if (!gameAccount) {
        return NextResponse.json({ error: "Cuenta de juego no válida" }, { status: 403 });
      }
      const updated = await db.challenge.update({
        where: { id },
        data: { opponentId: userId, opponentGameAccountId, status: "ACCEPTED" },
        include: {
          creator: { select: { id: true, alias: true, avatarSeed: true, walletAddress: true } },
          opponent: { select: { id: true, alias: true, avatarSeed: true, walletAddress: true } },
        },
      });
      return NextResponse.json({ challenge: updated });
    }

    // FONDEAR escrow
    if (action === "fund") {
      if (challenge.status !== "ACCEPTED") {
        return NextResponse.json({ error: "El reto debe estar aceptado primero" }, { status: 400 });
      }
      if (!escrowAddress || !escrowTxHash) {
        return NextResponse.json({ error: "Faltan escrowAddress y escrowTxHash" }, { status: 400 });
      }
      const updated = await db.challenge.update({
        where: { id },
        data: { status: "ESCROW_FUNDED", escrowAddress, escrowTxHash },
      });
      return NextResponse.json({ challenge: updated, message: "Escrow fondeado on-chain." });
    }

    // INICIAR partido
    if (action === "start") {
      if (challenge.status !== "ESCROW_FUNDED") {
        return NextResponse.json({ error: "El escrow debe estar fondeado" }, { status: 400 });
      }
      const updated = await db.challenge.update({
        where: { id },
        data: { status: "IN_PROGRESS" },
      });
      return NextResponse.json({ challenge: updated });
    }

    // ============================================================
    // REPORTAR RESULTADO (self-report para juegos sin API)
    // ============================================================
    if (action === "report-result") {
      if (challenge.status !== "IN_PROGRESS") {
        return NextResponse.json({ error: "El reto debe estar en progreso" }, { status: 400 });
      }
      if (!reportedWinner || !["creator", "opponent"].includes(reportedWinner)) {
        return NextResponse.json({ error: "reportedWinner debe ser 'creator' o 'opponent'" }, { status: 400 });
      }
      if (!screenshotCID) {
        return NextResponse.json({ error: "screenshotCID requerido (subir screenshot a IPFS primero)" }, { status: 400 });
      }
      // Solo el creador o el oponente pueden reportar
      if (challenge.creatorId !== userId && challenge.opponentId !== userId) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      }

      // Si el juego tiene API, intentar verificación automática primero
      if (adapter.verification === "API" && matchId) {
        return NextResponse.json({
          error: "Este juego usa verificación automática vía API. Use action=verify con matchId.",
        }, { status: 400 });
      }

      const now = new Date();
      const deadline = new Date(now.getTime() + SELF_REPORT_TIMEOUT_MIN * 60 * 1000);

      const updated = await db.challenge.update({
        where: { id },
        data: {
          status: "PENDING_CONFIRM",
          reportedWinner,
          resultScreenshot: screenshotCID,
          resultReportedAt: now,
          resultDeadline: deadline,
        },
      });

      return NextResponse.json({
        challenge: updated,
        message: `Resultado reportado. El oponente tiene ${SELF_REPORT_TIMEOUT_MIN} minutos para confirmar o disputar. Si no responde, se libera el pago al ganador reportado.`,
        deadline: deadline.toISOString(),
      });
    }

    // ============================================================
    // CONFIRMAR RESULTADO (el perdedor confirma)
    // ============================================================
    if (action === "confirm-result") {
      if (challenge.status !== "PENDING_CONFIRM") {
        return NextResponse.json({ error: "No hay resultado pendiente de confirmación" }, { status: 400 });
      }
      // El que confirma debe ser el perdedor reportado
      const isReportedWinnerCreator = challenge.reportedWinner === "creator";
      const expectedConfirmerId = isReportedWinnerCreator ? challenge.opponentId : challenge.creatorId;

      if (userId !== expectedConfirmerId) {
        return NextResponse.json({ error: "Solo el perdedor reportado puede confirmar" }, { status: 403 });
      }

      const winnerId = challenge.reportedWinner === "creator" ? challenge.creatorId : challenge.opponentId;

      const updated = await db.challenge.update({
        where: { id },
        data: {
          status: "COMPLETED",
          winnerId,
          resultConfirmedAt: new Date(),
          matchVerifiedAt: new Date(),
          payoutStatus: "PENDING", // Bot de pago automático procesará esto
        },
        include: {
          winner: { select: { id: true, alias: true, walletAddress: true } },
        },
      });

      return NextResponse.json({
        challenge: updated,
        message: `Resultado confirmado. Ganador: ${updated.winner?.alias}. Pago liberado automáticamente.`,
      });
    }

    // ============================================================
    // DISPUTAR RESULTADO (el perdedor disputa)
    // ============================================================
    if (action === "dispute-result") {
      if (challenge.status !== "PENDING_CONFIRM") {
        return NextResponse.json({ error: "No hay resultado pendiente para disputar" }, { status: 400 });
      }
      if (!disputeReason) {
        return NextResponse.json({ error: "disputeReason requerido" }, { status: 400 });
      }

      const updated = await db.challenge.update({
        where: { id },
        data: {
          status: "DISPUTED",
          disputeReason,
          disputeEvidence: disputeEvidence || null,
          disputeOpenedAt: new Date(),
        },
      });

      return NextResponse.json({
        challenge: updated,
        message: "Disputa abierta. Un árbitro revisará la evidencia (screenshot + reason). Tiempo estimado: 24-48h.",
      });
    }

    // ============================================================
    // VERIFICAR RESULTADO (API automática para LoL/Valorant/Dota2/PUBG)
    // ============================================================
    if (action === "verify") {
      if (challenge.status !== "IN_PROGRESS") {
        return NextResponse.json({ error: "El reto debe estar en progreso" }, { status: 400 });
      }
      if (!matchId) {
        return NextResponse.json({ error: "matchId requerido" }, { status: 400 });
      }

      await db.challenge.update({
        where: { id },
        data: { status: "PENDING_RESULT", matchId },
      });

      const [creatorAccount, opponentAccount] = await Promise.all([
        db.gameAccount.findUnique({ where: { id: challenge.creatorGameAccountId } }),
        challenge.opponentGameAccountId
          ? db.gameAccount.findUnique({ where: { id: challenge.opponentGameAccountId } })
          : null,
      ]);

      const result = await verifyMatchResult(
        challenge.game,
        matchId,
        creatorAccount?.accountId || "",
        opponentAccount?.accountId || ""
      );

      const winnerId =
        result.winner === "creator" ? challenge.creatorId
        : result.winner === "opponent" ? challenge.opponentId
        : null;

      const updated = await db.challenge.update({
        where: { id },
        data: {
          status: winnerId ? "COMPLETED" : "DISPUTED",
          winnerId,
          matchData: JSON.stringify(result),
          matchVerifiedAt: new Date(),
          payoutStatus: winnerId ? "PENDING" : null, // Bot procesará si hay ganador
        },
        include: {
          winner: { select: { id: true, alias: true, walletAddress: true } },
        },
      });

      const apiConfigured = isGameAPIConfigured(challenge.game);
      const sourceLabel = apiConfigured
        ? `API real (${result.source})`
        : "Mock (sin API key configurada)";

      return NextResponse.json({
        challenge: updated,
        result: { ...result, source: sourceLabel },
        apiConfigured,
        message: winnerId
          ? `Ganador: ${updated.winner?.alias}. ${apiConfigured ? "Pago liberado vía smart contract." : "Verificado con mock."}`
          : "Sin resultado claro. Se abre disputa.",
      });
    }

    // ============================================================
    // CHECK TIMEOUT (para auto-completar si el perdedor no responde)
    // ============================================================
    if (action === "check-timeout") {
      if (challenge.status !== "PENDING_CONFIRM" || !challenge.resultDeadline) {
        return NextResponse.json({ error: "No hay deadline activo" }, { status: 400 });
      }
      if (new Date() < challenge.resultDeadline) {
        const remaining = Math.floor((challenge.resultDeadline.getTime() - Date.now()) / 1000);
        return NextResponse.json({
          timedOut: false,
          remainingSeconds: remaining,
          message: `Quedan ${Math.floor(remaining / 60)} min ${remaining % 60} seg`,
        });
      }
      // Timeout pasado → auto-completar con el ganador reportado
      const winnerId = challenge.reportedWinner === "creator" ? challenge.creatorId : challenge.opponentId;
      const updated = await db.challenge.update({
        where: { id },
        data: {
          status: "COMPLETED",
          winnerId,
          matchVerifiedAt: new Date(),
          payoutStatus: "PENDING",
        },
        include: {
          winner: { select: { id: true, alias: true } },
        },
      });
      return NextResponse.json({
        challenge: updated,
        timedOut: true,
        message: `Tiempo agotado. El perdedor no respondió en ${SELF_REPORT_TIMEOUT_MIN} min. Ganador: ${updated.winner?.alias}. Pago liberado.`,
      });
    }

    // CANCELAR
    if (action === "cancel") {
      if (!["OPEN", "ACCEPTED", "ESCROW_FUNDED"].includes(challenge.status)) {
        return NextResponse.json({ error: "No se puede cancelar" }, { status: 400 });
      }
      if (challenge.creatorId !== userId && challenge.opponentId !== userId) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      }
      const updated = await db.challenge.update({
        where: { id },
        data: { status: "CANCELLED" },
      });
      return NextResponse.json({ challenge: updated, message: "Reto cancelado." });
    }

    return NextResponse.json({ error: `Acción no soportada: ${action}` }, { status: 400 });
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
        creator: { select: { id: true, alias: true, avatarSeed: true, reputationScore: true, walletAddress: true } },
        opponent: { select: { id: true, alias: true, avatarSeed: true, reputationScore: true, walletAddress: true } },
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
