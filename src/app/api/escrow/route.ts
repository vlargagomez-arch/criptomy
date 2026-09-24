import { NextRequest, NextResponse } from "next/server";
import {
  EscrowTx, ProductType, PHASE_LABELS, PRODUCT_TYPE_LABELS,
} from "@/lib/escrow/types";
import {
  loadTx, saveTx, getTx, putTx, logEvent, buildChecklist, appendMsg, pushBotMsg,
} from "@/lib/escrow/store";
import {
  parseCommand, executeCommand, analyzeFreeMessage, CONFIG,
} from "@/lib/escrow/engine";

// ============================================================
// API: /api/escrow — CRUD + state machine + slash commands
// ============================================================

function requireWallet(body: any): string | null {
  return body?.wallet || null;
}

// GET — listar transacciones del usuario
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get("wallet") || "";
  const filter = searchParams.get("filter") || "active"; // active | all | completed | disputed
  const db = loadTx();
  let list = Object.values(db);
  if (wallet) {
    list = list.filter(t => t.buyer === wallet || t.seller === wallet);
  }
  if (filter === "active") {
    list = list.filter(t => !["COMPLETADA", "CANCELADA"].includes(t.phase));
  } else if (filter === "completed") {
    list = list.filter(t => t.phase === "COMPLETADA");
  } else if (filter === "disputed") {
    list = list.filter(t => t.phase.startsWith("DISPUTA"));
  }
  list.sort((a, b) => b.updatedAt - a.updatedAt);
  return NextResponse.json({ txs: list, count: list.length });
}

// POST — ejecutar acción
export async function POST(req: NextRequest) {
  const body = await req.json();
  const wallet = requireWallet(body);
  if (!wallet) return NextResponse.json({ error: "wallet requerida" }, { status: 400 });
  const alias = body.alias || "anónimo";
  const action = body.action;

  // ---- LIST_TX_BY_WALLET (convenience) ----------------------
  if (action === "list_mine") {
    const db = loadTx();
    const list = Object.values(db).filter(t => t.buyer === wallet || t.seller === wallet);
    return NextResponse.json({ txs: list, count: list.length });
  }

  // ---- COMMAND (slash command) ------------------------------
  if (action === "command") {
    const { text, txId } = body;
    if (!text || !text.startsWith("/")) {
      return NextResponse.json({ error: "Solo se aceptan comandos / en este endpoint" }, { status: 400 });
    }
    const cmd = parseCommand(text);
    if (!cmd) return NextResponse.json({ error: "Comando inválido" }, { status: 400 });
    let tx: EscrowTx | null = txId ? getTx(txId) : null;
    const result = executeCommand(cmd, tx, wallet, alias);
    return NextResponse.json({
      ok: result.ok,
      error: result.error,
      tx: result.tx,
      botReply: result.botReply,
    });
  }

  // ---- SEND_MESSAGE (mensaje libre, no comando) ------------
  if (action === "message") {
    const { txId, text } = body;
    if (!txId || !text) return NextResponse.json({ error: "txId y text requeridos" }, { status: 400 });
    const tx = getTx(txId);
    if (!tx) return NextResponse.json({ error: "Transacción no encontrada" }, { status: 404 });
    // Validar sender
    const isParticipant = tx.buyer === wallet || tx.seller === wallet;
    if (!isParticipant) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    // Anti-fraude
    const analysis = analyzeFreeMessage(tx, text);
    if (analysis.block) {
      tx.phase = "CANCELADA";
      tx.cancelledAt = Date.now();
      logEvent(tx, "AUTO_CANCEL_FORBIDDEN", wallet, { text });
      putTx(tx);
      pushBotMsg(tx.id, analysis.warning!, "SISTEMA");
      return NextResponse.json({ ok: false, error: analysis.warning, tx });
    }
    const immutable = tx.phase !== "NEGOCIANDO";
    const role = tx.buyer === wallet ? "BUYER" : "SELLER";
    const msg = appendMsg(txId, wallet, alias, role, text, immutable);
    if (analysis.warning) {
      pushBotMsg(tx.id, analysis.warning, "SISTEMA");
    }
    logEvent(tx, "MESSAGE_SENT", wallet, { text: text.slice(0, 50) });
    putTx(tx);
    return NextResponse.json({ ok: true, message: msg, warning: analysis.warning });
  }

  // ---- GET_TX ----------------------------------------------
  if (action === "get") {
    const tx = getTx(body.txId);
    if (!tx) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
    return NextResponse.json({ tx });
  }

  return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
}
