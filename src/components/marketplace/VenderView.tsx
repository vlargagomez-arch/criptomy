"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/lib/store";
import {
  TrendingDown, AlertTriangle, Info, ExternalLink, ShieldCheck, Wallet,
} from "lucide-react";

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

// Off-ramps con páginas públicas de venta (no requieren nuestra API key).
// Si el usuario va al sitio oficial, puede vender cripto ahí.
const OFFRAMP_DIRECT_URLS: Record<string, (params: {
  crypto: string;
  network: string;
  walletAddress: string;
  currency: string;
}) => string> = {
  moonpay: (p) => {
    const params = new URLSearchParams({
      currencyCode: p.crypto,
      walletAddress: p.walletAddress || "",
      baseCurrencyCode: p.currency,
    });
    return `https://sell.moonpay.com?${params.toString()}`;
  },
  transak: (p) => {
    const params = new URLSearchParams({
      cryptoCurrency: p.crypto,
      walletAddress: p.walletAddress || "",
      fiatCurrency: p.currency,
      isSell: "true",
    });
    return `https://global.transak.com?${params.toString()}`;
  },
};

interface OfframpProvider {
  id: string;
  name: string;
  logo: string;
  websiteUrl: string;
  docsUrl: string;
  countries: string[];
  kycRequired: boolean;
  payoutMethods: string[]; // métodos para recibir fiat
  notes: string;
  availableInCountry: boolean;
}

const OFFRAMP_PROVIDERS: OfframpProvider[] = [
  {
    id: "moonpay",
    name: "MoonPay Sell",
    logo: "🌙",
    websiteUrl: "https://sell.moonpay.com",
    docsUrl: "https://docs.moonpay.com/sell-onramp-api/introduction",
    countries: ["CO", "MX", "AR", "BR"],
    kycRequired: true,
    payoutMethods: ["Transferencia bancaria", "PIX (Brasil)", "SPEI (México)"],
    notes: "Off-ramp disponible en LATAM. Verificar payout methods actuales para Colombia.",
    availableInCountry: false, // se calcula en runtime
  },
  {
    id: "transak",
    name: "Transak Sell",
    logo: "🎯",
    websiteUrl: "https://global.transak.com",
    docsUrl: "https://docs.transak.com/sell-crypto/introduction",
    countries: ["CO", "MX", "BR"],
    kycRequired: true,
    payoutMethods: ["PSE", "Transferencia bancaria", "PIX", "SPEI"],
    notes: "Soporta PSE en Colombia. KYC completo requerido.",
    availableInCountry: false,
  },
];

export default function VenderView() {
  const { user, setTab } = useApp();
  const [country, setCountry] = useState("CO");
  const [crypto, setCrypto] = useState("USDT");
  const [network, setNetwork] = useState("POLYGON");
  const [amount, setAmount] = useState("100");

  const currency = COUNTRIES.find((c) => c.code === country)?.currency || "USD";

  // Marcar disponibilidad según país seleccionado
  const providers = OFFRAMP_PROVIDERS.map((p) => ({
    ...p,
    availableInCountry: p.countries.includes(country),
  }));

  const openOfframp = (providerId: string) => {
    const builder = OFFRAMP_DIRECT_URLS[providerId];
    if (!builder) return;
    const url = builder({
      crypto,
      network,
      walletAddress: user?.walletAddress || "",
      currency,
    });
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <TrendingDown className="w-6 h-6 text-amber-400" />
          Vender cripto
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Convierte USDT/USDC/ETH a moneda local. Te redirigimos al off-ramp oficial —
          KYC y payout lo hace el proveedor, no nosotros.
        </p>
      </div>

      {/* Panel explicativo */}
      <div className="mb-6 bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Info className="w-4 h-4 text-amber-400" />
          <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wide">
            ¿Cómo funciona?
          </h3>
        </div>
        <ol className="text-[12px] text-slate-400 space-y-1.5 list-decimal pl-4">
          <li>Selecciona país, cripto, red y cantidad a vender.</li>
          <li>
            <b className="text-slate-200">Compara</b> los off-ramps disponibles en tu país
            (MoonPay Sell, Transak Sell) con sus payout methods.
          </li>
          <li>
            <b className="text-slate-200">Click en "Vender"</b> — te redirige al sitio oficial
            del proveedor con parámetros prellenados.
          </li>
          <li>
            <b className="text-slate-200">El proveedor verifica KYC</b> y tú envías la cripto
            a su dirección. Ellos te transfieren el fiat a tu cuenta bancaria o método elegido.
          </li>
          <li>
            <b className="text-slate-200">Recibes el fiat</b> en 1-2 días hábiles. La cripto
            nunca pasa por nosotros.
          </li>
        </ol>
        <div className="mt-3 pt-3 border-t border-slate-800/50 flex items-center gap-2 text-[10px] text-slate-400">
          <ShieldCheck className="w-3 h-3 text-emerald-400" />
          No custodiamos cripto ni fiat. El off-ramp es servicio financiero regulado prestado por terceros.
        </div>
      </div>

      {/* Wallet warning */}
      {!user && (
        <div className="bg-amber-950/30 border border-amber-800/50 rounded-lg p-3 text-xs text-amber-300 mb-4 flex items-start gap-2">
          <Wallet className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <b>Conecta tu wallet</b> para vender — el proveedor necesita saber desde dónde
            enviarás la cripto.
          </div>
        </div>
      )}

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
                <option key={c} value={c}>
                  {c}
                </option>
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
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] text-slate-400">Cantidad ({crypto})</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-100 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Lista de off-ramps */}
      <h3 className="text-xs uppercase tracking-wide text-slate-500 mb-3">
        Off-ramps disponibles en {country}
      </h3>
      <div className="space-y-3 mb-6">
        {providers.map((p) => (
          <div
            key={p.id}
            className={`bg-slate-900 border ${
              p.availableInCountry ? "border-emerald-800/50" : "border-slate-800 opacity-60"
            } rounded-xl p-4`}
          >
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span className="text-2xl">{p.logo}</span>
                  <span className="font-semibold text-slate-100">{p.name}</span>
                  {p.availableInCountry ? (
                    <span className="text-[10px] px-1.5 py-0.5 bg-emerald-900/50 text-emerald-300 rounded uppercase">
                      ✓ Disponible en {country}
                    </span>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded uppercase">
                      No disponible en {country}
                    </span>
                  )}
                  {p.kycRequired && (
                    <span
                      className="text-[10px] px-1.5 py-0.5 bg-blue-900/50 text-blue-300 rounded uppercase cursor-help"
                      title="El proveedor requiere verificación de identidad. Lo hace él, no nosotros."
                    >
                      KYC
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-400 space-y-1">
                  <div>
                    <b className="text-slate-300">Payout methods:</b> {p.payoutMethods.join(", ")}
                  </div>
                  <div>
                    <b className="text-slate-300">Países:</b> {p.countries.join(", ")}
                  </div>
                  <div className="italic text-[11px] text-slate-500">{p.notes}</div>
                </div>
              </div>

              {p.availableInCountry ? (
                <button
                  onClick={() => openOfframp(p.id)}
                  className="shrink-0 px-4 py-2 text-xs bg-amber-600 hover:bg-amber-500 text-white rounded inline-flex items-center gap-1.5"
                >
                  Vender en {p.name}
                  <ExternalLink className="w-3 h-3" />
                </button>
              ) : null}
            </div>

            <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
              <div className="text-[10px] text-slate-500">
                💡 Serás redirigido al sitio oficial. Ellos hacen el KYC y procesan el payout.
              </div>
              <a
                href={p.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-slate-400 hover:text-slate-200 inline-flex items-center gap-1"
              >
                Docs <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* Alternativa P2P */}
      <div className="bg-emerald-950/30 border border-emerald-800/50 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-slate-100 mb-2 flex items-center gap-2">
          💡 Alternativa sin KYC: Mercado P2P
        </h3>
        <p className="text-xs text-slate-400 mb-3">
          Si no quieres pasar por KYC de un off-ramp, usa el <b className="text-emerald-400">Mercado P2P</b>:
          publica una oferta "Vender USDT por COP" y otros usuarios te compran vía
          transferencia bancaria, Nequi, Daviplata, PSE. Sin KYC, sin custodia, sin intermediarios.
        </p>
        <button
          onClick={() => setTab("mercado-p2p")}
          className="text-xs px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded inline-flex items-center gap-1"
        >
          Ir al Mercado P2P →
        </button>
      </div>

      {/* Disclaimer */}
      <div className="mt-6 text-[10px] text-slate-500 flex items-start gap-2">
        <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5 text-amber-400" />
        <div>
          El off-ramp es un servicio financiero regulado. Antes de activarlo en producción
          debe pasar revisión legal en cada país. No prometemos disponibilidad hasta verificar
          con cada proveedor oficialmente. Las comisiones y payout methods mostrados son
          referenciales y pueden cambiar.
        </div>
      </div>
    </div>
  );
}
