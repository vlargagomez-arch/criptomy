"use client";

import { useState, useEffect, useCallback } from "react";
import {
  TrendingUp, Loader2, Info, Shield, Zap, ExternalLink, RefreshCw,
  Lock, Unlock, Coins, AlertCircle, Calculator, ChevronDown,
  ChevronUp, Wallet, BarChart3, Building2, Globe2, Target, Check, X,
  Eye, Activity, PieChart, Cpu,
} from "lucide-react";
import P2PArbitragePanel from "../panels/p2p-arbitrage-panel";
import type {
  EarnOpportunity, FundingData, FundingMultiResponse, BasisData,
} from "@/lib/earn/types";

// ============================================================
// Constantes
// ============================================================
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
  { id: "restaking", name: "Restaking" },
  { id: "lp", name: "LP" },
  { id: "vault", name: "Vaults" },
];

const FUNDING_SYMBOLS = [
  { id: "BTCUSDT", name: "BTC" },
  { id: "ETHUSDT", name: "ETH" },
  { id: "SOLUSDT", name: "SOL" },
  { id: "BNBUSDT", name: "BNB" },
  { id: "XRPUSDT", name: "XRP" },
  { id: "DOGEUSDT", name: "DOGE" },
];

function fmtTVL(tvl: number): string {
  if (tvl >= 1e9) return `$${(tvl / 1e9).toFixed(1)}B`;
  if (tvl >= 1e6) return `$${(tvl / 1e6).toFixed(0)}M`;
  if (tvl >= 1e3) return `$${(tvl / 1e3).toFixed(0)}K`;
  return "$0";
}

function timeAgo(ts: number): string {
  if (!ts) return "—";
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
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
  const [tab, setTab] = useState<"work" | "p2parb" | "funding">("work");

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-100">Earn</h1>
        <p className="text-sm text-slate-400 mt-1 max-w-3xl">
          Explora formas de poner tu capital cripto a trabajar o analizar oportunidades de mercado.
        </p>
      </div>

      {/* 3 Main cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MainCard
          icon={Coins}
          title="Poner crypto a trabajar"
          desc="Busca opciones de rendimiento para BTC, ETH, USDT, USDC y otros activos compatibles."
          active={tab === "work"}
          onClick={() => setTab("work")}
          color="text-emerald-400"
          cta="EXPLORAR"
        />
        <MainCard
          icon={TrendingUp}
          title="P2P & Arbitraje"
          desc="Analiza diferencias entre precios de compra y venta y busca oportunidades entre mercados."
          active={tab === "p2parb"}
          onClick={() => setTab("p2parb")}
          color="text-purple-400"
          cta={["P2P", "ARBITRAJE"]}
        />
        <MainCard
          icon={BarChart3}
          title="Funding & Basis"
          desc="Analiza funding, basis y diferencias entre spot y derivados."
          active={tab === "funding"}
          onClick={() => setTab("funding")}
          color="text-amber-400"
          cta={["FUNDING", "BASIS"]}
        />
      </div>

      {tab === "work" && <DeFiSection />}
      {tab === "p2parb" && <P2PArbitrageSection />}
      {tab === "funding" && <FundingBasisSection />}
    </div>
  );
}

function MainCard({ icon: Icon, title, desc, active, onClick, color, cta }: any) {
  return (
    <button
      onClick={onClick}
      className={`text-left p-4 rounded-xl border transition ${
        active
          ? "bg-slate-800 border-slate-600 ring-1 ring-slate-500/50"
          : "bg-slate-900 border-slate-800 hover:border-slate-700"
      }`}
    >
      <div className={`w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center mb-2 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <h3 className="text-sm font-bold text-slate-100">{title}</h3>
      <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{desc}</p>
      <div className="mt-3 flex items-center gap-1 flex-wrap">
        {Array.isArray(cta) ? (
          cta.map((c: string) => (
            <span key={c} className={`text-[9px] px-1.5 py-0.5 rounded ${active ? "bg-slate-700 text-slate-200" : "bg-slate-800 text-slate-500"}`}>
              {c}
            </span>
          ))
        ) : (
          <span className={`text-[9px] px-1.5 py-0.5 rounded ${active ? "bg-slate-700 text-slate-200" : "bg-slate-800 text-slate-500"}`}>
            {cta}
          </span>
        )}
      </div>
    </button>
  );
}

// ============================================================
// DEFI SECTION — Poner crypto a trabajar (DeFiLlama real)
// ============================================================
function DeFiSection() {
  const [asset, setAsset] = useState("ALL");
  const [type, setType] = useState("ALL");
  const [capital, setCapital] = useState("");
  const [pools, setPools] = useState<EarnOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number>(0);
  const [advanced, setAdvanced] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (asset !== "ALL") params.set("asset", asset);
      if (type !== "ALL") params.set("type", type);
      const res = await fetch(`/api/earn/defi?${params}`);
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Esta fuente no respondió en este momento.");
        setPools([]);
      } else {
        setPools(data.pools || []);
        setUpdatedAt(data.updatedAt || Date.now());
      }
    } catch {
      setError("Esta fuente no respondió en este momento.");
      setPools([]);
    }
    setLoading(false);
  }, [asset, type]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const i = setInterval(load, 60_000);
    return () => clearInterval(i);
  }, [load]);

  const capitalNum = parseFloat(capital) || 0;

  return (
    <div className="space-y-4">
      <ModuleIntro
        title="Poner crypto a trabajar"
        text="Depositas activos en protocolos DeFi. El protocolo los usa para prestar, hacer staking o proveer liquidez, y te devuelve una parte del rendimiento. No es garantizado: el APY cambia con el mercado y el propio protocolo puede fallar."
      />

      {/* Capital input */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <label className="text-[11px] text-slate-400 uppercase tracking-wide font-semibold">¿Cuánto tienes?</label>
        <div className="mt-2 relative">
          <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
          <input
            type="number"
            value={capital}
            onChange={(e) => setCapital(e.target.value)}
            placeholder="Ej: 5000"
            className="w-full pl-10 pr-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-emerald-500 transition"
          />
        </div>
        {capitalNum > 0 && (
          <p className="mt-2 text-xs text-slate-400">
            Buscando qué puedes hacer con <b className="text-emerald-400">{capitalNum.toLocaleString()}</b>.
          </p>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          {ASSETS.map((a) => (
            <button
              key={a.id}
              onClick={() => setAsset(a.id)}
              className={`px-2.5 py-1 text-[11px] rounded transition ${
                asset === a.id ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"
              }`}
            >
              {a.icon} <span className="hidden sm:inline">{a.name}</span>
            </button>
          ))}
        </div>
        <div className="w-px bg-slate-800 mx-1" />
        <div className="flex items-center gap-1">
          {TYPES.map((t) => (
            <button
              key={t.id}
              onClick={() => setType(t.id)}
              className={`px-2.5 py-1 text-[11px] rounded transition ${
                type === t.id ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>
        <button
          onClick={() => setAdvanced(!advanced)}
          className="ml-auto text-[11px] px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded transition flex items-center gap-1"
        >
          {advanced ? <Eye className="w-3 h-3" /> : <BarChart3 className="w-3 h-3" />} {advanced ? "Simple" : "Avanzado"}
        </button>
        <button onClick={load} className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-400 transition">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Status */}
      {!loading && !error && pools.length > 0 && (
        <div className="text-[11px] text-slate-500 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          {pools.length} oportunidades · DeFiLlama · Actualizado {timeAgo(updatedAt)}
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-400 mb-2" />
          <p className="text-xs text-slate-400">Consultando DeFiLlama…</p>
        </div>
      )}

      {error && <ErrorBox message={error} onRetry={load} />}

      {!loading && !error && pools.length === 0 && (
        <EmptyBox message="En este momento no hay oportunidades para este filtro. Prueba con otro activo o tipo." onRetry={load} />
      )}

      <div className="space-y-3">
        {pools.map((pool, i) => (
          <PoolCard key={`${pool.project}-${pool.asset}-${i}`} pool={pool} capital={capitalNum} advanced={advanced} />
        ))}
      </div>
    </div>
  );
}

function ModuleIntro({ title, text }: { title: string; text: string }) {
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
      <h2 className="text-sm font-bold text-slate-100 mb-1">{title}</h2>
      <p className="text-xs text-slate-400 leading-relaxed">{text}</p>
    </div>
  );
}

function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center">
      <AlertCircle className="w-8 h-8 mx-auto text-amber-400 mb-2" />
      <p className="text-sm text-slate-300">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition inline-flex items-center gap-1"
        >
          <RefreshCw className="w-3 h-3" /> Reintentar
        </button>
      )}
    </div>
  );
}

function EmptyBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
      <p className="text-sm text-slate-400">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition inline-flex items-center gap-1"
        >
          <RefreshCw className="w-3 h-3" /> Reintentar
        </button>
      )}
    </div>
  );
}

// ============================================================
// POOL CARD
// ============================================================
function PoolCard({ pool, capital, advanced }: { pool: EarnOpportunity; capital: number; advanced: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const earnings = capital > 0 ? calcEarnings(capital, pool.apy) : null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <div className="p-3 sm:p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-base font-bold shrink-0">
              {pool.asset.includes("USD") ? "💵" : pool.asset.includes("BTC") ? "₿" : pool.asset.includes("ETH") ? "Ξ" : "🪙"}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-slate-100">{pool.asset}</span>
                <span className="text-[10px] px-1.5 py-0.5 bg-slate-800 rounded text-slate-400">{pool.project}</span>
                <span className="text-[10px] text-slate-500">· {pool.chain}</span>
                <ProductBadge type={pool.productType} />
              </div>
              <p className="text-[11px] text-slate-500 mt-1 truncate">{pool.yieldSource.split(".")[0]}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <div className="text-xl font-bold text-emerald-400 font-mono">{pool.apy.toFixed(2)}%</div>
              <div className="text-[9px] text-slate-500 uppercase">APY</div>
            </div>
            <a
              href={pool.url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium flex items-center gap-1 transition"
            >
              Ir <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Key metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 pt-3 border-t border-slate-800">
          <div>
            <div className="text-[9px] text-slate-500 uppercase">Liquidez</div>
            <div className="text-xs text-slate-300 flex items-center gap-1">
              {pool.liquidity === "Flexible" ? <Unlock className="w-3 h-3 text-emerald-400" /> : <Lock className="w-3 h-3 text-amber-400" />}
              {pool.liquidity}
            </div>
          </div>
          <div>
            <div className="text-[9px] text-slate-500 uppercase">Bloqueo</div>
            <div className="text-xs text-slate-300">{pool.lockPeriod}</div>
          </div>
          <div>
            <div className="text-[9px] text-slate-500 uppercase">TVL</div>
            <div className="text-xs text-slate-300 font-mono">{fmtTVL(pool.tvlUsd)}</div>
          </div>
          <div>
            <div className="text-[9px] text-slate-500 uppercase">Origen</div>
            <div className="text-[11px] text-slate-400 truncate" title={pool.yieldSource}>
              {pool.yieldSource.split(".")[0]}
            </div>
          </div>
        </div>

        {/* Calculator */}
        {earnings && (
          <div className="mt-3 bg-emerald-950/20 border border-emerald-800/30 rounded-lg p-3">
            <div className="text-[10px] text-emerald-400 uppercase font-semibold mb-2 flex items-center gap-1">
              <Calculator className="w-3 h-3" /> Ganancia estimada con {capital.toLocaleString()}
            </div>
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

        {/* Advanced */}
        {advanced && (
          <div className="mt-3 pt-3 border-t border-slate-800 grid grid-cols-3 sm:grid-cols-6 gap-2 text-[11px] font-mono">
            <div><div className="text-slate-500 text-[9px]">APY Base</div><div className="text-slate-300">{pool.apyBase?.toFixed(2) || "—"}%</div></div>
            <div><div className="text-slate-500 text-[9px]">APY Reward</div><div className="text-slate-300">{pool.apyReward?.toFixed(2) || "—"}%</div></div>
            <div><div className="text-slate-500 text-[9px]">APY 7d</div><div className="text-slate-300">{pool.apy7d?.toFixed(2) || "—"}%</div></div>
            <div><div className="text-slate-500 text-[9px]">APY 30d</div><div className="text-slate-300">{pool.apy30d?.toFixed(2) || "—"}%</div></div>
            <div><div className="text-slate-500 text-[9px]">Fees</div><div className="text-slate-300 truncate" title={pool.fees}>{pool.fees}</div></div>
            <div><div className="text-slate-500 text-[9px]">Rewards</div><div className="text-slate-300 truncate" title={pool.rewards}>{pool.rewards}</div></div>
          </div>
        )}

        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 text-xs text-slate-500 hover:text-slate-300 transition flex items-center gap-1"
        >
          {expanded ? <><ChevronUp className="w-3 h-3" /> Ocultar detalles</> : <><ChevronDown className="w-3 h-3" /> Ver detalles</>}
        </button>
      </div>

      {expanded && (
        <div className="bg-slate-950/40 border-t border-slate-800 p-4 space-y-3">
          <HumanExplainer
            blocks={[
              { title: "¿Qué estoy viendo?", text: `Una oportunidad de rendimiento en ${pool.asset} ofrecida por ${pool.project} (${pool.chain}). El APY mostrado es el observado ahora mismo.` },
              { title: "¿Cómo podría generar dinero?", text: `Depositando ${pool.asset} en ${pool.project}. El rendimiento se acumula automáticamente según la mecánica del protocolo.` },
              { title: "¿De dónde sale el rendimiento?", text: pool.yieldSource },
              { title: "¿Qué costos tengo?", text: pool.fees },
              { title: "¿Qué puede salir mal?", text: pool.riskFactors.join(" · ") },
              { title: "¿Qué tan líquida es la operación?", text: `Liquidez: ${pool.liquidity}. Bloqueo: ${pool.lockPeriod}. TVL actual: ${fmtTVL(pool.tvlUsd)}.` },
            ]}
          />
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-500">
            <span>Fuente: {pool.source} · {pool.project} · {timeAgo(pool.updatedAt)}</span>
            <a href={pool.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">Ver fuente ↗</a>
          </div>
        </div>
      )}
    </div>
  );
}

function ProductBadge({ type }: { type: EarnOpportunity["productType"] }) {
  const map: Record<string, { label: string; cls: string }> = {
    lending: { label: "LENDING", cls: "bg-emerald-950/30 border border-emerald-800/30 text-emerald-400" },
    staking: { label: "STAKING", cls: "bg-blue-950/30 border border-blue-800/30 text-blue-400" },
    restaking: { label: "RESTAKING", cls: "bg-purple-950/30 border border-purple-800/30 text-purple-400" },
    lp: { label: "LP", cls: "bg-amber-950/30 border border-amber-800/30 text-amber-400" },
    vault: { label: "VAULT", cls: "bg-slate-800 border border-slate-700 text-slate-300" },
    cdp: { label: "CDP", cls: "bg-rose-950/30 border border-rose-800/30 text-rose-400" },
  };
  const m = map[type] || map.vault;
  return <span className={`text-[9px] px-1.5 py-0.5 rounded ${m.cls}`}>{m.label}</span>;
}

function HumanExplainer({ blocks }: { blocks: { title: string; text: string }[] }) {
  return (
    <div className="space-y-2">
      {blocks.map((b, i) => (
        <div key={i}>
          <div className="text-[10px] uppercase text-emerald-400 font-semibold mb-0.5">{b.title}</div>
          <p className="text-xs text-slate-300 leading-relaxed">{b.text}</p>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// P2P & ARBITRAJE SECTION
// ============================================================
function P2PArbitrageSection() {
  const [sub, setSub] = useState<"p2p" | "arb">("p2p");

  return (
    <div className="space-y-4">
      <ModuleIntro
        title="P2P & Arbitraje"
        text="P2P es un mercado de compra y venta directa entre personas. Arbitraje es una estrategia que busca aprovechar diferencias de precio entre mercados. Aquí puedes hacer ambas cosas: ver precios P2P reales por exchange y buscar oportunidades de arbitraje entre ellos."
      />

      {/* Sub-tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800">
        <SubTab active={sub === "p2p"} onClick={() => setSub("p2p")} icon={Activity} label="P2P" />
        <SubTab active={sub === "arb"} onClick={() => setSub("arb")} icon={Zap} label="Arbitraje" />
      </div>

      {sub === "p2p" ? (
        <div className="space-y-3">
          <Banner
            color="purple"
            text="P2P requiere actividad: no es rendimiento pasivo. Aquí ves precios reales de compra y venta entre personas en distintos exchanges. Cuidado con estafas: verifica reputación y métodos de pago."
          />
          <P2PArbitragePanel />
        </div>
      ) : (
        <div className="space-y-3">
          <Banner
            color="blue"
            text="Arbitraje busca diferencias de precio entre exchanges. La oportunidad solo se muestra si sobrevive a fees y slippage conocidos. Cuando faltan datos, se muestra 'Margen potencial'."
          />
          <P2PArbitragePanel />
        </div>
      )}
    </div>
  );
}

function SubTab({ active, onClick, icon: Icon, label }: any) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 text-xs font-medium border-b-2 transition flex items-center gap-1.5 ${
        active
          ? "border-purple-500 text-purple-300"
          : "border-transparent text-slate-400 hover:text-slate-200"
      }`}
    >
      <Icon className="w-3.5 h-3.5" /> {label}
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
// FUNDING & BASIS SECTION
// ============================================================
function FundingBasisSection() {
  const [sub, setSub] = useState<"funding" | "basis">("funding");
  const [symbol, setSymbol] = useState("BTCUSDT");

  return (
    <div className="space-y-4">
      <ModuleIntro
        title="Funding & Basis"
        text="Funding es un pago periódico entre posiciones largas y cortas en futuros perpetuos. Basis es la diferencia entre el precio spot y el precio de futuros. Ninguno es rendimiento garantizado: cambian con el mercado y pueden ser negativos."
      />

      {/* Sub-tabs */}
      <div className="flex items-center justify-between gap-2 flex-wrap border-b border-slate-800">
        <div className="flex items-center gap-2">
          <SubTab active={sub === "funding"} onClick={() => setSub("funding")} icon={Activity} label="Funding" />
          <SubTab active={sub === "basis"} onClick={() => setSub("basis")} icon={BarChart3} label="Basis" />
        </div>
        <div className="flex items-center gap-1 flex-wrap pb-2">
          <span className="text-xs text-slate-500 mr-1">Activo:</span>
          {FUNDING_SYMBOLS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSymbol(s.id)}
              className={`px-2.5 py-1 text-[11px] rounded transition ${
                symbol === s.id ? "bg-amber-500 text-black" : "bg-slate-800 text-slate-400 hover:bg-slate-700"
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>

      {sub === "funding" ? <FundingCard symbol={symbol} /> : <BasisCard symbol={symbol} />}
    </div>
  );
}

// ============================================================
// FUNDING CARD — Multi-exchange
// ============================================================
function FundingCard({ symbol }: { symbol: string }) {
  const [data, setData] = useState<FundingMultiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [advanced, setAdvanced] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/earn/funding?symbol=${symbol}`);
      const d = await res.json();
      setData(d);
    } catch {
      setData({
        symbol,
        primary: null,
        fallbacks: [],
        failed: [{ exchange: "ALL", reason: "Error de red" }],
        updatedAt: Date.now(),
      });
    }
    setLoading(false);
  }, [symbol]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const i = setInterval(load, 30_000);
    return () => clearInterval(i);
  }, [load]);

  if (loading) {
    return (
      <div className="flex flex-col items-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-amber-400 mb-2" />
        <p className="text-xs text-slate-400">Consultando Binance, Bybit, OKX, Gate.io…</p>
      </div>
    );
  }

  if (!data || (!data.primary && data.fallbacks.length === 0)) {
    return (
      <ErrorBox
        message="En este momento no hay datos de funding disponibles para este mercado en ninguna fuente."
        onRetry={load}
      />
    );
  }

  const all = [data.primary, ...data.fallbacks].filter(Boolean) as FundingData[];

  return (
    <div className="space-y-3">
      {/* Status badges */}
      <div className="flex items-center gap-2 flex-wrap text-[11px]">
        {all.map((f) => (
          <span key={f.exchange} className="flex items-center gap-1 px-2 py-0.5 bg-emerald-950/30 border border-emerald-800/30 text-emerald-400 rounded">
            <Check className="w-3 h-3" /> {f.exchange}
          </span>
        ))}
        {data.failed.map((f) => (
          <span key={f.exchange} className="flex items-center gap-1 px-2 py-0.5 bg-rose-950/30 border border-rose-800/30 text-rose-400 rounded" title={f.reason}>
            <X className="w-3 h-3" /> {f.exchange}
          </span>
        ))}
        <button
          onClick={() => setAdvanced(!advanced)}
          className="ml-auto text-[11px] px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded transition flex items-center gap-1"
        >
          {advanced ? <Eye className="w-3 h-3" /> : <BarChart3 className="w-3 h-3" />} {advanced ? "Simple" : "Avanzado"}
        </button>
        <button onClick={load} className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-400 transition">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {data.failed.length > 0 && data.primary && (
        <div className="bg-amber-950/20 border border-amber-700/30 rounded-lg p-3 text-[11px] text-amber-300 flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            {data.failed.map((f) => f.exchange).join(", ")} no respondió en este momento. Mostrando datos de <b>{data.primary!.exchange}</b>.
          </span>
        </div>
      )}

      {/* Multi-exchange cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {all.map((f) => (
          <FundingExchangeCard key={f.exchange} f={f} advanced={advanced} />
        ))}
      </div>

      {/* Explainer */}
      <FundingExplainer data={data.primary} />

      <div className="text-[10px] text-slate-500 flex items-center justify-between">
        <span>Actualizado {timeAgo(data.updatedAt)}</span>
      </div>
    </div>
  );
}

function FundingExchangeCard({ f, advanced }: { f: FundingData; advanced: boolean }) {
  const nextFunding = f.nextFundingTime ? new Date(f.nextFundingTime).toLocaleString() : "—";
  const positive = f.fundingRate >= 0;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-xs font-bold text-amber-400">
            {f.exchange[0]}
          </div>
          <div>
            <div className="text-sm font-bold text-slate-100">{f.exchange}</div>
            <div className="text-[10px] text-slate-500">{f.asset} · {f.source}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="bg-slate-950/50 rounded-lg p-2.5">
          <div className="text-[10px] text-slate-500 uppercase">Funding actual</div>
          <div className={`text-lg font-bold font-mono ${positive ? "text-emerald-400" : "text-rose-400"}`}>
            {f.fundingRate >= 0 ? "+" : ""}{f.fundingRate.toFixed(4)}%
          </div>
          <div className="text-[10px] text-slate-500">cada {f.fundingIntervalHours}h</div>
        </div>
        <div className="bg-slate-950/50 rounded-lg p-2.5">
          <div className="text-[10px] text-slate-500 uppercase">Anualizado</div>
          <div className={`text-lg font-bold font-mono ${f.annualizedFunding >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {f.annualizedFunding >= 0 ? "+" : ""}{f.annualizedFunding.toFixed(2)}%
          </div>
          <div className="text-[10px] text-slate-500">estimación</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <div className="text-[9px] text-slate-500 uppercase">Spot (Index)</div>
          <div className="text-slate-200 font-mono">${f.indexPrice.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-[9px] text-slate-500 uppercase">Futures (Mark)</div>
          <div className="text-slate-200 font-mono">${f.markPrice.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-[9px] text-slate-500 uppercase">Próximo funding</div>
          <div className="text-slate-300 font-mono text-[10px]">{nextFunding}</div>
        </div>
        <div>
          <div className="text-[9px] text-slate-500 uppercase">Histórico 7d / 30d</div>
          <div className="text-slate-300 font-mono text-[10px]">
            {f.historical["7d"].toFixed(4)}% / {f.historical["30d"].toFixed(4)}%
          </div>
        </div>
      </div>

      {/* Mini chart */}
      {f.historical.series.length > 1 && (
        <div>
          <div className="text-[9px] text-slate-500 uppercase mb-1">Histórico reciente</div>
          <Sparkline data={f.historical.series.map((s) => s.v)} />
        </div>
      )}

      {advanced && (
        <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-500 font-mono">
          {f.notes}
        </div>
      )}

      <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-500">
        <span>Actualizado {timeAgo(f.updatedAt)}</span>
        <a
          href={f.exchange === "Binance" ? `https://www.binance.com/en/futures/funding-history/perp/${f.symbol}`
            : f.exchange === "Bybit" ? `https://www.bybit.com/trade/usdt/${f.symbol}`
            : f.exchange === "OKX" ? `https://www.okx.com/futures/popular/${f.asset.toLowerCase()}-usdt-swap`
            : "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-300"
        >
          Ver fuente ↗
        </a>
      </div>
    </div>
  );
}

function FundingExplainer({ data }: { data: FundingData | null }) {
  if (!data) return null;
  const positive = data.fundingRate >= 0;
  return (
    <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-4 space-y-2">
      <div className="text-[10px] uppercase text-amber-400 font-semibold">¿Qué significa?</div>
      <p className="text-xs text-slate-300 leading-relaxed">
        {positive
          ? `El funding es positivo: los traders con posición larga pagan a los traders con posición corta. Esto indica más demanda de posiciones largas en ${data.asset}. Si tienes una posición corta, recibes el funding; si tienes una larga, lo pagas.`
          : `El funding es negativo: los traders cortos pagan a los largos. Hay más presión vendedora en ${data.asset}. Si tienes una posición larga, recibes el funding; si tienes una corta, lo pagas.`}
      </p>
      <p className="text-xs text-slate-400 leading-relaxed">
        La anualización de <b className="text-amber-400">{data.annualizedFunding.toFixed(2)}%</b> asume que la tasa actual se mantiene constante, lo cual <b className="text-amber-400">no es realista</b>. El funding cambia cada {data.fundingIntervalHours} horas.
      </p>
      <p className="text-[11px] text-slate-500">
        Funding actual ≠ funding durante todo el período. Revisa el histórico para tener contexto.
      </p>
    </div>
  );
}

// ============================================================
// BASIS CARD — Multi-exchange
// ============================================================
function BasisCard({ symbol }: { symbol: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [advanced, setAdvanced] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/earn/basis?symbol=${symbol}`);
      const d = await res.json();
      setData(d);
    } catch {
      setData({
        primary: null,
        fallbacks: [],
        failed: [{ exchange: "ALL", reason: "Error de red" }],
        updatedAt: Date.now(),
      });
    }
    setLoading(false);
  }, [symbol]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const i = setInterval(load, 30_000);
    return () => clearInterval(i);
  }, [load]);

  if (loading) {
    return (
      <div className="flex flex-col items-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-amber-400 mb-2" />
        <p className="text-xs text-slate-400">Consultando Binance COIN-M, Bybit…</p>
      </div>
    );
  }

  if (!data || (!data.primary && data.fallbacks.length === 0)) {
    return (
      <ErrorBox
        message="En este momento no hay datos de basis disponibles para este mercado en ninguna fuente."
        onRetry={load}
      />
    );
  }

  const all: BasisData[] = [data.primary, ...data.fallbacks].filter(Boolean) as BasisData[];

  return (
    <div className="space-y-3">
      {/* Status */}
      <div className="flex items-center gap-2 flex-wrap text-[11px]">
        {all.map((b) => (
          <span key={b.exchange} className="flex items-center gap-1 px-2 py-0.5 bg-emerald-950/30 border border-emerald-800/30 text-emerald-400 rounded">
            <Check className="w-3 h-3" /> {b.exchange}
          </span>
        ))}
        {data.failed.map((f: any) => (
          <span key={f.exchange} className="flex items-center gap-1 px-2 py-0.5 bg-rose-950/30 border border-rose-800/30 text-rose-400 rounded" title={f.reason}>
            <X className="w-3 h-3" /> {f.exchange}
          </span>
        ))}
        <button
          onClick={() => setAdvanced(!advanced)}
          className="ml-auto text-[11px] px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded transition flex items-center gap-1"
        >
          {advanced ? <Eye className="w-3 h-3" /> : <BarChart3 className="w-3 h-3" />} {advanced ? "Simple" : "Avanzado"}
        </button>
        <button onClick={load} className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-400 transition">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {data.failed.length > 0 && data.primary && (
        <div className="bg-amber-950/20 border border-amber-700/30 rounded-lg p-3 text-[11px] text-amber-300 flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            {data.failed.map((f: any) => f.exchange).join(", ")} no respondió en este momento. Mostrando datos de <b>{data.primary.exchange}</b>.
          </span>
        </div>
      )}

      {/* Multi-exchange cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {all.map((b) => (
          <BasisExchangeCard key={b.exchange} b={b} advanced={advanced} />
        ))}
      </div>

      <BasisExplainer data={data.primary} />

      <div className="text-[10px] text-slate-500 flex items-center justify-between">
        <span>Actualizado {timeAgo(data.updatedAt)}</span>
      </div>
    </div>
  );
}

function BasisExchangeCard({ b, advanced }: { b: BasisData; advanced: boolean }) {
  const positive = b.basis >= 0;
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-xs font-bold text-blue-400">
            {b.exchange[0]}
          </div>
          <div>
            <div className="text-sm font-bold text-slate-100">{b.exchange}</div>
            <div className="text-[10px] text-slate-500">{b.asset} · {b.contractType} · {b.period}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="bg-slate-950/50 rounded-lg p-2.5">
          <div className="text-[10px] text-slate-500 uppercase">Basis</div>
          <div className={`text-lg font-bold font-mono ${positive ? "text-emerald-400" : "text-rose-400"}`}>
            {positive ? "+" : ""}{b.basis.toFixed(3)}%
          </div>
          <div className="text-[10px] text-slate-500">futures vs spot</div>
        </div>
        <div className="bg-slate-950/50 rounded-lg p-2.5">
          <div className="text-[10px] text-slate-500 uppercase">Anualizado</div>
          <div className={`text-lg font-bold font-mono ${b.annualizedBasisRate >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {b.annualizedBasisRate >= 0 ? "+" : ""}{b.annualizedBasisRate.toFixed(2)}%
          </div>
          <div className="text-[10px] text-slate-500">estimación</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <div className="text-[9px] text-slate-500 uppercase">Spot / Index</div>
          <div className="text-slate-200 font-mono">${b.spotPrice.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-[9px] text-slate-500 uppercase">Futures</div>
          <div className="text-slate-200 font-mono">${b.futuresPrice.toFixed(2)}</div>
        </div>
        <div className="col-span-2">
          <div className="text-[9px] text-slate-500 uppercase">Diferencia</div>
          <div className={`font-mono ${positive ? "text-emerald-400" : "text-rose-400"}`}>
            {positive ? "+" : ""}{(b.futuresPrice - b.spotPrice).toFixed(2)} USD
          </div>
        </div>
      </div>

      {advanced && (
        <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-500 font-mono">
          {b.notes}
        </div>
      )}

      <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-500">
        <span>Actualizado {timeAgo(b.timestamp)}</span>
        <span className="text-slate-600">{b.source}</span>
      </div>
    </div>
  );
}

function BasisExplainer({ data }: { data: BasisData | null }) {
  if (!data) return null;
  const positive = data.basis >= 0;
  return (
    <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-4 space-y-2">
      <div className="text-[10px] uppercase text-blue-400 font-semibold">¿Qué significa?</div>
      <p className="text-xs text-slate-300 leading-relaxed">
        {positive
          ? `El futures está cotizando <b className="text-emerald-400">por encima</b> del spot (${data.basis.toFixed(3)}% más caro). Esto suele indicar expectativa alcista en el mercado. La anualización de ${data.annualizedBasisRate.toFixed(2)}% es teórica: asume que la diferencia se mantiene todo el año, lo cual no es realista.`
          : `El futures está cotizando <b className="text-rose-400">por debajo</b> del spot (${Math.abs(data.basis).toFixed(3)}% más barato). Esto suele indicar expectativa bajista o estrategias de short. La anualización de ${data.annualizedBasisRate.toFixed(2)}% es teórica y no garantizada.`}
      </p>
      <p className="text-[11px] text-slate-500">
        Basis ≠ ganancia garantizada. Para capturarlo necesitas tomar posición en futuros, lo cual implica costos y riesgo.
      </p>
    </div>
  );
}

// ============================================================
// SPARKLINE — mini chart sin librerías
// ============================================================
function Sparkline({ data, color = "#f59e0b" }: { data: number[]; color?: string }) {
  if (!data || data.length < 2) return null;
  const w = 220;
  const h = 36;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = w / (data.length - 1);
  const points = data.map((v, i) => `${(i * step).toFixed(1)},${(h - ((v - min) / range) * h).toFixed(1)}`).join(" ");
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" />
      <circle cx={w} cy={h - ((data[data.length - 1] - min) / range) * h} r="2" fill={color} />
    </svg>
  );
}
