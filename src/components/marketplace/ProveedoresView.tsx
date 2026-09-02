"use client";

import { useState, useEffect } from "react";
import { Loader2, Grid3x3, ExternalLink, ShieldCheck, AlertTriangle } from "lucide-react";

interface ProviderInfo {
  id: string;
  name: string;
  category: string;
  logoUrl?: string;
  websiteUrl: string;
  documentationUrl?: string;
  countries: string[];
  cryptos: string[];
  networks: string[];
  kycRequired: boolean;
  isReal: boolean;
  isLive: boolean;
  apiKeyRequired: boolean;
  integrationType: string;
  notes?: string;
}

const CATEGORIES = [
  { id: "WALLET", label: "Wallets", icon: "👛" },
  { id: "ON_RAMP", label: "On-Ramp (comprar)", icon: "🛒" },
  { id: "OFF_RAMP", label: "Off-Ramp (vender)", icon: "💸" },
  { id: "CARD", label: "Tarjetas crypto", icon: "💳" },
  { id: "REMITTANCE", label: "Remesas", icon: "🌐" },
  { id: "MARKET_DATA", label: "Precios", icon: "📊" },
];

const COUNTRY_CODE_TO_NAME: Record<string, string> = {
  CO: "Colombia", MX: "México", AR: "Argentina", BR: "Brasil", CL: "Chile",
  PE: "Perú", EC: "Ecuador", VE: "Venezuela", DO: "Rep. Dom.",
  ALL: "Todos", US: "EEUU", EU: "Europa",
};

export default function ProveedoresView() {
  const [category, setCategory] = useState<string>("");
  const [country, setCountry] = useState<string>("CO");
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (category) params.append("category", category);
        if (country) params.append("country", country);
        const res = await fetch(`/api/providers?${params}`);
        if (!res.ok) return;
        const data = await res.json();
        setProviders(data.providers || []);
      } finally {
        setLoading(false);
      }
    })();
  }, [category, country]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <Grid3x3 className="w-6 h-6 text-cyan-400" />
          Directorio de Proveedores
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Todos los proveedores integrables. Filtra por categoría y país. Vemos claramente cuáles
          están activos (verde), cuáles requieren API key (ámbar), y cuáles necesitan verificación
          legal antes de activarse.
        </p>
      </div>

      {/* Filtros */}
      <div className="space-y-3 mb-6">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
          <button
            onClick={() => setCategory("")}
            className={`shrink-0 px-3 py-1.5 text-xs font-medium rounded-md ${
              !category ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-300"
            }`}
          >
            Todas las categorías
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              className={`shrink-0 px-3 py-1.5 text-xs font-medium rounded-md ${
                category === c.id ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-300"
              }`}
            >
              {c.icon} {c.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-800 border border-slate-700 rounded text-slate-100"
          >
            <option value="">Todos los países</option>
            <option value="CO">Colombia</option>
            <option value="MX">México</option>
            <option value="AR">Argentina</option>
            <option value="BR">Brasil</option>
            <option value="CL">Chile</option>
            <option value="PE">Perú</option>
            <option value="EC">Ecuador</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
        </div>
      ) : providers.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          No se encontraron proveedores con estos filtros.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {providers.map((p) => {
            const cat = CATEGORIES.find((c) => c.id === p.category);
            return (
              <div
                key={p.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{p.logoUrl || "•"}</span>
                    <div>
                      <h3 className="font-semibold text-slate-100 text-sm">{p.name}</h3>
                      <p className="text-[10px] text-slate-500">{cat?.label || p.category}</p>
                    </div>
                  </div>
                  {p.isLive ? (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-900/50 text-emerald-300 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" /> Activo
                    </span>
                  ) : p.isReal ? (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-amber-900/50 text-amber-300 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> API key
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-700 text-slate-300">
                      MOCK
                    </span>
                  )}
                </div>

                <div className="text-xs text-slate-400 space-y-1 mt-2 flex-1">
                  <div>
                    <b>Países:</b>{" "}
                    {p.countries.map((c) => COUNTRY_CODE_TO_NAME[c] || c).join(", ")}
                  </div>
                  <div>
                    <b>Criptos:</b> {p.cryptos.slice(0, 4).join(", ")}
                    {p.cryptos.length > 4 && ` +${p.cryptos.length - 4}`}
                  </div>
                  <div>
                    <b>Redes:</b> {p.networks.slice(0, 3).join(", ")}
                    {p.networks.length > 3 && ` +${p.networks.length - 3}`}
                  </div>
                  <div>
                    <b>KYC:</b>{" "}
                    {p.kycRequired ? "Sí (lo hace el proveedor)" : "No requerido"}
                  </div>
                  <div>
                    <b>Integración:</b> {p.integrationType}
                  </div>
                </div>

                {p.notes && (
                  <p className="text-[10px] text-slate-500 mt-2 italic line-clamp-2">{p.notes}</p>
                )}

                <div className="flex gap-2 mt-3">
                  <a
                    href={p.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 text-xs px-2 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-200 text-center inline-flex items-center justify-center gap-1"
                  >
                    Web <ExternalLink className="w-3 h-3" />
                  </a>
                  {p.documentationUrl && (
                    <a
                      href={p.documentationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 text-xs px-2 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-200 text-center inline-flex items-center justify-center gap-1"
                    >
                      Docs <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
