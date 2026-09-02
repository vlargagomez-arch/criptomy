import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/price-alerts?address=0x... — lista alertas del usuario
// POST /api/price-alerts — crea nueva alerta
//    body: { address, asset, alertType, thresholdPrice?, thresholdPercent?, timeframeHours? }
// DELETE /api/price-alerts?id=... — elimina alerta

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address");

  if (!address) {
    return NextResponse.json({ error: "address requerido" }, { status: 400 });
  }

  const user = await db.user.findUnique({
    where: { walletAddress: address.toLowerCase() },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.json({ alerts: [] });
  }

  const alerts = await db.priceAlert.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ alerts });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      address,
      asset,
      alertType,
      thresholdPrice,
      thresholdPercent,
      timeframeHours,
    } = body as {
      address: string;
      asset: string;
      alertType: string;
      thresholdPrice?: number;
      thresholdPercent?: number;
      timeframeHours?: number;
    };

    if (!address || !asset || !alertType) {
      return NextResponse.json(
        { error: "address, asset, alertType requeridos" },
        { status: 400 }
      );
    }

    const validTypes = ["DIP_BELOW", "PERCENT_DROP", "TARGET_PRICE"];
    if (!validTypes.includes(alertType)) {
      return NextResponse.json(
        { error: `alertType debe ser uno de: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    // Validaciones por tipo
    if (alertType === "DIP_BELOW" && (thresholdPrice === undefined || thresholdPrice <= 0)) {
      return NextResponse.json(
        { error: "DIP_BELOW requiere thresholdPrice > 0" },
        { status: 400 }
      );
    }
    if (alertType === "TARGET_PRICE" && (thresholdPrice === undefined || thresholdPrice <= 0)) {
      return NextResponse.json(
        { error: "TARGET_PRICE requiere thresholdPrice > 0" },
        { status: 400 }
      );
    }
    if (alertType === "PERCENT_DROP") {
      if (thresholdPercent === undefined || thresholdPercent <= 0 || thresholdPercent > 90) {
        return NextResponse.json(
          { error: "PERCENT_DROP requiere thresholdPercent entre 0.1 y 90" },
          { status: 400 }
        );
      }
    }

    const user = await db.user.findUnique({
      where: { walletAddress: address.toLowerCase() },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "usuario no encontrado" }, { status: 404 });
    }

    const alert = await db.priceAlert.create({
      data: {
        userId: user.id,
        asset: asset.toUpperCase(),
        alertType,
        thresholdPrice: thresholdPrice ?? null,
        thresholdPercent: thresholdPercent ?? null,
        timeframeHours: timeframeHours ?? 24,
      },
    });

    return NextResponse.json({ alert });
  } catch (err) {
    console.error("[/api/price-alerts POST]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const address = searchParams.get("address");

  if (!id || !address) {
    return NextResponse.json({ error: "id y address requeridos" }, { status: 400 });
  }

  const user = await db.user.findUnique({
    where: { walletAddress: address.toLowerCase() },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.json({ error: "usuario no encontrado" }, { status: 404 });
  }

  // Solo el dueño puede borrar
  const alert = await db.priceAlert.findUnique({ where: { id } });
  if (!alert || alert.userId !== user.id) {
    return NextResponse.json({ error: "alerta no encontrada" }, { status: 404 });
  }

  await db.priceAlert.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
