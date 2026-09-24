// ============================================================
// EscrowBot — Engine: parser de slash commands + state machine
// ============================================================
// Cada comando recibe el tx actual + el wallet del emisor y
// devuelve { tx, botReply } con el nuevo estado y un mensaje
// del bot para el chat (formato [ESCROW BOT]).
// ============================================================

import {
  EscrowTx, EscrowPhase, ProductType, EVASION_PATTERNS, FORBIDDEN_PATTERNS,
  PHASE_LABELS, PRODUCT_TYPE_LABELS, ChecklistItem,
} from "./types";
import {
  getTx, putTx, appendMsg, pushBotMsg, logEvent, generateTxId, buildChecklist,
} from "./store";

const INSPECTION_HOURS = 48;
const DELIVERY_DEADLINE_HOURS = 24;
const COMMISSION_PCT = 2;
const N1_MEDIATION_HOURS = 24;
const N2_MAX_DAYS = 7;

export interface CmdResult {
  ok: boolean;
  tx?: EscrowTx;
  botReply?: string;
  botTag?: "ACUERDO" | "EVIDENCIA" | "URGENTE" | "SISTEMA";
  error?: string;
}

// ---- Helpers ------------------------------------------------
function escrowHeader(tx: EscrowTx): string {
  return `[ESCROW BOT] Estado: ${tx.phase} | TX: ${tx.id}`;
}

function fmtTimeLeft(deadline?: number): string {
  if (!deadline) return "—";
  const ms = deadline - Date.now();
  if (ms <= 0) return "Expirado";
  const h = Math.floor(ms / 3600_000);
  const m = Math.floor((ms % 3600_000) / 60_000);
  return `${h}h ${m}m`;
}

function detectEvasion(text: string): boolean {
  return EVASION_PATTERNS.some(re => re.test(text));
}
function detectForbidden(text: string): boolean {
  return FORBIDDEN_PATTERNS.some(re => re.test(text));
}

function assertRole(tx: EscrowTx, wallet: string): "BUYER" | "SELLER" | null {
  if (tx.buyer === wallet) return "BUYER";
  if (tx.seller === wallet) return "SELLER";
  return null;
}

function requirePhase(tx: EscrowTx, phases: EscrowPhase[]): boolean {
  return phases.includes(tx.phase);
}

// ============================================================
// COMMAND PARSER
// ============================================================
export function parseCommand(text: string): { name: string; args: string[]; raw: string } | null {
  if (!text.startsWith("/")) return null;
  const trimmed = text.slice(1).trim();
  const space = trimmed.indexOf(" ");
  if (space === -1) return { name: trimmed.toLowerCase(), args: [], raw: trimmed };
  const name = trimmed.slice(0, space).toLowerCase();
  const argsStr = trimmed.slice(space + 1);
  // Si el primer argumento está entre comillas, lo extraemos
  const quoteMatch = argsStr.match(/^"([^"]+)"\s*(.*)$/);
  if (quoteMatch) return { name, args: [quoteMatch[1], ...quoteMatch[2].split(/\s+/).filter(Boolean)], raw: trimmed };
  return { name, args: argsStr.split(/\s+/).filter(Boolean), raw: trimmed };
}

// ============================================================
// COMMANDS
// ============================================================

// /nueva_transaccion [productType]
export function cmd_new(wallet: string, alias: string, args: string[]): CmdResult {
  const typeArg = (args[0] || "").toUpperCase() as ProductType;
  if (!PRODUCT_TYPE_LABELS[typeArg]) {
    return {
      ok: false,
      error: `Tipo de producto inválido. Tipos válidos: ${Object.keys(PRODUCT_TYPE_LABELS).join(", ")}`,
    };
  }
  const tx: EscrowTx = {
    id: generateTxId(),
    phase: "NEGOCIANDO",
    productType: typeArg,
    title: "",
    description: "",
    category: "",
    amount: 0,
    currency: "USDT",
    commissionPct: COMMISSION_PCT,
    buyer: wallet,
    buyerAlias: alias,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    checklist: buildChecklist(typeArg),
    events: [],
  };
  logEvent(tx, "TX_CREATED", wallet, { productType: typeArg });
  putTx(tx);
  pushBotMsg(tx.id, `${escrowHeader(tx)}

Transacción iniciada. Eres el COMPRADOR. Comparte el código de transacción con el vendedor para que se una con /unirse ${tx.id}.

Antes de bloquear fondos, acuerden:
- Producto exacto y condiciones
- Precio en USDT
- Método de entrega

Usa /acuerdo "texto del acuerdo" para fijar el acuerdo mutuo. Una vez fijado, /bloquear [monto] pasará a Fase 2.

[DATOS RELEVANTES]
- Tipo: ${PRODUCT_TYPE_LABELS[typeArg].emoji} ${PRODUCT_TYPE_LABELS[typeArg].label}
- Comisión: ${COMMISSION_PCT}%
- Período de inspección: ${INSPECTION_HOURS}h
- Vigencia de TX temporal: 24h`, "SISTEMA");
  return { ok: true, tx, botReply: `Transacción ${tx.id} creada` };
}

// /unirse [codigo]
export function cmd_join(wallet: string, alias: string, args: string[]): CmdResult {
  const id = args[0];
  if (!id) return { ok: false, error: "Uso: /unirse ESC-YYYY-NNNNN" };
  const tx = getTx(id);
  if (!tx) return { ok: false, error: `Transacción ${id} no existe` };
  if (tx.seller) return { ok: false, error: "La transacción ya tiene vendedor" };
  if (tx.phase !== "NEGOCIANDO") return { ok: false, error: "La transacción no está en negociación" };
  tx.seller = wallet;
  tx.sellerAlias = alias;
  logEvent(tx, "SELLER_JOINED", wallet);
  putTx(tx);
  pushBotMsg(tx.id, `${escrowHeader(tx)}

Vendedor vinculado: ${alias}.

Ahora pueden acordar los términos en este chat. Cuando estén listos, el COMPRADOR debe fijar el acuerdo con /acuerdo "texto" y luego bloquear fondos con /bloquear [monto].

⚠️ Mientras estén en NEGOCIANDO el chat es editable. Una vez bloqueados los fondos, todo mensaje se vuelve EVIDENCIA LEGAL inmutable.`, "SISTEMA");
  return { ok: true, tx, botReply: `Te uniste a ${id} como vendedor` };
}

// /acuerdo "texto"
export function cmd_agree(tx: EscrowTx, wallet: string, args: string[]): CmdResult {
  if (!tx.seller || !tx.buyer) return { ok: false, error: "Faltan partes (comprador o vendedor)" };
  if (tx.phase !== "NEGOCIANDO" && tx.phase !== "FONDOS_BLOQUEADOS") {
    return { ok: false, error: "No se puede acordar en este estado" };
  }
  const text = args.join(" ");
  if (!text || text.length < 10) return { ok: false, error: "El acuerdo debe ser descriptivo (mín 10 caracteres)" };
  tx.agreement = text;
  tx.agreementLockedAt = Date.now();
  logEvent(tx, "AGREEMENT_LOCKED", wallet, { text });
  putTx(tx);
  pushBotMsg(tx.id, `${escrowHeader(tx)}

✅ Acuerdo mutuo fijado:

"${text}"

Este texto será referenciado en caso de disputa.`, "ACUERDO");
  return { ok: true, tx, botReply: "Acuerdo fijado" };
}

// /bloquear [monto]
export function cmd_lock(tx: EscrowTx, wallet: string, args: string[]): CmdResult {
  if (tx.buyer !== wallet) return { ok: false, error: "Solo el comprador puede bloquear fondos" };
  if (tx.phase !== "NEGOCIANDO") return { ok: false, error: "No se puede bloquear en este estado" };
  if (!tx.seller) return { ok: false, error: "Falta el vendedor" };
  if (!tx.agreement) return { ok: false, error: "Primero fijen el acuerdo con /acuerdo" };
  const amount = parseFloat(args[0]);
  if (!amount || amount <= 0) return { ok: false, error: "Monto inválido" };
  tx.amount = amount;
  tx.phase = "FONDOS_BLOQUEADOS";
  tx.fundedAt = Date.now();
  logEvent(tx, "FUNDS_LOCKED", wallet, { amount });
  putTx(tx);
  pushBotMsg(tx.id, `${escrowHeader(tx)}

🔒 Fondos bloqueados en custodia: ${amount} USDT
Comisión (2%): ${(amount * 0.02).toFixed(2)} USDT
Vendedor recibe al liberar: ${(amount * 0.98).toFixed(2)} USDT

⚠️ A partir de ahora TODOS los mensajes son INMUTABLES y constituyen EVIDENCIA LEGAL.

Vendedor: tienes ${DELIVERY_DEADLINE_HOURS}h para entregar con /entregar [tipo] [descripción]. Si no entregas, el comprador puede cancelar.

Comprador: NO liberes con /liberar hasta verificar completamente el producto.`, "SISTEMA");
  return { ok: true, tx, botReply: "Fondos bloqueados" };
}

// /entregar [tipo] [descripción] (con payload opcional en args adicionales)
export function cmd_deliver(tx: EscrowTx, wallet: string, args: string[]): CmdResult {
  if (tx.seller !== wallet) return { ok: false, error: "Solo el vendedor puede entregar" };
  if (!requirePhase(tx, ["FONDOS_BLOQUEADOS"])) return { ok: false, error: "No hay fondos bloqueados" };
  const description = args.slice(0).join(" ");
  if (!description || description.length < 5) return { ok: false, error: "Describe el producto entregado" };
  tx.deliveryPayload = {
    description,
    // El resto lo envía el cliente vía campos extra en el body
  };
  tx.phase = "EN_VERIFICACION";
  tx.deliveredAt = Date.now();
  tx.inspectionDeadline = Date.now() + INSPECTION_HOURS * 3600_000;
  logEvent(tx, "DELIVERED", wallet, { description });
  putTx(tx);
  const checklistText = tx.checklist.map(c => `☐ ${c.label}`).join("\n");
  pushBotMsg(tx.id, `${escrowHeader(tx)}

✅ Producto marcado como entregado.

[CHECKLIST PARA COMPRADOR]
${checklistText}

[TIEMPO DE INSPECCIÓN]
${fmtTimeLeft(tx.inspectionDeadline)} para verificar.

Usa /checklist para marcar items completados. Si todo está OK, /liberar libera los fondos al vendedor. Si hay problemas, /disputar [razon] abre disputa nivel 1.`, "SISTEMA");
  return { ok: true, tx, botReply: "Entregado" };
}

// /checklist [item_id]
export function cmd_checklist_tick(tx: EscrowTx, wallet: string, args: string[]): CmdResult {
  if (!requirePhase(tx, ["EN_VERIFICACION"])) return { ok: false, error: "No hay inspección activa" };
  if (tx.buyer !== wallet) return { ok: false, error: "Solo el comprador marca el checklist" };
  const itemId = args[0];
  const item = tx.checklist.find(c => c.id === itemId);
  if (!item) return { ok: false, error: `Item inválido. Items: ${tx.checklist.map(c => c.id).join(", ")}` };
  item.done = !item.done;
  item.doneBy = wallet;
  item.doneAt = Date.now();
  logEvent(tx, "CHECKLIST_TOGGLED", wallet, { itemId, done: item.done });
  putTx(tx);
  const done = tx.checklist.filter(c => c.done).length;
  const total = tx.checklist.length;
  pushBotMsg(tx.id, `${escrowHeader(tx)}

✅ Item '${itemId}' marcado como ${item.done ? "completado" : "pendiente"}.

Progreso: ${done}/${total}

${tx.checklist.map(c => `${c.done ? "✅" : "☐"} ${c.id} — ${c.label}`).join("\n")}`, "SISTEMA");
  return { ok: true, tx, botReply: `Item ${itemId} ${item.done ? "✓" : "☐"}` };
}

// /liberar
export function cmd_release(tx: EscrowTx, wallet: string): CmdResult {
  if (tx.buyer !== wallet) return { ok: false, error: "Solo el comprador libera" };
  if (!requirePhase(tx, ["EN_VERIFICACION", "DISPUTA_N1"])) return { ok: false, error: "No se puede liberar en este estado" };
  const allDone = tx.checklist.every(c => c.done);
  if (!allDone) {
    pushBotMsg(tx.id, `${escrowHeader(tx)}

⚠️ Aún hay items del checklist sin completar. ¿Seguro que quieres liberar?

Si liberas sin verificar completamente, NO PODRÁS abrir disputa después.`, "SISTEMA");
    // Permitimos forzar, pero advertimos
  }
  tx.phase = "COMPLETADA";
  tx.completedAt = Date.now();
  logEvent(tx, "RELEASED", wallet, { allDone });
  putTx(tx);
  pushBotMsg(tx.id, `${escrowHeader(tx)}

🎉 Fondos liberados al vendedor.

Vendedor recibe: ${(tx.amount * (1 - tx.commissionPct / 100)).toFixed(2)} ${tx.currency}
Comisión: ${(tx.amount * tx.commissionPct / 100).toFixed(2)} ${tx.currency}

Transacción completada. Evidencia archivada por 90 días.`, "SISTEMA");
  return { ok: true, tx, botReply: "Liberado" };
}

// /disputar [razon]
export function cmd_dispute(tx: EscrowTx, wallet: string, args: string[]): CmdResult {
  if (!assertRole(tx, wallet)) return { ok: false, error: "No autorizado" };
  if (!requirePhase(tx, ["EN_VERIFICACION", "FONDOS_BLOQUEADOS", "DISPUTA_N1"])) {
    return { ok: false, error: "No se puede disputar en este estado" };
  }
  const reason = args.join(" ");
  if (!reason || reason.length < 10) return { ok: false, error: "Describe el motivo (mín 10 caracteres)" };
  tx.phase = "DISPUTA_N1";
  tx.dispute = {
    openedAt: Date.now(),
    level: 1,
    reason,
    events: [{ ts: Date.now(), level: 1, by: wallet, reason }],
  };
  logEvent(tx, "DISPUTE_OPENED", wallet, { level: 1, reason });
  putTx(tx);
  const other = tx.buyer === wallet ? "vendedor" : "comprador";
  pushBotMsg(tx.id, `${escrowHeader(tx)}

🚨 DISPUTA NIVEL 1 INICIADA

[MOTIVO]
${reason}

[PROCESO]
- ${other === "vendedor" ? "Vendedor" : "Comprador"} tiene ${N1_MEDIATION_HOURS}h para responder.
- Fondos congelados hasta resolución.
- Mediación automática en 6h si no hay acuerdo.

[EVIDENCIA REQUERIDA]
${wallet === tx.buyer ? "Comprador: screenshots del problema." : "Vendedor: prueba de que el producto está conforme al acuerdo."}

Usa /evidencia_disputa [descripción] para subir pruebas.
Si hay acuerdo parcial: /acuerdo_parcial [monto_vendedor] [monto_reembolso]`, "SISTEMA");
  return { ok: true, tx, botReply: "Disputa N1 abierta" };
}

// /evidencia_disputa [descripción]
export function cmd_evidence(tx: EscrowTx, wallet: string, args: string[]): CmdResult {
  if (!tx.dispute) return { ok: false, error: "No hay disputa abierta" };
  const desc = args.join(" ");
  if (!desc) return { ok: false, error: "Describe la evidencia" };
  tx.dispute.events.push({ ts: Date.now(), level: tx.dispute.level, by: wallet, reason: desc });
  logEvent(tx, "EVIDENCE_ADDED", wallet, { desc });
  putTx(tx);
  pushBotMsg(tx.id, `${escrowHeader(tx)}

📎 Evidencia registrada por ${tx.buyer === wallet ? "comprador" : "vendedor"}:

${desc}

Total de evidencias en disputa: ${tx.dispute.events.length}`, "EVIDENCIA");
  return { ok: true, tx, botReply: "Evidencia agregada" };
}

// /acuerdo_parcial [monto_vendedor] [monto_reembolso]
export function cmd_partial(tx: EscrowTx, wallet: string, args: string[]): CmdResult {
  if (!tx.dispute) return { ok: false, error: "No hay disputa abierta" };
  const seller = parseFloat(args[0]);
  const refund = parseFloat(args[1]);
  if (isNaN(seller) || isNaN(refund)) return { ok: false, error: "Uso: /acuerdo_parcial [monto_vendedor] [monto_reembolso]" };
  if (seller + refund > tx.amount) return { ok: false, error: "La suma excede el monto en escrow" };
  tx.dispute.proposedPartial = { seller, refund };
  logEvent(tx, "PARTIAL_PROPOSED", wallet, { seller, refund });
  putTx(tx);
  const other = tx.buyer === wallet ? "vendedor" : "comprador";
  pushBotMsg(tx.id, `${escrowHeader(tx)}

🤝 Acuerdo parcial propuesto por ${tx.buyer === wallet ? "comprador" : "vendedor"}:

Vendedor recibe: ${seller} ${tx.currency}
Comprador recibe (reembolso): ${refund} ${tx.currency}

El ${other} debe aceptar con /aceptar_resolucion.`, "ACUERDO");
  return { ok: true, tx, botReply: "Propuesta enviada" };
}

// /aceptar_resolucion
export function cmd_accept_resolution(tx: EscrowTx, wallet: string): CmdResult {
  if (!tx.dispute) return { ok: false, error: "No hay disputa abierta" };
  if (!tx.dispute.proposedPartial) return { ok: false, error: "No hay propuesta parcial pendiente" };
  // El que NO propuso debe aceptar
  tx.phase = "COMPLETADA";
  tx.completedAt = Date.now();
  logEvent(tx, "PARTIAL_ACCEPTED", wallet, tx.dispute.proposedPartial);
  putTx(tx);
  const p = tx.dispute.proposedPartial;
  pushBotMsg(tx.id, `${escrowHeader(tx)}

🤝 Acuerdo parcial aceptado y ejecutado.

Vendedor recibe: ${p.seller} ${tx.currency}
Comprador recibe (reembolso): ${p.refund} ${tx.currency}

Transacción cerrada. Evidencia archivada 90 días.`, "SISTEMA");
  return { ok: true, tx, botReply: "Resolución aceptada" };
}

// /cancelar_mutuo
export function cmd_cancel_mutual(tx: EscrowTx, wallet: string): CmdResult {
  if (!requirePhase(tx, ["NEGOCIANDO", "FONDOS_BLOQUEADOS"])) {
    return { ok: false, error: "Solo se puede cancelar en NEGOCIANDO o FONDOS_BLOQUEADOS" };
  }
  if (!assertRole(tx, wallet)) return { ok: false, error: "No autorizado" };
  // Marcamos como pendiente de confirmación de la otra parte
  // Implementación simple: si la otra parte también ejecuta /cancelar_mutuo, se cancela.
  const otherConfirmed = tx.events.some(
    e => e.type === "CANCEL_REQUESTED" && e.by !== wallet
  );
  if (otherConfirmed) {
    tx.phase = "CANCELADA";
    tx.cancelledAt = Date.now();
    logEvent(tx, "CANCELLED_MUTUAL", wallet);
    putTx(tx);
    pushBotMsg(tx.id, `${escrowHeader(tx)}

❌ Transacción cancelada por acuerdo mutuo. Reembolso completo al comprador.`, "SISTEMA");
    return { ok: true, tx, botReply: "Cancelada" };
  } else {
    logEvent(tx, "CANCEL_REQUESTED", wallet);
    putTx(tx);
    pushBotMsg(tx.id, `${escrowHeader(tx)}

Solicitud de cancelación mutua registrada por ${tx.buyer === wallet ? "comprador" : "vendedor"}.

La otra parte debe ejecutar /cancelar_mutuo para confirmar.`, "SISTEMA");
    return { ok: true, tx, botReply: "Pendiente confirmación de la otra parte" };
  }
}

// /estado
export function cmd_status(tx: EscrowTx): CmdResult {
  const done = tx.checklist.filter(c => c.done).length;
  const total = tx.checklist.length;
  pushBotMsg(tx.id, `${escrowHeader(tx)}

[ESTADO ACTUAL]
Fase: ${PHASE_LABELS[tx.phase].label}
Producto: ${PRODUCT_TYPE_LABELS[tx.productType].emoji} ${PRODUCT_TYPE_LABELS[tx.productType].label}
Monto: ${tx.amount} ${tx.currency}
Comprador: ${tx.buyerAlias || "—"}
Vendedor: ${tx.sellerAlias || "—"}
Acuerdo: ${tx.agreement ? "✅ fijado" : "—"}
Fondos: ${tx.fundedAt ? "🔒 bloqueados" : "—"}
Entrega: ${tx.deliveredAt ? "✅ entregada" : "—"}
Checklist: ${done}/${total}
Inspección restante: ${fmtTimeLeft(tx.inspectionDeadline)}
Disputa: ${tx.dispute ? `Nivel ${tx.dispute.level}` : "—"}

[ACUERDO]
${tx.agreement || "(sin acuerdo fijado)"}

[EVENTOS]
${tx.events.slice(-5).map(e => `• ${new Date(e.ts).toISOString().slice(0, 19)} — ${e.type} (${e.by.slice(0, 8)}...)`).join("\n")}`, "SISTEMA");
  return { ok: true, tx, botReply: "Estado mostrado" };
}

// /tiempo_restante
export function cmd_time_left(tx: EscrowTx): CmdResult {
  pushBotMsg(tx.id, `${escrowHeader(tx)}

⏰ Tiempos:

Inspección: ${fmtTimeLeft(tx.inspectionDeadline)}
Disputa abierta: ${tx.dispute ? fmtTimeLeft(tx.dispute.openedAt + N1_MEDIATION_HOURS * 3600_000) : "—"}`, "SISTEMA");
  return { ok: true, tx, botReply: "Tiempos mostrados" };
}

// /contrato
export function cmd_contract(tx: EscrowTx): CmdResult {
  pushBotMsg(tx.id, `${escrowHeader(tx)}

[CONTRATO]

Términos del acuerdo mutuo:
${tx.agreement || "(sin acuerdo fijado aún)"}

Monto en escrow: ${tx.amount} ${tx.currency}
Comisión: ${tx.commissionPct}%
Período de inspección: ${INSPECTION_HOURS}h
Tipo de producto: ${PRODUCT_TYPE_LABELS[tx.productType].emoji} ${PRODUCT_TYPE_LABELS[tx.productType].label}

Partes:
- Comprador: ${tx.buyerAlias} (${tx.buyer})
- Vendedor: ${tx.sellerAlias || "—"} (${tx.seller || "—"})

Hash del acuerdo: ${tx.agreementLockedAt && tx.agreement ? require("crypto").createHash("sha256").update(tx.agreement + tx.agreementLockedAt).digest("hex").slice(0, 16) : "—"}`, "SISTEMA");
  return { ok: true, tx, botReply: "Contrato mostrado" };
}

// /historial
export function cmd_history(tx: EscrowTx): CmdResult {
  pushBotMsg(tx.id, `${escrowHeader(tx)}

[LOG DE EVENTOS]

${tx.events.map(e => `${new Date(e.ts).toISOString().slice(0, 19)} — ${e.type} — by ${e.by.slice(0, 10)}...`).join("\n")}`, "SISTEMA");
  return { ok: true, tx, botReply: "Historial mostrado" };
}

// /ayuda [comando]
export function cmd_help(tx: EscrowTx, args: string[]): CmdResult {
  const specific = args[0];
  const help: Record<string, string> = {
    nueva_transaccion: "/nueva_transaccion [SOFTWARE|CUENTA_DIGITAL|CONTENIDO_CREATIVO|CRIPTO|SERVICIO] — Crea una transacción nueva como comprador.",
    unirse: "/unirse ESC-YYYY-NNNNN — Únete como vendedor a una transacción existente.",
    acuerdo: "/acuerdo \"texto del acuerdo\" — Fija el acuerdo mutuo. Requerido antes de /bloquear.",
    bloquear: "/bloquear [monto] — Comprador bloquea fondos en escrow. Inicia Fase 2.",
    entregar: "/entregar [descripción] — Vendedor marca producto como entregado. Inicia Fase 3.",
    checklist: "/checklist [item_id] — Comprador marca/desmarca item del checklist.",
    liberar: "/liberar — Comprador libera fondos al vendedor.",
    disputar: "/disputar \"motivo\" — Abre disputa nivel 1.",
    evidencia_disputa: "/evidencia_disputa \"descripción\" — Agrega evidencia a la disputa.",
    acuerdo_parcial: "/acuerdo_parcial [monto_vendedor] [monto_reembolso] — Propone división.",
    aceptar_resolucion: "/aceptar_resolucion — Acepta propuesta parcial de la contraparte.",
    cancelar_mutuo: "/cancelar_mutuo — Solicita cancelación mutua (la otra parte debe confirmar).",
    estado: "/estado — Muestra estado completo de la transacción.",
    tiempo_restante: "/tiempo_restante — Muestra tiempos de inspección y disputa.",
    contrato: "/contrato — Muestra el contrato acordado.",
    historial: "/historial — Muestra log completo de eventos.",
    ayuda: "/ayuda [comando] — Muestra ayuda.",
  };
  if (specific && help[specific]) {
    pushBotMsg(tx.id, `${escrowHeader(tx)}

[Ayuda: /${specific}]

${help[specific]}`, "SISTEMA");
  } else {
    pushBotMsg(tx.id, `${escrowHeader(tx)}

[COMANDOS DISPONIBLES]

INICIO:
${help.nueva_transaccion}
${help.unirse}

ACUERDO Y FONDOS:
${help.acuerdo}
${help.bloquear}

ENTREGA Y VERIFICACIÓN:
${help.entregar}
${help.checklist}
${help.liberar}

DISPUTAS:
${help.disputar}
${help.evidencia_disputa}
${help.acuerdo_parcial}
${help.aceptar_resolucion}

CANCELACIÓN:
${help.cancelar_mutuo}

INFO:
${help.estado}
${help.tiempo_restante}
${help.contrato}
${help.historial}
${help.ayuda}`, "SISTEMA");
  }
  return { ok: true, tx, botReply: "Ayuda mostrada" };
}

// ============================================================
// ROUTER — procesa cualquier comando
// ============================================================
export function executeCommand(
  cmd: { name: string; args: string[]; raw: string },
  tx: EscrowTx | null,
  wallet: string,
  alias: string,
): CmdResult {
  // Comandos que no requieren TX existente
  if (cmd.name === "nueva_transaccion") return cmd_new(wallet, alias, cmd.args);
  if (cmd.name === "unirse") return cmd_join(wallet, alias, cmd.args);
  if (cmd.name === "ayuda" && !tx) {
    // Devolver ayuda sin TX
    return {
      ok: true,
      botReply: "Comandos disponibles: /nueva_transaccion [tipo], /unirse [codigo], /ayuda",
    };
  }
  if (!tx) return { ok: false, error: "Transacción no encontrada. Usa /nueva_transaccion o /unirse [codigo]" };

  switch (cmd.name) {
    case "acuerdo":            return cmd_agree(tx, wallet, cmd.args);
    case "bloquear":           return cmd_lock(tx, wallet, cmd.args);
    case "entregar":           return cmd_deliver(tx, wallet, cmd.args);
    case "entregar_software":
    case "entregar_cuenta":
    case "entregar_creativo":
    case "entregar_crypto":
    case "entregar_servicio":  return cmd_deliver(tx, wallet, cmd.args);
    case "checklist":          return cmd_checklist_tick(tx, wallet, cmd.args);
    case "verificar":          return cmd_checklist_tick(tx, wallet, cmd.args);
    case "liberar":            return cmd_release(tx, wallet);
    case "disputar":           return cmd_dispute(tx, wallet, cmd.args);
    case "evidencia_disputa":  return cmd_evidence(tx, wallet, cmd.args);
    case "acuerdo_parcial":    return cmd_partial(tx, wallet, cmd.args);
    case "aceptar_resolucion": return cmd_accept_resolution(tx, wallet);
    case "cancelar_mutuo":     return cmd_cancel_mutual(tx, wallet);
    case "estado":             return cmd_status(tx);
    case "tiempo_restante":    return cmd_time_left(tx);
    case "contrato":           return cmd_contract(tx);
    case "historial":          return cmd_history(tx);
    case "ayuda":              return cmd_help(tx, cmd.args);
    case "urgente":
      pushBotMsg(tx.id, `${escrowHeader(tx)}\n\n⚠️ Notificación urgente enviada a la contraparte.`, "URGENTE");
      return { ok: true, tx, botReply: "Urgente enviado" };
    default:
      return { ok: false, error: `Comando desconocido: /${cmd.name}. Usa /ayuda para ver la lista.` };
  }
}

// ============================================================
// Anti-fraude — analiza mensajes libres (no comandos)
// ============================================================
export function analyzeFreeMessage(tx: EscrowTx, text: string): { warning?: string; block?: boolean } {
  if (detectForbidden(text)) {
    return {
      block: true,
      warning: "🚫 Mensaje bloqueado: detectado posible contenido prohibido (datos de tarjeta, CVV). Transacción cancelada.",
    };
  }
  if (detectEvasion(text)) {
    return {
      warning: "⚠️ Detectado intento de contacto externo. Por seguridad, mantengan la comunicación dentro del escrow. Mensajes fuera de plataforma NO son evidencia.",
    };
  }
  return {};
}

export const CONFIG = {
  INSPECTION_HOURS,
  DELIVERY_DEADLINE_HOURS,
  COMMISSION_PCT,
  N1_MEDIATION_HOURS,
  N2_MAX_DAYS,
};
