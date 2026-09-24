// ============================================================
// EscrowBot — Store (persistencia + hashing + audit log)
// ============================================================
// Persistencia en /tmp/escrow-tx.json + /tmp/escrow-msg.json
// En producción: DB real. Para dev/demo es suficiente.
// ============================================================

import { createHash } from "crypto";
import {
  EscrowTx, EscrowMessage, ChecklistItem, CHECKLISTS, ProductType,
} from "./types";

const TX_FILE = "/tmp/escrow-tx.json";
const MSG_FILE = "/tmp/escrow-msg.json";

function readJSON<T>(path: string, fallback: T): T {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require("fs");
    if (fs.existsSync(path)) return JSON.parse(fs.readFileSync(path, "utf-8")) as T;
  } catch {}
  return fallback;
}

function writeJSON(path: string, data: any): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require("fs");
    fs.writeFileSync(path, JSON.stringify(data, null, 2));
  } catch {}
}

// ---- Hashing criptográfico ----------------------------------
export function sha256(input: string): string {
  return createHash("sha256").update(input, "utf-8").digest("hex");
}

// ---- TX CRUD ------------------------------------------------
export function loadTx(): Record<string, EscrowTx> {
  return readJSON<Record<string, EscrowTx>>(TX_FILE, {});
}
export function saveTx(db: Record<string, EscrowTx>): void {
  writeJSON(TX_FILE, db);
}
export function getTx(id: string): EscrowTx | null {
  return loadTx()[id] || null;
}
export function putTx(tx: EscrowTx): void {
  const db = loadTx();
  db[tx.id] = tx;
  saveTx(db);
}

// ---- Msg CRUD -----------------------------------------------
export function loadMsg(): EscrowMessage[] {
  return readJSON<EscrowMessage[]>(MSG_FILE, []);
}
export function saveMsg(msgs: EscrowMessage[]): void {
  writeJSON(MSG_FILE, msgs);
}
export function getMsgs(escrowId: string): EscrowMessage[] {
  return loadMsg().filter(m => m.escrowId === escrowId).sort((a, b) => a.ts - b.ts);
}

/**
 * Append-only con chaining hash: el hash de cada mensaje depende
 * del hash del anterior. Si se altera uno, todos los siguientes
 * dejan de cuadrar → evidencia verificable.
 */
export function appendMsg(
  escrowId: string,
  sender: string,
  senderAlias: string,
  senderRole: EscrowMessage["senderRole"],
  text: string,
  immutable: boolean,
  tag?: EscrowMessage["tag"],
): EscrowMessage {
  const msgs = loadMsg();
  const txMsgs = msgs.filter(m => m.escrowId === escrowId).sort((a, b) => a.ts - b.ts);
  const prevHash = txMsgs.length ? txMsgs[txMsgs.length - 1].hash : "GENESIS";
  const ts = Date.now();
  const hash = sha256(`${prevHash}|${escrowId}|${sender}|${ts}|${text}`);
  const msg: EscrowMessage = {
    id: `msg_${ts}_${Math.random().toString(36).slice(2, 6)}`,
    escrowId,
    sender,
    senderAlias,
    senderRole,
    text: text.slice(0, 2000),
    ts,
    hash: hash.slice(0, 16),
    immutable,
    tag,
  };
  msgs.push(msg);
  saveMsg(msgs);
  return msg;
}

export function pushBotMsg(escrowId: string, text: string, tag?: EscrowMessage["tag"]): EscrowMessage {
  return appendMsg(escrowId, "ESCROW_BOT", "EscrowBot", "BOT", text, true, tag);
}

// ---- Audit log ----------------------------------------------
export function logEvent(tx: EscrowTx, type: string, by: string, meta?: any): void {
  tx.events.push({ ts: Date.now(), type, by, meta });
  tx.updatedAt = Date.now();
}

// ---- ID generator -------------------------------------------
export function generateTxId(): string {
  const year = new Date().getFullYear();
  const num = Math.floor(Math.random() * 90000) + 10000;
  return `ESC-${year}-${num}`;
}

// ---- Checklist factory --------------------------------------
export function buildChecklist(type: ProductType): ChecklistItem[] {
  return CHECKLISTS[type].map(item => ({ ...item, done: false }));
}

// ---- Verificación de integridad del log ---------------------
export function verifyChain(escrowId: string): { ok: boolean; brokenAt?: number } {
  const msgs = getMsgs(escrowId);
  let prev = "GENESIS";
  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i];
    const expected = sha256(`${prev}|${escrowId}|${m.sender}|${m.ts}|${m.text}`).slice(0, 16);
    if (expected !== m.hash) return { ok: false, brokenAt: i };
    prev = m.hash;
  }
  return { ok: true };
}
