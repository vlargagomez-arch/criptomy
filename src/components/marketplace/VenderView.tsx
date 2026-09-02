"use client";

import { useState } from "react";
import { useApp } from "@/lib/store";
import { TrendingDown, Loader2, AlertTriangle, Info } from "lucide-react";

export default function VenderView() {
  const { user } = useApp();
  const [crypto, setCrypto] = useState("USDT");
  const [network, setNetwork] = useState("POLYGON");
  const [amount, setAmount] = useState("100");
  const [payoutMethod, setPayoutMethod] = useState("BANK_TRANSFER");
  const [status, setStatus] = useState<string | null>(null);

  const sell = async () => {
    if (!user) return;
    setStatus("Consultando proveedores off-ramp…");
    try {
      // Llamar API /api/offramp (aún no implementada con providers reales)
      // Por ahora mostramos info clara
      setStatus(
        "⚠️ Off-ramp real requiere integración con MoonPay/Transak. Mock disponible en desarrollo."
      );
    } catch (e) {
      setStatus("Error: " + (e as Error).message);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <TrendingDown className="w-6 h-6 text-amber-400" />
          Vender cripto
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Convierte USDT/USDC/ETH a moneda local y recíbelo en tu cuenta. KYC lo hace el proveedor.
        </p>
      </div>

      <div className="bg-amber-950/30 border border-amber-800/50 rounded-lg p-3 text-xs text-amber-300 mb-4 flex gap-2">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <div>
          <b>Estado actual:</b> El módulo de off-ramp está listo para integrar MoonPay, Transak y
          otros. Para activarlo, necesitamos:
          <ol className="list-decimal ml-4 mt-1">
            <li>API key del provider (MoonPay / Transak)</li>
            <li>Verificar payout methods disponibles en Colombia</li>
            <li>Revisión legal (es un servicio financiero regulado)</li>
          </ol>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="text-[11px] text-slate-400">Cripto</label>
            <select
              value={crypto}
              onChange={(e) => setCrypto(e.target.value)}
              className="mt-1 w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-100 text-sm"
            >
              {["USDT", "USDC", "ETH", "BTC"].map((c) => (
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
              {["POLYGON", "ETHEREUM", "BASE", "ARBITRUM"].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] text-slate-400">Cantidad</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-100 text-sm"
            />
          </div>
          <div>
            <label className="text-[11px] text-slate-400">Método de pago</label>
            <select
              value={payoutMethod}
              onChange={(e) => setPayoutMethod(e.target.value)}
              className="mt-1 w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-100 text-sm"
            >
              <option value="BANK_TRANSFER">Transferencia bancaria</option>
              <option value="NEQUI">Nequi</option>
              <option value="DAVIPLATA">Daviplata</option>
              <option value="PSE">PSE</option>
            </select>
          </div>
        </div>

        <button
          onClick={sell}
          disabled={!user}
          className="w-full bg-amber-600 hover:bg-amber-500 text-white py-2 rounded text-sm font-medium disabled:opacity-50"
        >
          Ver proveedores
        </button>

        {status && (
          <div className="text-xs text-slate-300 p-2 bg-slate-800 rounded">{status}</div>
        )}
      </div>
    </div>
  );
}
