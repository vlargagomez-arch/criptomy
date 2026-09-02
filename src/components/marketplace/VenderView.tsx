"use client";

import { TrendingDown, AlertTriangle, Info, ExternalLink } from "lucide-react";
import { useApp } from "@/lib/store";

// Vista HONESTA: el módulo de off-ramp no está activo todavía.
// No simulamos transacciones. Mostramos claramente el estado y los
// providers reales que se integrarán cuando tengamos API keys.

const OFFRAMP_PROVIDERS = [
  {
    id: "moonpay-offramp",
    name: "MoonPay Sell",
    logo: "🌙",
    docsUrl: "https://docs.moonpay.com/sell-onramp-api/introduction",
    website: "https://moonpay.com",
    countries: ["CO", "MX", "AR", "BR"],
    kycRequired: true,
    notes: "Off-ramp disponible en LATAM. Verificar payout methods Colombia (Bancolombia, Nequi).",
  },
  {
    id: "transak-offramp",
    name: "Transak Sell",
    logo: "🎯",
    docsUrl: "https://docs.transak.com/sell-crypto/introduction",
    website: "https://transak.com",
    countries: ["CO", "MX", "BR"],
    kycRequired: true,
    notes: "Soporta PSE y transferencias bancarias en Colombia.",
  },
];

const COUNTRY_NAMES: Record<string, string> = {
  CO: "Colombia", MX: "México", AR: "Argentina", BR: "Brasil",
};

export default function VenderView() {
  const { user } = useApp();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <TrendingDown className="w-6 h-6 text-amber-400" />
          Vender cripto
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Convierte USDT/USDC/ETH a moneda local y recíbelo en tu cuenta bancaria.
        </p>
      </div>

      {/* Estado honesto */}
      <div className="bg-amber-950/30 border border-amber-800/50 rounded-lg p-4 text-xs text-amber-300 mb-6 flex gap-2">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <div>
          <b>Estado actual: No activo todavía.</b> El módulo de off-ramp requiere:
          <ol className="list-decimal ml-4 mt-1">
            <li>API key del provider (MoonPay Sell o Transak Sell)</li>
            <li>Verificar payout methods disponibles en Colombia</li>
            <li>Revisión legal (off-ramp es servicio financiero regulado)</li>
          </ol>
          <p className="mt-2">
            La arquitectura ya está lista. Cuando se configure el API key, esta vista
            funcionará igual que el módulo de Comprar.
          </p>
        </div>
      </div>

      {/* Providers disponibles para futura integración */}
      <h2 className="text-sm font-semibold text-slate-200 mb-3">
        Providers reales disponibles para integración:
      </h2>
      <div className="space-y-3 mb-6">
        {OFFRAMP_PROVIDERS.map((p) => (
          <div
            key={p.id}
            className="bg-slate-900 border border-slate-800 rounded-xl p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{p.logo}</span>
                <div>
                  <div className="font-semibold text-slate-100">{p.name}</div>
                  <div className="text-[11px] text-slate-500">
                    Países: {p.countries.map((c) => COUNTRY_NAMES[c] || c).join(", ")} ·
                    KYC: {p.kycRequired ? "Sí (provider)" : "No"}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <a
                  href={p.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-2 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-200 inline-flex items-center gap-1"
                >
                  Docs <ExternalLink className="w-3 h-3" />
                </a>
                <a
                  href={p.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-2 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-200 inline-flex items-center gap-1"
                >
                  Web <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
            {p.notes && (
              <p className="text-[11px] text-slate-500 italic mt-2">{p.notes}</p>
            )}
          </div>
        ))}
      </div>

      {/* Alternativa: usar Mercado P2P */}
      <div className="bg-slate-900 border border-emerald-800/50 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-100 mb-2">
          ¿Necesitas vender cripto ahora mismo?
        </h3>
        <p className="text-xs text-slate-400 mb-3">
          Usa el <b className="text-emerald-400">Mercado P2P</b>: publica una oferta de
          "Vender USDT por COP" y otros usuarios pueden comprártelo vía transferencia
          bancaria, Nequi, Daviplata, PSE. Sin KYC, sin custodia, sin intermediarios.
        </p>
        {user ? (
          <a
            href="/?tab=mercado-p2p"
            className="inline-block text-xs px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded"
          >
            Ir al Mercado P2P →
          </a>
        ) : (
          <p className="text-xs text-slate-500">Conecta tu wallet para usar el mercado P2P.</p>
        )}
      </div>

      {/* Warning compliance */}
      <div className="mt-6 text-[11px] text-slate-500 flex gap-2">
        <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
        <span>
          El off-ramp es un servicio financiero regulado. Antes de activarlo, debe pasar
          revisión legal en cada país. No prometemos rentabilidad ni disponibilidad hasta
          verificar con cada proveedor oficialmente.
        </span>
      </div>
    </div>
  );
}
