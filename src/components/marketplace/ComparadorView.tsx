"use client";

import { useState } from "react";
import { useApp } from "@/lib/store";
import { LineChart, Loader2, TrendingDown, ShoppingBag } from "lucide-react";

type Mode = "BUY" | "SELL";

const COUNTRIES = [
  { code: "CO", name: "Colombia", currency: "COP" },
  { code: "MX", name: "México", currency: "MXN" },
  { code: "AR", name: "Argentina", currency: "ARS" },
  { code: "BR", name: "Brasil", currency: "BRL" },
  { code: "CL", name: "Chile", currency: "CLP" },
  { code: "PE", name: "Perú", currency: "PEN" },
];

const CRYPTOS = ["USDT", "USDC", "ETH", "BTC"];
const NETWORKS = ["POLYGON", "ETHEREUM", "BASE", "ARBITRUM"];

interface CompareRow {
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
}

export default function ComparadorView() {
  const { setTab } = useApp();
  const [mode, setMode] = useState<Mode>("BUY");
  const [country, setCountry] = useState("CO");
  const [crypto, setCrypto] = useState("USDT");
  const [network, setNetwork] = useState("POLYGON");
  const [amount, setAmount] = useState("500");
  const [sortBy, setSortBy] = useState<"fee" | "time" | "kyc">("fee");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<CompareRow[] | null>(null);

  const currency = COUNTRIES.find((c) => c.code === country)?.currency || "USD";

  const compare = async () => {
    setLoading(true);
    setRows(null);
    try {
      const res = await fetch(
        `/api/onramp/compare?country=${country}&crypto=${crypto}&network=${network}&amount=${amount}&currency=${currency}`
      );
      if (!res.ok) return;
      const data = await res.json();
      let results: CompareRow[] = data.results || [];
      results = results.filter((r) => r.available);
      results.sort((a, b) => {
        if (sortBy === "fee") return (a.fee || 0) - (b.fee || 0);
        if (sortBy === "kyc") return (a.kycRequired ? 1 : 0) - (b.kycRequired ? 1 : 0);
        // time: no es fácil comparar texto; dejamos "fee" como default
        return (a.fee || 0) - (b.fee || 0);
      });
      setRows(results);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <LineChart className="w-6 h-6 text-teal-400" />
          Comparador de proveedores
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Compara comisiones, tiempo estimado y KYC entre todos los providers disponibles para tu
          caso de uso. Ordena por mejor precio, menor comisión o menor KYC.
        </p>
      </div>

      {/* Form */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6 space-y-3">
        {/* Mode toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setMode("BUY")}
            className={`flex-1 py-2 text-sm font-medium rounded flex items-center justify-center gap-2 ${
              mode === "BUY"
                ? "bg-emerald-600 text-white"
                : "bg-slate-800 text-slate-300"
            }`}
          >
            <ShoppingBag className="w-4 h-4" /> Comprar cripto
          </button>
          <button
            onClick={() => setMode("SELL")}
            className={`flex-1 py-2 text-sm font-medium rounded flex items-center justify-center gap-2 ${
              mode === "SELL"
                ? "bg-amber-600 text-white"
                : "bg-slate-800 text-slate-300"
            }`}
          >
            <TrendingDown className="w-4 h-4" /> Vender cripto
          </button>
        </div>

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
                  {c.name}
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
                <option key={c}>{c}</option>
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
                <option key={n}>{n}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] text-slate-400">
              {mode === "BUY" ? `Monto (${currency})` : `Cantidad ${crypto}`}
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-100 text-sm"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400">Ordenar por:</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as never)}
            className="px-2 py-1 text-xs bg-slate-800 border border-slate-700 rounded text-slate-100"
          >
            <option value="fee">Menor comisión</option>
            <option value="kyc">Menor KYC</option>
          </select>
          <button
            onClick={compare}
            disabled={loading}
            className="ml-auto px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Comparar"}
          </button>
        </div>
      </div>

      {/* Resultados */}
      {rows === null ? null : rows.length === 0 ? (
        <div className="text-center py-12 text-slate-500 border border-slate-800 rounded-xl">
          No hay proveedores disponibles para tu configuración.
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-slate-800/50 text-slate-400">
              <tr>
                <th className="text-left px-3 py-2">Proveedor</th>
                <th className="text-right px-3 py-2">
                  {mode === "BUY" ? "Pagas" : "Recibes"}
                </th>
                <th className="text-right px-3 py-2">Comisión</th>
                <th className="text-left px-3 py-2">Tiempo</th>
                <th className="text-center px-3 py-2">KYC</th>
                <th className="text-right px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={r.providerId} className="border-t border-slate-800">
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{r.logo}</span>
                      <div>
                        <div className="text-slate-100 font-medium">{r.name}</div>
                        {!r.isLive && (
                          <span className="text-[10px] text-amber-400">Requiere API key</span>
                        )}
                        {!r.isReal && (
                          <span className="text-[10px] text-slate-500">MOCK</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="text-right px-3 py-3 text-slate-100">
                    {r.rate
                      ? `${(parseFloat(amount) / r.rate).toFixed(4)} ${crypto}`
                      : "—"}
                  </td>
                  <td className="text-right px-3 py-3">
                    <span className="text-emerald-400">
                      {r.fee ? `${r.fee} ${r.feeCurrency}` : "—"}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-slate-400">
                    {r.estimatedTime || "—"}
                  </td>
                  <td className="px-3 py-3 text-center">
                    {r.kycRequired ? (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-blue-900/50 text-blue-300">
                        Sí
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-900/50 text-emerald-300">
                        No
                      </span>
                    )}
                  </td>
                  <td className="text-right px-3 py-3">
                    <button
                      onClick={() => setTab(mode === "BUY" ? "comprar" : "vender")}
                      className="text-emerald-400 hover:text-emerald-300 text-xs font-medium"
                    >
                      Ir →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[10px] text-slate-500 mt-3 italic">
        ⚠️ Los datos provienen de la metadata del proveedor. Los fees reales se confirman al iniciar
        la transacción con el provider.
      </p>
    </div>
  );
}
