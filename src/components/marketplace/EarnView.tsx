"use client";

import { useState, useEffect, useMemo } from "react";
import {
  TrendingUp, TrendingDown, Loader2, Info, Shield, Zap, ExternalLink,
  RefreshCw, Lock, Unlock, Coins, AlertCircle, Award, Calculator,
  ChevronDown, ChevronUp, ArrowRight, BarChart3, Building2, Globe2,
  Wallet, Target, Flame, Check, X,
} from "lucide-react";
import P2PArbitragePanel from "../panels/p2p-arbitrage-panel";

// ============================================================
// TIPOS
// ============================================================
interface YieldPool {
  protocol: string;
  protocolIcon: string;
  asset: string;
  chain: string;
  supplyAPY: number;
  borrowAPY?: number;
  tvlUsd: number;
  type: string;
  url: string;
  description: string;
  risk: "BAJO" | "MEDIO" | "ALTO";
  yieldSource: string;
  liquidity: string;
  lockPeriod: string;
  riskFactors: string[];
}

const ALL_POOLS: YieldPool[] = [
  // AAVE V3 — Polygon
  { protocol: "Aave V3", protocolIcon: "👻", asset: "USDC", chain: "Polygon", supplyAPY: 2.96, borrowAPY: 4.95, tvlUsd: 11_500_000, type: "lending", url: "https://app.aave.com/?marketName=proto_polygon_v3", description: "Deposita USDC y gana interés. Préstamos contra colateral.", risk: "BAJO", yieldSource: "Intereses pagados por usuarios que toman préstamos en el mercado de Aave.", liquidity: "Flexible", lockPeriod: "Ninguno", riskFactors: ["Smart contract", "Liquidez"] },
  { protocol: "Aave V3", protocolIcon: "👻", asset: "USDT", chain: "Polygon", supplyAPY: 3.31, borrowAPY: 5.12, tvlUsd: 10_900_000, type: "lending", url: "https://app.aave.com/?marketName=proto_polygon_v3", description: "Deposita USDT y gana interés.", risk: "BAJO", yieldSource: "Intereses de préstamos de Aave.", liquidity: "Flexible", lockPeriod: "Ninguno", riskFactors: ["Smart contract", "Liquidez"] },
  { protocol: "Aave V3", protocolIcon: "👻", asset: "USDC", chain: "Base", supplyAPY: 4.12, borrowAPY: 5.45, tvlUsd: 520_000_000, type: "lending", url: "https://app.aave.com/?marketName=proto_base_v3", description: "USDC en Base (L2 de Coinbase). Gas barato.", risk: "BAJO", yieldSource: "Intereses de préstamos en Base.", liquidity: "Flexible", lockPeriod: "Ninguno", riskFactors: ["Smart contract", "Liquidez"] },
  { protocol: "Aave V3", protocolIcon: "👻", asset: "WETH", chain: "Polygon", supplyAPY: 0.28, borrowAPY: 1.87, tvlUsd: 24_300_000, type: "lending", url: "https://app.aave.com/?marketName=proto_polygon_v3", description: "Deposita ETH y gana interés.", risk: "BAJO", yieldSource: "Intereses de préstamos.", liquidity: "Flexible", lockPeriod: "Ninguno", riskFactors: ["Smart contract", "Volatilidad"] },
  { protocol: "Aave V3", protocolIcon: "👻", asset: "WBTC", chain: "Polygon", supplyAPY: 0.01, borrowAPY: 0.52, tvlUsd: 65_800_000, type: "lending", url: "https://app.aave.com/?marketName=proto_polygon_v3", description: "Deposita BTC (wrapped) y gana interés.", risk: "BAJO", yieldSource: "Intereses de préstamos.", liquidity: "Flexible", lockPeriod: "Ninguno", riskFactors: ["Smart contract", "Volatilidad"] },
  // Compound V3
  { protocol: "Compound V3", protocolIcon: "🟢", asset: "USDC", chain: "Ethereum", supplyAPY: 3.34, borrowAPY: 4.50, tvlUsd: 38_400_000, type: "lending", url: "https://app.compound.finance/", description: "Segundo mayor protocolo DeFi. Auditado.", risk: "BAJO", yieldSource: "Intereses pagados por prestatarios de Compound.", liquidity: "Flexible", lockPeriod: "Ninguno", riskFactors: ["Smart contract", "Liquidez"] },
  { protocol: "Compound V3", protocolIcon: "🟢", asset: "USDT", chain: "Ethereum", supplyAPY: 3.09, borrowAPY: 4.20, tvlUsd: 32_400_000, type: "lending", url: "https://app.compound.finance/", description: "USDT en Compound.", risk: "BAJO", yieldSource: "Intereses de préstamos de Compound.", liquidity: "Flexible", lockPeriod: "Ninguno", riskFactors: ["Smart contract", "Liquidez"] },
  { protocol: "Compound V3", protocolIcon: "🟢", asset: "USDC", chain: "Base", supplyAPY: 6.44, borrowAPY: 7.80, tvlUsd: 800_000, type: "lending", url: "https://app.compound.finance/", description: "USDC en Base. APY alto pero TVL bajo.", risk: "MEDIO", yieldSource: "Intereses de préstamos en Base.", liquidity: "Flexible", lockPeriod: "Ninguno", riskFactors: ["Smart contract", "Liquidez", "Volatilidad de APY"] },
  // Lido
  { protocol: "Lido", protocolIcon: "🌊", asset: "stETH", chain: "Ethereum", supplyAPY: 2.25, tvlUsd: 23_700_000_000, type: "staking", url: "https://lido.fi/", description: "Staking líquido de ETH. Recibes stETH que sube de valor. Mayor pool DeFi ($23.7B).", risk: "BAJO", yieldSource: "Recompensas de staking de Ethereum (validadores).", liquidity: "Flexible (stETH es líquido)", lockPeriod: "Ninguno (pero withdraw puede tardar)", riskFactors: ["Smart contract", "Slashing", "Contraparte (validadores)"] },
  { protocol: "Lido", protocolIcon: "🌊", asset: "wstETH", chain: "Arbitrum", supplyAPY: 2.25, tvlUsd: 8_400_000, type: "staking", url: "https://lido.fi/", description: "wstETH en Arbitrum. Staking de ETH con gas barato.", risk: "BAJO", yieldSource: "Recompensas de staking de Ethereum.", liquidity: "Flexible", lockPeriod: "Ninguno", riskFactors: ["Smart contract", "Slashing", "Puente cross-chain"] },
  // Uniswap V3 LP
  { protocol: "Uniswap V3", protocolIcon: "🦄", asset: "USDC/WETH", chain: "Ethereum", supplyAPY: 42.9, tvlUsd: 30_500_000, type: "lp", url: "https://app.uniswap.org/#/pools", description: "Provee liquidez USDC/WETH. Ganas fees de trading.", risk: "MEDIO", yieldSource: "Comisiones de trading pagadas por usuarios del pool.", liquidity: "Flexible", lockPeriod: "Ninguno", riskFactors: ["Impermanent loss", "Smart contract", "Volatilidad"] },
  { protocol: "Uniswap V3", protocolIcon: "🦄", asset: "WBTC/USDT", chain: "Ethereum", supplyAPY: 35.9, tvlUsd: 19_600_000, type: "lp", url: "https://app.uniswap.org/#/pools", description: "Provee liquidez WBTC/USDT.", risk: "MEDIO", yieldSource: "Comisiones de trading.", liquidity: "Flexible", lockPeriod: "Ninguno", riskFactors: ["Impermanent loss", "Smart contract", "Volatilidad"] },
  // Aerodrome
  { protocol: "Aerodrome", protocolIcon: "✈️", asset: "USDC/CBBTC", chain: "Base", supplyAPY: 43.3, tvlUsd: 7_500_000, type: "lp", url: "https://aerodrome.finance/", description: "DEX de Base. LP USDC/BTC.", risk: "MEDIO", yieldSource: "Comisiones de trading + incentivos AERO.", liquidity: "Flexible", lockPeriod: "Ninguno", riskFactors: ["Impermanent loss", "Smart contract", "Incentivos"] },
  // Alto riesgo
  { protocol: "Aerodrome", protocolIcon: "✈️", asset: "WETH/USDC", chain: "Base", supplyAPY: 142.9, tvlUsd: 8_200_000, type: "lp", url: "https://aerodrome.finance/", description: "LP WETH/USDC en Base. APY extremo 142%.", risk: "ALTO", yieldSource: "Comisiones + incentivos AERO (pueden terminar).", liquidity: "Flexible", lockPeriod: "Ninguno", riskFactors: ["Impermanent loss severo", "Smart contract", "APY inestable", "Incentivos"] },
  { protocol: "Uniswap V3", protocolIcon: "🦄", asset: "WETH/ARB", chain: "Arbitrum", supplyAPY: 298.2, tvlUsd: 1_500_000, type: "lp", url: "https://app.uniswap.org/#/pools", description: "LP WETH/ARB. APY 298%.", risk: "ALTO", yieldSource: "Comisiones de trading.", liquidity: "Flexible", lockPeriod: "Ninguno", riskFactors: ["Impermanent loss severo", "TVL bajo", "Volatilidad"] },
];

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

const SORT_OPTIONS = [
  { id: "apy", name: "APY" },
  { id: "tvl", name: "TVL" },
];

const RISK_COLORS: Record<string, string> = {
  "BAJO": "text-emerald-400 bg-emerald-950/30 border-emerald-800/50",
  "MEDIO": "text-amber-400 bg-amber-950/30 border-amber-800/50",
  "ALTO": "text-red-400 bg-red-950/30 border-red-800/50",
};

function fmtTVL(tvl: number): string {
  if (tvl >= 1e9) return `$${(tvl / 1e9).toFixed(1)}B`;
  if (tvl >= 1e6) return `$${(tvl / 1e6).toFixed(0)}M`;
  if (tvl >= 1e3) return `$${(tvl / 1e3).toFixed(0)}K`;
  return "$0";
}

function calcEarnings(capital: number, apy: number): { d7: number; d30: number; d90: number; y1: number } {
  const y1 = capital * (apy / 100);
  return { d7: y1 / 52, d30: y1 / 12, d90: y1 / 4, y1 };
}

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function EarnView() {
  const [mainTab, setMainTab] = useState<"work" | "p2p" | "arb" | "funding">("work");
  const [assetFilter, setAssetFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("apy");
  const [capital, setCapital] = useState("");
  const [advancedMode, setAdvancedMode] = useState(false);

  const filtered = useMemo(() => {
    let arr = ALL_POOLS.filter((p) => {
      if (assetFilter !== "ALL") {
        if (assetFilter === "BTC" && !p.asset.includes("BTC") && !p.asset.includes("WBTC") && !p.asset.includes("CBBTC")) return false;
        else if (assetFilter === "ETH" && !p.asset.includes("ETH") && !p.asset.includes("stETH") && !p.asset.includes("wstETH")) return false;
        else if (assetFilter !== "BTC" && assetFilter !== "ETH" && !p.asset.includes(assetFilter)) return false;
      }
      if (typeFilter !== "ALL" && p.type !== typeFilter) return false;
      return true;
    });
    arr = [...arr].sort((a, b) => sortBy === "apy" ? b.supplyAPY - a.supplyAPY : b.tvlUsd - a.tvlUsd);
    return arr;
  }, [assetFilter, typeFilter, sortBy]);

  const capitalNum = parseFloat(capital) || 0;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-4">
      {/* ===== HEADER ===== */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-100">Earn</h1>
        <p className="text-sm text-slate-400 mt-1 max-w-3xl">
          Encuentra formas de poner tu capital cripto a trabajar o generar ingresos mediante operaciones activas.
        </p>
      </div>

      {/* ===== 4 MAIN CARDS ===== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <MainCard icon={Coins} title="Poner crypto a trabajar" desc="Rendimiento mediante staking, lending, vaults y otras estrategias." active={mainTab === "work"} onClick={() => setMainTab("work")} color="text-emerald-400" />
        <MainCard icon={TrendingUp} title="P2P" desc="Compra y venta de cripto buscando oportunidades de margen." active={mainTab === "p2p"} onClick={() => setMainTab("p2p")} color="text-purple-400" />
        <MainCard icon={Building2} title="Arbitraje B2B" desc="Busca diferencias de precio entre mercados y proveedores." active={mainTab === "arb"} onClick={() => setMainTab("arb")} color="text-blue-400" />
        <MainCard icon={BarChart3} title="Funding / Basis" desc="Analiza oportunidades de diferencial y financiación entre mercados." active={mainTab === "funding"} onClick={() => setMainTab("funding")} color="text-amber-400" />
      </div>

      {/* ===== CONTENT ===== */}
      {mainTab === "work" && (
        <DeFiSection filtered={filtered} assetFilter={assetFilter} setAssetFilter={setAssetFilter} typeFilter={typeFilter} setTypeFilter={setTypeFilter} sortBy={sortBy} setSortBy={setSortBy} capital={capital} setCapital={setCapital} capitalNum={capitalNum} advancedMode={advancedMode} setAdvancedMode={setAdvancedMode} />
      )}
      {mainTab === "p2p" && (
        <div className="space-y-3">
          <div className="bg-purple-950/20 border border-purple-700/30 rounded-lg p-3 text-xs text-purple-300 flex items-start gap-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span><b>P2P requiere actividad.</b> No es rendimiento pasivo. Buscas diferencias de precio entre compra y venta.</span>
          </div>
          <P2PArbitragePanel />
        </div>
      )}
      {mainTab === "arb" && (
        <div className="space-y-3">
          <div className="bg-blue-950/20 border border-blue-700/30 rounded-lg p-3 text-xs text-blue-300 flex items-start gap-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span><b>Arbitraje B2B</b> busca diferencias de precio entre exchanges. La oportunidad solo se muestra como positiva cuando el diferencial sobrevive a fees, retiro y slippage.</span>
          </div>
          <P2PArbitragePanel />
        </div>
      )}
      {mainTab === "funding" && (
        <FundingSection />
      )}
    </div>
  );
}

// ============================================================
// MAIN CARD
// ============================================================
function MainCard({ icon: Icon, title, desc, active, onClick, color }: any) {
  return (
    <button onClick={onClick} className={`text-left p-3 sm:p-4 rounded-xl border transition ${active ? `bg-slate-800 border-slate-600` : "bg-slate-900 border-slate-800 hover:border-slate-700"}`}>
      <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-slate-800 flex items-center justify-center mb-2 ${color}`}>
        <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
      </div>
      <h3 className="text-xs sm:text-sm font-bold text-slate-100">{title}</h3>
      <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 leading-relaxed">{desc}</p>
    </button>
  );
}

// ============================================================
// DEFI SECTION
// ============================================================
function DeFiSection({ filtered, assetFilter, setAssetFilter, typeFilter, setTypeFilter, sortBy, setSortBy, capital, setCapital, capitalNum, advancedMode, setAdvancedMode }: any) {
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
        {capitalNum > 0 && (
          <p className="mt-2 text-xs text-slate-400">Buscando qué puedes hacer con <b className="text-emerald-400">{capitalNum.toLocaleString()}</b> en oportunidades reales.</p>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Asset filter */}
        <div className="flex items-center gap-1">
          {ASSETS.map((a) => (
            <button key={a.id} onClick={() => setAssetFilter(a.id)}
              className={`px-2.5 py-1 text-[11px] rounded transition ${assetFilter === a.id ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}>
              {a.icon} <span className="hidden sm:inline">{a.name}</span>
            </button>
          ))}
        </div>
        <div className="w-px bg-slate-800 mx-1" />
        {/* Type filter */}
        <div className="flex items-center gap-1">
          {TYPES.map((t) => (
            <button key={t.id} onClick={() => setTypeFilter(t.id)}
              className={`px-2.5 py-1 text-[11px] rounded transition ${typeFilter === t.id ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}>
              {t.name}
            </button>
          ))}
        </div>
        <div className="w-px bg-slate-800 mx-1" />
        {/* Sort */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-slate-500 mr-1">Ordenar:</span>
          {SORT_OPTIONS.map((s) => (
            <button key={s.id} onClick={() => setSortBy(s.id)}
              className={`px-2.5 py-1 text-[11px] rounded transition ${sortBy === s.id ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}>
              {s.name}
            </button>
          ))}
        </div>
        {/* Mode toggle */}
        <button onClick={() => setAdvancedMode(!advancedMode)}
          className="ml-auto text-[11px] px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded transition flex items-center gap-1">
          {advancedMode ? <Eye className="w-3 h-3" /> : <BarChart3 className="w-3 h-3" />}
          {advancedMode ? "Simple" : "Avanzado"}
        </button>
      </div>

      {/* Pool cards */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-500 text-sm">
            No hay oportunidades disponibles para este filtro.
          </div>
        ) : (
          filtered.map((pool: YieldPool, i: number) => (
            <PoolCard key={i} pool={pool} rank={i + 1} capital={capitalNum} advancedMode={advancedMode} />
          ))
        )}
      </div>
    </div>
  );
}

// ============================================================
// POOL CARD
// ============================================================
function PoolCard({ pool, rank, capital, advancedMode }: { pool: YieldPool; rank: number; capital: number; advancedMode: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const earnings = capital > 0 ? calcEarnings(capital, pool.supplyAPY) : null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      {/* Main row */}
      <div className="p-3 sm:p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          {/* Left: protocol + asset */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-xl shrink-0">{pool.protocolIcon}</div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-slate-100">{pool.asset}</span>
                <span className="text-[10px] px-1.5 py-0.5 bg-slate-800 rounded text-slate-400">{pool.protocol}</span>
                <span className="text-[10px] text-slate-500">· {pool.chain}</span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded border ${RISK_COLORS[pool.risk]}`}>{pool.risk}</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">{pool.description}</p>
            </div>
          </div>
          {/* Right: APY + CTA */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <div className="text-xl font-bold text-emerald-400 font-mono">{pool.supplyAPY.toFixed(2)}%</div>
              <div className="text-[9px] text-slate-500 uppercase">APY</div>
            </div>
            <a href={pool.url} target="_blank" rel="noopener noreferrer"
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium flex items-center gap-1 transition">
              Ir <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Key metrics (simple mode) */}
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
            <div className="text-[11px] text-slate-400 truncate" title={pool.yieldSource}>{pool.yieldSource.split(".")[0]}</div>
          </div>
        </div>

        {/* Earnings calculator (if capital entered) */}
        {earnings && (
          <div className="mt-3 bg-emerald-950/20 border border-emerald-800/30 rounded-lg p-3">
            <div className="text-[10px] text-emerald-400 uppercase font-semibold mb-2 flex items-center gap-1"><Calculator className="w-3 h-3" /> Ganancia estimada con {capital.toLocaleString()}</div>
            <div className="grid grid-cols-4 gap-2 text-xs">
              <div><div className="text-slate-500 text-[9px]">7 días</div><div className="text-slate-200 font-mono">≈ {earnings.d7.toFixed(2)}</div></div>
              <div><div className="text-slate-500 text-[9px]">30 días</div><div className="text-slate-200 font-mono">≈ {earnings.d30.toFixed(2)}</div></div>
              <div><div className="text-slate-500 text-[9px]">90 días</div><div className="text-slate-200 font-mono">≈ {earnings.d90.toFixed(2)}</div></div>
              <div><div className="text-slate-500 text-[9px]">1 año</div><div className="text-emerald-400 font-mono font-bold">≈ {earnings.y1.toFixed(2)}</div></div>
            </div>
            <p className="mt-2 text-[10px] text-amber-400/70">Estimación basada en el rendimiento actual. El rendimiento puede cambiar.</p>
          </div>
        )}

        {/* Advanced mode */}
        {advancedMode && (
          <div className="mt-3 pt-3 border-t border-slate-800 grid grid-cols-3 sm:grid-cols-6 gap-2 text-[11px] font-mono">
            {pool.borrowAPY && <div><div className="text-slate-500 text-[9px]">APY préstamo</div><div className="text-amber-400">{pool.borrowAPY.toFixed(2)}%</div></div>}
            <div><div className="text-slate-500 text-[9px]">Tipo</div><div className="text-slate-300">{pool.type}</div></div>
            <div><div className="text-slate-500 text-[9px]">Red</div><div className="text-slate-300">{pool.chain}</div></div>
            <div><div className="text-slate-500 text-[9px]">Gas</div><div className="text-slate-300">{pool.chain === "Ethereum" ? "$5-50" : "$0.01"}</div></div>
            <div><div className="text-slate-500 text-[9px]">Protocolo</div><div className="text-slate-300">{pool.protocol}</div></div>
            <div><div className="text-slate-500 text-[9px]">URL</div><a href={pool.url} target="_blank" className="text-blue-400 truncate">Fuente ↗</a></div>
          </div>
        )}

        {/* Toggle */}
        <button onClick={() => setExpanded(!expanded)} className="mt-2 text-xs text-slate-500 hover:text-slate-300 transition flex items-center gap-1">
          {expanded ? <><ChevronUp className="w-3 h-3" /> Ocultar detalles</> : <><ChevronDown className="w-3 h-3" /> Ver detalles</>}
        </button>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="bg-slate-950/40 border-t border-slate-800 p-4 space-y-3">
          {/* Yield source */}
          <div>
            <div className="text-[10px] uppercase text-emerald-400 font-semibold mb-1">¿De dónde sale este rendimiento?</div>
            <p className="text-xs text-slate-300">{pool.yieldSource}</p>
          </div>
          {/* Risk factors */}
          <div>
            <div className="text-[10px] uppercase text-amber-400 font-semibold mb-2">Factores de riesgo</div>
            <div className="flex flex-wrap gap-1.5">
              {pool.riskFactors.map((r) => (
                <span key={r} className="text-[10px] px-2 py-0.5 bg-amber-950/30 border border-amber-800/30 text-amber-400 rounded">{r}</span>
              ))}
            </div>
          </div>
          {/* Steps */}
          <div>
            <div className="text-[10px] uppercase text-blue-400 font-semibold mb-2">Cómo empezar</div>
            <ol className="space-y-1.5 text-xs text-slate-300">
              <li className="flex items-start gap-2"><span className="text-slate-600 font-bold">1.</span> Ve a <a href={pool.url} target="_blank" className="text-blue-400 hover:text-blue-300">{pool.protocol} ↗</a></li>
              <li className="flex items-start gap-2"><span className="text-slate-600 font-bold">2.</span> Conecta tu wallet (MetaMask, etc.)</li>
              <li className="flex items-start gap-2"><span className="text-slate-600 font-bold">3.</span> Deposita tu {pool.asset}</li>
              <li className="flex items-start gap-2"><span className="text-slate-600 font-bold">4.</span> El rendimiento se acumula automáticamente</li>
              {pool.liquidity === "Flexible" && <li className="flex items-start gap-2"><span className="text-slate-600 font-bold">5.</span> Retira cuando quieras — sin bloqueo</li>}
            </ol>
          </div>
          {/* Source */}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-500">
            <span>Fuente: {pool.protocol} · {pool.chain}</span>
            <span>Actualizado: datos verificados Sept 2024</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// FUNDING / BASIS SECTION (placeholder with real structure)
// ============================================================
function FundingSection() {
  return (
    <div className="space-y-3">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-amber-400" /> Funding / Basis
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          Analiza el diferencial entre precio spot y precio de futuros. Cuando el funding rate es positivo, los traders long pagan a los short.
        </p>
      </div>
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
        <BarChart3 className="w-10 h-10 mx-auto text-slate-700 mb-3" />
        <p className="text-sm text-slate-400 font-medium">Módulo en desarrollo</p>
        <p className="text-xs text-slate-600 mt-1 max-w-md mx-auto">
          Próximamente: datos de funding rate de Binance, OKX y Bybit en tiempo real,
          con cálculo de rendimiento anualizado y análisis de basis.
        </p>
      </div>
      <div className="bg-amber-950/20 border border-amber-700/30 rounded-lg p-3 text-[11px] text-amber-300 flex items-start gap-2">
        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>El funding rate no es un beneficio garantizado. Puede cambiar de signo (de positivo a negativo) en cualquier momento. Requiere position en futuros.</span>
      </div>
    </div>
  );
}
