import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createHash } from "crypto";

// ============================================================
// API: /api/escrow — CRUD + state machine con Prisma
// ============================================================
//
// Flujo claro con MetaMask:
//   1. Vendedor crea deal (CREATED) con /api/escrow POST { action: "create" }
//   2. Comprador se une con código (JOINED)
//   3. Comprador firma acuerdo con MetaMask + bloquea fondos (FUNDED)
//   4. Vendedor entrega producto (DELIVERED)
//   5. Comprador confirma recepción (COMPLETED) → fondos al vendedor
//   6. Cualquiera abre disputa (DISPUTED) → admin resuelve
//
// Admin (wallet del .env ADMIN_WALLET) puede:
//   - Liberar fondos al vendedor
//   - Reembolsar al comprador
//   - División parcial
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
  const { searchParams } = new URL(req.url);
  const wallet = (searchParams.get("wallet") || "").toLowerCase();
  const filter = searchParams.get("filter") || "active"; // active | all | disputed | admin

  // Panel admin: ve TODOS los deals en disputa
  if (filter === "admin") {
    if (!ADMIN_WALLET || wallet !== ADMIN_WALLET) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
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
    return NextResponse.json({ error: "wallet requerida" }, { status: 400 });
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
}

// POST — ejecutar acción
export async function POST(req: NextRequest) {
  const body = await req.json();
  const wallet = (body.wallet || "").toLowerCase();
  const alias = body.alias || "anónimo";
  const action = body.action;

  if (!wallet && action !== "get") {
    return NextResponse.json({ error: "wallet requerida" }, { status: 400 });
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
    if (!deal) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    return NextResponse.json({ deal });
  }

  // ---- CREATE — vendedor crea deal ----
  if (action === "create") {
    // Necesitamos el userId; buscar o crear usuario por wallet
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
        description: body.description,
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
      `Comparte el código ${deal.code} con el comprador para que se una con /join ${deal.code}.\n\n` +
      `El comprador deberá firmar el acuerdo con MetaMask para bloquear los fondos.`,
      "SISTEMA",
    );
    return NextResponse.json({ ok: true, deal });
  }

  // ---- JOIN — comprador se une con código ----
  if (action === "join") {
    const code = body.code;
    if (!code) return NextResponse.json({ error: "Código requerido" }, { status: 400 });
    let user = await db.user.findUnique({ where: { walletAddress: wallet } });
    if (!user) {
      user = await db.user.create({
        data: { walletAddress: wallet, alias },
      });
    }
    const deal = await db.escrowDeal.findUnique({ where: { code } });
    if (!deal) return NextResponse.json({ error: "Código no válido" }, { status: 404 });
    if (deal.status !== "CREATED") return NextResponse.json({ error: "Deal ya tomado" }, { status: 400 });
    if (deal.sellerId === user.id) return NextResponse.json({ error: "No puedes unirte a tu propio deal" }, { status: 400 });
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
      `1. Firmar el acuerdo con MetaMask (/sign)\n` +
      `2. Bloquear los fondos (/fund)\n\n` +
      `Una vez bloqueados, el vendedor entrega el producto.`,
      "SISTEMA",
    );
    return NextResponse.json({ ok: true, deal: updated });
  }

  // Para las siguientes acciones necesitamos el dealId
  const deal = await db.escrowDeal.findUnique({ where: { id: body.dealId } });
  if (!deal) return NextResponse.json({ error: "Deal no encontrado" }, { status: 404 });

  // ---- SIGN — comprador firma acuerdo con MetaMask ----
  if (action === "sign") {
    if (deal.buyerId) {
      let user = await db.user.findUnique({ where: { walletAddress: wallet } });
      if (!user || user.id !== deal.buyerId) {
        return NextResponse.json({ error: "Solo el comprador puede firmar" }, { status: 403 });
      }
    }
    const agreement = body.agreement;
    if (!agreement || agreement.length < 10) {
      return NextResponse.json({ error: "Acuerdo muy corto" }, { status: 400 });
    }
    const signature = body.signature; // MetaMask signature
    if (!signature) return NextResponse.json({ error: "Firma requerida" }, { status: 400 });
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
      `[ESCROW BOT] Acuerdo firmado y bloqueado.\n\n` +
      `El comprador puede ahora bloquear los fondos con /fund.`,
      "SISTEMA",
    );
    return NextResponse.json({ ok: true, deal: updated });
  }

  // ---- FUND — comprador bloquea fondos (simulado, firmado con MetaMask) ----
  if (action === "fund") {
    let user = await db.user.findUnique({ where: { walletAddress: wallet } });
    if (!user || user.id !== deal.buyerId) {
      return NextResponse.json({ error: "Solo el comprador puede bloquear" }, { status: 403 });
    }
    if (deal.status !== "JOINED") return NextResponse.json({ error: "Deal no está en JOINED" }, { status: 400 });
    if (!deal.agreement) return NextResponse.json({ error: "Firma el acuerdo primero" }, { status: 400 });
    const fundTxHash = body.fundTxHash; // hash de la tx real si hay smart contract, o firma simulada
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
      `Vendedor: entrega el producto con /deliver.\n` +
      `Comprador: NO confirmes recepción hasta verificar el producto.`,
      "SISTEMA",
    );
    return NextResponse.json({ ok: true, deal: updated });
  }

  // ---- DELIVER — vendedor entrega producto ----
  if (action === "deliver") {
    let user = await db.user.findUnique({ where: { walletAddress: wallet } });
    if (!user || user.id !== deal.sellerId) {
      return NextResponse.json({ error: "Solo el vendedor puede entregar" }, { status: 403 });
    }
    if (deal.status !== "FUNDED") return NextResponse.json({ error: "No hay fondos bloqueados" }, { status: 400 });
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
      `Comprador: revisa el producto. Si todo está OK, usa /release para liberar los fondos al vendedor.\n` +
      `Si hay problemas, usa /dispute para abrir una disputa y el admin la revisará.`,
      "SISTEMA",
    );
    return NextResponse.json({ ok: true, deal: updated });
  }

  // ---- RELEASE — comprador libera fondos al vendedor ----
  if (action === "release") {
    let user = await db.user.findUnique({ where: { walletAddress: wallet } });
    if (!user || user.id !== deal.buyerId) {
      return NextResponse.json({ error: "Solo el comprador libera" }, { status: 403 });
    }
    if (!["DELIVERED", "DISPUTED"].includes(deal.status)) {
      return NextResponse.json({ error: "No se puede liberar en este estado" }, { status: 400 });
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
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
    if (!["FUNDED", "DELIVERED"].includes(deal.status)) {
      return NextResponse.json({ error: "No se puede disputar en este estado" }, { status: 400 });
    }
    const reason = body.reason;
    if (!reason || reason.length < 10) {
      return NextResponse.json({ error: "Razón muy corta" }, { status: 400 });
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
      `Ambas partes pueden agregar evidencia con /evidence "descripción".`,
      "SISTEMA",
    );
    return NextResponse.json({ ok: true, deal: updated });
  }

  // ---- EVIDENCE — agregar evidencia a disputa ----
  if (action === "evidence") {
    let user = await db.user.findUnique({ where: { walletAddress: wallet } });
    if (!user || (user.id !== deal.buyerId && user.id !== deal.sellerId)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
    if (deal.status !== "DISPUTED") {
      return NextResponse.json({ error: "No hay disputa abierta" }, { status: 400 });
    }
    const desc = body.description;
    if (!desc) return NextResponse.json({ error: "Descripción requerida" }, { status: 400 });
    const role = user.id === deal.buyerId ? "BUYER" : "SELLER";
    await pushUserMsg(deal.id, wallet, alias, role, `📎 Evidencia:\n\n${desc}`, true, "EVIDENCIA");
    return NextResponse.json({ ok: true });
  }

  // ---- MESSAGE — mensaje libre en chat ----
  if (action === "message") {
    let user = await db.user.findUnique({ where: { walletAddress: wallet } });
    if (!user || (user.id !== deal.buyerId && user.id !== deal.sellerId)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
    const text = body.text;
    if (!text) return NextResponse.json({ error: "Texto requerido" }, { status: 400 });
    const immutable = deal.status !== "CREATED" && deal.status !== "JOINED";
    const role = user.id === deal.buyerId ? "BUYER" : "SELLER";
    await pushUserMsg(deal.id, wallet, alias, role, text, immutable);
    return NextResponse.json({ ok: true });
  }

  // ---- ADMIN RESOLVE — solo el admin resuelve disputas ----
  if (action === "admin_resolve") {
    if (!ADMIN_WALLET) return NextResponse.json({ error: "ADMIN_WALLET no configurado" }, { status: 500 });
    if (wallet !== ADMIN_WALLET) {
      return NextResponse.json({ error: "Solo el admin puede resolver disputas" }, { status: 403 });
    }
    if (deal.status !== "DISPUTED") {
      return NextResponse.json({ error: "El deal no está en disputa" }, { status: 400 });
    }
    const resolution = body.resolution; // RELEASE | REFUND | PARTIAL
    const partialSeller = body.partialSeller ? parseFloat(body.partialSeller) : null;
    const partialRefund = body.partialRefund ? parseFloat(body.partialRefund) : null;
    if (!["RELEASE", "REFUND", "PARTIAL"].includes(resolution)) {
      return NextResponse.json({ error: "Resolución inválida" }, { status: 400 });
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
      txt += `Fondos liberados al vendedor.\n` +
             `Vendedor recibe: ${(deal.amount * (1 - deal.commissionPct / 100)).toFixed(2)} USDT`;
    } else if (resolution === "REFUND") {
      txt += `Fondos reembolsados al comprador.\n` +
             `Comprador recibe: ${deal.amount} USDT`;
    } else {
      txt += `División parcial:\n` +
             `Vendedor recibe: ${partialSeller} USDT\n` +
             `Comprador recibe: ${partialRefund} USDT`;
    }
    await pushBotMsg(deal.id, txt, "SISTEMA");
    return NextResponse.json({ ok: true, deal: updated });
  }

  // ---- CANCEL — cancelar deal (solo CREATED o JOINED) ----
  if (action === "cancel") {
    let user = await db.user.findUnique({ where: { walletAddress: wallet } });
    if (!user || (user.id !== deal.buyerId && user.id !== deal.sellerId)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
    if (!["CREATED", "JOINED"].includes(deal.status)) {
      return NextResponse.json({ error: "No se puede cancelar en este estado" }, { status: 400 });
    }
    const updated = await db.escrowDeal.update({
      where: { id: deal.id },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });
    await pushBotMsg(deal.id, `[ESCROW BOT] Deal cancelado.`, "SISTEMA");
    return NextResponse.json({ ok: true, deal: updated });
  }

  return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
}
