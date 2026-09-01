import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/cleanup — elimina ofertas y usuarios de demostración
export async function POST() {
  try {
    // Eliminar todas las ofertas creadas antes del 2026-09-01 15:00
    const deletedOffers = await db.offer.deleteMany({
      where: {
        createdAt: { lt: new Date("2026-09-01T15:00:00Z") }
      }
    });

    // Eliminar usuarios de demostración
    const deletedUsers = await db.user.deleteMany({
      where: {
        createdAt: { lt: new Date("2026-09-01T15:00:00Z") }
      }
    });

    // Eliminar game accounts huerfanas
    const deletedAccounts = await db.gameAccount.deleteMany({
      where: {
        createdAt: { lt: new Date("2026-09-01T15:00:00Z") }
      }
    });

    // Eliminar retos de prueba
    const deletedChallenges = await db.challenge.deleteMany({
      where: {
        createdAt: { lt: new Date("2026-09-01T15:00:00Z") }
      }
    });

    return NextResponse.json({
      deletedOffers: deletedOffers.count,
      deletedUsers: deletedUsers.count,
      deletedGameAccounts: deletedAccounts.count,
      deletedChallenges: deletedChallenges.count,
      message: "Datos de demostración eliminados. El mercado ahora está limpio."
    });
  } catch (err) {
    console.error("[cleanup]", err);
    return NextResponse.json({ error: "Error: " + (err as Error).message }, { status: 500 });
  }
}
