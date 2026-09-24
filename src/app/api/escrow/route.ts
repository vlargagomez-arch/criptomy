import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createHash } from "crypto";

// ============================================================
// API: /api/escrow — CRUD + state machine con Prisma
// ============================================================
// Todas las respuestas son JSON válido, incluso en error.
// Si la DB no está migrada, devuelve error claro en JSON.
// ============================================================

const ADMIN_WALLET = (process.env.ADMIN_WALLET || "").toLowerCase();

function sha256(input: string): string {
  return createHash("sha256").update(input, "utf-8").digest("hex");
}

function genCode(): string {
  const year = new Date().getFullYear();
  const num = Math.floor(Math.random() * 90000) + 10000;
  return `ESC-${year}-${num}`;
}

function jsonError(message: string, status = 500, extra: any = {}) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}

async function pushBotMsg(
  dealId: string,
  text: string,
  tag?: "ACUERDO" | "EVIDENCIA" | "URGENTE" | "SISTEMA",
) {
  const existing = await db.escrowMessage.findMany({
    where: { dealId },
    orderBy: { ts: "asc" },
  });
  const prevHash = existing.length ? existing[existing.length - 1].hash : "GENESIS";
  const ts = new Date();
  const hash = sha256(`${prevHash}|${dealId}|BOT|${ts.getTime()}|${text}`).slice(0, 16);
  return db.escrowMessage.create({
    data: {
      dealId,
      senderWallet: "ESCROW_BOT",
      senderAlias: "EscrowBot",
      senderRole: "BOT",
      text,
      ts,
      hash,
      immutable: true,
      tag: tag || "SISTEMA",
    },
  });
}

async function pushUserMsg(
  dealId: string,
  wallet: string,
  alias: string,
  role: "BUYER" | "SELLER" | "ADMIN",
  text: string,
  immutable: boolean,
  tag?: "ACUERDO" | "EVIDENCIA" | "URGENTE" | "SISTEMA",
) {
  const existing = await db.escrowMessage.findMany({
    where: { dealId },
    orderBy: { ts: "asc" },
  });
  const prevHash = existing.length ? existing[existing.length - 1].hash : "GENESIS";
  const ts = new Date();
  const hash = sha256(`${prevHash}|${dealId}|${wallet}|${ts.getTime()}|${text}`).slice(0, 16);
  return db.escrowMessage.create({
    data: {
      dealId,
      senderWallet: wallet,
      senderAlias: alias,
      senderRole: role,
      text,
      ts,
      hash,
      immutable,
      tag,
    },
  });
}

// GET — listar deals del usuario
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const wallet = (searchParams.get("wallet") || "").toLowerCase();
    const filter = searchParams.get("filter") || "active";

    // Panel admin: ve TODOS los deals en disputa
    if (filter === "admin") {
      if (!ADMIN_WALLET || wallet !== ADMIN_WALLET) {
        return jsonError("No autorizado", 403);
      }
      const deals = await db.escrowDeal.findMany({
        where: { status: "DISPUTED" },
        include: {
          buyer: { select: { alias: true, walletAddress: true } },
          seller: { select: { alias: true, walletAddress: true } },
        },
        orderBy: { updatedAt: "desc" },
      });
      return NextResponse.json({ deals });
    }

    if (!wallet) {
      return jsonError("wallet requerida", 400);
    }

    // Buscar usuario por wallet
    const user = await db.user.findUnique({ where: { walletAddress: wallet } });
    if (!user) return NextResponse.json({ deals: [] });

    let where: any = {
      OR: [{ buyerId: user.id }, { sellerId: user.id }],
    };
    if (filter === "active") {
      where = {
        AND: [
          { OR: [{ buyerId: user.id }, { sellerId: user.id }] },
          { status: { notIn: ["COMPLETED", "CANCELLED"] } },
        ],
      };
    } else if (filter === "disputed") {
      where = {
        AND: [
          { OR: [{ buyerId: user.id }, { sellerId: user.id }] },
          { status: "DISPUTED" },
        ],
      };
    }

    const deals = await db.escrowDeal.findMany({
      where,
      include: {
        buyer: { select: { alias: true, walletAddress: true } },
        seller: { select: { alias: true, walletAddress: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json({ deals });
  } catch (err: any) {
    console.error("[escrow GET]", err);
    // Detectar si es error de tabla no existe
    const msg = err?.message || "";
    if (msg.includes("relation") && msg.includes("does not exist")) {
      return jsonError(
        "Las tablas de escrow no existen en la base de datos. Ejecuta el schema en Supabase.",
        500,
        { migrationNeeded: true, detail: msg }
      );
    }
    return jsonError("Error interno: " + msg.slice(0, 200), 500);
  }
}

// POST — ejecutar acción
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const wallet = (body.wallet || "").toLowerCase();
    const alias = body.alias || "anónimo";
    const action = body.action;

    if (!wallet && action !== "get") {
      return jsonError("wallet requerida", 400);
    }

    // ---- GET Deal específico ----
    if (action === "get") {
      const deal = await db.escrowDeal.findUnique({
        where: { id: body.dealId },
        include: {
          buyer: { select: { alias: true, walletAddress: true } },
          seller: { select: { alias: true, walletAddress: true } },
          messages: { orderBy: { ts: "asc" } },
        },
      });
      if (!deal) return jsonError("No encontrado", 404);
      return NextResponse.json({ deal });
    }

    // ---- CREATE — vendedor crea deal ----
    if (action === "create") {
      // Validar campos
      if (!body.productType || !body.title || !body.amount) {
        return jsonError("Faltan campos: productType, title, amount", 400);
      }
      let user = await db.user.findUnique({ where: { walletAddress: wallet } });
      if (!user) {
        user = await db.user.create({
          data: {
            walletAddress: wallet,
            alias: alias || `user_${wallet.slice(2, 8)}`,
          },
        });
      }
      const deal = await db.escrowDeal.create({
        data: {
          code: genCode(),
          productType: body.productType,
          title: body.title,
          description: body.description || "",
          category: body.category || "",
          amount: parseFloat(body.amount),
          currency: body.currency || "USDT",
          sellerId: user.id,
          sellerAlias: alias,
          status: "CREATED",
        },
      });
      await pushBotMsg(
        deal.id,
        `[ESCROW BOT] Deal creado: ${deal.code}\n\n` +
        `Vendedor: ${alias}\n` +
        `Producto: ${body.title}\n` +
        `Tipo: ${body.productType}\n` +
        `Monto: ${body.amount} USDT\n\n` +
        `Comparte el código ${deal.code} con el comprador para que se una.\n\n` +
        `El comprador deberá firmar el acuerdo con MetaMask para bloquear los fondos.`,
        "SISTEMA",
      );
      return NextResponse.json({ ok: true, deal });
    }

    // ---- JOIN — comprador se une con código ----
    if (action === "join") {
      const code = body.code;
      if (!code) return jsonError("Código requerido", 400);
      let user = await db.user.findUnique({ where: { walletAddress: wallet } });
      if (!user) {
        user = await db.user.create({
          data: { walletAddress: wallet, alias },
        });
      }
      const deal = await db.escrowDeal.findUnique({ where: { code } });
      if (!deal) return jsonError("Código no válido", 404);
      if (deal.status !== "CREATED") return jsonError("Deal ya tomado", 400);
      if (deal.sellerId === user.id) return jsonError("No puedes unirte a tu propio deal", 400);
      const updated = await db.escrowDeal.update({
        where: { id: deal.id },
        data: {
          buyerId: user.id,
          buyerAlias: alias,
          status: "JOINED",
        },
      });
      await pushBotMsg(
        deal.id,
        `[ESCROW BOT] Comprador vinculado: ${alias}\n\n` +
        `Ambas partes están listas. Acuerden los términos en el chat.\n\n` +
        `Cuando estén de acuerdo, el COMPRADOR debe:\n` +
        `1. Firmar el acuerdo con MetaMask\n` +
        `2. Bloquear los fondos\n\n` +
        `Una vez bloqueados, el vendedor entrega el producto.`,
        "SISTEMA",
      );
      return NextResponse.json({ ok: true, deal: updated });
    }

    // Para las siguientes acciones necesitamos el dealId
    const deal = await db.escrowDeal.findUnique({ where: { id: body.dealId } });
    if (!deal) return jsonError("Deal no encontrado", 404);

    // ---- SIGN — comprador firma acuerdo con MetaMask ----
    if (action === "sign") {
      let user = await db.user.findUnique({ where: { walletAddress: wallet } });
      if (!user || user.id !== deal.buyerId) {
        return jsonError("Solo el comprador puede firmar", 403);
      }
      const agreement = body.agreement;
      if (!agreement || agreement.length < 10) {
        return jsonError("Acuerdo muy corto", 400);
      }
      const signature = body.signature;
      if (!signature) return jsonError("Firma requerida", 400);
      const updated = await db.escrowDeal.update({
        where: { id: deal.id },
        data: {
          agreement,
          agreementLockedAt: new Date(),
          buyerSignature: signature,
        },
      });
      await pushUserMsg(deal.id, wallet, alias, "BUYER", `📝 Acuerdo firmado por MetaMask:\n\n${agreement}`, true, "ACUERDO");
      await pushBotMsg(
        deal.id,
        `[ESCROW BOT] Acuerdo firmado y bloqueado.\n\nEl comprador puede ahora bloquear los fondos.`,
        "SISTEMA",
      );
      return NextResponse.json({ ok: true, deal: updated });
    }

    // ---- FUND — comprador bloquea fondos ----
    if (action === "fund") {
      let user = await db.user.findUnique({ where: { walletAddress: wallet } });
      if (!user || user.id !== deal.buyerId) {
        return jsonError("Solo el comprador puede bloquear", 403);
      }
      if (deal.status !== "JOINED") return jsonError("Deal no está en JOINED", 400);
      if (!deal.agreement) return jsonError("Firma el acuerdo primero", 400);
      const fundTxHash = body.fundTxHash;
      const updated = await db.escrowDeal.update({
        where: { id: deal.id },
        data: {
          status: "FUNDED",
          fundedAt: new Date(),
          fundTxHash,
        },
      });
      await pushBotMsg(
        deal.id,
        `[ESCROW BOT] 🔒 Fondos bloqueados en custodia: ${deal.amount} USDT\n\n` +
        `Comisión (${deal.commissionPct}%): ${(deal.amount * deal.commissionPct / 100).toFixed(2)} USDT\n` +
        `Vendedor recibe al liberar: ${(deal.amount * (1 - deal.commissionPct / 100)).toFixed(2)} USDT\n\n` +
        `⚠️ A partir de ahora todos los mensajes son INMUTABLES y constituyen evidencia.\n\n` +
        `Vendedor: entrega el producto.\n` +
        `Comprador: NO confirmes recepción hasta verificar el producto.`,
        "SISTEMA",
      );
      return NextResponse.json({ ok: true, deal: updated });
    }

    // ---- DELIVER — vendedor entrega producto ----
    if (action === "deliver") {
      let user = await db.user.findUnique({ where: { walletAddress: wallet } });
      if (!user || user.id !== deal.sellerId) {
        return jsonError("Solo el vendedor puede entregar", 403);
      }
      if (deal.status !== "FUNDED") return jsonError("No hay fondos bloqueados", 400);
      const updated = await db.escrowDeal.update({
        where: { id: deal.id },
        data: {
          status: "DELIVERED",
          deliveredAt: new Date(),
          deliveryDescription: body.deliveryDescription || "",
          deliveryCode: body.deliveryCode || "",
          deliveryCredentials: body.deliveryCredentials || "",
          deliveryLink: body.deliveryLink || "",
          deliveryInstructions: body.deliveryInstructions || "",
        },
      });
      await pushBotMsg(
        deal.id,
        `[ESCROW BOT] ✅ Producto entregado por el vendedor.\n\n` +
        `Comprador: revisa el producto. Si todo está OK, libera los fondos.\n` +
        `Si hay problemas, abre una disputa y el admin la revisará.`,
        "SISTEMA",
      );
      return NextResponse.json({ ok: true, deal: updated });
    }

    // ---- RELEASE — comprador libera fondos al vendedor ----
    if (action === "release") {
      let user = await db.user.findUnique({ where: { walletAddress: wallet } });
      if (!user || user.id !== deal.buyerId) {
        return jsonError("Solo el comprador libera", 403);
      }
      if (!["DELIVERED", "DISPUTED"].includes(deal.status)) {
        return jsonError("No se puede liberar en este estado", 400);
      }
      const updated = await db.escrowDeal.update({
        where: { id: deal.id },
        data: {
          status: "COMPLETED",
          releasedAt: new Date(),
          completedAt: new Date(),
        },
      });
      await pushBotMsg(
        deal.id,
        `[ESCROW BOT] 🎉 Fondos liberados al vendedor.\n\n` +
        `Vendedor recibe: ${(deal.amount * (1 - deal.commissionPct / 100)).toFixed(2)} USDT\n` +
        `Comisión: ${(deal.amount * deal.commissionPct / 100).toFixed(2)} USDT\n\n` +
        `Transacción completada.`,
        "SISTEMA",
      );
      return NextResponse.json({ ok: true, deal: updated });
    }

    // ---- DISPUTE — cualquiera abre disputa ----
    if (action === "dispute") {
      let user = await db.user.findUnique({ where: { walletAddress: wallet } });
      if (!user || (user.id !== deal.buyerId && user.id !== deal.sellerId)) {
        return jsonError("No autorizado", 403);
      }
      if (!["FUNDED", "DELIVERED"].includes(deal.status)) {
        return jsonError("No se puede disputar en este estado", 400);
      }
      const reason = body.reason;
      if (!reason || reason.length < 10) {
        return jsonError("Razón muy corta", 400);
      }
      const updated = await db.escrowDeal.update({
        where: { id: deal.id },
        data: {
          status: "DISPUTED",
          disputedAt: new Date(),
          disputeReason: reason,
        },
      });
      const role = user.id === deal.buyerId ? "comprador" : "vendedor";
      await pushUserMsg(deal.id, wallet, alias, user.id === deal.buyerId ? "BUYER" : "SELLER", `🚨 Disputa abierta por ${role}:\n\n${reason}`, true, "EVIDENCIA");
      await pushBotMsg(
        deal.id,
        `[ESCROW BOT] 🚨 DISPUTA INICIADA\n\n` +
        `Motivo: ${reason}\n\n` +
        `Fondos congelados hasta resolución.\n` +
        `El ADMIN revisará el chat completo y la evidencia.\n\n` +
        `Ambas partes pueden agregar evidencia con mensajes etiquetados.`,
        "SISTEMA",
      );
      return NextResponse.json({ ok: true, deal: updated });
    }

    // ---- EVIDENCE — agregar evidencia a disputa ----
    if (action === "evidence") {
      let user = await db.user.findUnique({ where: { walletAddress: wallet } });
      if (!user || (user.id !== deal.buyerId && user.id !== deal.sellerId)) {
        return jsonError("No autorizado", 403);
      }
      if (deal.status !== "DISPUTED") {
        return jsonError("No hay disputa abierta", 400);
      }
      const desc = body.description;
      if (!desc) return jsonError("Descripción requerida", 400);
      const role = user.id === deal.buyerId ? "BUYER" : "SELLER";
      await pushUserMsg(deal.id, wallet, alias, role, `📎 Evidencia:\n\n${desc}`, true, "EVIDENCIA");
      return NextResponse.json({ ok: true });
    }

    // ---- MESSAGE — mensaje libre en chat ----
    if (action === "message") {
      let user = await db.user.findUnique({ where: { walletAddress: wallet } });
      if (!user || (user.id !== deal.buyerId && user.id !== deal.sellerId)) {
        return jsonError("No autorizado", 403);
      }
      const text = body.text;
      if (!text) return jsonError("Texto requerido", 400);
      const immutable = deal.status !== "CREATED" && deal.status !== "JOINED";
      const role = user.id === deal.buyerId ? "BUYER" : "SELLER";
      await pushUserMsg(deal.id, wallet, alias, role, text, immutable);
      return NextResponse.json({ ok: true });
    }

    // ---- ADMIN RESOLVE — solo el admin resuelve disputas ----
    if (action === "admin_resolve") {
      if (!ADMIN_WALLET) return jsonError("ADMIN_WALLET no configurado en el servidor", 500);
      if (wallet !== ADMIN_WALLET) {
        return jsonError("Solo el admin puede resolver disputas", 403);
      }
      if (deal.status !== "DISPUTED") {
        return jsonError("El deal no está en disputa", 400);
      }
      const resolution = body.resolution;
      const partialSeller = body.partialSeller ? parseFloat(body.partialSeller) : null;
      const partialRefund = body.partialRefund ? parseFloat(body.partialRefund) : null;
      if (!["RELEASE", "REFUND", "PARTIAL"].includes(resolution)) {
        return jsonError("Resolución inválida", 400);
      }
      const updated = await db.escrowDeal.update({
        where: { id: deal.id },
        data: {
          status: "COMPLETED",
          disputeResolution: resolution,
          disputeResolvedBy: wallet,
          disputeResolvedAt: new Date(),
          disputePartialSeller: partialSeller,
          disputePartialRefund: partialRefund,
          completedAt: new Date(),
        },
      });
      let txt = `[ESCROW BOT] ⚖️ RESOLUCIÓN DEL ADMIN\n\n`;
      if (resolution === "RELEASE") {
        txt += `Fondos liberados al vendedor.\nVendedor recibe: ${(deal.amount * (1 - deal.commissionPct / 100)).toFixed(2)} USDT`;
      } else if (resolution === "REFUND") {
        txt += `Fondos reembolsados al comprador.\nComprador recibe: ${deal.amount} USDT`;
      } else {
        txt += `División parcial:\nVendedor recibe: ${partialSeller} USDT\nComprador recibe: ${partialRefund} USDT`;
      }
      await pushBotMsg(deal.id, txt, "SISTEMA");
      return NextResponse.json({ ok: true, deal: updated });
    }

    // ---- CANCEL — cancelar deal ----
    if (action === "cancel") {
      let user = await db.user.findUnique({ where: { walletAddress: wallet } });
      if (!user || (user.id !== deal.buyerId && user.id !== deal.sellerId)) {
        return jsonError("No autorizado", 403);
      }
      if (!["CREATED", "JOINED"].includes(deal.status)) {
        return jsonError("No se puede cancelar en este estado", 400);
      }
      const updated = await db.escrowDeal.update({
        where: { id: deal.id },
        data: { status: "CANCELLED", cancelledAt: new Date() },
      });
      await pushBotMsg(deal.id, `[ESCROW BOT] Deal cancelado.`, "SISTEMA");
      return NextResponse.json({ ok: true, deal: updated });
    }

    return jsonError("Acción no válida: " + action, 400);
  } catch (err: any) {
    console.error("[escrow POST]", err);
    const msg = err?.message || "";
    if (msg.includes("relation") && msg.includes("does not exist")) {
      return jsonError(
        "Las tablas de escrow no existen en la base de datos. Ejecuta el schema en Supabase.",
        500,
        { migrationNeeded: true, detail: msg.slice(0, 300) }
      );
    }
    return jsonError("Error interno: " + msg.slice(0, 200), 500);
  }
}
