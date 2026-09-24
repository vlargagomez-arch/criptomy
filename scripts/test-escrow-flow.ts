import { parseCommand, executeCommand } from "../src/lib/escrow/engine";
import { getTx, getMsgs, verifyChain } from "../src/lib/escrow/store";

const BUYER = "0xBUYER1111111111111111111111111111111111111";
const SELLER = "0xSELLER2222222222222222222222222222222222222";

function run(text: string, wallet: string, alias: string, txId?: string) {
  const cmd = parseCommand(text);
  if (!cmd) { console.log("INVALID CMD:", text); return null; }
  const tx = txId ? getTx(txId) : null;
  const r = executeCommand(cmd, tx, wallet, alias);
  console.log(`> ${text}`);
  console.log(`  ok=${r.ok} err=${r.error || ""} txPhase=${r.tx?.phase || ""}`);
  return r.tx;
}

console.log("=== FLOW: NEGOTIATE → FUND → DELIVER → VERIFY → RELEASE ===\n");
let tx = run("/nueva_transaccion SOFTWARE", BUYER, "comprador_demo");
if (!tx) process.exit(1);
const txId = tx.id;
console.log(`TX: ${txId}\n`);

// Seller joins
tx = run(`/unirse ${txId}`, SELLER, "vendedor_demo", undefined as any);
// Agreement
tx = run('/acuerdo "Photoshop CC 2024 license key por 80 USDT, entrega por chat con hash SHA256"', BUYER, "comprador_demo", txId);
// Lock funds
tx = run("/bloquear 80", BUYER, "comprador_demo", txId);
// Deliver
tx = run('/entregar "Photoshop CC 2024 v25.1 key XXXX-XXXX-XXXX hash:a3f5"', SELLER, "vendedor_demo", txId);
// Checklist items
const items = tx!.checklist;
for (const it of items.slice(0, 3)) {
  tx = run(`/checklist ${it.id}`, BUYER, "comprador_demo", txId);
}
// Status
tx = run("/estado", BUYER, "comprador_demo", txId);
// Release
tx = run("/liberar", BUYER, "comprador_demo", txId);

console.log("\n=== MESSAGES ===");
const msgs = getMsgs(txId);
console.log(`Total: ${msgs.length}`);
msgs.slice(0, 3).forEach(m => {
  console.log(`[${m.tag || "—"}] ${m.senderAlias}: ${m.text.slice(0, 100)}${m.text.length > 100 ? "..." : ""} | hash=${m.hash}`);
});
console.log("...");
msgs.slice(-3).forEach(m => {
  console.log(`[${m.tag || "—"}] ${m.senderAlias}: ${m.text.slice(0, 100)}${m.text.length > 100 ? "..." : ""} | hash=${m.hash}`);
});

console.log("\n=== INTEGRITY ===");
const v = verifyChain(txId);
console.log(`Chain OK: ${v.ok}`);

console.log("\n=== DISPUTE FLOW (separate TX) ===\n");
let tx2 = run("/nueva_transaccion CUENTA_DIGITAL", BUYER, "comprador_demo");
const tx2Id = tx2!.id;
run(`/unirse ${tx2Id}`, SELLER, "vendedor_demo", undefined as any);
run('/acuerdo "Cuenta Netflix premium 4K, 30 días, sin cambios de contraseña posteriores"', BUYER, "comprador_demo", tx2Id);
run("/bloquear 25", BUYER, "comprador_demo", tx2Id);
run('/entregar "Cuenta Netflix: user@mail.com:password123"', SELLER, "vendedor_demo", tx2Id);
run('/disputar "La cuenta fue reclamada por el dueño original a las 2 horas"', BUYER, "comprador_demo", tx2Id);
run('/evidencia_disputa "Screenshot del error de cuenta reclamada"', BUYER, "comprador_demo", tx2Id);
run('/evidencia_disputa "Segundo screenshot con fecha visible"', BUYER, "comprador_demo", tx2Id);
run('/acuerdo_parcial 10 15', SELLER, "vendedor_demo", tx2Id);
run('/aceptar_resolucion', BUYER, "comprador_demo", tx2Id);

const tx2final = getTx(tx2Id);
console.log(`Final phase: ${tx2final?.phase}`);
console.log(`Dispute events: ${tx2final?.dispute?.events.length}`);

console.log("\n=== ANTI-FRAUDE TEST ===\n");
let tx3 = run("/nueva_transaccion SOFTWARE", BUYER, "comprador_demo");
const tx3Id = tx3!.id;
run(`/unirse ${tx3Id}`, SELLER, "vendedor_demo", undefined as any);
// Try evasion
const evasionText = "hablamos por fuera por whatsapp +57 300 123 4567";
const { analyzeFreeMessage } = require("../src/lib/escrow/engine");
const analysis = analyzeFreeMessage(getTx(tx3Id)!, evasionText);
console.log(`Evasion detection: warning=${!!analysis.warning} block=${!!analysis.block}`);
console.log(`Warning: ${analysis.warning || "(none)"}`);

