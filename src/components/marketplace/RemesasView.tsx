"use client";

import { useState, useEffect } from "react";
import { Globe2, Loader2, ExternalLink, AlertTriangle, Building2, Banknote } from "lucide-react";

interface RemittanceProvider {
  id: string;
  name: string;
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

const COUNTRY_NAMES: Record<string, string> = {
  CO: "Colombia", MX: "México", AR: "Argentina", BR: "Brasil", CL: "Chile",
  PE: "Perú", EC: "Ecuador", VE: "Venezuela", DO: "Rep. Dom.",
};

export default function RemesasView() {
  const [providers, setProviders] = useState<RemittanceProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [destCountry, setDestCountry] = useState("MX");
  const [amount, setAmount] = useState("100");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/providers?category=REMITTANCE`);
        if (!res.ok) return;
        const data = await res.json();
        setProviders(data.providers || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <Globe2 className="w-6 h-6 text-cyan-400" />
          Remesas
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Envía dinero internacionalmente usando cripto como infraestructura. Nosotros no
          custodiamos fondos — orquestamos la experiencia con proveedores especializados.
        </p>
      </div>

      {/* Compliance warning */}
      <div className="bg-amber-950/30 border border-amber-800/50 rounded-lg p-4 text-xs text-amber-300 mb-6 flex gap-2">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <div>
          <b>Reviso legal obligatoria.</b> Las remesas internacionales requieren licencia
          de remesador en cada país (en Colombia: Superfinanciera). Antes de activar cualquier
          provider en producción, debe pasar revisión legal. Por ahora esta vista solo muestra
          información de proveedores disponibles — no ejecuta transacciones.
        </div>
      </div>

      {/* Selector destino */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] text-slate-400">País destino</label>
            <select
              value={destCountry}
              onChange={(e) => setDestCountry(e.target.value)}
              className="mt-1 w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 text-sm"
            >
              {Object.entries(COUNTRY_NAMES).map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] text-slate-400">Monto a enviar (USDT)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 text-sm"
            />
          </div>
        </div>
        <div className="mt-3 text-[11px] text-slate-500">
          Origen: Colombia (asumido) · Destino: {COUNTRY_NAMES[destCountry]}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
        </div>
      ) : providers.length === 0 ? (
        <div className="text-center py-20 text-slate-500 border border-slate-800 rounded-xl">
          <Globe2 className="w-12 h-12 mx-auto mb-3 opacity-40" />
          No se encontraron proveedores de remesas cripto disponibles.
        </div>
      ) : (
        <div className="space-y-4">
          {providers.map((p) => {
            const supportsDest = p.countries.includes("ALL") || p.countries.includes(destCountry);
            return (
              <div
                key={p.id}
                className={`bg-slate-900 border rounded-xl p-5 ${
                  supportsDest
                    ? "border-emerald-800/50"
                    : "border-slate-800 opacity-60"
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{p.logoUrl || "🌐"}</span>
                    <div>
                      <h3 className="font-semibold text-slate-100">{p.name}</h3>
                      <p className="text-[11px] text-slate-500">
                        {supportsDest
                          ? `✓ Disponible en ${COUNTRY_NAMES[destCountry]}`
                          : `✗ No disponible en ${COUNTRY_NAMES[destCountry]}`}
                      </p>
                    </div>
                  </div>
                  {p.isLive ? (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-900/50 text-emerald-300">
                      Activo
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-amber-900/50 text-amber-300">
                      Requiere partnership
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs mb-3">
                  <div>
                    <div className="text-slate-500 text-[10px]">Países</div>
                    <div className="text-slate-200">
                      {p.countries.map((c) => COUNTRY_NAMES[c] || c).join(", ")}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-[10px]">Cripto soportada</div>
                    <div className="text-slate-200">{p.cryptos.join(", ")}</div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-[10px]">Redes</div>
                    <div className="text-slate-200">{p.networks.join(", ")}</div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-[10px]">KYC</div>
                    <div className="text-slate-200">
                      {p.kycRequired ? "Sí (proveedor)" : "No requerido"}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-[10px]">Integración</div>
                    <div className="text-slate-200">{p.integrationType}</div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-[10px]">Regulación</div>
                    <div className="text-slate-200">Requiere licencia</div>
                  </div>
                </div>

                {p.notes && (
                  <p className="text-[11px] text-slate-500 italic mb-3">{p.notes}</p>
                )}

                <div className="flex gap-2">
                  <a
                    href={p.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-200 inline-flex items-center gap-1"
                  >
                    <Building2 className="w-3 h-3" /> Web oficial <ExternalLink className="w-3 h-3" />
                  </a>
                  {p.documentationUrl && (
                    <a
                      href={p.documentationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-200 inline-flex items-center gap-1"
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

      {/* Flujo conceptual */}
      <div className="mt-8 bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-100 mb-3">
          ¿Cómo funcionaría el flujo?
        </h3>
        <div className="space-y-2 text-xs text-slate-400">
          <div className="flex items-start gap-2">
            <Banknote className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <b className="text-slate-200">1. Origen</b>: Usuario A en Colombia envía USDT
              desde su wallet a la dirección del proveedor (off-chain verification).
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Globe2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <div>
              <b className="text-slate-200">2. Proveedor</b>: Ejecuta conversión USDT → fiat
              del país destino y realiza payout al método elegido.
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Building2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
            <div>
              <b className="text-slate-200">3. Destino</b>: Usuario B en {COUNTRY_NAMES[destCountry]}
              recibe moneda local vía transferencia bancaria, cash pickup o wallet.
            </div>
          </div>
        </div>
        <p className="text-[10px] text-slate-500 mt-3 italic">
          ⚠️ No creamos un sistema informal de transferencia. El proveedor hace KYC en ambos
          extremos y es responsable del cumplimiento AML.
        </p>
      </div>
    </div>
  );
}
