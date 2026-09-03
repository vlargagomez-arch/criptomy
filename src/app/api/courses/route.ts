import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/courses?category=WALLET — lista cursos activos
// POST /api/courses?op=enroll — inscribir usuario
// POST /api/courses?op=progress — actualizar progreso

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const address = searchParams.get("address");

    const where: { active: boolean; category?: string } = { active: true };
    if (category) where.category = category;

    const courses = await db.course.findMany({
      where,
      orderBy: { order: "asc" },
      take: 50,
    });

    // Si hay address, incluir progreso
    let enrollments: Record<string, { progress: number; completed: boolean }> = {};
    if (address) {
      const user = await db.user.findUnique({
        where: { walletAddress: address.toLowerCase() },
        select: { id: true },
      });
      if (user) {
        const enrolls = await db.courseEnrollment.findMany({
          where: { userId: user.id },
          select: { courseId: true, progress: true, completed: true },
        });
        enrollments = Object.fromEntries(enrolls.map((e) => [e.courseId, { progress: e.progress, completed: e.completed }]));
      }
    }

    return NextResponse.json({ courses, enrollments });
  } catch (err) {
    console.error("[/api/courses GET]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const op = searchParams.get("op");
    const body = await req.json();
    const { address, courseId, progress } = body;

    if (!address || !courseId) {
      return NextResponse.json({ error: "address y courseId requeridos" }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { walletAddress: address.toLowerCase() },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    if (op === "enroll") {
      await db.courseEnrollment.upsert({
        where: { userId_courseId: { userId: user.id, courseId } },
        create: { userId: user.id, courseId },
        update: {},
      });
      return NextResponse.json({ ok: true });
    }

    if (op === "progress") {
      const pct = Math.max(0, Math.min(100, parseInt(progress) || 0));
      const completed = pct >= 100;
      await db.courseEnrollment.upsert({
        where: { userId_courseId: { userId: user.id, courseId } },
        create: { userId: user.id, courseId, progress: pct, completed, completedAt: completed ? new Date() : null },
        update: { progress: pct, completed, completedAt: completed ? new Date() : null },
      });
      return NextResponse.json({ ok: true, progress: pct, completed });
    }

    return NextResponse.json({ error: `op no soportado: ${op}` }, { status: 400 });
  } catch (err) {
    console.error("[/api/courses POST]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
