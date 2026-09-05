"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2, RefreshCw, ExternalLink, ChevronDown, TrendingUp,
  TrendingDown, Zap, AlertCircle, Check, User, Clock, Trophy, Target,
} from "lucide-react";
import { COUNTRIES, SUPPORTED_ASSETS, type CountryConfig } from "@/lib/api-clients/catalog";
import type { ArbitrageOpportunity, ArbitrageResponse } from "@/lib/p2p-arbitrage/engine-v3";

// ============================================================
// P2PArbitragePanel — Clon exacto de ArbitrajePro
// ============================================================
// Estructura:
//   1. 3 tarjetas de servicios (Sports Value Finder, Polymarket, Arbitraje P2P activa)
//   2. Bloque descripción con icono dorado + badge EN VIVO dorado
//   3. Header: título + badges de estado (En vivo, Oportunidades, Próx, Últ, Refrescar)
//   4. Filtros: 3 dropdowns + Anuncios + Pagos tags
//   5. Stats bar
//   6. Cards de oportunidad (BUY verde / SELL rojo, 2 columnas)
// ============================================================

const EXCHANGE_CIRCLE: Record<string, { bg: string; text: string }> = {
  Binance: { bg: "bg-amber-400", text: "text-black" },
  OKX:     { bg: "bg-slate-600", text: "text-white" },
  Bybit:   { bg: "bg-orange-500", text: "text-white" },
  Kraken:  { bg: "bg-purple-500", text: "text-white" },
};
const EXCHANGE_INITIAL: Record<string, string> = {
  Binance: "B", OKX: "O", Bybit: "Y", Kraken: "K",
};

function fmtPrice(n: number): string {
  if (!n) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: n < 100 ? 2 : 0 });
}

function fmtAmount(n: number): string {
  if (!n) return "—";
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return n.toFixed(0);
}

export default function P2PArbitragePanel() {
  const [country, setCountry] = useState<CountryConfig>(COUNTRIES[0]);
  const [asset, setAsset] = useState("USDT");
  const [payment, setPayment] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ArbitrageResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [refreshIn, setRefreshIn] = useState(20);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        asset, fiat: country.fiat, rows: "15",
        exchanges: "binance,okx,bybit,kraken",
        minReputation: "95", minNetSpread: "0.1",
      });
      if (payment) params.set("payment", payment);
      const res = await fetch(`/api/arbitrage/p2p?${params.toString()}`);
      const json = (await res.json()) as ArbitrageResponse;
      if (!res.ok || !json.success) { setError(json.error || `HTTP ${res.status}`); return; }
      setData(json);
      setExpandedRow(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [asset, country, payment]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshIn(prev => {
        if (prev <= 1) { load(); return 20; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [load]);
  useEffect(() => { setPayment(""); }, [country]);

  const opportunities = data?.opportunities || [];
  const quotes = data?.quotes || {};
  const reputation = data?.reputation;
  const bestOpp = opportunities[0];

  return (
    <div className="space-y-4 text-slate-100">
      {/* ===== 1. TARJETAS DE SERVICIOS ===== */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Sports Value Finder */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-slate-400" />
            </div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white">Sports Value Finder</h3>
              <span className="text-[10px] px-2 py-0.5 bg-slate-800 text-slate-500 rounded-full">● LIVE</span>
            </div>
          </div>
          <p className="text-xs text-slate-400">● En vivo + 📅 Agenda · 26 deportes · SL 10%</p>
        </div>

        {/* Predicciones Polymarket */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center">
              <Target className="w-5 h-5 text-slate-400" />
            </div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white">Predicciones Polymarket</h3>
              <span className="text-[10px] px-2 py-0.5 bg-slate-800 text-slate-500 rounded-full">● LIVE</span>
            </div>
          </div>
          <p className="text-xs text-slate-400">92% winrate · $10–$400/mes · Verificación cada 5s</p>
        </div>

        {/* Arbitraje P2P — ACTIVA */}
        <div className="bg-slate-900 border-2 border-amber-500 rounded-xl p-4 shadow-lg shadow-amber-900/20">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center">
              <Zap className="w-5 h-5 text-black" />
            </div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white">Arbitraje P2P</h3>
              <span className="text-[10px] px-2 py-0.5 bg-amber-500 text-black rounded-full font-bold">● LIVE</span>
            </div>
          </div>
          <p className="text-xs text-amber-400">Binance + OKX + Bybit · Profit real después de fees</p>
        </div>
      </div>

      {/* ===== 2. BLOQUE DESCRIPCIÓN ===== */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
            <Zap className="w-6 h-6 text-amber-500" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-xl font-bold text-white">Arbitraje P2P</h2>
              <span className="text-[11px] px-2.5 py-1 bg-amber-500 text-black rounded-full font-bold">● EN VIVO</span>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed max-w-3xl">
              Compra cripto barato en un exchange P2P y véndelo caro en otro. Anuncios reales en vivo de Binance, OKX y Bybit en paralelo.
              Filtro anti-estafa: solo merchants con ≥80% completion rate. Cálculo de profit NETO después de fees de retiro.
              6 países soportados: Colombia, Argentina, Brasil, México, Europa y USA.
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[11px] text-slate-500 uppercase tracking-wide font-semibold">
              BINANCE + OKX + BYBIT · PROFIT REAL DESPUÉS DE FEES
            </p>
          </div>
        </div>
      </div>

      {/* ===== 3. SECCIÓN ARBITRAJE P2P REAL ===== */}
      {/* Header con badges de estado */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-white">
            Arbitraje P2P Real <span className="text-slate-500 font-normal text-lg">(4 exchanges)</span>
          </h2>
          <p className="text-sm text-slate-400 mt-1 max-w-3xl">
            Compra barato en Binance/OKX/Bybit P2P o Kraken Spot, vende caro en otro.
            Anuncios reales en vivo de 4 exchanges en paralelo. Profit NETO después de fees de retiro crypto.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-950 border border-emerald-700 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-emerald-400 font-medium">En vivo</span>
          </span>
          <span className="text-slate-400">Oportunidades: <b className="text-slate-200">{opportunities.length}</b></span>
          <span className="text-slate-600">|</span>
          <span className="flex items-center gap-1 text-slate-400">
            <Clock className="w-3 h-3" />
            Próx: <b className="text-slate-200">{refreshIn}s</b>
          </span>
          {data && (
            <>
              <span className="text-slate-600">|</span>
              <span className="text-slate-400">Últ: <b className="text-slate-200">{new Date(data.timestamp).toLocaleTimeString()}</b></span>
            </>
          )}
          <span className="text-slate-600">|</span>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-100 text-black rounded-full transition disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Refrescar
          </button>
        </div>
      </div>

      {/* ===== 4. FILTROS ===== */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={country.code}
            onChange={(e) => {
              const c = COUNTRIES.find((x) => x.code === e.target.value);
              if (c) setCountry(c);
            }}
            className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-100 text-sm cursor-pointer focus:outline-none focus:border-amber-500"
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code} className="bg-slate-900">
                {c.code.toLowerCase()} {c.flag} {c.name} ({c.fiat})
              </option>
            ))}
          </select>

          <select
            value={asset}
            onChange={(e) => setAsset(e.target.value)}
            className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-100 text-sm cursor-pointer focus:outline-none focus:border-amber-500"
          >
            {SUPPORTED_ASSETS.map((a) => (
              <option key={a} value={a} className="bg-slate-900">{a}</option>
            ))}
          </select>

          <select
            value={payment}
            onChange={(e) => setPayment(e.target.value)}
            className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-100 text-sm cursor-pointer focus:outline-none focus:border-amber-500"
          >
            <option value="" className="bg-slate-900">Todo método de pag</option>
            {country.paymentMethods.map((m) => (
              <option key={m.id} value={m.id} className="bg-slate-900">{m.name}</option>
            ))}
          </select>

          <div className="ml-auto flex items-center gap-3 text-xs">
            <span className="text-slate-400">Anuncios:</span>
            {Object.entries(quotes).map(([ex, q]) => {
              const circle = EXCHANGE_CIRCLE[ex];
              if (!circle) return null;
              const total = q.buy + q.sell;
              if (total === 0) return null;
              return (
                <span key={ex} className="text-amber-400 font-semibold">
                  {ex} {total}
                </span>
              );
            })}
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-400">Pagos:</span>
          <button
            onClick={() => setPayment("")}
            className={`px-3 py-1 rounded text-xs font-medium transition ${
              !payment ? "bg-amber-500 text-black" : "bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700"
            }`}
          >
            Todos
          </button>
          {country.paymentMethods.map((m) => (
            <button
              key={m.id}
              onClick={() => setPayment(m.id)}
              className={`px-3 py-1 rounded text-xs transition ${
                payment === m.id ? "bg-amber-500 text-black font-medium" : "bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700"
              }`}
            >
              {m.name}
            </button>
          ))}
        </div>
      </div>

      {/* ===== 5. STATS BAR ===== */}
      <div className="flex items-center justify-between gap-4 flex-wrap text-sm">
        <div className="flex items-center gap-4 flex-wrap">
          <span>
            <span className="text-slate-400">Oportunidades:</span>{" "}
            <b className="text-white">{opportunities.length}</b>
          </span>
          <span>
            <span className="text-slate-400">Mejor NETO:</span>{" "}
            <b className="text-emerald-400">{bestOpp ? `+${bestOpp.netSpreadPct.toFixed(2)}%` : "—"}</b>
          </span>
          {reputation && (
            <span className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-slate-400">Reputación mín:</span>
              <b className="text-emerald-400">{reputation.minRequired}%</b>
              <span className="text-slate-500 text-xs">({reputation.merchantsFilteredOut} merchants filtrados)</span>
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 italic">
          * Arbitraje real: comprar barato en un P2P, vender caro en otro · fee de retiro ya descontado
        </p>
      </div>

      {/* ===== ERROR ===== */}
      {error && (
        <div className="bg-red-950/30 border border-red-800/50 rounded-xl p-3 text-sm text-red-300 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      {/* ===== LOADING ===== */}
      {loading && !data && (
        <div className="flex flex-col items-center justify-center py-16 bg-slate-900/30 border border-slate-800 rounded-xl">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500 mb-3" />
          <p className="text-sm text-slate-300">Escaneando 4 exchanges en paralelo…</p>
          <p className="text-xs text-slate-500 mt-1">8 requests · Binance · OKX · Bybit · Kraken</p>
        </div>
      )}

      {/* ===== 6. OPPORTUNITY CARDS ===== */}
      {data && !loading && (
        opportunities.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
            <AlertCircle className="w-10 h-10 mx-auto text-slate-600 mb-3" />
            <p className="text-sm text-slate-300 font-medium">No se detectaron oportunidades rentables</p>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              No hay spread suficiente entre BUY y SELL después de fees de retiro.
              Prueba con otro asset/país o espera al próximo refresh.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {opportunities.map((opp, i) => (
              <OpportunityCard
                key={opp.id}
                opp={opp}
                rank={i + 1}
                fiat={country.fiat}
                expanded={expandedRow === opp.id}
                onToggle={() => setExpandedRow(expandedRow === opp.id ? null : opp.id)}
              />
            ))}
          </div>
        )
      )}
    </div>
  );
}

// ============================================================
// OPPORTUNITY CARD
// ============================================================
function OpportunityCard({ opp, rank, fiat, expanded, onToggle }: {
  opp: ArbitrageOpportunity;
  rank: number;
  fiat: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const isCross = opp.buyExchange !== opp.sellExchange;
  const buyCircle = EXCHANGE_CIRCLE[opp.buyExchange] || { bg: "bg-slate-700", text: "text-white" };
  const sellCircle = EXCHANGE_CIRCLE[opp.sellExchange] || { bg: "bg-slate-700", text: "text-white" };

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
      {/* TOP BAR: badges BUY/SELL + profit */}
      <div className="bg-black px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-950 border border-emerald-600 rounded">
            <span className={`w-5 h-5 rounded-full ${buyCircle.bg} ${buyCircle.text} flex items-center justify-center text-[10px] font-bold`}>
              {EXCHANGE_INITIAL[opp.buyExchange] || "?"}
            </span>
            <span className="text-emerald-300 text-xs font-bold uppercase">BUY {opp.buyExchange}</span>
          </div>
          <span className="text-slate-400">→</span>
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-950 border border-red-600 rounded">
            <span className={`w-5 h-5 rounded-full ${sellCircle.bg} ${sellCircle.text} flex items-center justify-center text-[10px] font-bold`}>
              {EXCHANGE_INITIAL[opp.sellExchange] || "?"}
            </span>
            <span className="text-red-300 text-xs font-bold uppercase">SELL {opp.sellExchange}</span>
          </div>
          {isCross && (
            <span className="text-[10px] px-2 py-0.5 border border-amber-500 text-amber-400 rounded font-semibold tracking-wide">
              CROSS-EXCHANGE
            </span>
          )}
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-emerald-400 leading-none">
            +{opp.netSpreadPct.toFixed(2)}%
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            bruto +{opp.grossSpreadPct.toFixed(2)}% · fees -{opp.feesPct.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* BODY: 2 columnas */}
      <div className="grid grid-cols-1 sm:grid-cols-2">
        {/* BUY */}
        <div className="p-4 bg-emerald-950/60 border-r border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-slate-400 uppercase tracking-wide font-semibold">COMPRAR EN</span>
            <span className="text-emerald-400 font-bold text-sm">{opp.buyExchange}</span>
          </div>
          <div className="text-2xl font-bold text-white font-mono mb-3">
            {fmtPrice(opp.buyPrice)} <span className="text-sm text-slate-400 font-sans">{fiat}</span>
          </div>
          <div className="space-y-1.5 mb-3 text-xs">
            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-slate-400">Merchant:</span>
              <span className="text-slate-100 font-medium">{opp.buyMerchant}</span>
              {opp.buyMerchantPro && <span className="text-[8px] px-1 py-0.5 bg-amber-900/50 text-amber-300 rounded font-semibold">PRO</span>}
            </div>
            <div className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-slate-400">Reputación:</span>
              <b className="text-emerald-400">{opp.buyMerchantReputation.toFixed(1)}%</b>
              <span className="text-slate-500">· {opp.buyMerchantOrderCount.toLocaleString()} órdenes</span>
            </div>
          </div>
          <div className="border border-emerald-900/50 rounded p-2 mb-3 text-[11px] font-mono bg-emerald-950/70">
            <div className="text-emerald-600 uppercase text-[9px] mb-1 font-sans tracking-wide">Límites de operación</div>
            <div className="space-y-0.5">
              <div><span className="text-slate-400">Min:</span> <span className="text-white">{fmtPrice(opp.buyMinAmount)} {fiat}</span></div>
              <div><span className="text-slate-400">Max:</span> <span className="text-white">{fmtPrice(opp.buyMaxAmount)} {fiat}</span></div>
              <div><span className="text-slate-400">Disp:</span> <span className="text-emerald-400">{opp.buyAvailableQty.toFixed(2)} {opp.asset}</span></div>
            </div>
          </div>
          <div className="flex flex-wrap gap-1">
            {opp.buyPaymentMethods.slice(0, 5).map((m) => (
              <span key={m} className="text-[10px] px-2 py-0.5 bg-slate-800 text-slate-300 rounded">{m}</span>
            ))}
          </div>
        </div>

        {/* SELL */}
        <div className="p-4 bg-red-950/60">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-slate-400 uppercase tracking-wide font-semibold">VENDER EN</span>
            <span className="text-red-400 font-bold text-sm">{opp.sellExchange}</span>
          </div>
          <div className="text-2xl font-bold text-white font-mono mb-3">
            {fmtPrice(opp.sellPrice)} <span className="text-sm text-slate-400 font-sans">{fiat}</span>
          </div>
          <div className="space-y-1.5 mb-3 text-xs">
            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-slate-400">Merchant:</span>
              <span className="text-slate-100 font-medium">{opp.sellMerchant}</span>
              {opp.sellMerchantPro && <span className="text-[8px] px-1 py-0.5 bg-amber-900/50 text-amber-300 rounded font-semibold">PRO</span>}
            </div>
            <div className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-slate-400">Reputación:</span>
              <b className="text-emerald-400">{opp.sellMerchantReputation.toFixed(1)}%</b>
              <span className="text-slate-500">· {opp.sellMerchantOrderCount.toLocaleString()} órdenes</span>
            </div>
          </div>
          <div className="border border-red-900/50 rounded p-2 mb-3 text-[11px] font-mono bg-red-950/70">
            <div className="text-red-600 uppercase text-[9px] mb-1 font-sans tracking-wide">Límites de operación</div>
            <div className="space-y-0.5">
              <div><span className="text-slate-400">Min:</span> <span className="text-white">{fmtPrice(opp.sellMinAmount)} {fiat}</span></div>
              <div><span className="text-slate-400">Max:</span> <span className="text-white">{fmtPrice(opp.sellMaxAmount)} {fiat}</span></div>
              <div><span className="text-slate-400">Disp:</span> <span className="text-red-400">{opp.sellAvailableQty.toFixed(2)} {opp.asset}</span></div>
            </div>
          </div>
          <div className="flex flex-wrap gap-1">
            {opp.sellPaymentMethods.slice(0, 5).map((m) => (
              <span key={m} className="text-[10px] px-2 py-0.5 bg-slate-800 text-slate-300 rounded">{m}</span>
            ))}
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div className="bg-slate-950 px-4 py-3">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3 text-xs">
          <div className="text-slate-400">
            Operación: <b className="text-white">{fmtPrice(opp.operationFiatAmount)} {fiat}</b>
            <span className="text-slate-500"> ({opp.operationAssetAmount.toFixed(2)} {opp.asset})</span>
            <span className="text-slate-600 mx-2">·</span>
            Fee retiro: <b className="text-red-400">{opp.withdrawalFee} {opp.asset}</b>
          </div>
          <div>
            <span className="text-white">Profit NETO: </span>
            <b className="text-emerald-400 text-base font-mono">+{fmtPrice(opp.netProfitForOperation)} {fiat}</b>
            <span className="text-slate-500 text-[10px] ml-1">
              (~${(opp.netProfitForOperation / 4100).toFixed(2)} USD/$1000)
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <a href={opp.buyDirectUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded transition font-semibold">
            <Zap className="w-3.5 h-3.5" /> 1. Comprar en {opp.buyExchange} P2P <ExternalLink className="w-3 h-3" />
          </a>
          <a href={opp.sellDirectUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded transition font-semibold">
            <Zap className="w-3.5 h-3.5" /> 2. Vender en {opp.sellExchange} P2P <ExternalLink className="w-3 h-3" />
          </a>
          <button onClick={onToggle} className="ml-auto text-xs text-slate-400 hover:text-slate-200 transition">
            {expanded ? "‹ Ocultar" : "› Detalle"}
          </button>
        </div>
        {expanded && (
          <div className="mt-3 pt-3 border-t border-slate-800 space-y-2 text-xs">
            <div className="text-[10px] uppercase text-slate-500 font-semibold tracking-wide">Cálculo del profit NETO</div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 font-mono text-[11px]">
              <div><div className="text-slate-500 text-[9px] font-sans">Tamaño op.</div><div className="text-slate-200">{fmtPrice(opp.operationFiatAmount)} {fiat}</div></div>
              <div><div className="text-slate-500 text-[9px] font-sans">Asset</div><div className="text-slate-200">{opp.operationAssetAmount.toFixed(3)} {opp.asset}</div></div>
              <div><div className="text-slate-500 text-[9px] font-sans">Spread bruto</div><div className="text-slate-300">+{opp.grossSpreadPct.toFixed(2)}%</div></div>
              <div><div className="text-slate-500 text-[9px] font-sans">Fee retiro</div><div className="text-red-400">-{fmtPrice(opp.withdrawalFeeFiat)} {fiat}</div></div>
              <div><div className="text-slate-500 text-[9px] font-sans">Profit NETO</div><div className="text-emerald-400 font-bold">+{fmtPrice(opp.netProfitForOperation)} {fiat}</div></div>
              <div><div className="text-slate-500 text-[9px] font-sans">Profit/1000</div><div className="text-emerald-400">+{opp.netProfitOn1000.toFixed(2)}</div></div>
            </div>
            {opp.commonPaymentMethod && (
              <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <Check className="w-3 h-3 text-blue-400" />
                Método de pago común: <b className="text-blue-300">{opp.commonPaymentMethod}</b>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
