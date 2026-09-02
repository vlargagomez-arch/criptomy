import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/notifications?address=0x... — lista notifs del usuario
// POST /api/notifications — marca como leídas (body: { ids: string[] } o { all: true })

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
    return NextResponse.json({ notifications: [], unread: 0 });
  }

  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
  const onlyUnread = searchParams.get("unread") === "true";

  const where = onlyUnread
    ? { userId: user.id, read: false }
    : { userId: user.id };

  const [notifications, unread] = await Promise.all([
    db.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    db.notification.count({ where: { userId: user.id, read: false } }),
  ]);

  return NextResponse.json({ notifications, unread });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { address, op, ids, all } = body as {
    address: string;
    op: string;
    ids?: string[];
    all?: boolean;
  };

  if (!address || !op) {
    return NextResponse.json({ error: "address y op requeridos" }, { status: 400 });
  }

  const user = await db.user.findUnique({
    where: { walletAddress: address.toLowerCase() },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.json({ error: "usuario no encontrado" }, { status: 404 });
  }

  if (op === "mark-read") {
    if (all) {
      await db.notification.updateMany({
        where: { userId: user.id, read: false },
        data: { read: true, readAt: new Date() },
      });
    } else if (ids && Array.isArray(ids)) {
      await db.notification.updateMany({
        where: { id: { in: ids }, userId: user.id },
        data: { read: true, readAt: new Date() },
      });
    } else {
      return NextResponse.json({ error: "ids o all=true requerido" }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  if (op === "delete") {
    if (ids && Array.isArray(ids)) {
      await db.notification.deleteMany({
        where: { id: { in: ids }, userId: user.id },
      });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: `op no soportado: ${op}` }, { status: 400 });
}
