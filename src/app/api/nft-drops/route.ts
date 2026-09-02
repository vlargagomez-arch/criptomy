import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/nft-drops?status=UPCOMING|LIVE|ENDED
// POST /api/nft-drops — crea nuevo drop (solo admin)
//    body: { name, description?, collectionImage?, projectWebsite?, chain, contractAddress?, dropDate, mintPrice?, priceCurrency?, totalSupply?, maxPerWallet? }

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || "all";
  const onlyVerified = searchParams.get("verified") !== "false";

  const where: {
    status?: string;
    verified?: boolean;
  } = {};
  if (status !== "all") where.status = status;
  if (onlyVerified) where.verified = true;

  const drops = await db.nFTDrop.findMany({
    where,
    orderBy: { dropDate: "asc" },
    take: 50,
  });

  // Marcar status automáticamente si dropDate ya pasó
  const now = new Date();
  for (const drop of drops) {
    let autoStatus = drop.status;
    if (drop.status === "UPCOMING" && drop.dropDate <= now) {
      autoStatus = "LIVE";
      await db.nFTDrop.update({ where: { id: drop.id }, data: { status: "LIVE" } });
    }
    const hoursAgo = (now.getTime() - drop.dropDate.getTime()) / (1000 * 60 * 60);
    if (drop.status === "LIVE" && hoursAgo > 48) {
      autoStatus = "ENDED";
      await db.nFTDrop.update({ where: { id: drop.id }, data: { status: "ENDED" } });
    }
    drop.status = autoStatus;
  }

  return NextResponse.json({ drops });
}

export async function POST(req: NextRequest) {
  // Crear drop — requiere token admin simple (DROPS_ADMIN_TOKEN env)
  const authHeader = req.headers.get("authorization");
  const adminToken = process.env.DROPS_ADMIN_TOKEN;
  if (adminToken && authHeader !== `Bearer ${adminToken}`) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const validChains = ["polygon", "base", "ethereum"];

    if (!body.name || !body.chain || !body.dropDate) {
      return NextResponse.json(
        { error: "name, chain, dropDate requeridos" },
        { status: 400 }
      );
    }
    if (!validChains.includes(body.chain)) {
      return NextResponse.json({ error: "chain inválida" }, { status: 400 });
    }

    const drop = await db.nFTDrop.create({
      data: {
        name: body.name,
        description: body.description || null,
        collectionImage: body.collectionImage || null,
        projectWebsite: body.projectWebsite || null,
        chain: body.chain,
        contractAddress: body.contractAddress?.toLowerCase() || null,
        dropDate: new Date(body.dropDate),
        mintPrice: body.mintPrice || null,
        priceCurrency: body.priceCurrency || "ETH",
        totalSupply: body.totalSupply || null,
        maxPerWallet: body.maxPerWallet || null,
        status: "UPCOMING",
        verified: true,
      },
    });

    return NextResponse.json({ drop });
  } catch (err) {
    console.error("[/api/nft-drops POST]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
