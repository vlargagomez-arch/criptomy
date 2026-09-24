"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Loader2, RefreshCw, Shield, MessageSquare, Send, AlertTriangle,
  Plus, Wallet, ChevronDown, ChevronUp, Hash, Clock,
  CheckCircle2, XCircle, Lock, FileText, Cpu, Gamepad2, PaintBucket,
  Bitcoin, Bell, Scale, History, FileCheck, Info, ArrowRight, Copy,
} from "lucide-react";
import { useApp } from "@/lib/store";

// ============================================================
// EscrowMarketplaceView — Escrow digital con MetaMask
// ============================================================
//
// Flujo:
//   1. Vendedor crea deal (CREATED)
//   2. Comprador se une con código (JOINED)
//   3. Comprador firma acuerdo con MetaMask + bloquea fondos (FUNDED)
//   4. Vendedor entrega producto (DELIVERED)
//   5. Comprador confirma (COMPLETED) → fondos al vendedor
//   6. Cualquiera abre disputa → admin resuelve

type ProductType = "SOFTWARE" | "CUENTA_DIGITAL" | "CONTENIDO_CREATIVO" | "CRIPTO" | "SERVICIO";

const TYPE_ICONS: Record<ProductType, any> = {
  SOFTWARE: Cpu,
  CUENTA_DIGITAL: Gamepad2,
  CONTENIDO_CREATIVO: PaintBucket,
  CRIPTO: Bitcoin,
  SERVICIO: Bell,
};

const TYPE_LABELS: Record<ProductType, { label: string; emoji: string }> = {
  SOFTWARE: { label: "Software / Licencia / Código", emoji: "💻" },
  CUENTA_DIGITAL: { label: "Cuenta Digital (streaming, juegos, redes)", emoji: "🎮" },
  CONTENIDO_CREATIVO: { label: "Contenido Creativo (diseño, video, audio, docs)", emoji: "🎨" },
  CRIPTO: { label: "Criptoactivo / NFT / Dominio", emoji: "⛓️" },
  SERVICIO: { label: "Servicio / Suscripción / Créditos", emoji: "🔔" },
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  CREATED: { label: "Esperando comprador", color: "text-slate-300 bg-slate-700/30 border-slate-600/30" },
  JOINED: { label: "Listo para firmar", color: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
  FUNDED: { label: "Fondos bloqueados", color: "text-blue-400 bg-blue-500/10 border-blue-500/30" },
  DELIVERED: { label: "Producto entregado", color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30" },
  COMPLETED: { label: "Completado", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" },
  DISPUTED: { label: "En disputa", color: "text-rose-400 bg-rose-500/10 border-rose-500/30" },
  CANCELLED: { label: "Cancelado", color: "text-slate-500 bg-slate-700/30 border-slate-600/30" },
};

interface Deal {
  id: string;
  code: string;
  productType: string;
  title: string;
  description: string;
  category: string;
  amount: number;
  currency: string;
  commissionPct: number;
  buyerId?: string;
  buyerAlias?: string;
  buyer?: { alias: string; walletAddress: string };
  sellerId?: string;
  sellerAlias?: string;
  seller?: { alias: string; walletAddress: string };
  agreement?: string;
  status: string;
  deliveryDescription?: string;
  deliveryCode?: string;
  deliveryCredentials?: string;
  deliveryLink?: string;
  deliveryInstructions?: string;
  deliveredAt?: string;
  fundedAt?: string;
  releasedAt?: string;
  completedAt?: string;
  disputedAt?: string;
  disputeReason?: string;
  disputeResolution?: string;
  createdAt: string;
  updatedAt: string;
}

interface Message {
  id: string;
  dealId: string;
  senderWallet: string;
  senderAlias: string;
  senderRole: string;
  text: string;
  ts: string;
  hash: string;
  immutable: boolean;
  tag?: string;
}

export default function EscrowMarketplaceView() {
  const { user } = useApp();
  const [view, setView] = useState<"list" | "chat" | "create" | "join">("list");
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeDeal, setActiveDeal] = useState<Deal | null>(null);

  const wallet = user?.walletAddress || "";
  const alias = user?.alias || "anónimo";

  const load = useCallback(async () => {
    if (!wallet) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/escrow?wallet=${encodeURIComponent(wallet)}&filter=active`);
      const data = await res.json();
      setDeals(data.deals || []);
    } catch {}
    setLoading(false);
  }, [wallet]);

  useEffect(() => { load(); }, [load]);

  const openDeal = async (deal: Deal) => {
    setActiveDeal(deal);
    setView("chat");
  };

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <Shield className="w-12 h-12 mx-auto text-slate-600 mb-3" />
        <p className="text-slate-300 font-medium">Conecta tu wallet para usar el escrow</p>
        <p className="text-xs text-slate-500 mt-1">
          Sin KYC, sin email. Tu wallet es tu identidad. Las dos partes firman con MetaMask.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 flex items-center gap-2">
            <Shield className="w-6 h-6 text-emerald-400" /> Escrow Digital
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            Custodia neutral para compra/venta de productos digitales. Las dos partes firman con MetaMask.
            Si hay conflicto, el admin revisa la evidencia y resuelve.
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
            onClick={() => setView("create")}
            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
          >
            <Plus className="w-4 h-4" /> Crear deal
          </button>
          <button
            onClick={() => setView("join")}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
          >
            Unirse con código
          </button>
        </div>
      </div>

      {/* Body */}
      {view === "list" && (
        <ListView deals={deals} loading={loading} onOpen={openDeal} />
      )}

      {view === "create" && (
        <CreateDealView
          wallet={wallet}
          alias={alias}
          onCreated={(deal) => {
            setActiveDeal(deal);
            setView("chat");
            load();
          }}
          onBack={() => setView("list")}
        />
      )}

      {view === "join" && (
        <JoinDealView
          wallet={wallet}
          alias={alias}
          onJoined={(deal) => {
            setActiveDeal(deal);
            setView("chat");
            load();
          }}
          onBack={() => setView("list")}
        />
      )}

      {view === "chat" && activeDeal && (
        <ChatView
          deal={activeDeal}
          wallet={wallet}
          alias={alias}
          onBack={() => { setView("list"); setActiveDeal(null); load(); }}
        />
      )}
    </div>
  );
}

// ============================================================
// LIST VIEW
// ============================================================
function ListView({
  deals, loading, onOpen,
}: {
  deals: Deal[];
  loading: boolean;
  onOpen: (deal: Deal) => void;
}) {
  if (loading) {
    return (
      <div className="flex flex-col items-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-400 mb-2" />
        <p className="text-xs text-slate-400">Cargando deals…</p>
      </div>
    );
  }
  if (deals.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
        <Shield className="w-10 h-10 mx-auto text-slate-700 mb-3" />
        <p className="text-sm text-slate-400">No tienes deals activos.</p>
        <p className="text-xs text-slate-500 mt-1">
          Crea un deal como vendedor o únete a uno con código.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {deals.map(deal => {
        const Icon = TYPE_ICONS[deal.productType as ProductType] || Shield;
        const status = STATUS_LABELS[deal.status] || STATUS_LABELS.CREATED;
        return (
          <button
            key={deal.id}
            onClick={() => onOpen(deal)}
            className="w-full text-left p-4 bg-slate-900 border border-slate-800 hover:border-emerald-700/40 rounded-xl transition"
          >
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-slate-100 font-mono">{deal.code}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded border ${status.color}`}>
                      {status.label}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5 truncate">
                    {deal.title} · {deal.amount} {deal.currency}
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[10px] text-slate-500">Actualizado</div>
                <div className="text-[11px] text-slate-400">
                  {new Date(deal.updatedAt).toLocaleDateString()} {new Date(deal.updatedAt).toLocaleTimeString().slice(0, 5)}
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ============================================================
// CREATE DEAL VIEW
// ============================================================
function CreateDealView({
  wallet, alias, onCreated, onBack,
}: {
  wallet: string;
  alias: string;
  onCreated: (deal: Deal) => void;
  onBack: () => void;
}) {
  const [productType, setProductType] = useState<ProductType>("SOFTWARE");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    if (!title || title.length < 3) { setError("Título muy corto"); return; }
    if (!description || description.length < 10) { setError("Descripción muy corta"); return; }
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setError("Monto inválido"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/escrow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          wallet, alias,
          productType, title, description, category,
          amount,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Error");
      } else {
        onCreated(data.deal);
      }
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <button onClick={onBack} className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1">
        ← Volver
      </button>
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-100">Crear deal como vendedor</h2>
          <p className="text-xs text-slate-400 mt-1">
            Vas a vender un producto digital. El comprador deberá firmar el acuerdo con MetaMask
            y bloquear los fondos antes de que entregues el producto.
          </p>
        </div>

        <div>
          <label className="text-[11px] text-slate-400 uppercase font-semibold">Tipo de producto</label>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {(Object.keys(TYPE_LABELS) as ProductType[]).map(t => {
              const Icon = TYPE_ICONS[t];
              return (
                <button
                  key={t}
                  onClick={() => setProductType(t)}
                  className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-[11px] transition border ${
                    productType === t
                      ? "bg-slate-800 border-slate-600 text-slate-100"
                      : "bg-slate-950/50 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="flex-1 text-left">{TYPE_LABELS[t].label.split("(")[0].trim()}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="text-[11px] text-slate-400 uppercase font-semibold">Título</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej: Licencia Photoshop CC 2024"
            className="mt-1 w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 text-sm focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div>
          <label className="text-[11px] text-slate-400 uppercase font-semibold">Descripción del producto</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe qué incluye, formato de entrega, garantía, etc."
            rows={3}
            className="mt-1 w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 text-sm focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] text-slate-400 uppercase font-semibold">Categoría</label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Ej: Software"
              className="mt-1 w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="text-[11px] text-slate-400 uppercase font-semibold">Precio (USDT)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="80"
              className="mt-1 w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {error && (
          <div className="bg-rose-950/30 border border-rose-700/30 rounded p-2 text-xs text-rose-300 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5" /> {error}
          </div>
        )}

        <button
          onClick={submit}
          disabled={loading}
          className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition"
        >
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creando…</> : <><Plus className="w-4 h-4" /> Crear deal</>}
        </button>

        <div className="bg-slate-950/40 rounded p-3 text-[10px] text-slate-500">
          <b>Comisión:</b> 2% sobre el monto. <b>Custodia:</b> el monto se bloquea cuando el comprador firma con MetaMask.
          <br />
          <b>Disputas:</b> si hay conflicto, el admin revisa la evidencia y decide (liberar / reembolsar / división parcial).
        </div>
      </div>
    </div>
  );
}

// ============================================================
// JOIN DEAL VIEW
// ============================================================
function JoinDealView({
  wallet, alias, onJoined, onBack,
}: {
  wallet: string;
  alias: string;
  onJoined: (deal: Deal) => void;
  onBack: () => void;
}) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    if (!code) { setError("Ingresa el código"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/escrow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join", wallet, alias, code }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) setError(data.error || "Error");
      else onJoined(data.deal);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <button onClick={onBack} className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1">
        ← Volver
      </button>
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-100">Unirse como comprador</h2>
          <p className="text-xs text-slate-400 mt-1">
            Pega el código que te compartió el vendedor. Te vas a convertir en comprador del deal.
          </p>
        </div>
        <div>
          <label className="text-[11px] text-slate-400 uppercase font-semibold">Código del deal</label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ESC-2025-12345"
            className="mt-1 w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 text-sm font-mono focus:outline-none focus:border-emerald-500"
          />
        </div>
        {error && (
          <div className="bg-rose-950/30 border border-rose-700/30 rounded p-2 text-xs text-rose-300 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5" /> {error}
          </div>
        )}
        <button
          onClick={submit}
          disabled={loading}
          className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition"
        >
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Uniéndose…</> : <>Unirme como comprador</>}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// CHAT VIEW — seguimiento + acciones del deal
// ============================================================
function ChatView({
  deal, wallet, alias, onBack,
}: {
  deal: Deal;
  wallet: string;
  alias: string;
  onBack: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentDeal, setCurrentDeal] = useState(deal);
  const [showDeliver, setShowDeliver] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isBuyer = (currentDeal.buyer?.walletAddress || "").toLowerCase() === wallet.toLowerCase();
  const isSeller = (currentDeal.seller?.walletAddress || "").toLowerCase() === wallet.toLowerCase();
  const role = isBuyer ? "Comprador" : isSeller ? "Vendedor" : "Observador";
  const status = STATUS_LABELS[currentDeal.status] || STATUS_LABELS.CREATED;
  const immutable = ["FUNDED", "DELIVERED", "DISPUTED", "COMPLETED"].includes(currentDeal.status);

  const loadMsgs = useCallback(async () => {
    try {
      const res = await fetch(`/api/escrow/messages?dealId=${currentDeal.id}`);
      const d = await res.json();
      setMessages(d.messages || []);
    } catch {}
  }, [currentDeal.id]);

  const refreshDeal = useCallback(async () => {
    try {
      const res = await fetch("/api/escrow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get", dealId: currentDeal.id }),
      });
      const d = await res.json();
      if (d.deal) setCurrentDeal(d.deal);
    } catch {}
  }, [currentDeal.id]);

  useEffect(() => { loadMsgs(); }, [loadMsgs]);
  useEffect(() => {
    const i = setInterval(() => { loadMsgs(); refreshDeal(); }, 5000);
    return () => clearInterval(i);
  }, [loadMsgs, refreshDeal]);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const callApi = async (body: any) => {
    setLoading(true);
    try {
      const res = await fetch("/api/escrow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, wallet, alias, dealId: currentDeal.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        alert(data.error || "Error");
      } else {
        await loadMsgs();
        await refreshDeal();
      }
      return data;
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Firmar acuerdo con MetaMask
  const signAgreement = async () => {
    const agreement = prompt(
      "Escribe el acuerdo mutuo que vas a firmar con MetaMask:\n\nEj: 'Vendo licencia Photoshop CC 2024 por 80 USDT, entrega por chat con código de activación.'",
      currentDeal.agreement || `${currentDeal.title} por ${currentDeal.amount} USDT`
    );
    if (!agreement) return;

    const eth = (window as any).ethereum;
    if (!eth) {
      alert("MetaMask no está instalado");
      return;
    }
    try {
      // Pedir firma de mensaje
      const msg = `CriptoMy Escrow - Acuerdo de deal ${currentDeal.code}\n\n${agreement}\n\nFirmo este acuerdo como COMPRADOR.`;
      const signature = await eth.request({
        method: "personal_sign",
        params: [msg, wallet],
      });
      await callApi({
        action: "sign",
        agreement,
        signature,
      });
    } catch (e: any) {
      alert("Firma cancelada: " + e.message);
    }
  };

  // Bloquear fondos (simulado con firma MetaMask)
  const fund = async () => {
    const eth = (window as any).ethereum;
    if (!eth) {
      alert("MetaMask no está instalado");
      return;
    }
    if (!confirm(`Vas a bloquear ${currentDeal.amount} USDT en escrow. Confirmas?`)) return;
    try {
      // En una implementación completa esto enviaría una tx a un smart contract.
      // Aquí simulamos el "bloqueo" con una firma MetaMask que atestigua el acuerdo.
      const msg = `Bloqueo ${currentDeal.amount} USDT en escrow para deal ${currentDeal.code}`;
      const fundTxHash = await eth.request({
        method: "personal_sign",
        params: [msg, wallet],
      });
      await callApi({
        action: "fund",
        fundTxHash,
      });
    } catch (e: any) {
      alert("Bloqueo cancelado: " + e.message);
    }
  };

  const deliver = async (formData: any) => {
    await callApi({
      action: "deliver",
      ...formData,
    });
    setShowDeliver(false);
  };

  const release = async () => {
    if (!confirm("Confirmas liberar los fondos al vendedor? Esta acción es irreversible.")) return;
    await callApi({ action: "release" });
  };

  const dispute = async () => {
    const reason = prompt("Describe el motivo de la disputa (mín 10 caracteres):");
    if (!reason) return;
    await callApi({ action: "dispute", reason });
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    setLoading(true);
    try {
      await fetch("/api/escrow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "message",
          wallet, alias, dealId: currentDeal.id,
          text: input,
        }),
      });
      setInput("");
      await loadMsgs();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-2 flex-wrap bg-slate-900 border border-slate-800 rounded-xl p-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1">
            ← Volver
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-slate-100 font-mono">{currentDeal.code}</span>
              <span className={`text-[9px] px-1.5 py-0.5 rounded border ${status.color}`}>{status.label}</span>
              <span className="text-[10px] text-slate-500">· {role}</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {currentDeal.title} · {currentDeal.amount} USDT
            </div>
          </div>
        </div>
      </div>

      {/* Step indicator */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
        <div className="flex items-center justify-between gap-2 text-[10px] flex-wrap">
          {[
            { key: "CREATED", label: "Deal creado", icon: Plus },
            { key: "JOINED", label: "Comprador unido", icon: Wallet },
            { key: "FUNDED", label: "Fondos bloqueados", icon: Lock },
            { key: "DELIVERED", label: "Producto entregado", icon: CheckCircle2 },
            { key: "COMPLETED", label: "Completado", icon: Shield },
          ].map((step, i, arr) => {
            const order = ["CREATED", "JOINED", "FUNDED", "DELIVERED", "COMPLETED", "DISPUTED", "CANCELLED"];
            const currentIdx = order.indexOf(currentDeal.status);
            const stepIdx = order.indexOf(step.key);
            const done = stepIdx <= currentIdx;
            const Icon = step.icon;
            return (
              <div key={step.key} className="flex items-center gap-1">
                <div className={`flex items-center gap-1 ${done ? "text-emerald-400" : "text-slate-600"}`}>
                  <Icon className="w-3 h-3" />
                  <span className="hidden sm:inline">{step.label}</span>
                </div>
                {i < arr.length - 1 && <div className={`w-4 h-px ${done ? "bg-emerald-600" : "bg-slate-700"}`} />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Action buttons según estado */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center gap-2 flex-wrap">
        {currentDeal.status === "JOINED" && isBuyer && (
          <>
            <button
              onClick={signAgreement}
              disabled={loading}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-medium flex items-center gap-1.5 transition"
            >
              <Wallet className="w-3.5 h-3.5" /> Firmar acuerdo con MetaMask
            </button>
            {currentDeal.agreement && (
              <button
                onClick={fund}
                disabled={loading}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium flex items-center gap-1.5 transition"
              >
                <Lock className="w-3.5 h-3.5" /> Bloquear {currentDeal.amount} USDT
              </button>
            )}
          </>
        )}
        {currentDeal.status === "FUNDED" && isSeller && (
          <button
            onClick={() => setShowDeliver(!showDeliver)}
            disabled={loading}
            className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-medium flex items-center gap-1.5 transition"
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> Entregar producto
          </button>
        )}
        {currentDeal.status === "DELIVERED" && isBuyer && (
          <>
            <button
              onClick={release}
              disabled={loading}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium flex items-center gap-1.5 transition"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Liberar fondos al vendedor
            </button>
            <button
              onClick={dispute}
              disabled={loading}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-medium flex items-center gap-1.5 transition"
            >
              <AlertTriangle className="w-3.5 h-3.5" /> Abrir disputa
            </button>
          </>
        )}
        {currentDeal.status === "DISPUTED" && (
          <div className="text-[11px] text-rose-300 flex items-center gap-1.5">
            <Scale className="w-3.5 h-3.5" /> Disputa abierta — el admin revisará la evidencia
          </div>
        )}
        {["FUNDED", "DELIVERED"].includes(currentDeal.status) && !isBuyer && (
          <button
            onClick={dispute}
            disabled={loading}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-medium flex items-center gap-1.5 transition"
          >
            <AlertTriangle className="w-3.5 h-3.5" /> Abrir disputa
          </button>
        )}
      </div>

      {/* Deliver form */}
      {showDeliver && isSeller && currentDeal.status === "FUNDED" && (
        <DeliverForm onSubmit={deliver} onCancel={() => setShowDeliver(false)} />
      )}

      {/* Datos del deal (entrega) */}
      {currentDeal.status === "DELIVERED" && currentDeal.deliveryDescription && (
        <div className="bg-cyan-950/20 border border-cyan-700/30 rounded-lg p-3">
          <div className="text-[10px] uppercase text-cyan-400 font-semibold mb-2">📦 Producto entregado</div>
          <div className="text-xs text-slate-200 space-y-1">
            <div>{currentDeal.deliveryDescription}</div>
            {currentDeal.deliveryCode && <div><b>Código:</b> <code className="text-cyan-300">{currentDeal.deliveryCode}</code></div>}
            {currentDeal.deliveryLink && <div><b>Link:</b> <a href={currentDeal.deliveryLink} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">{currentDeal.deliveryLink}</a></div>}
            {currentDeal.deliveryInstructions && <div className="text-slate-400 text-[11px] mt-1">{currentDeal.deliveryInstructions}</div>}
          </div>
        </div>
      )}

      {/* Disputa info */}
      {currentDeal.status === "DISPUTED" && currentDeal.disputeReason && (
        <div className="bg-rose-950/20 border border-rose-700/30 rounded-lg p-3">
          <div className="text-[10px] uppercase text-rose-400 font-semibold mb-1">🚨 Motivo de la disputa</div>
          <div className="text-xs text-slate-200">{currentDeal.disputeReason}</div>
        </div>
      )}

      {/* Immutable banner */}
      {immutable && (
        <div className="bg-amber-950/20 border border-amber-700/30 rounded-lg p-2 text-[11px] text-amber-300 flex items-center gap-2">
          <Lock className="w-3 h-3 shrink-0" />
          <span>Mensajería inmutable activa. Cada mensaje es evidencia con hash criptográfico.</span>
        </div>
      )}

      {/* Acuerdo */}
      {currentDeal.agreement && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
          <div className="text-[10px] uppercase text-emerald-400 font-semibold mb-1">📝 Acuerdo firmado</div>
          <div className="text-xs text-slate-200">{currentDeal.agreement}</div>
          {currentDeal.buyerSignature && (
            <div className="mt-2 text-[10px] text-slate-500">
              Firma MetaMask: <code className="text-emerald-400">{currentDeal.buyerSignature.slice(0, 30)}...</code>
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl flex flex-col" style={{ height: "50vh", minHeight: "350px" }}>
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <MessageSquare className="w-8 h-8 mx-auto text-slate-700 mb-2" />
              <p className="text-xs text-slate-500">No hay mensajes todavía.</p>
            </div>
          )}
          {messages.map(m => <MessageBubble key={m.id} m={m} wallet={wallet} />)}
        </div>

        {/* Input */}
        <div className="border-t border-slate-800 p-2 flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !loading) sendMessage(); }}
            placeholder={immutable ? "Mensaje (inmutable)…" : "Mensaje…"}
            className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-emerald-500"
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="p-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ m, wallet }: { m: Message; wallet: string }) {
  const isBot = m.senderRole === "BOT";
  const isMine = m.senderWallet.toLowerCase() === wallet.toLowerCase();
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
            <span>{time}</span>
            {m.immutable && <><span>·</span><Hash className="w-2.5 h-2.5" /><span className="font-mono">{m.hash}</span></>}
            {m.tag && m.tag !== "SISTEMA" && (
              <span className="px-1 py-0 bg-amber-950/30 border border-amber-700/30 text-amber-400 rounded text-[8px]">{m.tag}</span>
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
          <span>{time}</span>
          {m.immutable && <><span>·</span><Hash className="w-2.5 h-2.5" /><span className="font-mono">{m.hash}</span></>}
        </div>
      </div>
    </div>
  );
}

function DeliverForm({ onSubmit, onCancel }: { onSubmit: (data: any) => void; onCancel: () => void }) {
  const [description, setDescription] = useState("");
  const [code, setCode] = useState("");
  const [credentials, setCredentials] = useState("");
  const [link, setLink] = useState("");
  const [instructions, setInstructions] = useState("");

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-100">Entregar producto</h3>
        <button onClick={onCancel} className="text-slate-500 hover:text-slate-300">✕</button>
      </div>
      <div>
        <label className="text-[10px] text-slate-500 uppercase">Descripción*</label>
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ej: Licencia Photoshop CC 2024 entregada"
          className="mt-1 w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-100 text-xs" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-slate-500 uppercase">Código / Key</label>
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="XXXX-XXXX-XXXX"
            className="mt-1 w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-100 text-xs font-mono" />
        </div>
        <div>
          <label className="text-[10px] text-slate-500 uppercase">Credenciales</label>
          <input value={credentials} onChange={(e) => setCredentials(e.target.value)} placeholder="user:password"
            className="mt-1 w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-100 text-xs font-mono" />
        </div>
      </div>
      <div>
        <label className="text-[10px] text-slate-500 uppercase">Link de descarga</label>
        <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://..."
          className="mt-1 w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-100 text-xs" />
      </div>
      <div>
        <label className="text-[10px] text-slate-500 uppercase">Instrucciones</label>
        <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={2}
          placeholder="Instrucciones de uso, activación, etc."
          className="mt-1 w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-100 text-xs" />
      </div>
      <button
        onClick={() => {
          if (!description) { alert("Descripción requerida"); return; }
          onSubmit({ deliveryDescription: description, deliveryCode: code, deliveryCredentials: credentials, deliveryLink: link, deliveryInstructions: instructions });
        }}
        className="w-full bg-cyan-600 hover:bg-cyan-500 text-white py-2 rounded text-xs font-medium"
      >
        Entregar producto
      </button>
    </div>
  );
}
