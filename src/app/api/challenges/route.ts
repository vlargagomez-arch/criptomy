import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/challenges?status=OPEN&game=LEAGUE_OF_LEGENDS&userId=...
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const game = searchParams.get("game");
    const userId = searchParams.get("userId");

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (game) {
      const VALID = ["LEAGUE_OF_LEGENDS", "VALORANT", "COUNTER_STRIKE_2", "DOTA2", "ROCKET_LEAGUE"];
      if (VALID.includes(game)) where.game = game ;
    }
    if (userId) {
      where.OR = [{ creatorId: userId }, { opponentId: userId }];
    }

    const challenges = await db.challenge.findMany({
      where,
      include: {
        creator: {
          select: { id: true, alias: true, avatarSeed: true, reputationScore: true },
        },
        opponent: {
          select: { id: true, alias: true, avatarSeed: true, reputationScore: true },
        },
        winner: { select: { id: true, alias: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({ challenges });
  } catch (err) {
    console.error("[challenges GET]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// POST /api/challenges — crear reto nuevo
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { creatorId, game, mode, stakeAmount, creatorGameAccountId } = body;

    if (!creatorId || !game || !mode || !stakeAmount || !creatorGameAccountId) {
      return NextResponse.json(
        { error: "Faltan: creatorId, game, mode, stakeAmount, creatorGameAccountId" },
        { status: 400 }
      );
    }

    const VALID_GAMES: Record<string, unknown> = {
      LEAGUE_OF_LEGENDS: "LEAGUE_OF_LEGENDS",
      VALORANT: "VALORANT",
      COUNTER_STRIKE_2: "COUNTER_STRIKE_2",
      DOTA2: "DOTA2",
      ROCKET_LEAGUE: "ROCKET_LEAGUE",
    };
    const gameValue = VALID_GAMES[game];
    if (!gameValue) {
      return NextResponse.json({ error: "Juego no soportado" }, { status: 400 });
    }

    if (stakeAmount < 1) {
      return NextResponse.json({ error: "Apuesta mínima: 1 USDT" }, { status: 400 });
    }

    const gameAccount = await db.gameAccount.findFirst({
      where: { id: creatorGameAccountId, userId: creatorId, game: gameValue  },
    });
    if (!gameAccount) {
      return NextResponse.json(
        { error: "Cuenta de juego no vinculada" },
        { status: 403 }
      );
    }

    const challenge = await db.challenge.create({
      data: {
        game: gameValue ,
        mode,
        stakeAmount: parseFloat(stakeAmount),
        currency: "USDT",
        chain: "TRON",
        creatorId,
        creatorGameAccountId,
        status: "OPEN",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
      include: {
        creator: {
          select: { id: true, alias: true, avatarSeed: true, reputationScore: true },
        },
      },
    });

    return NextResponse.json({ challenge }, { status: 201 });
  } catch (err) {
    console.error("[challenges POST]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
