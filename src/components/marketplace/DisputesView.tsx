"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/lib/store";
import { Shield, Loader2, MessageSquare, AlertTriangle } from "lucide-react";

interface Dispute {
  id: string;
  reason: string;
  status: string;
  evidence: string | null;
  resolution: string | null;
  createdAt: string;
  trade: {
    id: string;
    cryptoAmount: number;
    fiatAmount: number;
    paymentMethod: string;
  };
}

export default function DisputesView() {
  const { user } = useApp();
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        // Intentamos obtener disputas; si la API no existe, devolvemos []
        const res = await fetch(`/api/disputes?address=${user.walletAddress}`);
        if (res.ok) {
          const data = await res.json();
          setDisputes(data.disputes || []);
        }
      } catch (e) {
        console.warn("Disputas fetch failed:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto p-8 text-center text-slate-400">
        Conecta tu wallet para ver disputas.
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <Shield className="w-6 h-6 text-emerald-400" />
          Disputas
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Disputas abiertas en tus trades P2P. El sistema las revisa y resuelve según la evidencia
          (mensajes del chat, screenshots IPFS, estado del escrow on-chain).
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
        </div>
      ) : disputes.length === 0 ? (
        <div className="text-center py-20 text-slate-500 border border-slate-800 rounded-xl">
          <Shield className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No tienes disputas activas.</p>
          <p className="text-xs mt-1">
            Si tienes un problema en un trade, abre una disputa desde la sección "Mis trades".
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {disputes.map((d) => (
            <div
              key={d.id}
              className="bg-slate-900 rounded-xl border border-slate-800 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <span className="font-medium text-slate-100">{d.reason}</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    Trade: {d.trade.cryptoAmount} cripto · {d.trade.fiatAmount} fiat ·{" "}
                    {d.trade.paymentMethod}
                  </div>
                  {d.evidence && (
                    <div className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      Evidencia disponible (IPFS)
                    </div>
                  )}
                  {d.resolution && (
                    <div className="text-[11px] text-slate-300 mt-2 p-2 bg-slate-800 rounded">
                      <b>Resolución:</b> {d.resolution}
                    </div>
                  )}
                </div>
                <span
                  className={`px-2 py-1 text-[10px] rounded uppercase font-bold ${
                    d.status === "OPEN"
                      ? "bg-amber-900/50 text-amber-300"
                      : d.status === "RESOLVED"
                        ? "bg-emerald-900/50 text-emerald-300"
                        : "bg-slate-800 text-slate-300"
                  }`}
                >
                  {d.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
