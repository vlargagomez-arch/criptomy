"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/lib/store";
import { Loader2, ShoppingBag, ExternalLink, AlertTriangle, Info, ShieldCheck, Wallet } from "lucide-react";

interface CompareResult {
  providerId: string;
  name: string;
  logo: string;
  isReal: boolean;
  isLive: boolean;
  available: boolean;
  reason?: string;
  fee?: number;
  feeCurrency?: string;
  rate?: number;
  estimatedTime?: string;
  minAmount?: number;
  maxAmount?: number;
  kycRequired?: boolean;
  countries?: string[];
  documentationUrl?: string;
  integrationType?: string;
}

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

// URLs públicas de cada on-ramp — el usuario puede comprar directamente en su sitio.
// No requieren nuestra API key. Solo redirigimos con parámetros prellenados.
// Estas URLs son públicas y están documentadas oficialmente por cada proveedor.
const ONRAMP_DIRECT_URLS: Record<string, (params: {
  crypto: string;
  network: string;
  walletAddress: string;
  currency: string;
  country: string;
}) => string> = {
  moonpay: (p) => {
    // URL pública de MoonPay (no requiere nuestra API key, el usuario entra como visitante)
    const params = new URLSearchParams({
      currencyCode: p.crypto,
      walletAddress: p.walletAddress || "",
      baseCurrencyCode: p.currency,
    });
    return `https://buy.moonpay.com?${params.toString()}`;
  },
  transak: (p) => {
    // URL pública de Transak (no requiere nuestra API key)
    const params = new URLSearchParams({
      cryptoCurrency: p.crypto,
      walletAddress: p.walletAddress || "",
      fiatCurrency: p.currency,
      networks: p.network.toLowerCase(),
    });
    return `https://global.transak.com?${params.toString()}`;
  },
  ramp: (p) => {
    // URL pública de Ramp Network
    return `https://ramp.network/buy?swapAsset=${p.crypto}&userAddress=${p.walletAddress || ""}`;
  },
  "coinbase-onramp": (p) => {
    // URL pública de Coinbase Onramp
    return `https://www.coinbase.com/buy?asset=${p.crypto}&destination=${p.walletAddress || ""}`;
  },
};

export default function ComprarView() {
  const { user } = useApp();
  const [country, setCountry] = useState("CO");
  const [crypto, setCrypto] = useState("USDT");
  const [network, setNetwork] = useState("POLYGON");
  const [amount, setAmount] = useState("500");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<CompareResult[] | null>(null);

  const currency = COUNTRIES.find((c) => c.code === country)?.currency || "USD";

  const compare = async () => {
    setLoading(true);
    setResults(null);
    try {
      const res = await fetch(
        `/api/onramp/compare?country=${country}&crypto=${crypto}&network=${network}&amount=${amount}&currency=${currency}`
      );
      if (!res.ok) return;
      const data = await res.json();
      setResults(data.results || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    compare();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country, crypto, network, amount]);

  // Abrir el on-ramp directamente en el navegador del usuario.
  // No pasa por nuestro backend (no tenemos API key), pero el usuario
  // puede completar la compra en el sitio oficial del proveedor.
  const openOnramp = (providerId: string) => {
    const builder = ONRAMP_DIRECT_URLS[providerId];
    if (!builder) return;
    const url = builder({
      crypto,
      network,
      walletAddress: user?.walletAddress || "",
      currency,
      country,
    });
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <ShoppingBag className="w-6 h-6 text-emerald-400" />
          Comprar cripto
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Compara proveedores on-ramp disponibles en tu país y compra directamente en su sitio oficial.
          KYC lo hace el proveedor, no nosotros. No custodiamos tus fondos.
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
          <li>Selecciona tu país, cripto, red y monto.</li>
          <li>
            <b className="text-slate-200">El sistema compara</b> los on-ramps disponibles
            (MoonPay, Transak, Ramp, Coinbase) y te muestra comisiones, tiempo, KYC.
          </li>
          <li>
            <b className="text-slate-200">Click en "Comprar"</b> — te redirige al sitio oficial
            del proveedor con tu wallet, cripto y monto prellenados.
          </li>
          <li>
            <b className="text-slate-200">Completas el pago</b> en el sitio del proveedor (PSE,
            tarjeta, etc.) y el KYC si lo requiere.
          </li>
          <li>
            <b className="text-slate-200">La cripto llega a tu wallet</b> — nunca pasa por nosotros.
          </li>
        </ol>
        <div className="mt-3 pt-3 border-t border-slate-800/50 flex items-center gap-2 text-[10px] text-slate-400">
          <ShieldCheck className="w-3 h-3 text-emerald-400" />
          No custodiamos fondos. No tocamos tus claves. Solo te conectamos con proveedores regulados.
        </div>
      </div>

      {/* Wallet warning */}
      {!user && (
        <div className="bg-amber-950/30 border border-amber-800/50 rounded-lg p-3 text-xs text-amber-300 mb-4 flex items-start gap-2">
          <Wallet className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <b>Conecta tu wallet</b> para que el proveedor sepa dónde enviar la cripto. Sin wallet
            conectada puedes ver la comparación pero no comprar.
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
            <label className="text-[11px] text-slate-400">Monto ({currency})</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-100 text-sm"
            />
          </div>
        </div>
        {user && (
          <div className="mt-3 text-[11px] text-slate-500">
            Wallet destino: <code className="text-slate-300 font-mono">{user.walletAddress.slice(0, 10)}…{user.walletAddress.slice(-6)}</code>
          </div>
        )}
      </div>

      {/* Resultados */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
        </div>
      ) : results === null ? null : results.length === 0 ? (
        <div className="text-center py-12 text-slate-500 border border-slate-800 rounded-xl">
          No se encontraron proveedores on-ramp para tu configuración.
        </div>
      ) : (
        <div className="space-y-3">
          {results.map((r) => {
            const isAvailable = r.available && r.isReal;
            const directUrlBuilder = ONRAMP_DIRECT_URLS[r.providerId];

            return (
              <div
                key={r.providerId}
                className={`bg-slate-900 border ${
                  isAvailable ? "border-emerald-800/50" : "border-slate-800"
                } rounded-xl p-4`}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-2xl">{r.logo}</span>
                      <span className="font-semibold text-slate-100">{r.name}</span>
                      {r.isReal && r.countries?.includes(country) && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-emerald-900/50 text-emerald-300 rounded uppercase">
                          ✓ Disponible en {country}
                        </span>
                      )}
                      {r.kycRequired && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 bg-blue-900/50 text-blue-300 rounded uppercase cursor-help"
                          title="El proveedor requiere verificación de identidad (gov ID, selfie). Lo hace el proveedor, no nosotros."
                        >
                          KYC
                        </span>
                      )}
                      {r.integrationType && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded uppercase">
                          {r.integrationType}
                        </span>
                      )}
                    </div>

                    {isAvailable ? (
                      <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                        {r.fee !== undefined && (
                          <div title="Comisión estimada del proveedor">
                            <div className="text-slate-500 text-[10px]">Comisión est.</div>
                            <div className="text-slate-200">
                              {r.fee ? `${r.fee} ${r.feeCurrency}` : "Variable"}
                            </div>
                          </div>
                        )}
                        {r.estimatedTime && (
                          <div title="Tiempo estimado de entrega de la cripto">
                            <div className="text-slate-500 text-[10px]">Tiempo</div>
                            <div className="text-slate-200">{r.estimatedTime}</div>
                          </div>
                        )}
                        {(r.minAmount || r.maxAmount) && (
                          <div title="Monto mínimo y máximo por operación">
                            <div className="text-slate-500 text-[10px]">Min/Max ({r.feeCurrency})</div>
                            <div className="text-slate-200">
                              {r.minAmount || "—"} / {r.maxAmount || "—"}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="mt-2 text-xs text-slate-500">
                        {r.reason || "No disponible para tu configuración"}
                      </div>
                    )}
                  </div>

                  {/* CTA: SIEMPRE disponible si es real, aún sin wallet conectada */}
                  {isAvailable && directUrlBuilder ? (
                    <button
                      onClick={() => openOnramp(r.providerId)}
                      className="shrink-0 px-4 py-2 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded inline-flex items-center gap-1.5"
                      title={`Ir al sitio oficial de ${r.name} con tus parámetros prellenados`}
                    >
                      Comprar en {r.name}
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  ) : !isAvailable ? (
                    <span className="shrink-0 text-[10px] text-slate-500 italic">
                      No disponible en {country}
                    </span>
                  ) : null}
                </div>

                {/* Footer con info del proveedor */}
                {isAvailable && (
                  <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between gap-2 flex-wrap">
                    <div className="text-[10px] text-slate-500">
                      💡 Serás redirigido al sitio oficial de {r.name}. Ellos hacen el KYC y procesan
                      el pago. Nosotros no tocamos tus fondos ni tus datos.
                    </div>
                    {r.documentationUrl && (
                      <a
                        href={r.documentationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-slate-400 hover:text-slate-200 inline-flex items-center gap-1"
                      >
                        Docs <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Disclaimer */}
      <div className="mt-6 text-[10px] text-slate-500 flex items-start gap-2">
        <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5 text-amber-400" />
        <div>
          Las comisiones y disponibilidad mostradas son referenciales. El proveedor confirma el
          precio final al iniciar la compra. Verifica siempre la URL del proveedor antes de
          ingresar datos (debe ser https:// y el dominio oficial).
        </div>
      </div>
    </div>
  );
}
