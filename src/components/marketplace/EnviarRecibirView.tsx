"use client";

import { useState } from "react";
import { useApp } from "@/lib/store";
import { Send, Download, ArrowLeftRight } from "lucide-react";
import EnviarView from "./EnviarView";
import RecibirView from "./RecibirView";

// ============================================================
// EnviarRecibirView — Menú unificado de transferencias
// ============================================================
// Combina "Enviar" y "Recibir" en una sola vista con sub-tabs internos.
// Responde al requerimiento del usuario de unificar esos dos menús.
// ============================================================

type SubTab = "enviar" | "recibir";

const SUBTABS: { id: SubTab; label: string; icon: React.ElementType; desc: string }[] = [
  { id: "enviar", label: "Enviar", icon: Send, desc: "Transfiere cripto a cualquier dirección" },
  { id: "recibir", label: "Recibir", icon: Download, desc: "Tu dirección + QR para recibir" },
];

export default function EnviarRecibirView() {
  const { user } = useApp();
  const [subTab, setSubTab] = useState<SubTab>("enviar");

  return (
    <div>
      {/* Header unificado */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-6">
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <ArrowLeftRight className="w-6 h-6 text-cyan-400" />
          Enviar / Recibir
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Transfiere cripto entre wallets. Tú firmas, nosotros nunca tocamos tus claves.
          100% non-custodial.
        </p>
      </div>

      {/* Sub-nav */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 mt-4">
        <div className="flex gap-2 bg-slate-900/50 border border-slate-800 rounded-xl p-1">
          {SUBTABS.map((s) => {
            const Icon = s.icon;
            const active = subTab === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setSubTab(s.id)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition ${
                  active
                    ? "bg-cyan-600 text-white"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                }`}
                title={s.desc}
              >
                <Icon className="w-4 h-4" />
                {s.label}
              </button>
            );
          })}
        </div>
        {!user && (
          <div className="mt-3 text-xs text-amber-300 bg-amber-950/30 border border-amber-800/50 rounded-lg p-3">
            ⚠️ Conecta tu wallet para usar Enviar/Recibir.
          </div>
        )}
      </div>

      {/* Contenido */}
      <div className="mt-4">
        {subTab === "enviar" ? <EnviarView /> : <RecibirView />}
      </div>
    </div>
  );
}
