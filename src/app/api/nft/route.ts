import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notifyNFTSold, notifyNFTBought } from "@/lib/notify";

// GET /api/nft?chain=polygon&status=LISTED — lista NFTs
// POST /api/nft — crea nueva listing (mint + list)
//    body: { address, chain, contractAddress, tokenId, name, description?, imageCID?, imageGateway?, metadataCID?, priceAmount, priceCurrency }
// POST /api/nft?op=buy — marca como vendido (buyer envía pago off-chain directo al seller)
//    body: { listingId, buyerAddress, saleTxHash }
// POST /api/nft?op=delist — deslista
//    body: { listingId, address }

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const chain = searchParams.get("chain");
  const status = searchParams.get("status") || "LISTED";
  const sellerAddress = searchParams.get("seller");

  const where: {
    status: string;
    chain?: string;
    seller?: { walletAddress: string };
  } = { status };

  if (chain && chain !== "all") where.chain = chain;
  if (sellerAddress) where.seller = { walletAddress: sellerAddress.toLowerCase() };

  const listings = await db.nFTListing.findMany({
    where,
    include: { seller: { select: { alias: true, walletAddress: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ listings });
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const op = searchParams.get("op") || "create";
    const body = await req.json();

    if (op === "create") {
      return await createListing(body);
    }
    if (op === "buy") {
      return await markBought(body);
    }
    if (op === "delist") {
      return await delist(body);
    }
    return NextResponse.json({ error: `op no soportado: ${op}` }, { status: 400 });
  } catch (err) {
    console.error("[/api/nft POST]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

async function createListing(body: {
  address: string;
  chain: string;
  contractAddress: string;
  tokenId: string;
  name: string;
  description?: string;
  imageCID?: string;
  imageGateway?: string;
  metadataCID?: string;
  priceAmount: number;
  priceCurrency: string;
}) {
  const validChains = ["polygon", "base", "ethereum"];
  if (!validChains.includes(body.chain)) {
    return NextResponse.json(
      { error: `chain debe ser uno de: ${validChains.join(", ")}` },
      { status: 400 }
    );
  }
  const validCurrencies = ["ETH", "USDT", "USDC", "MATIC"];
  if (!validCurrencies.includes(body.priceCurrency)) {
    return NextResponse.json(
      { error: `priceCurrency debe ser uno de: ${validCurrencies.join(", ")}` },
      { status: 400 }
    );
  }
  if (!body.address || !body.contractAddress || !body.tokenId || !body.name || !body.priceAmount || body.priceAmount <= 0) {
    return NextResponse.json(
      { error: "address, contractAddress, tokenId, name, priceAmount requeridos" },
      { status: 400 }
    );
  }

  const user = await db.user.findUnique({
    where: { walletAddress: body.address.toLowerCase() },
    select: { id: true, walletAddress: true },
  });
  if (!user) {
    return NextResponse.json({ error: "usuario no encontrado" }, { status: 404 });
  }

  // Verificar que no exista ya un listing activo para el mismo NFT
  const existing = await db.nFTListing.findFirst({
    where: {
      chain: body.chain,
      contractAddress: body.contractAddress.toLowerCase(),
      tokenId: body.tokenId,
      status: "LISTED",
    },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Este NFT ya está listado. Delistalo primero." },
      { status: 400 }
    );
  }

  const listing = await db.nFTListing.create({
    data: {
      sellerId: user.id,
      chain: body.chain,
      contractAddress: body.contractAddress.toLowerCase(),
      tokenId: body.tokenId,
      name: body.name,
      description: body.description || null,
      imageCID: body.imageCID || null,
      imageGateway: body.imageGateway || null,
      metadataCID: body.metadataCID || null,
      priceAmount: body.priceAmount,
      priceCurrency: body.priceCurrency,
      priceChain: body.chain,
    },
  });

  return NextResponse.json({ listing });
}

async function markBought(body: {
  listingId: string;
  buyerAddress: string;
  saleTxHash?: string;
}) {
  if (!body.listingId || !body.buyerAddress) {
    return NextResponse.json(
      { error: "listingId y buyerAddress requeridos" },
      { status: 400 }
    );
  }

  const buyer = await db.user.findUnique({
    where: { walletAddress: body.buyerAddress.toLowerCase() },
    select: { id: true },
  });
  if (!buyer) {
    return NextResponse.json({ error: "comprador no encontrado" }, { status: 404 });
  }

  const listing = await db.nFTListing.findUnique({
    where: { id: body.listingId },
    include: { seller: true },
  });
  if (!listing || listing.status !== "LISTED") {
    return NextResponse.json({ error: "listing no disponible" }, { status: 400 });
  }
  if (listing.sellerId === buyer.id) {
    return NextResponse.json({ error: "no puedes comprar tu propio NFT" }, { status: 400 });
  }

  await db.nFTListing.update({
    where: { id: body.listingId },
    data: {
      status: "SOLD",
      buyerId: buyer.id,
      soldAt: new Date(),
      saleTxHash: body.saleTxHash || null,
    },
  });

  // Notificar a vendedor y comprador
  await notifyNFTSold({
    sellerId: listing.sellerId,
    listingId: listing.id,
    nftName: listing.name,
    price: listing.priceAmount,
    currency: listing.priceCurrency,
  });
  await notifyNFTBought({
    buyerId: buyer.id,
    listingId: listing.id,
    nftName: listing.name,
    price: listing.priceAmount,
    currency: listing.priceCurrency,
  });

  return NextResponse.json({ ok: true });
}

async function delist(body: { listingId: string; address: string }) {
  if (!body.listingId || !body.address) {
    return NextResponse.json(
      { error: "listingId y address requeridos" },
      { status: 400 }
    );
  }

  const user = await db.user.findUnique({
    where: { walletAddress: body.address.toLowerCase() },
    select: { id: true },
  });
  if (!user) {
    return NextResponse.json({ error: "usuario no encontrado" }, { status: 404 });
  }

  const listing = await db.nFTListing.findUnique({ where: { id: body.listingId } });
  if (!listing || listing.sellerId !== user.id) {
    return NextResponse.json({ error: "listing no encontrado o no eres el dueño" }, { status: 404 });
  }
  if (listing.status !== "LISTED") {
    return NextResponse.json({ error: "solo se puede delistar NFTs activos" }, { status: 400 });
  }

  await db.nFTListing.update({
    where: { id: body.listingId },
    data: { status: "DELISTED" },
  });

  return NextResponse.json({ ok: true });
}
