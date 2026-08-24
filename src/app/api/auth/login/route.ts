import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { randomAlias } from "@/lib/crypto";

// POST /api/auth/login
// Login pseudónimo: recibe walletAddress + publicKey, devuelve el usuario existente
// o crea uno nuevo. NO se solicita email, nombre, ni ningún dato PII.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { walletAddress, publicKey, alias: providedAlias, torOnly } = body;

    if (!walletAddress || typeof walletAddress !== "string") {
      return NextResponse.json(
        { error: "walletAddress requerida" },
        { status: 400 }
      );
    }

    // Buscar usuario existente por wallet
    let user = await db.user.findUnique({
      where: { walletAddress },
    });

    if (!user) {
      // Crear nuevo usuario pseudónimo
      const alias = providedAlias || randomAlias();
      user = await db.user.create({
        data: {
          alias,
          walletAddress,
          publicKey: publicKey || null,
          torOnly: !!torOnly,
          avatarSeed: walletAddress.slice(2, 10),
        },
      });
    } else {
      // Actualizar publicKey/torOnly si llegaron
      user = await db.user.update({
        where: { id: user.id },
        data: {
          publicKey: publicKey || user.publicKey,
          torOnly: torOnly !== undefined ? !!torOnly : user.torOnly,
          lastSeenAt: new Date(),
        },
      });
    }

    return NextResponse.json({ user });
  } catch (err) {
    console.error("[auth/login] error", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
