import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/cleanup — elimina TODOS los datos de demostración
export async function POST() {
  try {
    // Borrar en orden de dependencias (hijos primero)
    const r1 = await db.message.deleteMany({});
    const r2 = await db.feedback.deleteMany({});
    const r3 = await db.dispute.deleteMany({});
    const r4 = await db.trade.deleteMany({});
    
    // Borrar retos antes que game accounts
    const r5 = await db.challenge.deleteMany({});
    
    // Borrar offers antes que users
    const r6 = await db.offer.deleteMany({});
    
    // Ahora si borrar game accounts y users
    const r7 = await db.gameAccount.deleteMany({});
    const r8 = await db.user.deleteMany({});

    return NextResponse.json({
      deleted: {
        messages: r1.count,
        feedbacks: r2.count,
        disputes: r3.count,
        trades: r4.count,
        challenges: r5.count,
        offers: r6.count,
        gameAccounts: r7.count,
        users: r8.count,
      },
      message: "Todos los datos eliminados. Mercado limpio."
    });
  } catch (err) {
    console.error("[cleanup]", err);
    return NextResponse.json({ error: "Error: " + (err as Error).message }, { status: 500 });
  }
}
