"use client";

import { useState, useEffect } from "react";
import { CreditCard, Loader2, ExternalLink, AlertTriangle, CheckCircle2, Shield } from "lucide-react";

interface CardProvider {
  id: string;
  name: string;
  logoUrl?: string;
  websiteUrl: string;
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

const COUNTRY_NAMES: Record<string, string> = {
  CO: "Colombia", MX: "México", AR: "Argentina", BR: "Brasil", CL: "Chile",
  PE: "Perú", EC: "Ecuador", VE: "Venezuela", DO: "Rep. Dom.",
};

export default function TarjetaView() {
  const [providers, setProviders] = useState<CardProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [country, setCountry] = useState("CO");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/providers?category=CARD&country=${country}`);
        if (!res.ok) return;
        const data = await res.json();
        setProviders(data.providers || []);
      } finally {
        setLoading(false);
      }
    })();
  }, [country]);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <CreditCard className="w-6 h-6 text-purple-400" />
          Tarjeta cripto
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Solicita una tarjeta crypto de un proveedor especializado. No emitimos tarjetas propias,
          no almacenamos PAN ni CVV. La tarjeta vive en el sistema del emisor.
        </p>
      </div>

      {/* Compliance */}
      <div className="bg-amber-950/30 border border-amber-800/50 rounded-lg p-4 text-xs text-amber-300 mb-6 flex gap-2">
        <Shield className="w-4 h-4 shrink-0 mt-0.5" />
        <div>
          <b>No emitimos tarjetas.</b> Cada proveedor aquí listado tiene su propia licencia de
          emisor de tarjetas y regulation local. Verifica disponibilidad oficial en tu país antes
          de solicitar. No almacenamos PAN completo ni CVV — solo últimos 4 dígitos si la API lo provee.
        </div>
      </div>

      {/* Selector país */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6">
        <label className="text-[11px] text-slate-400">Tu país</label>
        <select
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className="mt-1 w-full sm:w-auto px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 text-sm"
        >
          {Object.entries(COUNTRY_NAMES).map(([code, name]) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
        </div>
      ) : providers.length === 0 ? (
        <div className="text-center py-20 text-slate-500 border border-slate-800 rounded-xl">
          <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-sm">
            No se encontraron proveedores de tarjetas cripto disponibles en {COUNTRY_NAMES[country]}.
          </p>
          <p className="text-xs mt-1">
            Verificamos disponibilidad oficial antes de mostrar cualquier proveedor.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {providers.map((p) => {
            const available = p.countries.includes("ALL") || p.countries.includes(country);
            return (
              <div
                key={p.id}
                className={`bg-slate-900 border rounded-xl p-5 ${
                  available ? "border-emerald-800/50" : "border-slate-800 opacity-60"
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-3xl">{p.logoUrl || "💳"}</span>
                    <div>
                      <h3 className="font-semibold text-slate-100">{p.name}</h3>
                      <p className="text-[10px] text-slate-500">
                        {available ? `✓ Disponible en ${COUNTRY_NAMES[country]}` : "Verificar disponibilidad"}
                      </p>
                    </div>
                  </div>
                  {p.isLive ? (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-900/50 text-emerald-300">
                      Activo
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-700 text-slate-300">
                      Verificación oficial requerida
                    </span>
                  )}
                </div>

                <div className="space-y-1.5 text-xs">
                  <div>
                    <span className="text-slate-500 text-[10px]">Países (verificados):</span>{" "}
                    <span className="text-slate-200">
                      {p.countries.map((c) => COUNTRY_NAMES[c] || c).join(", ")}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px]">Cripto:</span>{" "}
                    <span className="text-slate-200">{p.cryptos.join(", ")}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px]">Redes:</span>{" "}
                    <span className="text-slate-200">{p.networks.join(", ")}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px]">KYC:</span>{" "}
                    <span className="text-slate-200">{p.kycRequired ? "Sí (emisor)" : "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px]">Apple Pay / Google Pay:</span>{" "}
                    <span className="text-slate-200">
                      {p.integrationType === "SDK" ? "Probable" : "Verificar con emisor"}
                    </span>
                  </div>
                </div>

                {p.notes && (
                  <p className="text-[11px] text-slate-500 italic mt-2">{p.notes}</p>
                )}

                <div className="flex gap-2 mt-3">
                  <a
                    href={p.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 text-xs px-3 py-1.5 bg-purple-700 hover:bg-purple-600 rounded text-white text-center inline-flex items-center justify-center gap-1"
                  >
                    Solicitar <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Features list */}
      <div className="mt-8 bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-100 mb-3">
          Lo que el sistema soporta (cuando el emisor lo expone)
        </h3>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Solicitar tarjeta (virtual o física)
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Estado de emisión
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Últimos 4 dígitos
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Saldo y transacciones
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Congelar/descongelar (si la API lo permite)
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Vincular Apple Pay / Google Wallet
          </div>
        </div>
        <div className="mt-3 text-[10px] text-slate-500 flex gap-2">
          <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
          <span>
            NO almacenamos PAN completo ni CVV. Toda info sensible vive en el emisor. Nosotros
            solo mostramos lo que el emisor expone vía su API.
          </span>
        </div>
      </div>
    </div>
  );
}
