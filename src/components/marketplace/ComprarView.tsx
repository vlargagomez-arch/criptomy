"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/lib/store";
import { Loader2, ShoppingBag, ExternalLink, AlertTriangle, CheckCircle2 } from "lucide-react";

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

export default function ComprarView() {
  const { user } = useApp();
  const [country, setCountry] = useState("CO");
  const [crypto, setCrypto] = useState("USDT");
  const [network, setNetwork] = useState("POLYGON");
  const [amount, setAmount] = useState("500");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<CompareResult[] | null>(null);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [purchaseResult, setPurchaseResult] = useState<{ url?: string; status?: string } | null>(null);

  const currency = COUNTRIES.find((c) => c.code === country)?.currency || "USD";

  const compare = async () => {
    setLoading(true);
    setResults(null);
    setPurchaseResult(null);
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

  const buy = async (providerId: string) => {
    if (!user) return;
    setPurchasing(providerId);
    setPurchaseResult(null);
    try {
      const res = await fetch("/api/onramp/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId,
          purchaseRequest: {
            crypto,
            network,
            amount: parseFloat(amount),
            amountType: "FIAT",
            currency,
            paymentMethod: "PSE", // simplificación
            walletAddress: user.walletAddress,
            country,
            redirectUrl: window.location.origin,
          },
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        setPurchaseResult({ status: "error: " + err.error });
        return;
      }
      const data = await res.json();
      setPurchaseResult({
        url: data.result?.redirectUrl,
        status: data.result?.status,
      });

      // Si hay redirect, abrir en nueva pestaña
      if (data.result?.redirectUrl) {
        window.open(data.result.redirectUrl, "_blank", "noopener,noreferrer");
      }
    } catch (e) {
      setPurchaseResult({ status: "error: " + (e as Error).message });
    } finally {
      setPurchasing(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <ShoppingBag className="w-6 h-6 text-emerald-400" />
          Comprar cripto
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Compara proveedores de on-ramp disponibles en tu país. KYC lo hace el proveedor, no
          nosotros. No custodiamos tus fondos.
        </p>
      </div>

      {!user && (
        <div className="bg-amber-950/30 border border-amber-800/50 rounded-lg p-3 text-xs text-amber-300 mb-4">
          <AlertTriangle className="w-4 h-4 inline mr-2" />
          Conecta tu wallet para comprar. Necesitamos una dirección destino.
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
          {results.map((r) => (
            <div
              key={r.providerId}
              className={`bg-slate-900 border ${
                r.available ? "border-emerald-800/50" : "border-slate-800"
              } rounded-xl p-4`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-2xl">{r.logo}</span>
                    <span className="font-semibold text-slate-100">{r.name}</span>
                    {!r.isReal && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-amber-900/50 text-amber-300 rounded uppercase">
                        MOCK
                      </span>
                    )}
                    {!r.isLive && r.isReal && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-slate-700 text-slate-300 rounded uppercase">
                        Requiere API key
                      </span>
                    )}
                    {r.kycRequired && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-blue-900/50 text-blue-300 rounded uppercase">
                        KYC
                      </span>
                    )}
                  </div>

                  {r.available ? (
                    <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div>
                        <div className="text-slate-500 text-[10px]">Comisión</div>
                        <div className="text-slate-200">
                          {r.fee ? `${r.fee} ${r.feeCurrency}` : "—"}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500 text-[10px]">Tiempo</div>
                        <div className="text-slate-200">{r.estimatedTime || "—"}</div>
                      </div>
                      <div>
                        <div className="text-slate-500 text-[10px]">Min/Max</div>
                        <div className="text-slate-200">
                          {r.minAmount || 0} / {r.maxAmount || 0}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500 text-[10px]">Integración</div>
                        <div className="text-slate-200">{r.integrationType || "API"}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 text-xs text-slate-500">
                      {r.reason || "No disponible para tu configuración"}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => buy(r.providerId)}
                  disabled={!r.available || !user || purchasing === r.providerId}
                  className="shrink-0 px-3 py-2 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {purchasing === r.providerId ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    "Comprar"
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {purchaseResult && (
        <div className="mt-4 p-3 bg-emerald-950/30 border border-emerald-800/50 rounded-lg text-xs">
          {purchaseResult.url ? (
            <>
              <CheckCircle2 className="w-4 h-4 inline text-emerald-400 mr-2" />
              Te redirigimos al proveedor. Si no se abrió, haz click:{" "}
              <a
                href={purchaseResult.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 underline inline-flex items-center gap-1"
              >
                Abrir <ExternalLink className="w-3 h-3" />
              </a>
            </>
          ) : (
            <span>{purchaseResult.status}</span>
          )}
        </div>
      )}
    </div>
  );
}
