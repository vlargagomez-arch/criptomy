"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/lib/store";
import { ShoppingBag, Info, ShieldCheck, Wallet, Lock, Settings, ExternalLink, ArrowRight } from "lucide-react";

const COUNTRIES = [
  { code: "CO", name: "Colombia", currency: "COP" },
  { code: "MX", name: "México", currency: "MXN" },
  { code: "AR", name: "Argentina", currency: "ARS" },
  { code: "BR", name: "Brasil", currency: "BRL" },
  { code: "CL", name: "Chile", currency: "CLP" },
  { code: "PE", name: "Perú", currency: "PEN" },
];

const CRYPTOS = ["USDT", "USDC", "ETH", "BTC"];
const NETWORKS = ["POLYGON", "ETHEREUM", "BASE", "ARBITRUM", "BSC"];

export default function ComprarView() {
  const { user, setTab } = useApp();
  const [country, setCountry] = useState("CO");
  const [crypto, setCrypto] = useState("USDT");
  const [network, setNetwork] = useState("POLYGON");
  const [amount, setAmount] = useState("500");

  const currency = COUNTRIES.find((c) => c.code === country)?.currency || "USD";

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <ShoppingBag className="w-6 h-6 text-emerald-400" />
          Comprar cripto
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Compra cripto dentro de CriptoMy. Sin salir de la web. Sin redirigir a terceros.
        </p>
      </div>

      {/* Panel explicativo */}
      <div className="mb-6 bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Info className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wide">
            ¿Cómo funciona?
          </h3>
        </div>
        <ol className="text-[12px] text-slate-400 space-y-1.5 list-decimal pl-4">
          <li>Selecciona país, cripto, red y monto.</li>
          <li>
            <b className="text-slate-200">El sistema muestra</b> los on-ramps disponibles
            con comisiones, tiempo y KYC — todo dentro de la web.
          </li>
          <li>
            <b className="text-slate-200">Completas la compra</b> en el widget embebido
            (NO sales de CriptoMy).
          </li>
          <li>
            <b className="text-slate-200">La cripto llega a tu wallet</b> conectada.
          </li>
        </ol>
        <div className="mt-3 pt-3 border-t border-slate-800/50 flex items-center gap-2 text-[10px] text-slate-400">
          <ShieldCheck className="w-3 h-3 text-emerald-400" />
          No redirigimos a sitios externos. Todo ocurre dentro de CriptoMy.
        </div>
      </div>

      {/* Form */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="text-[11px] text-slate-400">País</label>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="mt-1 w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-100 text-sm"
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name} ({c.currency})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] text-slate-400">Cripto</label>
            <select
              value={crypto}
              onChange={(e) => setCrypto(e.target.value)}
              className="mt-1 w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-100 text-sm"
            >
              {CRYPTOS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] text-slate-400">Red</label>
            <select
              value={network}
              onChange={(e) => setNetwork(e.target.value)}
              className="mt-1 w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-100 text-sm"
            >
              {NETWORKS.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] text-slate-400">Monto ({currency})</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-100 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Estado: NO disponible — Requiere configuración */}
      <div className="bg-amber-950/30 border border-amber-800/50 rounded-xl p-6 text-center">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Lock className="w-6 h-6 text-amber-400" />
          <h3 className="text-lg font-bold text-slate-100">
            Comprar cripto requiere configuración
          </h3>
        </div>
        <p className="text-sm text-slate-400 mb-4 max-w-lg mx-auto">
          Para comprar cripto dentro de CriptoMy (sin salir de la web), necesitamos
          integrar el widget de un on-ramp. Los proveedores disponibles
          (<b>MoonPay</b>, <b>Transak</b>) requieren una <b className="text-amber-300">API key gratuita</b> que
          se obtiene creando una cuenta de developer en su sitio.
        </p>

        {/* Lista de qué se necesita */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 mb-4 text-left max-w-lg mx-auto">
          <div className="flex items-center gap-2 mb-3">
            <Settings className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-semibold text-slate-200 uppercase">
              Lo que falta configurar
            </span>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <div className="text-sm font-medium text-slate-100">🌙 MoonPay</div>
                <div className="text-[10px] text-slate-500">
                  Widget embebido. Disponible en Colombia. KYC lo hace MoonPay.
                </div>
              </div>
              <a
                href="https://www.moonpay.com/business"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded inline-flex items-center gap-1 shrink-0"
              >
                Obtener key <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-slate-100">🎯 Transak</div>
                <div className="text-[10px] text-slate-500">
                  SDK iframe. Soporta PSE y Bancolombia en Colombia.
                </div>
              </div>
              <a
                href="https://transak.com/partners"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded inline-flex items-center gap-1 shrink-0"
              >
                Obtener key <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-800 text-[10px] text-slate-500">
            Una vez que tengas la API key, agrégala en Vercel → Settings → Environment Variables:
            <code className="block mt-1 text-slate-300 font-mono">NEXT_PUBLIC_MOONPAY_API_KEY</code>
            <code className="block text-slate-300 font-mono">NEXT_PUBLIC_TRANSAK_API_KEY</code>
          </div>
        </div>

        {/* Alternativa: Mercado P2P */}
        <div className="bg-emerald-950/30 border border-emerald-800/50 rounded-lg p-4 max-w-lg mx-auto">
          <h4 className="text-sm font-semibold text-slate-100 mb-2 flex items-center gap-2">
            💡 Alternativa disponible AHORA: Mercado P2P
          </h4>
          <p className="text-xs text-slate-400 mb-3">
            Si no quieres esperar a la configuración del on-ramp, puedes comprar cripto
            <b className="text-emerald-400"> persona-a-persona</b> dentro de CriptoMy.
            Otros usuarios venden USDT/BTC/ETH por COP, MXN, ARS vía transferencia bancaria,
            Nequi, PSE — todo dentro de la web, sin KYC, sin salir.
          </p>
          <button
            onClick={() => setTab("mercado-p2p")}
            className="text-xs px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded inline-flex items-center gap-1.5"
          >
            Ir al Mercado P2P
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-6 text-[10px] text-slate-500 flex items-start gap-2">
        <Info className="w-3 h-3 shrink-0 mt-0.5 text-slate-500" />
        <div>
          Cuando se configuren las API keys, el widget de MoonPay/Transak se embeberá aquí
          dentro (iframe). El usuario completa el pago sin salir de CriptoMy.
          No redirigimos a sitios externos.
        </div>
      </div>
    </div>
  );
}
