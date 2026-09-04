"use client";

import { useState, useEffect, useCallback } from "react";
import {
  TrendingUp, TrendingDown, Loader2, Info, ShieldCheck, ArrowRight,
  Activity, Zap, ExternalLink, RefreshCw, Wallet, Lock, Unlock,
} from "lucide-react";

interface AaveReserve {
  asset: string;
  chain: string;
  supplyAPY: number;
  borrowAPY: number;
  status: "ONLINE" | "ERROR";
  error?: string;
}

const CHAINS = [
  { id: "POLYGON", name: "Polygon", icon: "🟣", gas: "$0.01" },
  { id: "BASE", name: "Base", icon: "🔵", gas: "$0.01" },
  { id: "ARBITRUM", name: "Arbitrum", icon: "🔵", gas: "$0.10" },
];

const ASSET_ICONS: Record<string, string> = {
  USDC: "$", USDT: "₮", WETH: "Ξ", WBTC: "₿", WMATIC: "◎", DAI: "◈",
};

const ASSET_NAMES: Record<string, string> = {
  USDC: "USD Coin", USDT: "Tether", WETH: "Ethereum", WBTC: "Bitcoin",
  WMATIC: "Polygon", DAI: "Dai",
};

export default function EarnView() {
  const [chain, setChain] = useState("POLYGON");
  const [reserves, setReserves] = useState<AaveReserve[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/aave?chain=${chain}&asset=ALL`);
      if (!res.ok) return;
      const data = await res.json();
      setReserves(data.reserves || []);
    } catch {}
    finally { setLoading(false); }
  }, [chain]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  // Ordenar por supplyAPY descendente
  const sorted = [...reserves].sort((a, b) => b.supplyAPY - a.supplyAPY);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-emerald-400" />
          Earn — Rendimientos sin banco
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Deposita cripto en Aave V3 y gana interés real. Sin KYC, sin banco, sin aprobación.
          Los smart contracts ya están desplegados en Polygon, Base y Arbitrum. Tú solo depositas.
        </p>
      </div>

      {/* Panel explicativo */}
      <div className="mb-6 bg-gradient-to-br from-emerald-950/30 to-slate-900 border border-emerald-800/50 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wide">
            ¿Qué es Aave V3?
          </h3>
        </div>
        <p className="text-[13px] text-slate-400 mb-3">
          Aave es el mayor protocolo de préstamos descentralizados del mundo. Funciona sin banco:
          los usuarios depositan cripto en pools de liquidez y ganan interés. Otros usuarios piden
          préstamos usando su cripto como colateral. <b className="text-slate-200">Sin KYC, sin revisión de crédito, sin aprobación.</b>
          Billones de dólares ya están depositados. Es <b className="text-emerald-400">la banca del futuro.</b>
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
          <div className="flex items-center gap-1.5 text-slate-400">
            <ShieldCheck className="w-3 h-3 text-emerald-400" /> Smart contracts auditados
          </div>
          <div className="flex items-center gap-1.5 text-slate-400">
            <Lock className="w-3 h-3 text-emerald-400" /> Non-custodial (tus claves, tu cripto)
          </div>
          <div className="flex items-center gap-1.5 text-slate-400">
            <Activity className="w-3 h-3 text-emerald-400" /> Datos on-chain en vivo
          </div>
          <div className="flex items-center gap-1.5 text-slate-400">
            <Unlock className="w-3 h-3 text-emerald-400" /> Retira cuando quieras
          </div>
        </div>
      </div>

      {/* Selector de chain */}
      <div className="flex gap-2 mb-6">
        {CHAINS.map((c) => (
          <button
            key={c.id}
            onClick={() => setChain(c.id)}
            className={`px-4 py-2 text-sm rounded-lg transition flex items-center gap-2 ${
              chain === c.id
                ? "bg-emerald-600 text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            <span className="text-base">{c.icon}</span>
            {c.name}
            <span className="text-[10px] opacity-60">gas {c.gas}</span>
          </button>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
          <div className="text-[10px] text-slate-500 uppercase">Mejor APY depósito</div>
          <div className="text-xl font-bold text-emerald-400">
            {sorted[0]?.supplyAPY ? `${sorted[0].supplyAPY.toFixed(2)}%` : "—"}
          </div>
          {sorted[0] && <div className="text-[10px] text-slate-500">{ASSET_NAMES[sorted[0].asset] || sorted[0].asset}</div>}
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
          <div className="text-[10px] text-slate-500 uppercase">Mejor APY préstamo</div>
          <div className="text-xl font-bold text-amber-400">
            {sorted[0]?.borrowAPY ? `${sorted[0].borrowAPY.toFixed(2)}%` : "—"}
          </div>
          {sorted[0] && <div className="text-[10px] text-slate-500">{ASSET_NAMES[sorted[0].asset] || sorted[0].asset}</div>}
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
          <div className="text-[10px] text-slate-500 uppercase">Activos disponibles</div>
          <div className="text-xl font-bold text-slate-100">
            {reserves.filter((r) => r.status === "ONLINE").length}
          </div>
        </div>
      </div>

      {/* Tabla de APYs */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-400 mb-3" />
          <p className="text-sm text-slate-400">Consultando Aave V3 en {chain}…</p>
          <p className="text-xs text-slate-500 mt-1">Leyendo smart contracts on-chain via RPC público</p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-slate-800/50 text-[10px] uppercase text-slate-500 font-semibold">
            <div className="col-span-3">Activo</div>
            <div className="col-span-2 text-right">APY Depósito</div>
            <div className="col-span-2 text-right">APY Préstamo</div>
            <div className="col-span-2 text-right">Spread</div>
            <div className="col-span-3 text-right">Acción</div>
          </div>

          {/* Rows */}
          {sorted.map((r) => {
            if (r.status === "ERROR") {
              return (
                <div key={r.asset} className="grid grid-cols-12 gap-2 px-4 py-3 border-t border-slate-800 text-xs text-slate-600">
                  <div className="col-span-12">{r.asset}: {r.error}</div>
                </div>
              );
            }
            const spread = r.borrowAPY - r.supplyAPY;
            return (
              <div key={r.asset} className="grid grid-cols-12 gap-2 px-4 py-4 border-t border-slate-800 hover:bg-slate-800/30 transition">
                {/* Activo */}
                <div className="col-span-3 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-sm font-bold text-slate-300">
                    {ASSET_ICONS[r.asset] || "?"}
                  </div>
                  <div>
                    <div className="text-sm text-slate-200 font-medium">{r.asset}</div>
                    <div className="text-[10px] text-slate-500">{ASSET_NAMES[r.asset] || r.asset}</div>
                  </div>
                </div>

                {/* APY Depósito */}
                <div className="col-span-2 text-right flex flex-col justify-center">
                  <div className="text-sm font-bold text-emerald-400 font-mono">
                    {r.supplyAPY > 0 ? `${r.supplyAPY.toFixed(2)}%` : "—"}
                  </div>
                  <div className="text-[9px] text-slate-600">APY</div>
                </div>

                {/* APY Préstamo */}
                <div className="col-span-2 text-right flex flex-col justify-center">
                  <div className="text-sm font-bold text-amber-400 font-mono">
                    {r.borrowAPY > 0 ? `${r.borrowAPY.toFixed(2)}%` : "—"}
                  </div>
                  <div className="text-[9px] text-slate-600">APY</div>
                </div>

                {/* Spread */}
                <div className="col-span-2 text-right flex flex-col justify-center">
                  <div className="text-sm text-slate-300 font-mono">
                    {spread > 0 ? `${spread.toFixed(2)}%` : "—"}
                  </div>
                  <div className="text-[9px] text-slate-600">spread</div>
                </div>

                {/* Acción */}
                <div className="col-span-3 text-right flex items-center justify-end gap-2">
                  <div className="text-[10px] text-slate-600 hidden sm:block">
                    Deposita {r.asset}<br/>en {chain}
                  </div>
                  <a
                    href={`https://app.aave.com/?marketName=proto_${chain.toLowerCase()}_v3`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium flex items-center gap-1 transition"
                  >
                    Ganar {r.supplyAPY > 0 ? `${r.supplyAPY.toFixed(1)}%` : ""}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Refresh */}
      <div className="mt-4 flex items-center justify-center gap-2">
        <button
          onClick={load}
          disabled={loading}
          className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg flex items-center gap-1.5 transition"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          Actualizar APYs
        </button>
        <span className="text-[10px] text-slate-500">
          Auto-refresh cada 30s · Datos de Aave V3 on-chain
        </span>
      </div>

      {/* Cómo funciona */}
      <div className="mt-8 bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
        <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wide mb-3 flex items-center gap-2">
          <Info className="w-3.5 h-3.5 text-emerald-400" />
          Cómo funciona Aave V3
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="text-sm font-semibold text-emerald-400 mb-2 flex items-center gap-1">
              <TrendingUp className="w-4 h-4" /> Depositar (ganar interés)
            </div>
            <ol className="text-[11px] text-slate-400 space-y-1 list-decimal pl-4">
              <li>Conectas tu wallet a Aave V3 en Polygon/Base/Arbitrum</li>
              <li>Depositas USDC, USDT, WETH, etc.</li>
              <li>Recibes aTokens (1:1 con tu depósito) que acumulan interés</li>
              <li>Ganas el APY mostrado arriba — interés real, pagado cada bloque</li>
              <li>Retiras cuando quieras — sin lock-up, sin penalización</li>
            </ol>
          </div>
          <div>
            <div className="text-sm font-semibold text-amber-400 mb-2 flex items-center gap-1">
              <TrendingDown className="w-4 h-4" /> Pedir préstamo
            </div>
            <ol className="text-[11px] text-slate-400 space-y-1 list-decimal pl-4">
              <li>Depositas cripto como colateral (ej: WBTC)</li>
              <li>Pides préstamo en otro activo (ej: USDC)</li>
              <li>Pagas el APY de préstamo mostrado arriba</li>
              <li>Mantienes tu colateral — si sube de valor, ganas</li>
              <li>Devuelves el préstamo + interés y recuperas tu colateral</li>
            </ol>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-slate-800 text-[10px] text-slate-500">
          ⚠️ Riesgos: los smart contracts pueden tener bugs (auditados pero no 100% seguros). Si tu health factor cae
          debajo de 1, tu colateral puede ser liquidado. Los APYs cambian constantemente. Esta información es
          educativa — no es asesoría financiera.
        </div>
      </div>
    </div>
  );
}
