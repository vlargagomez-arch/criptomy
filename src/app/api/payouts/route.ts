import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/payouts — lista pagos pendientes y procesados
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status"); // PENDING | PROCESSING | COMPLETED | FAILED

    const where: Record<string, unknown> = {
      status: "COMPLETED",
      winnerId: { not: null },
    };
    if (status) where.payoutStatus = status;

    const payouts = await db.challenge.findMany({
      where,
      select: {
        id: true,
        game: true,
        stakeAmount: true,
        payoutStatus: true,
        payoutTxHash: true,
        payoutAmount: true,
        payoutError: true,
        payoutProcessedAt: true,
        escrowTxHash: true,
        winner: {
          select: { id: true, alias: true, walletAddress: true },
        },
        createdAt: true,
        matchVerifiedAt: true,
      },
      orderBy: { matchVerifiedAt: "desc" },
      take: 50,
    });

    const summary = {
      pending: payouts.filter((p) => p.payoutStatus === "PENDING").length,
      processing: payouts.filter((p) => p.payoutStatus === "PROCESSING").length,
      completed: payouts.filter((p) => p.payoutStatus === "COMPLETED").length,
      failed: payouts.filter((p) => p.payoutStatus === "FAILED").length,
      totalVolume: payouts
        .filter((p) => p.payoutStatus === "COMPLETED")
        .reduce((s, p) => s + (p.payoutAmount || 0), 0),
    };

    return NextResponse.json({ payouts, summary });
  } catch (err) {
    console.error("[payouts GET]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
