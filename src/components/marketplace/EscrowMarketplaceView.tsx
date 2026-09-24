"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Loader2, RefreshCw, Shield, MessageSquare, Send, AlertTriangle,
  Plus, Search, Wallet, ChevronDown, ChevronUp, Hash, Clock,
  CheckCircle2, XCircle, Lock, FileText, Cpu, Gamepad2, PaintBucket,
  Bitcoin, Bell, Scale, History, FileCheck, Info,
} from "lucide-react";
import { useApp } from "@/lib/store";
import {
  EscrowTx, ProductType, PHASE_LABELS, PRODUCT_TYPE_LABELS, EscrowMessage,
} from "@/lib/escrow/types";

// ============================================================
// EscrowMarketplaceView — EscrowBot chat-driven escrow
// ============================================================

const TYPE_ICONS: Record<ProductType, any> = {
  SOFTWARE: Cpu,
  CUENTA_DIGITAL: Gamepad2,
  CONTENIDO_CREATIVO: PaintBucket,
  CRIPTO: Bitcoin,
  SERVICIO: Bell,
};

export default function EscrowMarketplaceView() {
  const { user } = useApp();
  const [view, setView] = useState<"list" | "chat">("list");
  const [txs, setTxs] = useState<EscrowTx[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTx, setActiveTx] = useState<EscrowTx | null>(null);
  const [showNew, setShowNew] = useState(false);

  const wallet = user?.walletAddress || "0xDemo...1234";
  const alias = user?.alias || "demo_user";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/escrow?wallet=${encodeURIComponent(wallet)}&filter=active`);
      const data = await res.json();
      setTxs(data.txs || []);
    } catch {}
    setLoading(false);
  }, [wallet]);

  useEffect(() => { load(); }, [load]);

  const openTx = async (tx: EscrowTx) => {
    setActiveTx(tx);
    setView("chat");
  };

  const startNew = (type: ProductType) => {
    setShowNew(false);
    // Crea TX nueva con slash command
    sendCommand(`/nueva_transaccion ${type}`, null);
  };

  const sendCommand = async (text: string, txId: string | null) => {
    try {
      const res = await fetch("/api/escrow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "command",
          wallet,
          alias,
          txId,
          text,
        }),
      });
      const data = await res.json();
      if (data.ok && data.tx) {
        setActiveTx(data.tx);
        setView("chat");
        // Recargar lista
        load();
      }
      return data;
    } catch (e) {
      return { ok: false, error: "Error de red" };
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 flex items-center gap-2">
            <Shield className="w-6 h-6 text-emerald-400" /> EscrowBot P2P
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Custodia neutral para transacciones P2P de productos digitales. Mensajería inmutable y verificación técnica por tipo de producto.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 transition"
            title="Refrescar"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowNew(!showNew)}
            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
          >
            <Plus className="w-4 h-4" /> Nueva transacción
          </button>
        </div>
      </div>

      {/* New TX picker */}
      {showNew && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-3">
            ¿Qué tipo de producto vas a escrow?
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {(Object.keys(PRODUCT_TYPE_LABELS) as ProductType[]).map(t => {
              const Icon = TYPE_ICONS[t];
              return (
                <button
                  key={t}
                  onClick={() => startNew(t)}
                  className="text-left p-3 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 hover:border-slate-600 transition"
                >
                  <Icon className="w-5 h-5 text-emerald-400 mb-1" />
                  <div className="text-xs font-bold text-slate-100">
                    {PRODUCT_TYPE_LABELS[t].emoji} {PRODUCT_TYPE_LABELS[t].label.split("(")[0].trim()}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    {PRODUCT_TYPE_LABELS[t].label.split("(")[1]?.replace(")", "") || ""}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Body */}
      {view === "list" && (
        <ListView
          txs={txs}
          loading={loading}
          wallet={wallet}
          onOpen={openTx}
          onJoin={(code) => sendCommand(`/unirse ${code}`, null)}
        />
      )}

      {view === "chat" && activeTx && (
        <ChatView
          tx={activeTx}
          wallet={wallet}
          alias={alias}
          onBack={() => { setView("list"); setActiveTx(null); }}
          onCommand={(text) => sendCommand(text, activeTx.id)}
          onRefresh={async () => {
            // Refrescar tx activo
            const res = await fetch("/api/escrow", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "get", txId: activeTx.id, wallet }),
            });
            const data = await res.json();
            if (data.tx) setActiveTx(data.tx);
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// LIST VIEW
// ============================================================
function ListView({
  txs, loading, wallet, onOpen, onJoin,
}: {
  txs: EscrowTx[];
  loading: boolean;
  wallet: string;
  onOpen: (tx: EscrowTx) => void;
  onJoin: (code: string) => void;
}) {
  const [joinCode, setJoinCode] = useState("");

  if (loading) {
    return (
      <div className="flex flex-col items-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-400 mb-2" />
        <p className="text-xs text-slate-400">Cargando transacciones…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Join existing TX */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-2">
          ¿Tienes un código de transacción?
        </div>
        <div className="flex items-center gap-2">
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="ESC-2025-12345"
            className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm font-mono focus:outline-none focus:border-emerald-500"
          />
          <button
            onClick={() => { if (joinCode) { onJoin(joinCode); setJoinCode(""); } }}
            className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-xs font-medium transition"
          >
            Unirse
          </button>
        </div>
        <p className="mt-2 text-[10px] text-slate-500">
          Si un comprador te compartió un código, ingrésalo aquí para unirte como vendedor.
        </p>
      </div>

      {/* TX list */}
      {txs.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
          <Shield className="w-10 h-10 mx-auto text-slate-700 mb-2" />
          <p className="text-sm text-slate-400">No tienes transacciones activas.</p>
          <p className="text-xs text-slate-500 mt-1">Crea una nueva con el botón de arriba.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {txs.map(tx => {
            const Icon = TYPE_ICONS[tx.productType];
            const role = tx.buyer === wallet ? "Comprador" : "Vendedor";
            const phase = PHASE_LABELS[tx.phase];
            return (
              <button
                key={tx.id}
                onClick={() => onOpen(tx)}
                className="w-full text-left p-4 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl transition"
              >
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-100 font-mono">{tx.id}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded border ${phase.color}`}>
                          {phase.label}
                        </span>
                        <span className="text-[10px] text-slate-500">· {role}</span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5 truncate">
                        {tx.title || PRODUCT_TYPE_LABELS[tx.productType].label.split("(")[0].trim()} · {tx.amount || 0} USDT
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[10px] text-slate-500">Actualizado</div>
                    <div className="text-[11px] text-slate-400">
                      {new Date(tx.updatedAt).toLocaleDateString()} {new Date(tx.updatedAt).toLocaleTimeString().slice(0, 5)}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================
// CHAT VIEW — Command-driven escrow conversation
// ============================================================
function ChatView({
  tx, wallet, alias, onBack, onCommand, onRefresh,
}: {
  tx: EscrowTx;
  wallet: string;
  alias: string;
  onBack: () => void;
  onCommand: (text: string) => Promise<any>;
  onRefresh: () => Promise<void>;
}) {
  const [messages, setMessages] = useState<EscrowMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showContract, setShowContract] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
  const [integrityOk, setIntegrityOk] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadMsgs = useCallback(async () => {
    try {
      const res = await fetch(`/api/escrow/messages?escrowId=${tx.id}`);
      const d = await res.json();
      setMessages(d.messages || []);
      setIntegrityOk(d.integrity?.ok !== false);
    } catch {}
  }, [tx.id]);

  useEffect(() => { loadMsgs(); }, [loadMsgs]);
  useEffect(() => {
    const i = setInterval(loadMsgs, 5000);
    return () => clearInterval(i);
  }, [loadMsgs]);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const send = async () => {
    if (!input.trim()) return;
    const text = input.trim();
    setInput("");
    setLoading(true);

    if (text.startsWith("/")) {
      const result = await onCommand(text);
      if (!result.ok && result.error) {
        // Mostrar error como mensaje local
        setMessages(prev => [...prev, {
          id: `local_${Date.now()}`,
          escrowId: tx.id,
          sender: "ESCROW_BOT",
          senderAlias: "EscrowBot",
          senderRole: "BOT",
          text: `⚠️ ${result.error}`,
          ts: Date.now(),
          hash: "—",
          immutable: true,
          tag: "SISTEMA",
        }]);
      }
      await loadMsgs();
      await onRefresh();
    } else {
      // Mensaje libre
      try {
        const res = await fetch("/api/escrow", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "message",
            wallet,
            alias,
            txId: tx.id,
            text,
          }),
        });
        const data = await res.json();
        if (data.warning) {
          // Bot warning se carga solo con reload
        }
        await loadMsgs();
        await onRefresh();
      } catch {}
    }
    setLoading(false);
  };

  const role = tx.buyer === wallet ? "Comprador" : tx.seller === wallet ? "Vendedor" : "Observador";
  const phase = PHASE_LABELS[tx.phase];
  const immutable = tx.phase !== "NEGOCIANDO";

  return (
    <div className="space-y-3">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-2 flex-wrap bg-slate-900 border border-slate-800 rounded-xl p-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1"
          >
            ← Volver
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-slate-100 font-mono">{tx.id}</span>
              <span className={`text-[9px] px-1.5 py-0.5 rounded border ${phase.color}`}>{phase.label}</span>
              <span className="text-[10px] text-slate-500">· {role}</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {PRODUCT_TYPE_LABELS[tx.productType].emoji} {PRODUCT_TYPE_LABELS[tx.productType].label.split("(")[0].trim()} · {tx.amount || 0} USDT
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowContract(!showContract)}
            className={`p-1.5 rounded transition ${showContract ? "bg-slate-700 text-slate-200" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}
            title="Contrato"
          ><FileText className="w-3.5 h-3.5" /></button>
          <button
            onClick={() => setShowChecklist(!showChecklist)}
            className={`p-1.5 rounded transition ${showChecklist ? "bg-slate-700 text-slate-200" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}
            title="Checklist"
          ><FileCheck className="w-3.5 h-3.5" /></button>
          <button
            onClick={() => onCommand("/estado")}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-400 transition"
            title="Estado"
          ><Info className="w-3.5 h-3.5" /></button>
          <button
            onClick={() => onCommand("/historial")}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-400 transition"
            title="Historial"
          ><History className="w-3.5 h-3.5" /></button>
          <button
            onClick={() => { loadMsgs(); onRefresh(); }}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-400 transition"
            title="Refrescar"
          ><RefreshCw className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      {/* Immutable banner */}
      {immutable && (
        <div className="bg-amber-950/20 border border-amber-700/30 rounded-lg p-2 text-[11px] text-amber-300 flex items-center gap-2">
          <Lock className="w-3 h-3 shrink-0" />
          <span>Mensajería inmutable activa. Cada mensaje tiene hash criptográfico y es evidencia legal en disputas.</span>
          {!integrityOk && <span className="ml-auto text-rose-400 font-bold">⚠ Integridad comprometida</span>}
          {integrityOk && <span className="ml-auto text-emerald-400/70">✓ Cadena verificada</span>}
        </div>
      )}

      {/* Contract panel */}
      {showContract && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-emerald-400" /> Contrato
            </div>
            <button onClick={() => setShowContract(false)} className="text-slate-500 hover:text-slate-300"><ChevronUp className="w-3.5 h-3.5" /></button>
          </div>
          <div className="text-[11px] text-slate-300">
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div><span className="text-slate-500">Comprador:</span> {tx.buyerAlias || "—"}</div>
              <div><span className="text-slate-500">Vendedor:</span> {tx.sellerAlias || "—"}</div>
              <div><span className="text-slate-500">Monto:</span> {tx.amount} {tx.currency}</div>
              <div><span className="text-slate-500">Comisión:</span> {tx.commissionPct}%</div>
            </div>
            <div className="text-slate-500 uppercase text-[9px] mb-1">Acuerdo mutuo</div>
            <div className="bg-slate-950/50 p-2 rounded text-slate-200 text-xs">
              {tx.agreement || "(sin acuerdo fijado aún — usa /acuerdo \"texto\" para fijarlo)"}
            </div>
          </div>
          <button
            onClick={() => onCommand("/contrato")}
            className="text-[11px] text-emerald-400 hover:text-emerald-300"
          >Ver contrato completo en chat →</button>
        </div>
      )}

      {/* Checklist panel */}
      {showChecklist && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
              <FileCheck className="w-3.5 h-3.5 text-emerald-400" /> Checklist de verificación
            </div>
            <button onClick={() => setShowChecklist(false)} className="text-slate-500 hover:text-slate-300"><ChevronUp className="w-3.5 h-3.5" /></button>
          </div>
          <div className="space-y-1">
            {tx.checklist.map(item => (
              <button
                key={item.id}
                onClick={() => onCommand(`/checklist ${item.id}`)}
                className={`w-full text-left flex items-center gap-2 p-2 rounded text-xs transition ${
                  item.done
                    ? "bg-emerald-950/30 text-emerald-300"
                    : "bg-slate-800/50 text-slate-300 hover:bg-slate-800"
                }`}
              >
                {item.done ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <XCircle className="w-3.5 h-3.5 text-slate-600" />}
                <span className="flex-1">{item.label}</span>
                <span className="text-[9px] text-slate-500 font-mono">{item.id}</span>
              </button>
            ))}
          </div>
          <div className="text-[10px] text-slate-500 pt-1">
            Click en cada item para marcarlo/desmarcarlo. Solo el comprador puede marcar.
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl flex flex-col" style={{ height: "60vh", minHeight: "400px" }}>
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <MessageSquare className="w-8 h-8 mx-auto text-slate-700 mb-2" />
              <p className="text-xs text-slate-500">No hay mensajes todavía.</p>
              <p className="text-[10px] text-slate-600 mt-1">Empieza con /ayuda para ver comandos.</p>
            </div>
          )}
          {messages.map(m => (
            <MessageBubble key={m.id} m={m} wallet={wallet} />
          ))}
        </div>

        {/* Quick commands */}
        <div className="border-t border-slate-800 p-2 flex items-center gap-1 overflow-x-auto scrollbar-hide">
          <QuickCmd label="Estado" cmd="/estado" onClick={onCommand} />
          <QuickCmd label="Tiempo" cmd="/tiempo_restante" onClick={onCommand} />
          <QuickCmd label="Contrato" cmd="/contrato" onClick={onCommand} />
          <QuickCmd label="Historial" cmd="/historial" onClick={onCommand} />
          <QuickCmd label="Ayuda" cmd="/ayuda" onClick={onCommand} />
          {tx.phase === "NEGOCIANDO" && tx.seller && (
            <QuickCmd label="Acuerdo" cmd='/acuerdo "Acuerdo mutuo: producto X por Y USDT, entrega por chat"' onClick={onCommand} />
          )}
          {tx.phase === "NEGOCIANDO" && tx.agreement && tx.buyer === wallet && (
            <QuickCmd label="Bloquear" cmd={`/bloquear ${tx.amount || 100}`} onClick={onCommand} />
          )}
          {tx.phase === "FONDOS_BLOQUEADOS" && tx.seller === wallet && (
            <QuickCmd label="Entregar" cmd='/entregar "Producto entregado según acuerdo"' onClick={onCommand} />
          )}
          {tx.phase === "EN_VERIFICACION" && (
            <QuickCmd label="Liberar" cmd="/liberar" onClick={onCommand} />
          )}
          {tx.phase === "EN_VERIFICACION" && (
            <QuickCmd label="Disputar" cmd='/disputar "Motivo de la disputa"' onClick={onCommand} />
          )}
        </div>

        {/* Input */}
        <div className="border-t border-slate-800 p-2 flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !loading) send(); }}
            placeholder={immutable ? "Mensaje (inmutable) o /comando…" : "Mensaje o /comando…"}
            className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm font-mono focus:outline-none focus:border-emerald-500"
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="p-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Command help */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-3">
        <div className="text-[10px] uppercase text-slate-500 font-semibold mb-1">Comandos rápidos</div>
        <div className="text-[11px] text-slate-400 leading-relaxed">
          <span className="font-mono text-emerald-400">/nueva_transaccion</span> ·{" "}
          <span className="font-mono text-emerald-400">/unirse</span> ·{" "}
          <span className="font-mono text-emerald-400">/acuerdo</span> ·{" "}
          <span className="font-mono text-emerald-400">/bloquear</span> ·{" "}
          <span className="font-mono text-emerald-400">/entregar</span> ·{" "}
          <span className="font-mono text-emerald-400">/checklist</span> ·{" "}
          <span className="font-mono text-emerald-400">/liberar</span> ·{" "}
          <span className="font-mono text-emerald-400">/disputar</span> ·{" "}
          <span className="font-mono text-emerald-400">/evidencia_disputa</span> ·{" "}
          <span className="font-mono text-emerald-400">/acuerdo_parcial</span> ·{" "}
          <span className="font-mono text-emerald-400">/aceptar_resolucion</span> ·{" "}
          <span className="font-mono text-emerald-400">/cancelar_mutuo</span> ·{" "}
          <span className="font-mono text-emerald-400">/estado</span> ·{" "}
          <span className="font-mono text-emerald-400">/tiempo_restante</span> ·{" "}
          <span className="font-mono text-emerald-400">/contrato</span> ·{" "}
          <span className="font-mono text-emerald-400">/historial</span> ·{" "}
          <span className="font-mono text-emerald-400">/ayuda</span>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ m, wallet }: { m: EscrowMessage; wallet: string }) {
  const isBot = m.senderRole === "BOT";
  const isMine = m.sender === wallet;
  const time = new Date(m.ts).toLocaleTimeString().slice(0, 8);
  const isMultiline = m.text.includes("\n");

  if (isBot) {
    return (
      <div className="flex items-start gap-2 max-w-[95%]">
        <div className="w-7 h-7 rounded-full bg-emerald-600/20 border border-emerald-600/40 flex items-center justify-center shrink-0 mt-1">
          <Shield className="w-3.5 h-3.5 text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-2.5">
            {isMultiline ? (
              <pre className="text-[11px] text-slate-200 font-mono whitespace-pre-wrap leading-relaxed">{m.text}</pre>
            ) : (
              <p className="text-xs text-slate-200">{m.text}</p>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[9px] text-slate-500">
            <span>{m.senderAlias}</span>
            <span>·</span>
            <Clock className="w-2.5 h-2.5" />
            <span>{time}</span>
            {m.immutable && (
              <>
                <span>·</span>
                <Hash className="w-2.5 h-2.5" />
                <span className="font-mono">{m.hash}</span>
              </>
            )}
            {m.tag && m.tag !== "SISTEMA" && (
              <span className="px-1 py-0 bg-amber-950/30 border border-amber-700/30 text-amber-400 rounded text-[8px]">
                {m.tag}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-start gap-2 max-w-[80%] ${isMine ? "ml-auto flex-row-reverse" : ""}`}>
      <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center shrink-0 mt-1 text-[10px] font-bold text-slate-200">
        {m.senderAlias.slice(0, 2).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className={`rounded-lg p-2.5 ${isMine ? "bg-emerald-600/20 border border-emerald-600/30" : "bg-slate-800 border border-slate-700"}`}>
          <p className="text-xs text-slate-100 whitespace-pre-wrap break-words">{m.text}</p>
        </div>
        <div className={`flex items-center gap-2 mt-0.5 text-[9px] text-slate-500 ${isMine ? "justify-end" : ""}`}>
          <span>{m.senderAlias}</span>
          <span>·</span>
          <Clock className="w-2.5 h-2.5" />
          <span>{time}</span>
          {m.immutable && (
            <>
              <span>·</span>
              <Hash className="w-2.5 h-2.5" />
              <span className="font-mono">{m.hash}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function QuickCmd({ label, cmd, onClick }: { label: string; cmd: string; onClick: (cmd: string) => void }) {
  return (
    <button
      onClick={() => onClick(cmd)}
      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 rounded whitespace-nowrap transition shrink-0"
    >
      {label}
    </button>
  );
}
