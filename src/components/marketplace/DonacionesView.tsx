"use client";

import { useState, useEffect, useCallback } from "react";
import { useApp } from "@/lib/store";
import {
  Heart, Loader2, Globe2, Shield, ExternalLink, Copy, Check, TrendingUp,
  Users, Target, Info, Search, Filter,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

interface Cause {
  id: string;
  title: string;
  description: string;
  category: string;
  country: string;
  organizerName: string;
  organizerWallet: string;
  imageUrl?: string;
  websiteUrl?: string;
  goalAmount: number;
  raisedAmount: number;
  donorCount: number;
  verified: boolean;
  active: boolean;
  deadline?: string;
  createdAt: string;
  _count: { donations: number };
}

const CATEGORIES = [
  { id: "", label: "Todas", icon: "🌍" },
  { id: "EMERGENCY", label: "Emergencias", icon: "🚨" },
  { id: "EDUCATION", label: "Educación", icon: "📚" },
  { id: "HEALTH", label: "Salud", icon: "🏥" },
  { id: "FOOD", label: "Alimentación", icon: "🍚" },
  { id: "SHELTER", label: "Refugio", icon: "🏠" },
  { id: "COMMUNITY", label: "Comunidad", icon: "🤝" },
];

const COUNTRY_NAMES: Record<string, string> = {
  CO: "Colombia", MX: "México", AR: "Argentina", VE: "Venezuela",
  BR: "Brasil", CL: "Chile", PE: "Perú", EC: "Ecuador", ALL: "Todos",
};

export default function DonacionesView() {
  const { user, setTab } = useApp();
  const [causes, setCauses] = useState<Cause[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("");
  const [selectedCause, setSelectedCause] = useState<Cause | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (category) params.append("category", category);
      if (user) params.append("address", user.walletAddress);
      const res = await fetch(`/api/donations?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      setCauses(data.causes || []);
    } finally {
      setLoading(false);
    }
  }, [category, user]);

  useEffect(() => {
    load();
  }, [load]);

  const copyWallet = (wallet: string) => {
    navigator.clipboard?.writeText(wallet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const totalRaised = causes.reduce((sum, c) => sum + c.raisedAmount, 0);
  const totalDonors = causes.reduce((sum, c) => sum + c.donorCount, 0);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <Heart className="w-6 h-6 text-rose-400" />
          Donaciones Cripto
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Dona USDT/USDC a causas sociales verificadas. Sin KYC, sin intermediarios,
          100% transparente. La cripto llega directo al organizador.
        </p>
      </div>

      {/* Panel explicativo */}
      <div className="mb-6 bg-rose-950/20 border border-rose-800/30 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Info className="w-4 h-4 text-rose-400" />
          <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wide">
            ¿Cómo funciona?
          </h3>
        </div>
        <ol className="text-[12px] text-slate-400 space-y-1.5 list-decimal pl-4">
          <li>Elige una causa verificada que te importe (emergencias, educación, salud, alimentación).</li>
          <li>Click en "Donar" — te mostramos la wallet del organizador y un QR.</li>
          <li>
            <b className="text-slate-200">Envías USDT/USDC desde tu wallet</b> directo al organizador.
            Nosotros no tocamos los fondos.
          </li>
          <li>Registra tu donación con el txHash para que aparezca en el contador de transparencia.</li>
          <li>100% transparente: cualquier puede verificar las donaciones on-chain.</li>
        </ol>
        <div className="mt-3 pt-3 border-t border-rose-800/30 flex items-center gap-4 flex-wrap text-[10px] text-slate-400">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-500" /> Sin intermediarios</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Sin KYC</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500" /> 100% on-chain</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" /> Causas verificadas</span>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
          <div className="text-[10px] text-slate-500 uppercase">Causas activas</div>
          <div className="text-xl font-bold text-rose-400">{causes.length}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
          <div className="text-[10px] text-slate-500 uppercase">Total recaudado</div>
          <div className="text-xl font-bold text-emerald-400">${totalRaised.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
          <div className="text-[10px] text-slate-500 uppercase">Donantes totales</div>
          <div className="text-xl font-bold text-slate-100">{totalDonors}</div>
        </div>
      </div>

      {/* Filtros categoría */}
      <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide pb-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategory(c.id)}
            className={`shrink-0 px-3 py-1.5 text-xs font-medium rounded-md transition ${
              category === c.id
                ? "bg-rose-600 text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            {c.icon} {c.label}
          </button>
        ))}
      </div>

      {/* Lista de causas */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-rose-400" />
        </div>
      ) : causes.length === 0 ? (
        <div className="text-center py-20 text-slate-500 border border-slate-800 rounded-xl">
          <Heart className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No hay causas activas en esta categoría todavía.</p>
          <p className="text-xs mt-1">Las causas se agregan con verificación manual del admin.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {causes.map((cause) => (
            <CauseCard key={cause.id} cause={cause} onDonate={() => setSelectedCause(cause)} />
          ))}
        </div>
      )}

      {/* Modal de donación */}
      {selectedCause && (
        <DonateModal
          cause={selectedCause}
          user={user}
          copied={copied}
          onCopy={() => copyWallet(selectedCause.organizerWallet)}
          onClose={() => setSelectedCause(null)}
          onGoSend={() => setTab("enviar-recibir")}
        />
      )}
    </div>
  );
}

function CauseCard({ cause, onDonate }: { cause: Cause; onDonate: () => void }) {
  const progress = cause.goalAmount > 0 ? Math.min(100, (cause.raisedAmount / cause.goalAmount) * 100) : 0;
  const cat = CATEGORIES.find((c) => c.id === cause.category);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-rose-600/30 transition">
      {/* Imagen o placeholder */}
      <div className="aspect-video bg-slate-800 relative">
        {cause.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cause.imageUrl} alt={cause.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl">
            {cat?.icon || "🌍"}
          </div>
        )}
        <div className="absolute top-2 left-2 px-2 py-1 text-[10px] font-bold rounded bg-black/60 text-white uppercase">
          {cat?.icon} {cat?.label || cause.category}
        </div>
        {cause.verified && (
          <div className="absolute top-2 right-2 px-2 py-1 text-[10px] rounded bg-emerald-600/80 text-white flex items-center gap-1">
            <Shield className="w-2.5 h-2.5" /> Verificada
          </div>
        )}
      </div>

      {/* Contenido */}
      <div className="p-4">
        <h3 className="font-semibold text-slate-100 text-sm mb-1 line-clamp-2">{cause.title}</h3>
        <p className="text-xs text-slate-400 line-clamp-2 mb-3">{cause.description}</p>

        {/* Organizador */}
        <div className="text-[10px] text-slate-500 mb-2 flex items-center gap-2">
          <span>📍 {COUNTRY_NAMES[cause.country] || cause.country}</span>
          <span>·</span>
          <span>por {cause.organizerName}</span>
        </div>

        {/* Progreso */}
        <div className="mb-3">
          <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
            <span className="text-emerald-400 font-bold">${cause.raisedAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            <span>Meta: ${cause.goalAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-rose-500 to-emerald-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between text-[10px] text-slate-500 mb-3">
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" /> {cause.donorCount} donantes
          </span>
          <span className="flex items-center gap-1">
            <Target className="w-3 h-3" /> {progress.toFixed(0)}% de la meta
          </span>
        </div>

        {/* Botón */}
        <button
          onClick={onDonate}
          className="w-full py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition"
        >
          <Heart className="w-4 h-4" />
          Donar ahora
        </button>

        {/* Website del organizador */}
        {cause.websiteUrl && (
          <a
            href={cause.websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 w-full block text-center text-[10px] text-slate-500 hover:text-slate-300"
          >
            Verificar organizador <ExternalLink className="w-2.5 h-2.5 inline" />
          </a>
        )}
      </div>
    </div>
  );
}

function DonateModal({
  cause, user, copied, onCopy, onClose, onGoSend,
}: {
  cause: Cause;
  user: { walletAddress: string } | null;
  copied: boolean;
  onCopy: () => void;
  onClose: () => void;
  onGoSend: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Heart className="w-5 h-5 text-rose-400" />
            Donar a: {cause.title}
          </h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-xl">×</button>
        </div>

        {/* Info de la causa */}
        <div className="text-sm text-slate-400 mb-4 bg-slate-800/50 rounded-lg p-3">
          {cause.description}
        </div>

        {/* Wallet del organizador */}
        <div className="mb-4">
          <div className="text-[11px] text-slate-500 uppercase mb-2">Wallet del organizador (envía USDT aquí):</div>
          <div className="bg-slate-800 rounded-lg p-3 flex items-center gap-2">
            <code className="text-xs font-mono text-slate-200 break-all flex-1">
              {cause.organizerWallet}
            </code>
            <button onClick={onCopy} className="shrink-0 p-2 bg-slate-700 hover:bg-slate-600 rounded text-slate-300">
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* QR */}
        <div className="flex flex-col items-center mb-4">
          <div className="bg-white p-3 rounded-xl">
            <QRCodeSVG value={cause.organizerWallet} size={160} level="M" />
          </div>
          <p className="text-[10px] text-slate-500 mt-2">Escanea para enviar USDT/USDC</p>
        </div>

        {/* Instrucciones */}
        <div className="bg-emerald-950/30 border border-emerald-800/50 rounded-lg p-3 text-xs text-slate-400 mb-4">
          <b className="text-emerald-300">Pasos:</b>
          <ol className="list-decimal pl-4 mt-1 space-y-1">
            <li>Copia la wallet del organizador o escanea el QR.</li>
            <li>Ve a "Enviar" en CriptoMy o usa tu wallet directamente.</li>
            <li>Envía USDT/USDC a la wallet del organizador.</li>
            <li>Vuelve aquí y registra tu donación con el txHash (opcional).</li>
          </ol>
        </div>

        {/* Botones */}
        <div className="flex gap-2">
          {user && (
            <button
              onClick={() => { onClose(); onGoSend(); }}
              className="flex-1 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-1.5 transition"
            >
              Ir a Enviar
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition"
          >
            Cerrar
          </button>
        </div>

        <div className="mt-3 text-[10px] text-slate-500 text-center">
          🔒 Tu donación va directa al organizador. Nosotros no custodiamos los fondos.
        </div>
      </div>
    </div>
  );
}
