"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2, RefreshCw, ExternalLink, Gift, FileText, Gamepad2, Tv,
  Check, X, Shield, MessageSquare, Send, AlertTriangle, ArrowLeftRight,
  Package, Coins, User, Lock, Key, Link2, FileCheck, Zap, Plus, Search,
  TrendingUp, Tag, Star, Wallet, ChevronRight, Clock,
} from "lucide-react";
import { useApp } from "@/lib/store";

// ============================================================
// EscrowMarketplaceView — Diseño profesional tipo marketplace
// ============================================================

const PRODUCT_TYPES = [
  { id: "GIFT_CARD", label: "Gift Card", icon: Gift, color: "text-purple-400", bgColor: "bg-purple-500/10", borderColor: "border-purple-500/30" },
  { id: "DIGITAL_PRODUCT", label: "Producto Digital", icon: FileText, color: "text-blue-400", bgColor: "bg-blue-500/10", borderColor: "border-blue-500/30" },
  { id: "SUBSCRIPTION", label: "Suscripción", icon: Tv, color: "text-cyan-400", bgColor: "bg-cyan-500/10", borderColor: "border-cyan-500/30" },
  { id: "GAME_ACCOUNT", label: "Cuenta de Juego", icon: Gamepad2, color: "text-amber-400", bgColor: "bg-amber-500/10", borderColor: "border-amber-500/30" },
];

const CATEGORIES: Record<string, string[]> = {
  GIFT_CARD: ["Amazon", "Steam", "Google Play", "Apple Store", "Netflix", "Spotify", "PlayStation", "Xbox", "Disney+", "Riot Points", "Free Fire", "Otra"],
  DIGITAL_PRODUCT: ["Curso", "Ebook", "Software", "Licencia", "Plantilla", "Otra"],
  SUBSCRIPTION: ["Netflix", "Spotify", "Disney+", "HBO Max", "YouTube Premium", "Crunchyroll", "Otra"],
  GAME_ACCOUNT: ["Steam", "Epic Games", "Riot (LoL/Valorant)", "PUBG", "Fortnite", "Free Fire", "Otra"],
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  CREATED: { label: "Disponible", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
  FUNDED: { label: "Pagado · Escrow", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30" },
  DELIVERED: { label: "Entregado", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30" },
  COMPLETED: { label: "Completado", color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/30" },
  DISPUTED: { label: "En Disputa", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30" },
  CANCELLED: { label: "Cancelado", color: "text-slate-500", bg: "bg-slate-700/30", border: "border-slate-600/30" },
};

interface Offer {
  id: string;
  type: string;
  title: string;
  description: string;
  category: string;
  price: number;
  seller: string;
  sellerAlias: string;
  buyer?: string;
  buyerAlias?: string;
  status: string;
  productData?: { code?: string; credentials?: string; link?: string; instructions?: string; };
  validationStatus: string;
  validationNote?: string;
  escrowAmount: number;
  createdAt: number;
  updatedAt: number;
}

interface Message {
  id: string;
  escrowId: string;
  sender: string;
  senderAlias: string;
  text: string;
  timestamp: number;
}

export default function EscrowMarketplaceView() {
  const { user } = useApp();
  const [tab, setTab] = useState<"explorar" | "crear" | "mis-trades">("explorar");
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState<string>("");
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let filter = "created";
      if (tab === "mis-trades") filter = "mine";
      const params = new URLSearchParams({ filter });
      if (user) params.set("wallet", user.walletAddress);
      const res = await fetch(`/api/escrow?${params}`);
      const data = await res.json();
      let filtered = data.offers || [];
      if (filterType) filtered = filtered.filter((o: Offer) => o.type === filterType);
      setOffers(filtered);
    } catch {}
    setLoading(false);
  }, [tab, user, filterType]);

  useEffect(() => { load(); }, [load]);

  const loadMessages = useCallback(async (escrowId: string) => {
    try {
      const res = await fetch(`/api/escrow/messages?escrowId=${escrowId}`);
      const data = await res.json();
      setMessages(data.messages || []);
    } catch {}
  }, []);

  const sendMessage = async () => {
    if (!messageText.trim() || !selectedOffer || !user) return;
    try {
      await fetch("/api/escrow/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ escrowId: selectedOffer.id, sender: user.walletAddress, senderAlias: user.alias, text: messageText }),
      });
      setMessageText("");
      loadMessages(selectedOffer.id);
    } catch {}
  };

  const handleAction = async (action: string, offerId: string, extra?: Record<string, unknown>) => {
    try {
      const res = await fetch("/api/escrow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, offerId, seller: user?.walletAddress, buyer: user?.walletAddress, wallet: user?.walletAddress, sellerAlias: user?.alias, buyerAlias: user?.alias, ...extra }),
      });
      const data = await res.json();
      if (data.success) {
        load();
        if (selectedOffer) setSelectedOffer(data.offer);
      }
    } catch {}
  };

  return (
    <div className="space-y-4">
      {/* ===== HEADER ===== */}
      <div>
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Shield className="w-6 h-6 text-amber-400" />
          Escrow Digital
        </h2>
        <p className="text-sm text-slate-400 mt-1 max-w-3xl">
          Compra y vende gift cards, productos digitales, suscripciones y cuentas de juego con protección de escrow.
          El comprador paga USDT al escrow → el vendedor entrega → el comprador confirma → se liberan los fondos.
        </p>
      </div>

      {/* ===== STATS BAR ===== */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Ofertas activas" value={String(offers.filter(o => o.status === "CREATED").length)} icon={Package} color="text-emerald-400" />
        <StatCard label="En escrow" value={String(offers.filter(o => o.status === "FUNDED" || o.status === "DELIVERED").length)} icon={Lock} color="text-amber-400" />
        <StatCard label="Completados" value={String(offers.filter(o => o.status === "COMPLETED").length)} icon={Check} color="text-cyan-400" />
        <StatCard label="Disputas" value={String(offers.filter(o => o.status === "DISPUTED").length)} icon={AlertTriangle} color="text-red-400" />
      </div>

      {/* ===== SUB-TABS ===== */}
      <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 max-w-lg">
        {[
          { id: "explorar", label: "Explorar", icon: Search },
          { id: "crear", label: "Crear oferta", icon: Plus },
          { id: "mis-trades", label: "Mis trades", icon: ArrowLeftRight },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <button key={s.id}
              onClick={() => { setTab(s.id as never); setSelectedOffer(null); }}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition ${
                tab === s.id ? "bg-amber-500 text-black" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}>
              <Icon className="w-3.5 h-3.5" />
              {s.label}
            </button>
          );
        })}
      </div>

      {/* ===== FILTROS POR TIPO (solo en explorar) ===== */}
      {tab === "explorar" && (
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setFilterType("")}
            className={`px-3 py-1.5 rounded-lg text-xs transition ${!filterType ? "bg-amber-500 text-black font-medium" : "bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700"}`}>
            Todos
          </button>
          {PRODUCT_TYPES.map((t) => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setFilterType(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition ${filterType === t.id ? "bg-amber-500 text-black font-medium" : `bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700 ${t.color}`}`}>
                <Icon className={`w-3.5 h-3.5 ${filterType === t.id ? "text-black" : t.color}`} />
                {t.label}
              </button>
            );
          })}
        </div>
      )}

      {/* ===== LOADING ===== */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
        </div>
      )}

      {/* ===== EXPLORAR ===== */}
      {tab === "explorar" && !loading && (
        offers.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
            <Package className="w-10 h-10 mx-auto text-slate-700 mb-3" />
            <p className="text-sm text-slate-400 font-medium">No hay ofertas disponibles</p>
            <p className="text-xs text-slate-600 mt-1">¡Sé el primero en crear una oferta!</p>
            <button onClick={() => setTab("crear")}
              className="mt-4 flex items-center gap-1.5 text-xs px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black rounded-lg transition font-semibold mx-auto">
              <Plus className="w-3.5 h-3.5" /> Crear oferta
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {offers.map((offer) => <OfferCard key={offer.id} offer={offer} user={user} onAction={handleAction} />)}
          </div>
        )
      )}

      {/* ===== CREAR ===== */}
      {tab === "crear" && <CreateOfferForm user={user} onCreated={() => { setTab("explorar"); load(); }} />}

      {/* ===== MIS TRADES ===== */}
      {tab === "mis-trades" && !loading && (
        offers.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
            <ArrowLeftRight className="w-10 h-10 mx-auto text-slate-700 mb-3" />
            <p className="text-sm text-slate-400 font-medium">No tienes trades activos</p>
            <p className="text-xs text-slate-600 mt-1">Crea una oferta o compra una existente</p>
          </div>
        ) : (
          <div className="space-y-3">
            {offers.map((offer) => (
              <TradeDetailCard key={offer.id} offer={offer} user={user} onAction={handleAction}
                messages={messages} onSendMessage={sendMessage} messageText={messageText}
                setMessageText={setMessageText} onLoadMessages={loadMessages}
                onSelect={(o: Offer) => { setSelectedOffer(o); loadMessages(o.id); }} />
            ))}
          </div>
        )
      )}
    </div>
  );
}

// ============================================================
// STAT CARD
// ============================================================
function StatCard({ label, value, icon: Icon, color }: { label: string; value: string; icon: any; color: string }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <div className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</div>
        <div className={`text-xl font-bold ${color}`}>{value}</div>
      </div>
    </div>
  );
}

// ============================================================
// OFFER CARD (explorar)
// ============================================================
function OfferCard({ offer, user, onAction }: { offer: Offer; user: any; onAction: (a: string, id: string, e?: any) => void }) {
  const tc = PRODUCT_TYPES.find(t => t.id === offer.type) || PRODUCT_TYPES[0];
  const Icon = tc.icon;
  const st = STATUS_CONFIG[offer.status] || STATUS_CONFIG.CREATED;

  return (
    <div className={`bg-slate-900 border ${tc.borderColor} rounded-xl p-4 hover:border-opacity-60 transition`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-xl ${tc.bgColor} flex items-center justify-center`}>
            <Icon className={`w-5 h-5 ${tc.color}`} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white leading-tight">{offer.title}</h3>
            <p className="text-[10px] text-slate-500 mt-0.5">{offer.category} · {tc.label}</p>
          </div>
        </div>
        <span className={`text-[9px] px-2 py-0.5 rounded border ${st.bg} ${st.border} ${st.color} font-medium`}>{st.label}</span>
      </div>

      {/* Description */}
      <p className="text-xs text-slate-400 mb-3 line-clamp-2">{offer.description}</p>

      {/* Seller + Price */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5 text-xs">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-[10px] text-white font-bold">
            {offer.sellerAlias.slice(0, 2).toUpperCase()}
          </div>
          <span className="text-slate-400">@{offer.sellerAlias}</span>
        </div>
        <div className="flex items-center gap-1">
          <Coins className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-amber-400 font-bold text-base">{offer.price}</span>
          <span className="text-[10px] text-slate-500">USDT</span>
        </div>
      </div>

      {/* Action */}
      {offer.status === "CREATED" && user && offer.seller !== user.walletAddress && (
        <button onClick={() => onAction("fund", offer.id)}
          className="w-full flex items-center justify-center gap-1.5 text-xs px-3 py-2.5 bg-amber-500 hover:bg-amber-400 text-black rounded-lg transition font-bold">
          <Lock className="w-3.5 h-3.5" />
          Comprar con escrow · {offer.price} USDT
        </button>
      )}
      {offer.status === "CREATED" && user && offer.seller === user.walletAddress && (
        <button onClick={() => onAction("cancel", offer.id)}
          className="w-full text-xs px-3 py-2 bg-slate-800 hover:bg-red-900/30 text-slate-400 hover:text-red-400 rounded-lg transition">
          Cancelar oferta
        </button>
      )}
      {!user && <p className="text-xs text-slate-500 text-center py-2">Conecta tu wallet para comprar</p>}
    </div>
  );
}

// ============================================================
// CREATE OFFER FORM
// ============================================================
function CreateOfferForm({ user, onCreated }: { user: any; onCreated: () => void }) {
  const [type, setType] = useState("GIFT_CARD");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const categories = CATEGORIES[type] || [];
  const tc = PRODUCT_TYPES.find(t => t.id === type) || PRODUCT_TYPES[0];

  const handleSubmit = async () => {
    if (!user) { setError("Conecta tu wallet"); return; }
    if (!title || !description || !category || !price) { setError("Completa todos los campos"); return; }
    if (parseFloat(price) <= 0) { setError("Precio inválido"); return; }
    setCreating(true); setError("");
    try {
      const res = await fetch("/api/escrow", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", type, title, description, category, price, seller: user.walletAddress, sellerAlias: user.alias }),
      });
      const data = await res.json();
      if (data.success) { setTitle(""); setDescription(""); setCategory(""); setPrice(""); onCreated(); }
      else setError(data.error || "Error");
    } catch (e) { setError((e as Error).message); }
    setCreating(false);
  };

  if (!user) return <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-500 text-sm">Conecta tu wallet para crear ofertas</div>;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-xl">
      <h3 className="text-base font-bold text-white mb-5 flex items-center gap-2">
        <Plus className="w-4 h-4 text-amber-400" />
        Nueva oferta de escrow
      </h3>

      <div className="space-y-4">
        {/* Tipo de producto */}
        <div>
          <label className="text-[11px] text-slate-400 uppercase tracking-wide font-semibold">Tipo de producto</label>
          <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {PRODUCT_TYPES.map((t) => {
              const Icon = t.icon;
              const active = type === t.id;
              return (
                <button key={t.id} onClick={() => { setType(t.id); setCategory(""); }}
                  className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border transition ${
                    active ? `${t.bgColor} ${t.borderColor}` : "bg-slate-800 border-slate-700 hover:border-slate-600"
                  }`}>
                  <Icon className={`w-5 h-5 ${active ? t.color : "text-slate-500"}`} />
                  <span className={`text-[10px] font-medium ${active ? t.color : "text-slate-400"}`}>{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Categoría */}
        <div>
          <label className="text-[11px] text-slate-400 uppercase tracking-wide font-semibold">Categoría</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)}
            className="mt-2 w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-amber-500 transition">
            <option value="">Selecciona...</option>
            {categories.map((c) => <option key={c} value={c} className="bg-slate-900">{c}</option>)}
          </select>
        </div>

        {/* Título */}
        <div>
          <label className="text-[11px] text-slate-400 uppercase tracking-wide font-semibold">Título</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder={`Ej: Gift Card ${categories[0] || ""} $50...`}
            className="mt-2 w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-amber-500 transition" />
        </div>

        {/* Descripción */}
        <div>
          <label className="text-[11px] text-slate-400 uppercase tracking-wide font-semibold">Descripción</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe el producto: saldo, región, validez, condiciones..."
            rows={3}
            className="mt-2 w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-amber-500 transition resize-none" />
        </div>

        {/* Precio */}
        <div>
          <label className="text-[11px] text-slate-400 uppercase tracking-wide font-semibold">Precio (USDT)</label>
          <div className="mt-2 relative">
            <Coins className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-400" />
            <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="50"
              className="w-full pl-10 pr-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-amber-500 transition" />
          </div>
        </div>

        {error && <div className="text-xs text-red-400 bg-red-950/30 border border-red-800/50 p-2.5 rounded-lg">{error}</div>}

        {/* Submit */}
        <button onClick={handleSubmit} disabled={creating}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-amber-500 hover:bg-amber-400 text-black rounded-lg transition font-bold disabled:opacity-50">
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          {creating ? "Creando..." : "Publicar oferta"}
        </button>

        {/* Info */}
        <div className="bg-slate-950/50 border border-slate-700/50 rounded-lg p-3 text-[11px] text-slate-400 flex items-start gap-2">
          <Shield className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
          <span>
            <b className="text-slate-300">Cómo funciona el escrow:</b> El comprador paga USDT que queda retenido.
            Tú entregas el producto (código, credenciales, link). El comprador verifica y confirma.
            Los fondos se liberan a tu wallet. Si hay problema, se abre disputa.
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// TRADE DETAIL CARD (mis-trades)
// ============================================================
function TradeDetailCard({ offer, user, onAction, messages, onSendMessage, messageText, setMessageText, onLoadMessages, onSelect }: any) {
  const tc = PRODUCT_TYPES.find(t => t.id === offer.type) || PRODUCT_TYPES[0];
  const Icon = tc.icon;
  const st = STATUS_CONFIG[offer.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.CREATED;
  const isSeller = user?.walletAddress === offer.seller;
  const isBuyer = user?.walletAddress === offer.buyer;
  const canDeliver = isSeller && offer.status === "FUNDED";
  const canConfirm = isBuyer && offer.status === "DELIVERED";
  const canDispute = (isSeller || isBuyer) && ["FUNDED", "DELIVERED"].includes(offer.status);

  const [showDeliver, setShowDeliver] = useState(false);
  const [code, setCode] = useState("");
  const [credentials, setCredentials] = useState("");
  const [link, setLink] = useState("");
  const [instructions, setInstructions] = useState("");

  const deliver = async () => {
    onAction("deliver", offer.id, { code, credentials, link, instructions });
    setShowDeliver(false);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="bg-black px-4 py-3 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg ${tc.bgColor} flex items-center justify-center`}>
            <Icon className={`w-4 h-4 ${tc.color}`} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">{offer.title}</h3>
            <p className="text-[10px] text-slate-500">{offer.category} · {tc.label} · {offer.price} USDT</p>
          </div>
        </div>
        <span className={`text-[9px] px-2 py-0.5 rounded border ${st.bg} ${st.border} ${st.color} font-medium`}>{st.label}</span>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        <p className="text-xs text-slate-400">{offer.description}</p>

        {/* Parties */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-950/50 rounded-lg p-2.5">
            <div className="text-[10px] text-slate-500 uppercase mb-1 flex items-center gap-1"><User className="w-3 h-3" /> Vendedor</div>
            <div className="text-slate-200 text-xs font-medium">@{offer.sellerAlias}</div>
            <div className="text-[10px] text-slate-600 font-mono mt-0.5">{offer.seller.slice(0, 8)}...{offer.seller.slice(-4)}</div>
          </div>
          <div className="bg-slate-950/50 rounded-lg p-2.5">
            <div className="text-[10px] text-slate-500 uppercase mb-1 flex items-center gap-1"><Wallet className="w-3 h-3" /> Comprador</div>
            <div className="text-slate-200 text-xs font-medium">@{offer.buyerAlias || "—"}</div>
            <div className="text-[10px] text-slate-600 font-mono mt-0.5">{offer.buyer ? `${offer.buyer.slice(0, 8)}...${offer.buyer.slice(-4)}` : "Sin comprador"}</div>
          </div>
        </div>

        {/* Product delivered */}
        {offer.productData && (isBuyer || isSeller) && (
          <div className="bg-slate-950/70 border border-slate-700/50 rounded-lg p-3">
            <div className="text-[10px] uppercase text-amber-400 font-semibold mb-2 flex items-center gap-1.5">
              <FileCheck className="w-3 h-3" /> Producto entregado
            </div>
            {offer.productData.code && (
              <div className="mb-2">
                <div className="text-slate-500 text-[10px] mb-0.5">Código:</div>
                <div className="text-slate-200 font-mono text-xs break-all bg-slate-900 p-2 rounded">{offer.productData.code}</div>
              </div>
            )}
            {offer.productData.credentials && (
              <div className="mb-2">
                <div className="text-slate-500 text-[10px] mb-0.5">Credenciales:</div>
                <div className="text-slate-200 font-mono text-xs break-all bg-slate-900 p-2 rounded">{offer.productData.credentials}</div>
              </div>
            )}
            {offer.productData.link && (
              <div className="mb-2">
                <div className="text-slate-500 text-[10px] mb-0.5">Link:</div>
                <a href={offer.productData.link} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 text-xs break-all">{offer.productData.link}</a>
              </div>
            )}
            {offer.productData.instructions && (
              <div className="mb-2">
                <div className="text-slate-500 text-[10px] mb-0.5">Instrucciones:</div>
                <div className="text-slate-300 text-xs">{offer.productData.instructions}</div>
              </div>
            )}
            {/* Validation */}
            <div className="mt-2 pt-2 border-t border-slate-700/50 flex items-center gap-2 text-[11px]">
              {offer.validationStatus === "VALIDATED" ? (
                <><Check className="w-3 h-3 text-emerald-400" /><span className="text-emerald-400">{offer.validationNote}</span></>
              ) : offer.validationStatus === "INVALID" ? (
                <><X className="w-3 h-3 text-red-400" /><span className="text-red-400">{offer.validationNote}</span></>
              ) : (
                <><Loader2 className="w-3 h-3 animate-spin text-amber-400" /><span className="text-amber-400">Pendiente de validación</span></>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {canDeliver && (
            <button onClick={() => setShowDeliver(!showDeliver)}
              className="flex items-center gap-1.5 text-xs px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition font-semibold">
              <Send className="w-3.5 h-3.5" /> Entregar producto
            </button>
          )}
          {canConfirm && (
            <button onClick={() => onAction("confirm", offer.id)}
              className="flex items-center gap-1.5 text-xs px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition font-semibold">
              <Check className="w-3.5 h-3.5" /> Confirmar recepción
            </button>
          )}
          {canDispute && (
            <button onClick={() => onAction("dispute", offer.id)}
              className="flex items-center gap-1.5 text-xs px-3 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition font-semibold">
              <AlertTriangle className="w-3.5 h-3.5" /> Abrir disputa
            </button>
          )}
        </div>

        {/* Deliver form */}
        {showDeliver && (
          <div className="bg-slate-950/50 border border-emerald-700/30 rounded-lg p-3 space-y-2">
            <div className="text-[10px] uppercase text-emerald-400 font-semibold mb-1">Entregar producto</div>
            {offer.type === "GIFT_CARD" && (
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Código de la gift card"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 text-xs font-mono" />
            )}
            {offer.type === "GAME_ACCOUNT" && (
              <input value={credentials} onChange={(e) => setCredentials(e.target.value)} placeholder="usuario:password"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 text-xs font-mono" />
            )}
            {(offer.type === "DIGITAL_PRODUCT" || offer.type === "SUBSCRIPTION") && (
              <>
                <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Link de descarga o acceso"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 text-xs" />
                <input value={credentials} onChange={(e) => setCredentials(e.target.value)} placeholder="Credenciales (opcional)"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 text-xs font-mono" />
              </>
            )}
            <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Instrucciones (opcional)"
              rows={2} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 text-xs resize-none" />
            <button onClick={deliver}
              className="w-full px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold transition">
              Entregar y validar
            </button>
          </div>
        )}

        {/* Messages */}
        {(isBuyer || isSeller) && offer.buyer && (
          <div className="bg-slate-950/50 border border-slate-700/50 rounded-lg p-3">
            <div className="text-[10px] uppercase text-slate-400 font-semibold mb-2 flex items-center gap-1.5">
              <MessageSquare className="w-3 h-3" /> Mensajes
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {messages.length === 0 && <p className="text-[10px] text-slate-600 italic">Sin mensajes</p>}
              {messages.map((msg: Message) => (
                <div key={msg.id} className={`text-xs ${msg.sender === user?.walletAddress ? "text-right" : "text-left"}`}>
                  <div className={`inline-block max-w-[80%] px-2.5 py-1.5 rounded-lg ${msg.sender === user?.walletAddress ? "bg-amber-500/20 text-amber-100" : "bg-slate-800 text-slate-300"}`}>
                    <div className="text-[9px] text-slate-500 mb-0.5">@{msg.senderAlias} · {new Date(msg.timestamp).toLocaleTimeString()}</div>
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-1">
              <input value={messageText} onChange={(e) => setMessageText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && onSendMessage()}
                placeholder="Escribe..." className="flex-1 px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-100 text-xs" />
              <button onClick={onSendMessage} className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black rounded text-xs font-semibold transition">
                <Send className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
