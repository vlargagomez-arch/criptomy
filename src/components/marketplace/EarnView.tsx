"use client";

import { useState, useEffect, useCallback } from "react";
import {
  TrendingUp, Loader2, Info, Shield, Zap, ExternalLink, RefreshCw,
  Lock, Unlock, Coins, AlertCircle, Award, Calculator, ChevronDown,
  ChevronUp, Wallet, BarChart3, Building2, Globe2, Target, Check, X,
  Eye,
} from "lucide-react";
import P2PArbitragePanel from "../panels/p2p-arbitrage-panel";

// ============================================================
// TYPES
// ============================================================
interface NormalizedPool {
  asset: string;
  chain: string;
  project: string;
  apy: number;
  apyBase: number | null;
  apyReward: number | null;
  apy7d: number | null;
  apy30d: number | null;
  tvlUsd: number;
  stablecoin: boolean;
  ilRisk: boolean;
  yieldSource: string;
  liquidity: string;
  lockPeriod: string;
  riskFactors: string[];
  url: string;
  updatedAt: number;
}

interface NormalizedFunding {
  exchange: string;
  symbol: string;
  markPrice: number;
  indexPrice: number;
  fundingRate: number;
  fundingIntervalHours: number;
  nextFundingTime: number;
  historical7d: number;
  historical30d: number;
  annualizedFunding: number;
  basis: number;
  annualizedBasis: number;
  updatedAt: number;
}

const ASSETS = [
  { id: "ALL", name: "Todos", icon: "🌐" },
  { id: "USDT", name: "USDT", icon: "💵" },
  { id: "USDC", name: "USDC", icon: "💵" },
  { id: "BTC", name: "BTC", icon: "₿" },
  { id: "ETH", name: "ETH", icon: "Ξ" },
  { id: "SOL", name: "SOL", icon: "🌞" },
];

const TYPES = [
  { id: "ALL", name: "Todos" },
  { id: "lending", name: "Lending" },
  { id: "staking", name: "Staking" },
  { id: "lp", name: "LP Vaults" },
];

const FUNDING_SYMBOLS = [
  { id: "BTCUSDT", name: "BTC" },
  { id: "ETHUSDT", name: "ETH" },
  { id: "SOLUSDT", name: "SOL" },
  { id: "BNBUSDT", name: "BNB" },
  { id: "XRPUSDT", name: "XRP" },
];

function fmtTVL(tvl: number): string {
  if (tvl >= 1e9) return `$${(tvl / 1e9).toFixed(1)}B`;
  if (tvl >= 1e6) return `$${(tvl / 1e6).toFixed(0)}M`;
  if (tvl >= 1e3) return `$${(tvl / 1e3).toFixed(0)}K`;
  return "$0";
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `hace ${s}s`;
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  return `hace ${Math.floor(s / 3600)}h`;
}

function calcEarnings(capital: number, apy: number) {
  const y1 = capital * (apy / 100);
  return { d1: y1 / 365, d7: y1 / 52, d30: y1 / 12, d90: y1 / 4, y1 };
}

// ============================================================
// MAIN
// ============================================================
export default function EarnView() {
  const [tab, setTab] = useState<"work" | "p2p" | "arb" | "funding">("work");

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-100">Earn</h1>
        <p className="text-sm text-slate-400 mt-1 max-w-3xl">
          Descubre formas de poner tu capital cripto a trabajar o analizar oportunidades activas.
        </p>
      </div>

      {/* 4 Main cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <MainCard icon={Coins} title="Poner crypto a trabajar" desc="Tienes BTC, ETH, USDT, USDC y quieres buscar rendimiento." active={tab === "work"} onClick={() => setTab("work")} color="text-emerald-400" />
        <MainCard icon={TrendingUp} title="P2P" desc="Compra y vende cripto buscando diferencias de precio." active={tab === "p2p"} onClick={() => setTab("p2p")} color="text-purple-400" />
        <MainCard icon={Zap} title="Arbitraje" desc="Analiza diferencias de precio entre exchanges o rutas." active={tab === "arb"} onClick={() => setTab("arb")} color="text-blue-400" />
        <MainCard icon={BarChart3} title="Funding / Basis" desc="Analiza diferencias entre spot y derivados." active={tab === "funding"} onClick={() => setTab("funding")} color="text-amber-400" />
      </div>

      {tab === "work" && <DeFiSection />}
      {tab === "p2p" && (
        <div className="space-y-3">
          <Banner color="purple" text="P2P requiere actividad. No es rendimiento pasivo. Buscas diferencias de precio entre compra y venta." />
          <P2PArbitragePanel />
        </div>
      )}
      {tab === "arb" && (
        <div className="space-y-3">
          <Banner color="blue" text="Arbitraje busca diferencias entre exchanges. La oportunidad solo se muestra si sobrevive a fees y slippage." />
          <P2PArbitragePanel />
        </div>
      )}
      {tab === "funding" && <FundingSection />}
    </div>
  );
}

function MainCard({ icon: Icon, title, desc, active, onClick, color }: any) {
  return (
    <button onClick={onClick} className={`text-left p-3 sm:p-4 rounded-xl border transition ${active ? "bg-slate-800 border-slate-600" : "bg-slate-900 border-slate-800 hover:border-slate-700"}`}>
      <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-slate-800 flex items-center justify-center mb-2 ${color}`}><Icon className="w-4 h-4 sm:w-5 sm:h-5" /></div>
      <h3 className="text-xs sm:text-sm font-bold text-slate-100">{title}</h3>
      <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 leading-relaxed">{desc}</p>
    </button>
  );
}

function Banner({ color, text }: { color: string; text: string }) {
  const colors: Record<string, string> = {
    purple: "bg-purple-950/20 border-purple-700/30 text-purple-300",
    blue: "bg-blue-950/20 border-blue-700/30 text-blue-300",
    amber: "bg-amber-950/20 border-amber-700/30 text-amber-300",
  };
  return (
    <div className={`border rounded-lg p-3 text-xs flex items-start gap-2 ${colors[color]}`}>
      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
      <span>{text}</span>
    </div>
  );
}

// ============================================================
// DEFI SECTION — Datos reales de DeFiLlama
// ============================================================
function DeFiSection() {
  const [asset, setAsset] = useState("ALL");
  const [type, setType] = useState("ALL");
  const [capital, setCapital] = useState("");
  const [pools, setPools] = useState<NormalizedPool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number>(0);
  const [advanced, setAdvanced] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (asset !== "ALL") params.set("asset", asset);
      if (type !== "ALL") params.set("type", type);
      const res = await fetch(`/api/earn/defi?${params}`);
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Error"); setPools([]); }
      else { setPools(data.pools || []); setUpdatedAt(data.updatedAt || Date.now()); }
    } catch (e) { setError("Esta fuente no respondió."); setPools([]); }
    setLoading(false);
  }, [asset, type]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const i = setInterval(load, 60_000); return () => clearInterval(i); }, [load]);

  const capitalNum = parseFloat(capital) || 0;

  return (
    <div className="space-y-4">
      {/* Capital input */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <label className="text-[11px] text-slate-400 uppercase tracking-wide font-semibold">¿Cuánto tienes?</label>
        <div className="mt-2 relative">
          <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
          <input type="number" value={capital} onChange={(e) => setCapital(e.target.value)} placeholder="Ej: 10000"
            className="w-full pl-10 pr-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-emerald-500 transition" />
        </div>
        {capitalNum > 0 && <p className="mt-2 text-xs text-slate-400">Buscando qué puedes hacer con <b className="text-emerald-400">{capitalNum.toLocaleString()}</b>.</p>}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          {ASSETS.map(a => (
            <button key={a.id} onClick={() => setAsset(a.id)} className={`px-2.5 py-1 text-[11px] rounded transition ${asset === a.id ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}>
              {a.icon} <span className="hidden sm:inline">{a.name}</span>
            </button>
          ))}
        </div>
        <div className="w-px bg-slate-800 mx-1" />
        <div className="flex items-center gap-1">
          {TYPES.map(t => (
            <button key={t.id} onClick={() => setType(t.id)} className={`px-2.5 py-1 text-[11px] rounded transition ${type === t.id ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}>{t.name}</button>
          ))}
        </div>
        <button onClick={() => setAdvanced(!advanced)} className="ml-auto text-[11px] px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded transition flex items-center gap-1">
          {advanced ? <Eye className="w-3 h-3" /> : <BarChart3 className="w-3 h-3" />} {advanced ? "Simple" : "Avanzado"}
        </button>
        <button onClick={load} className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-400 transition"><RefreshCw className="w-3.5 h-3.5" /></button>
      </div>

      {/* Status */}
      {!loading && !error && pools.length > 0 && (
        <div className="text-[11px] text-slate-500 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          {pools.length} oportunidades · DeFiLlama · Actualizado {timeAgo(updatedAt)}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-400 mb-2" />
          <p className="text-xs text-slate-400">Consultando DeFiLlama…</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center">
          <AlertCircle className="w-8 h-8 mx-auto text-slate-600 mb-2" />
          <p className="text-sm text-slate-400">{error}</p>
          <button onClick={load} className="mt-3 text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition">Reintentar</button>
        </div>
      )}

      {/* Pool cards */}
      {!loading && !error && pools.length === 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
          <p className="text-sm text-slate-400">No hay oportunidades para este filtro.</p>
        </div>
      )}

      <div className="space-y-3">
        {pools.map((pool, i) => (
          <PoolCard key={i} pool={pool} capital={capitalNum} advanced={advanced} />
        ))}
      </div>
    </div>
  );
}

// ============================================================
// POOL CARD — Datos reales
// ============================================================
function PoolCard({ pool, capital, advanced }: { pool: NormalizedPool; capital: number; advanced: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const earnings = capital > 0 ? calcEarnings(capital, pool.apy) : null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <div className="p-3 sm:p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-base font-bold shrink-0">
              {pool.stablecoin ? "💵" : pool.asset.includes("BTC") ? "₿" : pool.asset.includes("ETH") ? "Ξ" : "🪙"}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-slate-100">{pool.asset}</span>
                <span className="text-[10px] px-1.5 py-0.5 bg-slate-800 rounded text-slate-400">{pool.project}</span>
                <span className="text-[10px] text-slate-500">· {pool.chain}</span>
                {pool.ilRisk && <span className="text-[9px] px-1.5 py-0.5 bg-amber-950/30 border border-amber-800/30 text-amber-400 rounded">LP</span>}
              </div>
              <p className="text-[11px] text-slate-500 mt-1 truncate">{pool.yieldSource.split(".")[0]}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <div className="text-xl font-bold text-emerald-400 font-mono">{pool.apy.toFixed(2)}%</div>
              <div className="text-[9px] text-slate-500 uppercase">APY</div>
            </div>
            <a href={pool.url} target="_blank" rel="noopener noreferrer" className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium flex items-center gap-1 transition">Ir <ExternalLink className="w-3 h-3" /></a>
          </div>
        </div>

        {/* Key metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 pt-3 border-t border-slate-800">
          <div>
            <div className="text-[9px] text-slate-500 uppercase">Liquidez</div>
            <div className="text-xs text-slate-300 flex items-center gap-1">{pool.liquidity === "Flexible" ? <Unlock className="w-3 h-3 text-emerald-400" /> : <Lock className="w-3 h-3 text-amber-400" />}{pool.liquidity}</div>
          </div>
          <div><div className="text-[9px] text-slate-500 uppercase">Bloqueo</div><div className="text-xs text-slate-300">{pool.lockPeriod}</div></div>
          <div><div className="text-[9px] text-slate-500 uppercase">TVL</div><div className="text-xs text-slate-300 font-mono">{fmtTVL(pool.tvlUsd)}</div></div>
          <div><div className="text-[9px] text-slate-500 uppercase">Origen</div><div className="text-[11px] text-slate-400 truncate" title={pool.yieldSource}>{pool.yieldSource.split(".")[0]}</div></div>
        </div>

        {/* Calculator */}
        {earnings && (
          <div className="mt-3 bg-emerald-950/20 border border-emerald-800/30 rounded-lg p-3">
            <div className="text-[10px] text-emerald-400 uppercase font-semibold mb-2 flex items-center gap-1"><Calculator className="w-3 h-3" /> Ganancia estimada con {capital.toLocaleString()}</div>
            <div className="grid grid-cols-5 gap-2 text-xs">
              <div><div className="text-slate-500 text-[9px]">1 día</div><div className="text-slate-200 font-mono">≈ {earnings.d1.toFixed(2)}</div></div>
              <div><div className="text-slate-500 text-[9px]">7 días</div><div className="text-slate-200 font-mono">≈ {earnings.d7.toFixed(2)}</div></div>
              <div><div className="text-slate-500 text-[9px]">30 días</div><div className="text-slate-200 font-mono">≈ {earnings.d30.toFixed(2)}</div></div>
              <div><div className="text-slate-500 text-[9px]">90 días</div><div className="text-slate-200 font-mono">≈ {earnings.d90.toFixed(2)}</div></div>
              <div><div className="text-slate-500 text-[9px]">1 año</div><div className="text-emerald-400 font-mono font-bold">≈ {earnings.y1.toFixed(2)}</div></div>
            </div>
            <p className="mt-2 text-[10px] text-amber-400/70">Estimación basada en la tasa observada. El rendimiento puede cambiar.</p>
          </div>
        )}

        {/* Advanced mode */}
        {advanced && (
          <div className="mt-3 pt-3 border-t border-slate-800 grid grid-cols-3 sm:grid-cols-6 gap-2 text-[11px] font-mono">
            <div><div className="text-slate-500 text-[9px]">APY Base</div><div className="text-slate-300">{pool.apyBase?.toFixed(2) || "—"}%</div></div>
            <div><div className="text-slate-500 text-[9px]">APY Reward</div><div className="text-slate-300">{pool.apyReward?.toFixed(2) || "—"}%</div></div>
            <div><div className="text-slate-500 text-[9px]">APY 7d</div><div className="text-slate-300">{pool.apy7d?.toFixed(2) || "—"}%</div></div>
            <div><div className="text-slate-500 text-[9px]">APY 30d</div><div className="text-slate-300">{pool.apy30d?.toFixed(2) || "—"}%</div></div>
            <div><div className="text-slate-500 text-[9px]">Stablecoin</div><div className="text-slate-300">{pool.stablecoin ? "Sí" : "No"}</div></div>
            <div><div className="text-slate-500 text-[9px]">IL Risk</div><div className="text-slate-300">{pool.ilRisk ? "Sí" : "No"}</div></div>
          </div>
        )}

        <button onClick={() => setExpanded(!expanded)} className="mt-2 text-xs text-slate-500 hover:text-slate-300 transition flex items-center gap-1">
          {expanded ? <><ChevronUp className="w-3 h-3" /> Ocultar</> : <><ChevronDown className="w-3 h-3" /> Ver detalles</>}
        </button>
      </div>

      {expanded && (
        <div className="bg-slate-950/40 border-t border-slate-800 p-4 space-y-3">
          <div>
            <div className="text-[10px] uppercase text-emerald-400 font-semibold mb-1">¿Cómo genera dinero?</div>
            <p className="text-xs text-slate-300">{pool.yieldSource}</p>
          </div>
          <div>
            <div className="text-[10px] uppercase text-amber-400 font-semibold mb-2">Factores de riesgo</div>
            <div className="flex flex-wrap gap-1.5">
              {pool.riskFactors.map(r => <span key={r} className="text-[10px] px-2 py-0.5 bg-amber-950/30 border border-amber-800/30 text-amber-400 rounded">{r}</span>)}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-blue-400 font-semibold mb-2">¿Qué estoy haciendo?</div>
            <p className="text-xs text-slate-300">Depositas {pool.asset} en {pool.project} ({pool.chain}). El rendimiento se acumula automáticamente. Retiras cuando quieras si la liquidez es flexible.</p>
          </div>
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-500">
            <span>Fuente: DeFiLlama · {pool.project}</span>
            <a href={pool.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">Abrir fuente ↗</a>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// FUNDING SECTION — Datos reales de Binance
// ============================================================
function FundingSection() {
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [data, setData] = useState<NormalizedFunding | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/earn/funding?symbol=${symbol}`);
      const d = await res.json();
      if (!res.ok || !d.funding) { setError(d.error || "Error"); setData(null); }
      else { setData(d.funding); }
    } catch { setError("Binance no respondió."); setData(null); }
    setLoading(false);
  }, [symbol]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const i = setInterval(load, 30_000); return () => clearInterval(i); }, [load]);

  const nextFunding = data ? new Date(data.nextFundingTime).toLocaleString() : "—";

  return (
    <div className="space-y-4">
      {/* Symbol selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-slate-500">Activo:</span>
        {FUNDING_SYMBOLS.map(s => (
          <button key={s.id} onClick={() => setSymbol(s.id)} className={`px-2.5 py-1 text-[11px] rounded transition ${symbol === s.id ? "bg-amber-500 text-black" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}>{s.name}</button>
        ))}
        <button onClick={load} className="ml-auto p-1.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-400 transition"><RefreshCw className="w-3.5 h-3.5" /></button>
      </div>

      {/* Info */}
      <div className="bg-amber-950/20 border border-amber-700/30 rounded-lg p-3 text-[11px] text-amber-300 flex items-start gap-2">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>El funding es un pago periódico entre participantes del mercado de futuros perpetuos. La dirección y cantidad dependen de la tasa. <b>No es un beneficio garantizado.</b> Puede cambiar de signo.</span>
      </div>

      {loading && <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-amber-400" /></div>}

      {error && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center">
          <AlertCircle className="w-8 h-8 mx-auto text-slate-600 mb-2" />
          <p className="text-sm text-slate-400">{error}</p>
        </div>
      )}

      {data && !loading && !error && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4">
          {/* Main metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-950/50 rounded-lg p-3">
              <div className="text-[10px] text-slate-500 uppercase">Funding actual</div>
              <div className={`text-xl font-bold font-mono ${data.fundingRate >= 0 ? "text-emerald-400" : "text-red-400"}`}>{data.fundingRate.toFixed(4)}%</div>
              <div className="text-[10px] text-slate-500">cada {data.fundingIntervalHours}h</div>
            </div>
            <div className="bg-slate-950/50 rounded-lg p-3">
              <div className="text-[10px] text-slate-500 uppercase">Anualizado</div>
              <div className={`text-xl font-bold font-mono ${data.annualizedFunding >= 0 ? "text-emerald-400" : "text-red-400"}`}>{data.annualizedFunding.toFixed(2)}%</div>
              <div className="text-[10px] text-slate-500">estimación anual</div>
            </div>
            <div className="bg-slate-950/50 rounded-lg p-3">
              <div className="text-[10px] text-slate-500 uppercase">Basis</div>
              <div className={`text-xl font-bold font-mono ${data.basis >= 0 ? "text-emerald-400" : "text-red-400"}`}>{data.basis.toFixed(3)}%</div>
              <div className="text-[10px] text-slate-500">futures vs spot</div>
            </div>
            <div className="bg-slate-950/50 rounded-lg p-3">
              <div className="text-[10px] text-slate-500 uppercase">Próximo funding</div>
              <div className="text-xs text-slate-300 font-mono">{nextFunding}</div>
            </div>
          </div>

          {/* Prices */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-950/30 rounded-lg p-3">
              <div className="text-[10px] text-slate-500 uppercase mb-1">Precio Spot (Index)</div>
              <div className="text-lg font-mono text-slate-200">${data.indexPrice.toFixed(2)}</div>
            </div>
            <div className="bg-slate-950/30 rounded-lg p-3">
              <div className="text-[10px] text-slate-500 uppercase mb-1">Precio Futures (Mark)</div>
              <div className="text-lg font-mono text-slate-200">${data.markPrice.toFixed(2)}</div>
            </div>
          </div>

          {/* Historical */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-950/30 rounded-lg p-3">
              <div className="text-[10px] text-slate-500 uppercase">Funding promedio 7 días</div>
              <div className={`text-sm font-mono ${data.historical7d >= 0 ? "text-emerald-400" : "text-red-400"}`}>{data.historical7d.toFixed(4)}%</div>
            </div>
            <div className="bg-slate-950/30 rounded-lg p-3">
              <div className="text-[10px] text-slate-500 uppercase">Funding promedio 30 días</div>
              <div className={`text-sm font-mono ${data.historical30d >= 0 ? "text-emerald-400" : "text-red-400"}`}>{data.historical30d.toFixed(4)}%</div>
            </div>
          </div>

          {/* Explanation */}
          <div className="bg-slate-950/40 rounded-lg p-3 space-y-2">
            <div className="text-[10px] uppercase text-amber-400 font-semibold">¿Qué significa?</div>
            <p className="text-xs text-slate-300">
              {data.fundingRate >= 0
                ? `El funding es positivo: los traders con posición larga pagan a los traders con posición corta. Esto significa que hay más demanda de posiciones largas en ${data.symbol.replace("USDT", "")}.`
                : `El funding es negativo: los traders cortos pagan a los largos. Hay más presión vendedora.`}
            </p>
            <p className="text-xs text-slate-400">
              La anualización de {data.annualizedFunding.toFixed(2)}% asume que la tasa actual se mantiene constante, lo cual <b className="text-amber-400">no es realista</b>. El funding cambia cada {data.fundingIntervalHours} horas.
            </p>
          </div>

          {/* Source */}
          <div className="flex items-center justify-between text-[10px] text-slate-500">
            <span>Fuente: Binance Futures · {timeAgo(data.updatedAt)}</span>
            <a href={`https://www.binance.com/en/futures/funding-history/perp/${symbol}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">Abrir fuente ↗</a>
          </div>
        </div>
      )}
    </div>
  );
}
