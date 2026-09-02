import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/notifications/subscribe
// Body: {
//   address: "0x...",
//   subscription: { endpoint, keys: { p256dh, auth } }
// }
//
// Registra o actualiza la suscripción Web Push para el usuario.
// El navegador la crea con `serviceWorkerRegistration.pushManager.subscribe(...)`.

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { address, subscription } = body as {
      address: string;
      subscription: {
        endpoint: string;
        keys: { p256dh: string; auth: string };
        expirationTime?: number | null;
      };
    };

    if (!address || !subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
      return NextResponse.json(
        { error: "address y subscription (endpoint, keys.p256dh, keys.auth) requeridos" },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({
      where: { walletAddress: address.toLowerCase() },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "usuario no encontrado" }, { status: 404 });
    }

    // Upsert: si ya existe el endpoint, actualiza las keys (pueden rotar)
    const existing = await db.pushSubscription.findUnique({
      where: { endpoint: subscription.endpoint },
    });

    if (existing) {
      await db.pushSubscription.update({
        where: { endpoint: subscription.endpoint },
        data: {
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          userId: user.id,
        },
      });
    } else {
      await db.pushSubscription.create({
        data: {
          userId: user.id,
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[/api/notifications/subscribe]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// DELETE /api/notifications/subscribe?endpoint=...
// Elimina la suscripción (cuando el usuario desactiva notificaciones)
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const endpoint = searchParams.get("endpoint");

  if (!endpoint) {
    return NextResponse.json({ error: "endpoint requerido" }, { status: 400 });
  }

  try {
    await db.pushSubscription.deleteMany({ where: { endpoint } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[/api/notifications/subscribe DELETE]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
