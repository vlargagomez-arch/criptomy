import { NextRequest, NextResponse } from "next/server";

// ============================================================
// API: /api/escrow/migrate — Crea las tablas EscrowDeal y EscrowMessage
// en la base de datos si no existen. Solo ejecutable por el admin.
// ============================================================

const ADMIN_WALLET = (process.env.ADMIN_WALLET || "").toLowerCase();

const CREATE_SQL = `
-- Tabla EscrowDeal
CREATE TABLE IF NOT EXISTS "EscrowDeal" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "productType" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USDT',
  "commissionPct" DOUBLE PRECISION NOT NULL DEFAULT 2,
  "buyerId" TEXT,
  "buyerAlias" TEXT,
  "sellerId" TEXT,
  "sellerAlias" TEXT,
  "agreement" TEXT,
  "agreementLockedAt" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'CREATED',
  "deliveryDescription" TEXT,
  "deliveryCode" TEXT,
  "deliveryCredentials" TEXT,
  "deliveryLink" TEXT,
  "deliveryInstructions" TEXT,
  "deliveredAt" TIMESTAMP(3),
  "buyerSignature" TEXT,
  "fundedAt" TIMESTAMP(3),
  "fundTxHash" TEXT,
  "releasedAt" TIMESTAMP(3),
  "releaseTxHash" TEXT,
  "completedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "disputedAt" TIMESTAMP(3),
  "disputeReason" TEXT,
  "disputeResolvedBy" TEXT,
  "disputeResolution" TEXT,
  "disputePartialSeller" DOUBLE PRECISION,
  "disputePartialRefund" DOUBLE PRECISION,
  "disputeResolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EscrowDeal_pkey" PRIMARY KEY ("id")
);

-- Índices
CREATE UNIQUE INDEX IF NOT EXISTS "EscrowDeal_code_key" ON "EscrowDeal"("code");
CREATE INDEX IF NOT EXISTS "EscrowDeal_status_idx" ON "EscrowDeal"("status");
CREATE INDEX IF NOT EXISTS "EscrowDeal_buyerId_idx" ON "EscrowDeal"("buyerId");
CREATE INDEX IF NOT EXISTS "EscrowDeal_sellerId_idx" ON "EscrowDeal"("sellerId");

-- Tabla EscrowMessage
CREATE TABLE IF NOT EXISTS "EscrowMessage" (
  "id" TEXT NOT NULL,
  "dealId" TEXT NOT NULL,
  "senderId" TEXT,
  "senderWallet" TEXT NOT NULL,
  "senderAlias" TEXT NOT NULL,
  "senderRole" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "hash" TEXT NOT NULL,
  "immutable" BOOLEAN NOT NULL DEFAULT false,
  "tag" TEXT,
  CONSTRAINT "EscrowMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EscrowMessage_dealId_ts_idx" ON "EscrowMessage"("dealId", "ts");
`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const wallet = (body.wallet || "").toLowerCase();

    // Solo el admin puede ejecutar la migración
    if (!ADMIN_WALLET) {
      return NextResponse.json({
        ok: false,
        error: "ADMIN_WALLET no configurado en el servidor.",
      }, { status: 500 });
    }
    if (wallet !== ADMIN_WALLET) {
      return NextResponse.json({
        ok: false,
        error: "Solo el admin puede ejecutar la migración.",
        adminWallet: ADMIN_WALLET.slice(0, 10) + "...",
        yourWallet: wallet ? wallet.slice(0, 10) + "..." : "(vacía)",
      }, { status: 403 });
    }

    // Ejecutar SQL vía Prisma
    const { db } = await import("@/lib/db");
    
    // Dividir en statements individuales (Prisma no soporta multi-statement)
    const statements = CREATE_SQL
      .split(/;\s*\n/)
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith("--"));

    const results: string[] = [];
    for (const stmt of statements) {
      if (!stmt) continue;
      try {
        await db.$executeRawUnsafe(stmt);
        results.push("OK: " + stmt.slice(0, 60).replace(/\n/g, " "));
      } catch (e: any) {
        const msg = e.message || "";
        if (msg.includes("already exists") || msg.includes("duplicate")) {
          results.push("SKIP (ya existe): " + stmt.slice(0, 60).replace(/\n/g, " "));
        } else {
          results.push("ERROR: " + msg.slice(0, 100));
        }
      }
    }

    return NextResponse.json({
      ok: true,
      message: "Migración ejecutada. Revisa los resultados.",
      results,
    });
  } catch (err: any) {
    console.error("[escrow migrate]", err);
    return NextResponse.json({
      ok: false,
      error: "Error: " + (err.message || "").slice(0, 200),
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "Endpoint de migración. POST con wallet del admin para crear las tablas.",
    adminWalletConfigured: !!ADMIN_WALLET,
  });
}
