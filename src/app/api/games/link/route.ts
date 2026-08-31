import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/games/link?userId=... — lista cuentas vinculadas
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "userId requerido" }, { status: 400 });
    }
    const accounts = await db.gameAccount.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ accounts });
  } catch (err) {
    console.error("[games/link GET]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// POST /api/games/link — vincular cuenta de juego
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, game, accountRegion, accountId, accountName } = body;

    if (!userId || !game || !accountRegion || !accountId || !accountName) {
      return NextResponse.json(
        { error: "Faltan: userId, game, accountRegion, accountId, accountName" },
        { status: 400 }
      );
    }

    // Validar juego — obtener la lista dinámica de games.ts
    const { getAllGames } = await import("@/lib/games");
    const validGameTypes = getAllGames().map((g) => g.type);
    if (!validGameTypes.includes(game)) {
      return NextResponse.json({ error: "Juego no soportado" }, { status: 400 });
    }

    // Verificar que no esté ya vinculada
    const existing = await db.gameAccount.findUnique({
      where: {
        game_accountId_accountRegion: {
          game: game,
          accountId,
          accountRegion,
        },
      },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Esta cuenta ya está vinculada a otro usuario" },
        { status: 400 }
      );
    }

    const account = await db.gameAccount.create({
      data: {
        userId,
        game: game,
        accountRegion,
        accountId,
        accountName,
        verificationHash: `0x${Math.random().toString(16).slice(2).padStart(64, "0")}`,
      },
    });

    return NextResponse.json({ account }, { status: 201 });
  } catch (err) {
    console.error("[games/link POST]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// DELETE /api/games/link — desvincular cuenta
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get("accountId");
    const userId = searchParams.get("userId");
    if (!accountId || !userId) {
      return NextResponse.json(
        { error: "accountId y userId requeridos" },
        { status: 400 }
      );
    }
    await db.gameAccount.deleteMany({
      where: { id: accountId, userId },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[games/link DELETE]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
