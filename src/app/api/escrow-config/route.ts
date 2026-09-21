import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/escrow-config — devuelve el contrato desplegado (compartido)
export async function GET() {
  try {
    // Crear tabla si no existe (migración en runtime)
    await db.$executeRaw`CREATE TABLE IF NOT EXISTS EscrowContract (
      id TEXT PRIMARY KEY,
      address TEXT NOT NULL UNIQUE,
      chain TEXT NOT NULL,
      deployer TEXT NOT NULL,
      txHash TEXT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`;

    const contract = await db.$queryRaw<
      { id: string; address: string; chain: string; deployer: string; txHash: string | null; createdAt: string }[]
    >`SELECT * FROM EscrowContract ORDER BY createdAt DESC LIMIT 1`;

    return NextResponse.json({ contract: contract[0] || null });
  } catch (err) {
    console.error("[escrow-config GET]", err);
    return NextResponse.json({ contract: null });
  }
}

// POST /api/escrow-config — guarda la dirección del contrato desplegado
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { address, chain, deployer, txHash } = body;

    if (!address || !chain || !deployer) {
      return NextResponse.json(
        { error: "Faltan campos: address, chain, deployer" },
        { status: 400 }
      );
    }

    await db.$executeRaw`CREATE TABLE IF NOT EXISTS EscrowContract (
      id TEXT PRIMARY KEY,
      address TEXT NOT NULL UNIQUE,
      chain TEXT NOT NULL,
      deployer TEXT NOT NULL,
      txHash TEXT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`;

    const id = `esc_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    await db.$executeRaw`INSERT OR REPLACE INTO EscrowContract (id, address, chain, deployer, txHash, createdAt)
      VALUES (${id}, ${address}, ${chain}, ${deployer}, ${txHash || null}, ${new Date().toISOString()})`;

    return NextResponse.json(
      { address, chain, deployer, txHash },
      { status: 201 }
    );
  } catch (err) {
    console.error("[escrow-config POST]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
