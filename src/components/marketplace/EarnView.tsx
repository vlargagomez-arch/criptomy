"use client";

import { useState, useEffect, useCallback } from "react";
import {
  TrendingUp, TrendingDown, Loader2, Info, ShieldCheck,
  Activity, Zap, ExternalLink, RefreshCw, Lock, Unlock,
  Building2, Coins, BarChart3, ArrowRight, CheckCircle2, AlertCircle,
  Award,
} from "lucide-react";
import P2PArbitrageView from "./P2PArbitrageView";

interface YieldPool {
  protocol: string;
  protocolIcon: string;
  asset: string;
  chain: string;
  supplyAPY: number;
  borrowAPY?: number;
  tvlUsd: number;
  type: string; // "lending" | "staking" | "stable-pool"
  url: string;
  description: string;
  risk: "BAJO" | "MEDIO" | "ALTO";
}

const ALL_POOLS: YieldPool[] = [
  // ============================================================
  // RIESGO BAJO — Protocolos auditados, stablecoins, TVL alto
  // APY: 0.01% - 6.5% | Riesgo: smart contract bug (auditado, raro)
  // ============================================================

  // AAVE V3 — Polygon
  { protocol: "Aave V3", protocolIcon: "👻", asset: "USDC", chain: "Polygon", supplyAPY: 2.96, borrowAPY: 4.95, tvlUsd: 11_500_000, type: "lending", url: "https://app.aave.com/?marketName=proto_polygon_v3", description: "Deposita USDC y gana interés. Préstamos contra colateral.", risk: "BAJO" },
  { protocol: "Aave V3", protocolIcon: "👻", asset: "USDT", chain: "Polygon", supplyAPY: 3.31, borrowAPY: 5.12, tvlUsd: 10_900_000, type: "lending", url: "https://app.aave.com/?marketName=proto_polygon_v3", description: "Deposita USDT y gana interés. Préstamos contra colateral.", risk: "BAJO" },
  { protocol: "Aave V3", protocolIcon: "👻", asset: "DAI", chain: "Polygon", supplyAPY: 3.60, borrowAPY: 4.81, tvlUsd: 1_200_000, type: "lending", url: "https://app.aave.com/?marketName=proto_polygon_v3", description: "Deposita DAI y gana interés. Préstamos contra colateral.", risk: "BAJO" },
  { protocol: "Aave V3", protocolIcon: "👻", asset: "WETH", chain: "Polygon", supplyAPY: 0.28, borrowAPY: 1.87, tvlUsd: 24_300_000, type: "lending", url: "https://app.aave.com/?marketName=proto_polygon_v3", description: "Deposita ETH y gana interés. Préstamos contra colateral.", risk: "BAJO" },
  { protocol: "Aave V3", protocolIcon: "👻", asset: "WBTC", chain: "Polygon", supplyAPY: 0.01, borrowAPY: 0.52, tvlUsd: 65_800_000, type: "lending", url: "https://app.aave.com/?marketName=proto_polygon_v3", description: "Deposita BTC y gana interés. Préstamos contra colateral.", risk: "BAJO" },

  // AAVE V3 — Base
  { protocol: "Aave V3", protocolIcon: "👻", asset: "USDC", chain: "Base", supplyAPY: 4.12, borrowAPY: 5.45, tvlUsd: 520_000_000, type: "lending", url: "https://app.aave.com/?marketName=proto_base_v3", description: "Deposita USDC en Base (L2 de Coinbase). Gas barato.", risk: "BAJO" },

  // AAVE V3 — Arbitrum
  { protocol: "Aave V3", protocolIcon: "👻", asset: "USDC", chain: "Arbitrum", supplyAPY: 3.85, borrowAPY: 5.22, tvlUsd: 0, type: "lending", url: "https://app.aave.com/?marketName=proto_arbitrum_v3", description: "Deposita USDC en Arbitrum (L2). Gas barato.", risk: "BAJO" },

  // COMPOUND V3 — Ethereum
  { protocol: "Compound V3", protocolIcon: "🟢", asset: "USDC", chain: "Ethereum", supplyAPY: 3.34, borrowAPY: 4.50, tvlUsd: 38_400_000, type: "lending", url: "https://app.compound.finance/", description: "Segundo mayor protocolo DeFi. Auditado.", risk: "BAJO" },
  { protocol: "Compound V3", protocolIcon: "🟢", asset: "USDT", chain: "Ethereum", supplyAPY: 3.09, borrowAPY: 4.20, tvlUsd: 32_400_000, type: "lending", url: "https://app.compound.finance/", description: "Deposita USDT en Compound. Interés variable.", risk: "BAJO" },

  // COMPOUND V3 — Base (APY más alto, TVL bajo = más volátil)
  { protocol: "Compound V3", protocolIcon: "🟢", asset: "USDC", chain: "Base", supplyAPY: 6.44, borrowAPY: 7.80, tvlUsd: 800_000, type: "lending", url: "https://app.compound.finance/", description: "USDC en Base. APY más alto pero TVL bajo (puede cambiar rápido).", risk: "MEDIO" },

  // LIDO — Staking ETH
  { protocol: "Lido", protocolIcon: "🌊", asset: "stETH", chain: "Ethereum", supplyAPY: 2.25, tvlUsd: 23_700_000_000, type: "staking", url: "https://lido.fi/", description: "Staking líquido de ETH. Recibes stETH que sube de valor cada día. El mayor pool DeFi del mundo ($23.7B).", risk: "BAJO" },
  { protocol: "Lido", protocolIcon: "🌊", asset: "wstETH", chain: "Arbitrum", supplyAPY: 2.25, tvlUsd: 8_400_000, type: "staking", url: "https://lido.fi/", description: "wstETH en Arbitrum. Staking de ETH con gas barato.", risk: "BAJO" },

  // ============================================================
  // RIESGO MEDIO — LP pools (impermanent loss), APY 10-50%
  // Riesgo: impermanent loss, volatilidad del par, APY variable
  // ============================================================
  { protocol: "Uniswap V3", protocolIcon: "🦄", asset: "USDC/WETH", chain: "Ethereum", supplyAPY: 42.9, tvlUsd: 30_500_000, type: "lp", url: "https://app.uniswap.org/#/pools", description: "Provee liquidez al par USDC/WETH. Ganas fees de trading. RIESGO: impermanent loss si ETH sube/baja mucho.", risk: "MEDIO" },
  { protocol: "Uniswap V3", protocolIcon: "🦄", asset: "WETH/USDC", chain: "Arbitrum", supplyAPY: 40.3, tvlUsd: 35_800_000, type: "lp", url: "https://app.uniswap.org/#/pools", description: "Par WETH/USDC en Arbitrum. Gas barato. APY alto pero variable.", risk: "MEDIO" },
  { protocol: "Uniswap V3", protocolIcon: "🦄", asset: "WBTC/USDT", chain: "Ethereum", supplyAPY: 35.9, tvlUsd: 19_600_000, type: "lp", url: "https://app.uniswap.org/#/pools", description: "Par WBTC/USDT. Ganas fees de trading BTC. RIESGO: impermanent loss.", risk: "MEDIO" },
  { protocol: "Uniswap V3", protocolIcon: "🦄", asset: "WBTC/USDC", chain: "Arbitrum", supplyAPY: 34.3, tvlUsd: 8_900_000, type: "lp", url: "https://app.uniswap.org/#/pools", description: "Par WBTC/USDC en Arbitrum. Gas barato.", risk: "MEDIO" },
  { protocol: "Aerodrome", protocolIcon: "✈️", asset: "USDC/CBBTC", chain: "Base", supplyAPY: 43.3, tvlUsd: 7_500_000, type: "lp", url: "https://aerodrome.finance/", description: "DEX de Base. Provee liquidez USDC/BTC. APY alto, Base gas barato.", risk: "MEDIO" },
  { protocol: "Moonwell", protocolIcon: "🌙", asset: "CBBTC", chain: "Base", supplyAPY: 33.6, tvlUsd: 2_400_000, type: "lending", url: "https://moonwell.fi/", description: "Protocolo de préstamos en Base. APY alto en BTC tokenizado. TVL bajo.", risk: "MEDIO" },

  // ============================================================
  // RIESGO ALTO — LP pools con APY extremo (100%+), TVL bajo
  // Riesgo: impermanent loss severo, APY puede caer a 0, rug pull
  // ============================================================
  { protocol: "Aerodrome", protocolIcon: "✈️", asset: "WETH/USDC", chain: "Base", supplyAPY: 142.9, tvlUsd: 8_200_000, type: "lp", url: "https://aerodrome.finance/", description: "LP WETH/USDC en Base. APY extremo 142%. RIESGO: impermanent loss severo, APY puede caer a 0% en horas.", risk: "ALTO" },
  { protocol: "Uniswap V3", protocolIcon: "🦄", asset: "WETH/ARB", chain: "Arbitrum", supplyAPY: 298.2, tvlUsd: 1_500_000, type: "lp", url: "https://app.uniswap.org/#/pools", description: "LP WETH/ARB. APY 298%. RIESGO ALTO: TVL bajo, ARB volátil, impermanent loss severo.", risk: "ALTO" },
  { protocol: "Uniswap V3", protocolIcon: "🦄", asset: "WBTC/ARB", chain: "Arbitrum", supplyAPY: 211.9, tvlUsd: 2_600_000, type: "lp", url: "https://app.uniswap.org/#/pools", description: "LP WBTC/ARB. APY 212%. RIESGO: par volátil, impermanent loss, APY inestable.", risk: "ALTO" },
  { protocol: "Aerodrome", protocolIcon: "✈️", asset: "WETH/AERO", chain: "Base", supplyAPY: 136.6, tvlUsd: 2_600_000, type: "lp", url: "https://aerodrome.finance/", description: "LP WETH/AERO. APY 137%. RIESGO: token AERO puede perder valor, impermanent loss.", risk: "ALTO" },
  { protocol: "Uniswap V3", protocolIcon: "🦄", asset: "AAVE/WETH", chain: "Ethereum", supplyAPY: 48.4, tvlUsd: 3_800_000, type: "lp", url: "https://app.uniswap.org/#/pools", description: "LP AAVE/WETH. APY 48%. RIESGO: AAVE volátil, impermanent loss, gas caro.", risk: "ALTO" },
  { protocol: "Uniswap V3", protocolIcon: "🦄", asset: "ETH/LINK", chain: "Ethereum", supplyAPY: 46.2, tvlUsd: 21_600_000, type: "lp", url: "https://app.uniswap.org/#/pools", description: "LP ETH/LINK. APY 46%. RIESGO: LINK volátil, impermanent loss, gas caro Ethereum.", risk: "ALTO" },
];

const CHAINS = [
  { id: "ALL", name: "Todas", icon: "🌐" },
  { id: "Polygon", name: "Polygon", icon: "🟣" },
  { id: "Base", name: "Base", icon: "🔵" },
  { id: "Arbitrum", name: "Arbitrum", icon: "🔷" },
  { id: "Ethereum", name: "Ethereum", icon: "💎" },
];

const PROTOCOLS = [
  { id: "ALL", name: "Todos", icon: "📊" },
  { id: "Aave V3", name: "Aave V3", icon: "👻" },
  { id: "Compound V3", name: "Compound V3", icon: "🟢" },
  { id: "Lido", name: "Lido", icon: "🌊" },
];

const RISK_COLORS: Record<string, string> = {
  "BAJO": "text-emerald-400 bg-emerald-950/30 border-emerald-800/50",
  "MEDIO": "text-amber-400 bg-amber-950/30 border-amber-800/50",
  "ALTO": "text-red-400 bg-red-950/30 border-red-800/50",
};

const RISK_LEVELS = [
  { id: "ALL", name: "Todos los riesgos", icon: "📊", desc: "Mostrar todo" },
  { id: "BAJO", name: "Bajo riesgo", icon: "🟢", desc: "0.01-6.5% APY | Protocolos auditados, stablecoins" },
  { id: "MEDIO", name: "Medio riesgo", icon: "🟡", desc: "10-50% APY | LP pools, impermanent loss" },
  { id: "ALTO", name: "Alto riesgo", icon: "🔴", desc: "48-300% APY | APY extremo, puede caer a 0" },
];

export default function EarnView() {
  const [chain, setChain] = useState("ALL");
  const [protocol, setProtocol] = useState("ALL");
  const [riskFilter, setRiskFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  // Sub-tab: "defi" (pools Aave/Compound/Lido) | "p2p-arbitrage" (sección nueva)
  const [subTab, setSubTab] = useState<"defi" | "p2p-arbitrage">("defi");

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  const filtered = ALL_POOLS.filter((p) => {
    if (chain !== "ALL" && p.chain !== chain) return false;
    if (protocol !== "ALL" && p.protocol !== protocol) return false;
    if (riskFilter !== "ALL" && p.risk !== riskFilter) return false;
    return true;
  }).sort((a, b) => b.supplyAPY - a.supplyAPY);

  const bestAPY = filtered[0]?.supplyAPY || 0;
  const totalTVL = filtered.reduce((sum, p) => sum + p.tvlUsd, 0);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-emerald-400" />
          Earn — Rendimientos sin banco
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Pon tu cripto a trabajar. DeFi (Aave, Compound, Lido) o Arbitraje P2P (Binance, Kraken, Bitvavo).
          Sin KYC, sin banco, sin aprobación.
        </p>
      </div>

      {/* Sub-nav interna: DeFi | Arbitraje P2P */}
      <div className="mb-6 flex gap-1 bg-slate-900/50 border border-slate-800 rounded-xl p-1 max-w-md">
        <button
          onClick={() => setSubTab("defi")}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition ${
            subTab === "defi"
              ? "bg-emerald-600 text-white"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          DeFi Pools
        </button>
        <button
          onClick={() => setSubTab("p2p-arbitrage")}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition ${
            subTab === "p2p-arbitrage"
              ? "bg-purple-600 text-white"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          }`}
        >
          <Award className="w-3.5 h-3.5" />
          Arbitraje P2P
          <span className="text-[9px] px-1 py-0.5 bg-purple-900/50 text-purple-300 rounded">NEW</span>
        </button>
      </div>

      {/* ============================================================ */}
      {/* SUB-TAB: Arbitraje P2P — Binance + Kraken + Bitvavo + más */}
      {/* ============================================================ */}
      {subTab === "p2p-arbitrage" && <P2PArbitrageView />}

      {/* ============================================================ */}
      {/* SUB-TAB: DeFi Pools — Aave / Compound / Lido / Uniswap */}
      {/* ============================================================ */}
      {subTab === "defi" && (
        <>
      {/* Panel explicativo */}
      <div className="mb-6 bg-gradient-to-br from-emerald-950/30 to-slate-900 border border-emerald-800/50 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wide">
            ¿Qué es DeFi y por qué importa?
          </h3>
        </div>
        <p className="text-[13px] text-slate-400 mb-4">
          DeFi (Finanzas Descentralizadas) son protocolos que funcionan sin banco. En vez de depositar
          en un banco que te paga 0.01% al año, depositas en <b className="text-slate-200">smart contracts auditados</b> que
          pagan <b className="text-emerald-400">2-6% APY real</b>. Sin KYC, sin revisión de crédito, sin aprobación.
          Tu cripto está en la blockchain, no en un banco.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Aave */}
          <div className="bg-slate-800/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">👻</span>
              <b className="text-sm text-slate-200">Aave V3</b>
            </div>
            <p className="text-[11px] text-slate-400">
              Mayor protocolo de préstamos DeFi. <b className="text-slate-300">$12B+ en TVL.</b>
              Depositas y ganas interés. Pides préstamos contra tu colateral.
              <a href="https://github.com/aave/aave-v3-core" target="_blank" rel="noopener noreferrer" className="text-emerald-400 ml-1">GitHub ↗</a>
            </p>
          </div>
          {/* Compound */}
          <div className="bg-slate-800/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">🟢</span>
              <b className="text-sm text-slate-200">Compound V3</b>
            </div>
            <p className="text-[11px] text-slate-400">
              Segundo mayor protocolo. <b className="text-slate-300">$2B+ en TVL.</b>
              Depósitos y préstamos con tasas variables. Base tiene el APY más alto (6.44% USDC).
              <a href="https://github.com/compound-finance/comet" target="_blank" rel="noopener noreferrer" className="text-emerald-400 ml-1">GitHub ↗</a>
            </p>
          </div>
          {/* Lido */}
          <div className="bg-slate-800/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">🌊</span>
              <b className="text-sm text-slate-200">Lido</b>
            </div>
            <p className="text-[11px] text-slate-400">
              Staking líquido de Ethereum. <b className="text-slate-300">$23.7B en TVL — el más grande.</b>
              Depositas ETH, recibes stETH que sube de valor cada día. 2.25% APY.
              <a href="https://github.com/lidofinance/lido-ethereum-sdk" target="_blank" rel="noopener noreferrer" className="text-emerald-400 ml-1">GitHub ↗</a>
            </p>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-slate-800 flex items-center gap-4 flex-wrap text-[10px] text-slate-400">
          <span className="flex items-center gap-1.5"><ShieldCheck className="w-3 h-3 text-emerald-400" /> Smart contracts auditados</span>
          <span className="flex items-center gap-1.5"><Lock className="w-3 h-3 text-emerald-400" /> Non-custodial (tus claves)</span>
          <span className="flex items-center gap-1.5"><Activity className="w-3 h-3 text-emerald-400" /> Datos reales on-chain</span>
          <span className="flex items-center gap-1.5"><Unlock className="w-3 h-3 text-emerald-400" /> Retira cuando quieras</span>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
          <div className="text-[10px] text-slate-500 uppercase">Mejor APY</div>
          <div className="text-xl font-bold text-emerald-400">{bestAPY.toFixed(2)}%</div>
          {filtered[0] && <div className="text-[10px] text-slate-500">{filtered[0].asset} en {filtered[0].protocol}</div>}
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
          <div className="text-[10px] text-slate-500 uppercase">Pools disponibles</div>
          <div className="text-xl font-bold text-slate-100">{filtered.length}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
          <div className="text-[10px] text-slate-500 uppercase">TVL total</div>
          <div className="text-xl font-bold text-blue-400">
            {totalTVL >= 1e9 ? `$${(totalTVL / 1e9).toFixed(1)}B` : `$${(totalTVL / 1e6).toFixed(0)}M`}
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="space-y-2 mb-4">
        {/* Filtro de riesgo */}
        <div className="flex flex-wrap gap-2">
          {RISK_LEVELS.map((r) => (
            <button
              key={r.id}
              onClick={() => setRiskFilter(r.id)}
              className={`px-3 py-1.5 text-xs rounded-lg transition flex items-center gap-1.5 ${
                riskFilter === r.id
                  ? r.id === "BAJO" ? "bg-emerald-600 text-white"
                    : r.id === "MEDIO" ? "bg-amber-600 text-white"
                    : r.id === "ALTO" ? "bg-red-600 text-white"
                    : "bg-slate-600 text-white"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
              title={r.desc}
            >
              {r.icon} {r.name}
            </button>
          ))}
        </div>
        {/* Filtros protocolo y chain */}
        <div className="flex flex-wrap gap-2">
          {PROTOCOLS.map((p) => (
            <button
              key={p.id}
              onClick={() => setProtocol(p.id)}
              className={`px-3 py-1.5 text-xs rounded-lg transition ${
                protocol === p.id ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {p.icon} {p.name}
            </button>
          ))}
          <div className="w-px bg-slate-800 mx-1" />
          {CHAINS.map((c) => (
            <button
              key={c.id}
              onClick={() => setChain(c.id)}
              className={`px-3 py-1.5 text-xs rounded-lg transition ${
                chain === c.id ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {c.icon} {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla de pools */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-400 mb-3" />
          <p className="text-sm text-slate-400">Cargando pools DeFi…</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((pool, i) => (
            <PoolCard key={`${pool.protocol}-${pool.asset}-${pool.chain}-${i}`} pool={pool} rank={i + 1} />
          ))}
        </div>
      )}

      {/* Cómo funciona */}
      <div className="mt-8 bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
        <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wide mb-4 flex items-center gap-2">
          <Info className="w-3.5 h-3.5 text-emerald-400" />
          Cómo funciona cada protocolo
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Aave */}
          <div>
            <div className="text-sm font-semibold text-emerald-400 mb-2 flex items-center gap-1">
              👻 Aave V3 — Préstamos
            </div>
            <ol className="text-[11px] text-slate-400 space-y-1 list-decimal pl-4">
              <li>Conectas tu wallet a Aave V3 en Polygon/Base</li>
              <li>Depositas USDC, USDT, ETH, etc.</li>
              <li>Recibes aTokens que acumulan interés</li>
              <li>Ganas el APY mostrado — interés real, cada bloque</li>
              <li>Retiras cuando quieras — sin lock-up</li>
            </ol>
            <div className="mt-2 text-[10px] text-amber-400">
              ⚠️ Si pides préstamo y tu health factor cae &lt; 1, liquidan tu colateral
            </div>
          </div>
          {/* Compound */}
          <div>
            <div className="text-sm font-semibold text-emerald-400 mb-2 flex items-center gap-1">
              🟢 Compound V3 — Mercado
            </div>
            <ol className="text-[11px] text-slate-400 space-y-1 list-decimal pl-4">
              <li>Conectas tu wallet a Compound</li>
              <li>Depositas USDC/USDT en el mercado</li>
              <li>Recibes cTokens que representan tu depósito + interés</li>
              <li>Ganas el APY mostrado — tasa variable en tiempo real</li>
              <li>Base tiene el APY más alto (6.44% USDC) pero TVL bajo</li>
            </ol>
          </div>
          {/* Lido */}
          <div>
            <div className="text-sm font-semibold text-emerald-400 mb-2 flex items-center gap-1">
              🌊 Lido — Staking ETH
            </div>
            <ol className="text-[11px] text-slate-400 space-y-1 list-decimal pl-4">
              <li>Conectas tu wallet a Lido</li>
              <li>Depositas ETH</li>
              <li>Recibes stETH (1:1 con tu ETH)</li>
              <li>stETH sube de valor cada día (2.25% APY)</li>
              <li>Puedes usar stETH en otros DeFi mientras gana</li>
            </ol>
            <div className="mt-2 text-[10px] text-amber-400">
              ⚠️ Riesgo de slashing si un validator hace algo mal (raro)
            </div>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-slate-800 text-[10px] text-slate-500">
          ⚠️ <b>Riesgos generales:</b> Los smart contracts pueden tener bugs (auditados pero no 100% seguros).
          Los APYs cambian constantemente. Esta información es educativa — no es asesoría financiera.
          Nunca deposites más de lo que estás dispuesto a perder. Dyor (Do your own research).
        </div>
      </div>
        </>
      )}
    </div>
  );
}

function PoolCard({ pool, rank }: { pool: YieldPool; rank: number }) {
  const fmtTVL = (tvl: number) => {
    if (tvl >= 1e9) return `$${(tvl / 1e9).toFixed(1)}B`;
    if (tvl >= 1e6) return `$${(tvl / 1e6).toFixed(0)}M`;
    if (tvl >= 1e3) return `$${(tvl / 1e3).toFixed(0)}K`;
    return "$0";
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-emerald-600/30 transition">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
        {/* Left: protocol + asset */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-xl shrink-0">
            {pool.protocolIcon}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-slate-100">{pool.asset}</span>
              <span className="text-[10px] px-1.5 py-0.5 bg-slate-800 rounded text-slate-400">{pool.protocol}</span>
              <span className="text-[10px] text-slate-500">· {pool.chain}</span>
              {pool.type === "staking" && (
                <span className="text-[10px] px-1.5 py-0.5 bg-blue-900/50 text-blue-300 rounded">STAKING</span>
              )}
              <span className={`text-[9px] px-1.5 py-0.5 rounded border ${RISK_COLORS[pool.risk]}`}>
                Riesgo {pool.risk}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">{pool.description}</p>
          </div>
        </div>
        {/* Right: APY + CTA */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <div className="text-xl font-bold text-emerald-400 font-mono">{pool.supplyAPY.toFixed(2)}%</div>
            <div className="text-[9px] text-slate-500 uppercase">APY depósito</div>
          </div>
          <a
            href={pool.url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium flex items-center gap-1 transition"
          >
            Depositar
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 pt-3 border-t border-slate-800">
        <div>
          <div className="text-[9px] text-slate-500 uppercase">TVL</div>
          <div className="text-xs text-slate-300 font-mono">{fmtTVL(pool.tvlUsd)}</div>
        </div>
        {pool.borrowAPY && (
          <div>
            <div className="text-[9px] text-slate-500 uppercase">APY préstamo</div>
            <div className="text-xs text-amber-400 font-mono">{pool.borrowAPY.toFixed(2)}%</div>
          </div>
        )}
        <div>
          <div className="text-[9px] text-slate-500 uppercase">Tipo</div>
          <div className="text-xs text-slate-300">
            {pool.type === "lending" && "Préstamo"}
            {pool.type === "staking" && "Staking"}
            {pool.type === "stable-pool" && "Stable pool"}
          </div>
        </div>
        <div>
          <div className="text-[9px] text-slate-500 uppercase">Gas</div>
          <div className="text-xs text-slate-300">
            {pool.chain === "Ethereum" ? "$5-50" : "$0.01"}
          </div>
        </div>
      </div>
    </div>
  );
}
