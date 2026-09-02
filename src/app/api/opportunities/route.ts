import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/opportunities?category=STAKING&country=CO
// POST /api/opportunities (solo admin)
// POST /api/opportunities?op=save — usuario guarda oportunidad (body: opportunityId, address)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const country = searchParams.get("country");
  const address = searchParams.get("address");

  const where: { isActive: boolean; category?: string; countries?: unknown } = { isActive: true };
  if (category) where.category = category;

  // Filtrar por país: que el CSV "countries" contenga el país o "ALL"
  // Como countries es CSV en String, usamos contains para Match de substring
  // Esto es una simplificación (podría haber falsos positivos si el código
  // aparece dentro de otro). Para robustez real, mejor normalizar en otra tabla.

  const opportunities = await db.opportunity.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  // Filtro por país en runtime (post-query)
  let filtered = opportunities;
  if (country) {
    filtered = opportunities.filter((o) => {
      const c = o.countries.toUpperCase();
      return c === "ALL" || c.includes(country.toUpperCase());
    });
  }

  // Si hay address, agregamos si el usuario lo guardó
  let savedIds: Set<string> = new Set();
  if (address) {
    const user = await db.user.findUnique({
      where: { walletAddress: address.toLowerCase() },
      select: { id: true },
    });
    if (user) {
      const saved = await db.savedOpportunity.findMany({
        where: { userId: user.id },
        select: { opportunityId: true },
      });
      savedIds = new Set(saved.map((s) => s.opportunityId));
    }
  }

  return NextResponse.json({
    opportunities: filtered.map((o) => ({
      ...o,
      saved: savedIds.has(o.id),
    })),
  });
}

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const op = searchParams.get("op");

  // op=save o op=unsave: marcar como interesado
  if (op === "save" || op === "unsave") {
    const body = await req.json();
    const { address, opportunityId } = body as { address: string; opportunityId: string };

    if (!address || !opportunityId) {
      return NextResponse.json({ error: "address y opportunityId requeridos" }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { walletAddress: address.toLowerCase() },
      select: { id: true },
    });
    if (!user) return NextResponse.json({ error: "usuario no encontrado" }, { status: 404 });

    if (op === "save") {
      await db.savedOpportunity.upsert({
        where: { userId_opportunityId: { userId: user.id, opportunityId } },
        create: { userId: user.id, opportunityId },
        update: {},
      });
    } else {
      await db.savedOpportunity.deleteMany({
        where: { userId: user.id, opportunityId },
      });
    }
    return NextResponse.json({ ok: true });
  }

  // op=create: solo admin (OPPORTUNITIES_ADMIN_TOKEN)
  const authHeader = req.headers.get("authorization");
  const adminToken = process.env.OPPORTUNITIES_ADMIN_TOKEN;
  if (adminToken && authHeader !== `Bearer ${adminToken}`) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }

  const body = await req.json();
  const validCategories = ["LEARN_EARN", "AIRDROP", "JOB_WEB3", "CREATE", "MINING", "STAKING"];
  if (!validCategories.includes(body.category)) {
    return NextResponse.json(
      { error: `category inválido. Válidos: ${validCategories.join(", ")}` },
      { status: 400 }
    );
  }
  if (!body.name || !body.description || !body.sourceUrl) {
    return NextResponse.json(
      { error: "name, description, sourceUrl requeridos" },
      { status: 400 }
    );
  }

  const opp = await db.opportunity.create({
    data: {
      category: body.category,
      name: body.name,
      description: body.description,
      difficulty: body.difficulty || "BEGINNER",
      initialInvestment: body.initialInvestment || null,
      riskLevel: body.riskLevel || "LOW",
      potentialReward: body.potentialReward || null,
      countries: body.countries || "ALL",
      sourceUrl: body.sourceUrl,
      sourceName: body.sourceName || body.sourceUrl,
      isActive: true,
    },
  });

  return NextResponse.json({ opportunity: opp });
}
