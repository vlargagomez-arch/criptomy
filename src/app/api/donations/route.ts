import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/donations?category=EMERGENCY&country=CO — lista causas verificadas
// POST /api/donations — crea nueva causa (requiere admin token)
// POST /api/donations?op=donate — registra una donación

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const country = searchParams.get("country");
    const address = searchParams.get("address");

    const where: { verified: boolean; active: boolean; category?: string; country?: string } = {
      verified: true,
      active: true,
    };
    if (category) where.category = category;
    if (country) where.country = country.toUpperCase();

    const causes = await db.cause.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        _count: { select: { donations: true } },
      },
    });

    // Si hay address, incluir donaciones del usuario
    let myDonations: { causeId: string; totalDonated: number }[] = [];
    if (address) {
      const donations = await db.donation.findMany({
        where: { donorWallet: address.toLowerCase() },
        select: { causeId: true, amount: true },
      });
      const byCause: Record<string, number> = {};
      for (const d of donations) {
        byCause[d.causeId] = (byCause[d.causeId] || 0) + d.amount;
      }
      myDonations = Object.entries(byCause).map(([causeId, totalDonated]) => ({ causeId, totalDonated }));
    }

    return NextResponse.json({
      causes,
      myDonations,
    });
  } catch (err) {
    console.error("[/api/donations GET]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const op = searchParams.get("op");

    // === DONAR ===
    if (op === "donate") {
      const body = await req.json();
      const { causeId, donorWallet, donorAlias, amount, currency, txHash, message, anonymous } = body;

      if (!causeId || !donorWallet || !amount || amount <= 0) {
        return NextResponse.json({ error: "causeId, donorWallet y amount > 0 requeridos" }, { status: 400 });
      }

      const cause = await db.cause.findUnique({ where: { id: causeId } });
      if (!cause || !cause.active || !cause.verified) {
        return NextResponse.json({ error: "Causa no encontrada o no verificada" }, { status: 404 });
      }

      const donation = await db.donation.create({
        data: {
          causeId,
          donorWallet: donorWallet.toLowerCase(),
          donorAlias: donorAlias || null,
          amount: parseFloat(amount),
          currency: currency || "USDT",
          txHash: txHash || null,
          message: message || null,
          anonymous: anonymous !== false,
        },
      });

      // Actualizar recaudación de la causa
      const updatedRaised = cause.raisedAmount + parseFloat(amount);
      await db.cause.update({
        where: { id: causeId },
        data: {
          raisedAmount: updatedRaised,
          donorCount: { increment: 1 },
        },
      });

      return NextResponse.json({ donation, raisedTotal: updatedRaised }, { status: 201 });
    }

    // === CREAR CAUSA (admin) ===
    const authHeader = req.headers.get("authorization");
    const adminToken = process.env.DONATIONS_ADMIN_TOKEN;
    if (adminToken && authHeader !== `Bearer ${adminToken}`) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await req.json();
    const validCategories = ["EMERGENCY", "EDUCATION", "HEALTH", "FOOD", "SHELTER", "COMMUNITY"];
    if (!validCategories.includes(body.category)) {
      return NextResponse.json({ error: `Categoría inválida: ${validCategories.join(", ")}` }, { status: 400 });
    }
    if (!body.title || !body.description || !body.organizerName || !body.organizerWallet || !body.goalAmount) {
      return NextResponse.json({ error: "title, description, organizerName, organizerWallet, goalAmount requeridos" }, { status: 400 });
    }

    const cause = await db.cause.create({
      data: {
        title: body.title,
        description: body.description,
        category: body.category,
        country: (body.country || "CO").toUpperCase(),
        organizerName: body.organizerName,
        organizerWallet: body.organizerWallet.toLowerCase(),
        imageUrl: body.imageUrl || null,
        websiteUrl: body.websiteUrl || null,
        goalAmount: parseFloat(body.goalAmount),
        verified: true,
        active: true,
        deadline: body.deadline ? new Date(body.deadline) : null,
      },
    });

    return NextResponse.json({ cause }, { status: 201 });
  } catch (err) {
    console.error("[/api/donations POST]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
