"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2, RefreshCw, ExternalLink, Shield, ChevronDown,
  TrendingUp, TrendingDown, Zap, AlertCircle, Info, ArrowRight, Award,
  AlertTriangle, Crown, Check, User, Circle,
} from "lucide-react";
import { COUNTRIES, SUPPORTED_ASSETS, type CountryConfig } from "@/lib/api-clients/catalog";
import type { ArbitrageOpportunity, ArbitrageResponse } from "@/lib/p2p-arbitrage/engine-v3";

// ============================================================
// P2PArbitragePanel — Diseño al estilo ArbitrajePro
// ============================================================
// Layout:
//   1. Header: título + status bar (En vivo | Oportunidades: 30 | Próx | Últ | Refrescar)
//   2. Filtros: 3 dropdowns + anuncios count por exchange (color-coded)
//   3. Tags de pago (botones quick filter, activo en amarillo)
//   4. Stats summary bar (Oportunidades, Mejor NETO, Reputación mín)
//   5. Cards de oportunidad (2 columnas: BUY verde | SELL rojo, footer con profit y botones)
// ============================================================

const EXCHANGE_COLORS: Record<string, { bg: string; text: string; border: string; name: string; initial: string }> = {
  Binance: { bg: "bg-yellow-500/20", text: "text-yellow-400", border: "border-yellow-500/30", name: "Binance", initial: "B" },
  OKX:     { bg: "bg-cyan-500/20",    text: "text-cyan-400",   border: "border-cyan-500/30",   name: "OKX",     initial: "O" },
  Bybit:   { bg: "bg-orange-500/20",  text: "text-orange-400", border: "border-orange-500/30", name: "Bybit",   initial: "Y" },
  Kraken:  { bg: "bg-purple-500/20",  text: "text-purple-400", border: "border-purple-500/30", name: "Kraken",  initial: "K" },
};

function ExchangeCircle({ exchange, size = "md" }: { exchange: string; size?: "sm" | "md" | "lg" }) {
  const style = EXCHANGE_COLORS[exchange] || { bg: "bg-slate-700", text: "text-slate-200", border: "border-slate-600", initial: "?", name: exchange };
  const sizeClass = size === "lg" ? "w-10 h-10 text-base" : size === "md" ? "w-8 h-8 text-sm" : "w-6 h-6 text-xs";
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-bold border-2 ${style.bg} ${style.text} ${style.border} ${sizeClass} shrink-0 bg-slate-950`}
      title={style.name}
    >
      {style.initial}
    </span>
  );
}

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

function isSuspicious(opp: ArbitrageOpportunity): boolean {
  return opp.grossSpreadPct > 30;
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================
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
        minReputation: "90", minNetSpread: "0.1",
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
  const suspiciousCount = opportunities.filter(isSuspicious).length;

  return (
    <div className="space-y-3">
      {/* ===== HEADER ===== */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            Arbitraje P2P Real
            <span className="text-sm font-normal text-slate-500">(4 exchanges)</span>
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Compra barato en Binance/OKX/Bybit, vende caro en otro. Profit NETO después de fees de retiro.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-300">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            En vivo
          </span>
          <span className="text-slate-600">|</span>
          <span>Oportunidades: <b className="text-emerald-400">{opportunities.length}</b></span>
          <span className="text-slate-600">|</span>
          <span>Próx: <b className="text-slate-200">{refreshIn}s</b></span>
          {data && (
            <>
              <span className="text-slate-600">|</span>
              <span>Últ: <b className="text-slate-200">{new Date(data.timestamp).toLocaleTimeString()}</b></span>
            </>
          )}
          <span className="text-slate-600">|</span>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 disabled:opacity-50 transition"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Refrescar
          </button>
        </div>
      </div>

      {/* ===== FILTROS ===== */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={country.code}
            onChange={(e) => {
              const c = COUNTRIES.find((x) => x.code === e.target.value);
              if (c) setCountry(c);
            }}
            className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100 text-sm cursor-pointer focus:outline-none focus:border-emerald-500"
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
            className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100 text-sm cursor-pointer focus:outline-none focus:border-emerald-500"
          >
            {SUPPORTED_ASSETS.map((a) => (
              <option key={a} value={a} className="bg-slate-900">{a}</option>
            ))}
          </select>

          <select
            value={payment}
            onChange={(e) => setPayment(e.target.value)}
            className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100 text-sm cursor-pointer focus:outline-none focus:border-emerald-500"
          >
            <option value="" className="bg-slate-900">Todo método de pago</option>
            {country.paymentMethods.map((m) => (
              <option key={m.id} value={m.id} className="bg-slate-900">{m.name}</option>
            ))}
          </select>

          {/* Anuncios count por exchange */}
          <div className="ml-auto flex items-center gap-2 text-xs">
            <span className="text-slate-500">Anuncios:</span>
            {Object.entries(quotes).map(([ex, q]) => {
              const style = EXCHANGE_COLORS[ex];
              if (!style) return null;
              return (
                <span key={ex} className="flex items-center gap-1">
                  <span className={style.text}>{style.name}</span>
                  <b className={style.text}>{q.buy + q.sell}</b>
                </span>
              );
            })}
          </div>
        </div>

        {/* Tags de pago (quick filter) */}
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-500">Pagos:</span>
          <button
            onClick={() => setPayment("")}
            className={`px-3 py-1 rounded text-xs font-medium transition ${
              !payment
                ? "bg-amber-500 text-black"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            Todos
          </button>
          {country.paymentMethods.map((m) => (
            <button
              key={m.id}
              onClick={() => setPayment(m.id)}
              className={`px-3 py-1 rounded text-xs transition ${
                payment === m.id
                  ? "bg-amber-500 text-black font-medium"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {m.name}
            </button>
          ))}
        </div>
      </div>

      {/* ===== STATS SUMMARY ===== */}
      <div className="flex items-center gap-6 flex-wrap text-sm">
        <div>
          <span className="text-slate-500">Oportunidades: </span>
          <b className="text-emerald-400">{opportunities.length}</b>
        </div>
        <div>
          <span className="text-slate-500">Mejor NETO: </span>
          <b className="text-emerald-400">
            {bestOpp ? `+${bestOpp.netSpreadPct.toFixed(2)}%` : "—"}
          </b>
        </div>
        {reputation && (
          <div className="flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-500">Reputación mín: </span>
            <b className="text-emerald-400">{reputation.minRequired}%</b>
            <span className="text-slate-500 text-xs">
              ({reputation.merchantsFilteredOut} merchants filtrados)
            </span>
          </div>
        )}
        {suspiciousCount > 0 && (
          <div className="flex items-center gap-1.5 text-xs">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            <span className="text-amber-400">{suspiciousCount} sospechosas</span>
          </div>
        )}
      </div>
      <p className="text-xs text-slate-500 italic">
        Arbitraje real: comprar barato en un P2P, vender caro en otro — fee de retiro ya descontado
      </p>

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
          <Loader2 className="w-8 h-8 animate-spin text-emerald-400 mb-3" />
          <p className="text-sm text-slate-300">Escaneando 4 exchanges en paralelo…</p>
          <p className="text-xs text-slate-500 mt-1">8 requests · Binance · OKX · Bybit · Kraken</p>
        </div>
      )}

      {/* ===== RESULTADOS — LISTA DE OPPORTUNITY CARDS ===== */}
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
// OPPORTUNITY CARD — 2 columnas BUY (verde) | SELL (rojo)
// ============================================================
function OpportunityCard({ opp, rank, fiat, expanded, onToggle }: {
  opp: ArbitrageOpportunity;
  rank: number;
  fiat: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const suspicious = isSuspicious(opp);
  const isCross = opp.buyExchange !== opp.sellExchange;

  return (
    <div className={`bg-slate-900 border ${suspicious ? "border-amber-700/40" : "border-slate-800"} rounded-xl overflow-hidden hover:border-slate-700 transition`}>
      {/* Header de la card: badges + spread neto */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-950/40 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
            rank === 1 ? "bg-amber-500/20 text-amber-300 border-amber-500/30" :
            rank <= 3 ? "bg-slate-700/40 text-slate-200 border-slate-600/30" :
            "bg-slate-800 text-slate-400 border-slate-700"
          }`}>
            #{rank}
          </span>
          {isCross && (
            <span className="text-[9px] px-1.5 py-0.5 border border-amber-500/40 text-amber-400 rounded font-semibold">
              CROSS-EXCHANGE
            </span>
          )}
          {suspicious && (
            <span className="text-[9px] px-1.5 py-0.5 border border-red-500/40 text-red-400 rounded font-semibold flex items-center gap-1">
              <AlertTriangle className="w-2.5 h-2.5" />
              SOSPECHOSO
            </span>
          )}
          <span className="text-[9px] text-slate-500 font-mono">
            {opp.type === "P2P-P2P" ? "P2P→P2P" : opp.type === "P2P-Spot" ? "P2P→Spot" : "Spot→P2P"}
          </span>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-emerald-400 leading-none">
            +{opp.netSpreadPct.toFixed(2)}%
          </div>
          <div className="text-[10px] text-slate-500">
            bruto +{opp.grossSpreadPct.toFixed(2)}% · fees -{opp.feesPct.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Body: 2 columnas BUY | SELL */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-0">
        {/* BUY side */}
        <div className="p-4 border-r border-slate-800">
          <div className="flex items-center gap-2 mb-3">
            <span className="px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 text-[10px] font-bold uppercase tracking-wide">
              BUY
            </span>
            <ExchangeCircle exchange={opp.buyExchange} />
            <span className="text-slate-300 font-semibold text-sm">{opp.buyExchange}</span>
          </div>
          <div className="text-2xl font-bold text-white font-mono mb-2">
            {fmtPrice(opp.buyPrice)} <span className="text-sm text-slate-500">{fiat}</span>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center gap-1.5 text-slate-300">
              <User className="w-3 h-3 text-slate-500" />
              <span className="font-medium">{opp.buyMerchant}</span>
              {opp.buyMerchantPro && (
                <span className="text-[8px] px-1 py-0.5 bg-amber-900/50 text-amber-300 rounded font-semibold">PRO</span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-emerald-400">
              <Check className="w-3 h-3" />
              <span>{opp.buyMerchantReputation.toFixed(1)}%</span>
              <span className="text-slate-500">· {opp.buyMerchantOrderCount.toLocaleString()} órdenes</span>
            </div>
          </div>
          <div className="mt-3 bg-slate-950/50 rounded p-2 text-[10px]">
            <div className="text-slate-500 uppercase mb-1">Límites de operación</div>
            <div className="grid grid-cols-3 gap-1 text-slate-300 font-mono">
              <div>
                <div className="text-slate-500 text-[9px]">Min</div>
                <div>{fmtAmount(opp.buyMinAmount)}</div>
              </div>
              <div>
                <div className="text-slate-500 text-[9px]">Max</div>
                <div>{fmtAmount(opp.buyMaxAmount)}</div>
              </div>
              <div>
                <div className="text-slate-500 text-[9px]">Disp</div>
                <div className="text-emerald-400">{fmtAmount(opp.buyAvailableQty)} {opp.asset}</div>
              </div>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {opp.buyPaymentMethods.slice(0, 4).map((m) => (
              <span key={m} className="text-[9px] px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded">{m}</span>
            ))}
            {opp.buyPaymentMethods.length > 4 && (
              <span className="text-[9px] px-1.5 py-0.5 bg-slate-800 text-slate-500 rounded">+{opp.buyPaymentMethods.length - 4}</span>
            )}
          </div>
        </div>

        {/* SELL side */}
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="px-2 py-0.5 rounded bg-rose-950/60 text-rose-400 text-[10px] font-bold uppercase tracking-wide">
              SELL
            </span>
            <ExchangeCircle exchange={opp.sellExchange} />
            <span className="text-slate-300 font-semibold text-sm">{opp.sellExchange}</span>
          </div>
          <div className="text-2xl font-bold text-white font-mono mb-2">
            {fmtPrice(opp.sellPrice)} <span className="text-sm text-slate-500">{fiat}</span>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center gap-1.5 text-slate-300">
              <User className="w-3 h-3 text-slate-500" />
              <span className="font-medium">{opp.sellMerchant}</span>
              {opp.sellMerchantPro && (
                <span className="text-[8px] px-1 py-0.5 bg-amber-900/50 text-amber-300 rounded font-semibold">PRO</span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-emerald-400">
              <Check className="w-3 h-3" />
              <span>{opp.sellMerchantReputation.toFixed(1)}%</span>
              <span className="text-slate-500">· {opp.sellMerchantOrderCount.toLocaleString()} órdenes</span>
            </div>
          </div>
          <div className="mt-3 bg-slate-950/50 rounded p-2 text-[10px]">
            <div className="text-slate-500 uppercase mb-1">Límites de operación</div>
            <div className="grid grid-cols-3 gap-1 text-slate-300 font-mono">
              <div>
                <div className="text-slate-500 text-[9px]">Min</div>
                <div>{fmtAmount(opp.sellMinAmount)}</div>
              </div>
              <div>
                <div className="text-slate-500 text-[9px]">Max</div>
                <div>{fmtAmount(opp.sellMaxAmount)}</div>
              </div>
              <div>
                <div className="text-slate-500 text-[9px]">Disp</div>
                <div className="text-rose-400">{fmtAmount(opp.sellAvailableQty)} {opp.asset}</div>
              </div>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {opp.sellPaymentMethods.slice(0, 4).map((m) => (
              <span key={m} className="text-[9px] px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded">{m}</span>
            ))}
            {opp.sellPaymentMethods.length > 4 && (
              <span className="text-[9px] px-1.5 py-0.5 bg-slate-800 text-slate-500 rounded">+{opp.sellPaymentMethods.length - 4}</span>
            )}
          </div>
        </div>
      </div>

      {/* Footer: operación + profit + botones */}
      <div className="border-t border-slate-800 bg-slate-950/40 px-4 py-3">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3 text-xs">
          <div className="text-slate-400">
            Operación: <b className="text-white">{fmtAmount(opp.operationFiatAmount)} {fiat}</b>
            <span className="text-slate-500"> ({opp.operationAssetAmount.toFixed(2)} {opp.asset})</span>
            <span className="text-slate-600 mx-2">·</span>
            Fee retiro: <b className="text-rose-400">{opp.withdrawalFee} {opp.asset}</b>
            <span className="text-slate-500"> ({fmtAmount(opp.withdrawalFeeFiat)} {fiat})</span>
          </div>
          <div>
            <span className="text-slate-500">Profit NETO: </span>
            <b className="text-emerald-400 text-base font-mono">+{fmtAmount(opp.netProfitForOperation)} {fiat}</b>
            <span className="text-slate-500 text-[10px] ml-1">
              (~${(opp.netProfitForOperation / 4100).toFixed(2)} USD / $1000)
            </span>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="flex items-center gap-2 flex-wrap">
          <a
            href={opp.buyDirectUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition font-semibold"
          >
            <Zap className="w-3.5 h-3.5" />
            1. Comprar en {opp.buyExchange} P2P
            <ExternalLink className="w-3 h-3" />
          </a>
          <a
            href={opp.sellDirectUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition font-semibold"
          >
            <Zap className="w-3.5 h-3.5" />
            2. Vender en {opp.sellExchange} P2P
            <ExternalLink className="w-3 h-3" />
          </a>
          <button
            onClick={onToggle}
            className="ml-auto text-xs text-slate-500 hover:text-slate-300 transition flex items-center gap-1"
          >
            {expanded ? "Ocultar detalle" : "> Detalle"}
          </button>
        </div>

        {/* Detalle expandible */}
        {expanded && (
          <div className="mt-3 pt-3 border-t border-slate-800 space-y-2 text-xs">
            <div className="text-[10px] uppercase text-slate-500 font-semibold">Cálculo del profit NETO (algoritmo)</div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 font-mono text-[11px]">
              <div>
                <div className="text-slate-500 text-[9px]">Tamaño op.</div>
                <div className="text-slate-200">{fmtAmount(opp.operationFiatAmount)} {fiat}</div>
              </div>
              <div>
                <div className="text-slate-500 text-[9px]">Asset comprado</div>
                <div className="text-slate-200">{opp.operationAssetAmount.toFixed(3)} {opp.asset}</div>
              </div>
              <div>
                <div className="text-slate-500 text-[9px]">Spread bruto</div>
                <div className="text-slate-300">+{opp.grossSpreadPct.toFixed(2)}%</div>
              </div>
              <div>
                <div className="text-slate-500 text-[9px]">Fee retiro</div>
                <div className="text-rose-400">-{fmtAmount(opp.withdrawalFeeFiat)} {fiat}</div>
              </div>
              <div>
                <div className="text-slate-500 text-[9px]">Profit NETO</div>
                <div className="text-emerald-400 font-bold">+{fmtAmount(opp.netProfitForOperation)} {fiat}</div>
              </div>
              <div>
                <div className="text-slate-500 text-[9px]">Profit/1000</div>
                <div className="text-emerald-400">+{opp.netProfitOn1000.toFixed(2)}</div>
              </div>
            </div>
            {opp.commonPaymentMethod && (
              <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                <Check className="w-3 h-3 text-blue-400" />
                Método de pago común: <b className="text-blue-300">{opp.commonPaymentMethod}</b> · facilita el round-trip fiat
              </div>
            )}
            {suspicious && (
              <div className="bg-red-950/30 border border-red-700/40 rounded p-2 text-[10px] text-red-300 flex items-start gap-2">
                <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                <span>
                  Spread &gt; 30% es prácticamente imposible en P2P real. Probable bait ad — el merchant recibe tu pago pero no libera el crypto.
                  Verifica en el exchange directamente antes de operar.
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
