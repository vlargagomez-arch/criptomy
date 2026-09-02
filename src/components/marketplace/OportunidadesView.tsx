"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/lib/store";
import { Sparkles, Loader2, Bookmark, BookmarkCheck, ExternalLink, Filter } from "lucide-react";

interface Opportunity {
  id: string;
  category: string;
  name: string;
  description: string;
  difficulty: string;
  initialInvestment: number | null;
  riskLevel: string;
  potentialReward: string | null;
  countries: string;
  sourceUrl: string;
  sourceName: string;
  verifiedAt: string;
  isActive: boolean;
  saved?: boolean;
}

const CATEGORIES = [
  { id: "LEARN_EARN", label: "Aprende y gana", icon: "🎓" },
  { id: "AIRDROP", label: "Airdrops", icon: "🪂" },
  { id: "JOB_WEB3", label: "Trabajo Web3", icon: "💼" },
  { id: "CREATE", label: "Crear en Web3", icon: "🛠️" },
  { id: "MINING", label: "Minería", icon: "⛏️" },
  { id: "STAKING", label: "Staking", icon: "📈" },
];

const DIFFICULTY_LABELS: Record<string, { label: string; color: string }> = {
  BEGINNER: { label: "Principiante", color: "bg-emerald-900/50 text-emerald-300" },
  INTERMEDIATE: { label: "Intermedio", color: "bg-amber-900/50 text-amber-300" },
  ADVANCED: { label: "Avanzado", color: "bg-red-900/50 text-red-300" },
};

const RISK_LABELS: Record<string, { label: string; color: string }> = {
  LOW: { label: "Bajo", color: "bg-emerald-900/50 text-emerald-300" },
  MEDIUM: { label: "Medio", color: "bg-amber-900/50 text-amber-300" },
  HIGH: { label: "Alto", color: "bg-orange-900/50 text-orange-300" },
  VERY_HIGH: { label: "Muy alto", color: "bg-red-900/50 text-red-300" },
};

export default function OportunidadesView() {
  const { user } = useApp();
  const [category, setCategory] = useState<string>("");
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (category) params.append("category", category);
      params.append("country", "CO");
      if (user) params.append("address", user.walletAddress);
      const res = await fetch(`/api/opportunities?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      setOpps(data.opportunities || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, user]);

  const toggleSave = async (opp: Opportunity) => {
    if (!user) return;
    const op = opp.saved ? "unsave" : "save";
    try {
      await fetch(`/api/opportunities?op=${op}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: user.walletAddress, opportunityId: opp.id }),
      });
      setOpps((prev) =>
        prev.map((o) => (o.id === opp.id ? { ...o, saved: !o.saved } : o))
      );
    } catch (e) {
      // ignore
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-yellow-400" />
          Oportunidades Web3
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Aprende y gana, airdrops verificados, trabajo Web3, staking, minería.{" "}
          <b>Solo con fuente verificable.</b> No prometemos rentabilidad.
        </p>
      </div>

      {/* Filtros categoría */}
      <div className="flex gap-2 mb-6 overflow-x-auto scrollbar-hide pb-2">
        <button
          onClick={() => setCategory("")}
          className={`shrink-0 px-3 py-1.5 text-xs font-medium rounded-md transition ${
            !category
              ? "bg-emerald-600 text-white"
              : "bg-slate-800 text-slate-300 hover:bg-slate-700"
          }`}
        >
          <Filter className="w-3 h-3 inline mr-1" />
          Todas
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategory(c.id)}
            className={`shrink-0 px-3 py-1.5 text-xs font-medium rounded-md transition ${
              category === c.id
                ? "bg-emerald-600 text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            {c.icon} {c.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
        </div>
      ) : opps.length === 0 ? (
        <div className="text-center py-20 text-slate-500 border border-slate-800 rounded-xl">
          <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No hay oportunidades en esta categoría todavía.</p>
          <p className="text-xs mt-1">
            Las oportunidades se agregan con fuente verificable, sin promesas de rentabilidad.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {opps.map((o) => {
            const cat = CATEGORIES.find((c) => c.id === o.category);
            const diff = DIFFICULTY_LABELS[o.difficulty] || DIFFICULTY_LABELS.BEGINNER;
            const risk = RISK_LABELS[o.riskLevel] || RISK_LABELS.LOW;
            return (
              <div
                key={o.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-xs font-medium text-emerald-400">
                    {cat?.icon} {cat?.label || o.category}
                  </span>
                  {user && (
                    <button
                      onClick={() => toggleSave(o)}
                      className="text-slate-500 hover:text-emerald-400"
                    >
                      {o.saved ? (
                        <BookmarkCheck className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Bookmark className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>

                <h3 className="font-semibold text-slate-100 text-sm mb-1">{o.name}</h3>
                <p className="text-xs text-slate-400 line-clamp-3 flex-1">{o.description}</p>

                <div className="flex flex-wrap gap-1.5 mt-3">
                  <span className={`text-[10px] px-2 py-0.5 rounded ${diff.color}`}>
                    {diff.label}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded ${risk.color}`}>
                    Riesgo {risk.label}
                  </span>
                  {o.initialInvestment !== null && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      {o.initialInvestment === 0 ? "Gratis" : `~$${o.initialInvestment}`}
                    </span>
                  )}
                </div>

                {o.potentialReward && (
                  <div className="text-[11px] text-slate-400 mt-2">
                    <b>Recompensa:</b> {o.potentialReward}
                  </div>
                )}

                <a
                  href={o.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 text-xs text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1"
                >
                  Ver fuente: {o.sourceName} <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
