"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2, RefreshCw, ExternalLink, Shield, ChevronDown,
  TrendingUp, TrendingDown, Zap, AlertCircle, Info, ArrowRight,
  Check, User, Circle,
} from "lucide-react";
import { COUNTRIES, SUPPORTED_ASSETS, type CountryConfig } from "@/lib/api-clients/catalog";
import type { ArbitrageOpportunity, ArbitrageResponse } from "@/lib/p2p-arbitrage/engine-v3";

// ============================================================
// P2PArbitragePanel — Replicación exacta screenshot ArbitrajePro
// ============================================================
// Estructura:
//   1. HEADER: subtítulo descriptivo (sin badges de estado)
//   2. FILTROS: 3 dropdowns + Anuncios count + Pagos tags
//   3. STATS BAR: Oportunidades | Mejor NETO | ⊙ Reputación min | nota
//   4. CARDS: header BUY/SELL + 2 columnas (verde oscuro / rojo oscuro) + footer
// ============================================================

const EXCHANGE_CIRCLE: Record<string, { bg: string; text: string }> = {
  Binance: { bg: "bg-yellow-500", text: "text-black" },
  OKX:     { bg: "bg-cyan-500",    text: "text-black" },
  Bybit:   { bg: "bg-orange-500",  text: "text-white" },
  Kraken:  { bg: "bg-purple-500",  text: "text-white" },
};
const EXCHANGE_INITIAL: Record<string, string> = {
  Binance: "B", OKX: "O", Bybit: "Y", Kraken: "K",
};

const EXCHANGE_NAME_COLOR: Record<string, string> = {
  Binance: "text-yellow-400",
  OKX: "text-cyan-400",
  Bybit: "text-orange-400",
  Kraken: "text-purple-400",
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
    const interval = setInterval(load, 20_000);
    return () => clearInterval(interval);
  }, [load]);
  useEffect(() => { setPayment(""); }, [country]);

  const opportunities = data?.opportunities || [];
  const quotes = data?.quotes || {};
  const reputation = data?.reputation;
  const bestOpp = opportunities[0];

  return (
    <div className="space-y-3 text-slate-100">
      {/* ===== HEADER (sin badges — solo subtítulo descriptivo) ===== */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-1">
          Arbitraje P2P Real <span className="text-slate-500 font-normal text-lg">(4 exchanges)</span>
        </h2>
        <p className="text-sm text-slate-400 max-w-3xl">
          Compra barato en Binance/OKX/Bybit P2P o Kraken Spot, vende caro en otro.
          Anuncios reales en vivo de 4 exchanges en paralelo. Profit NETO después de fees de retiro crypto.
        </p>
      </div>

      {/* ===== FILTROS ===== */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={country.code}
            onChange={(e) => {
              const c = COUNTRIES.find((x) => x.code === e.target.value);
              if (c) setCountry(c);
            }}
            className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded text-slate-100 text-sm cursor-pointer focus:outline-none focus:border-emerald-500"
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
            className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded text-slate-100 text-sm cursor-pointer focus:outline-none focus:border-emerald-500"
          >
            {SUPPORTED_ASSETS.map((a) => (
              <option key={a} value={a} className="bg-slate-900">{a}</option>
            ))}
          </select>

          <select
            value={payment}
            onChange={(e) => setPayment(e.target.value)}
            className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded text-slate-100 text-sm cursor-pointer focus:outline-none focus:border-emerald-500"
          >
            <option value="" className="bg-slate-900">Todo método de pag</option>
            {country.paymentMethods.map((m) => (
              <option key={m.id} value={m.id} className="bg-slate-900">{m.name}</option>
            ))}
          </select>

          <div className="ml-auto flex items-center gap-3 text-xs">
            <span className="text-slate-400">Anuncios:</span>
            {Object.entries(quotes).map(([ex, q]) => {
              const color = EXCHANGE_NAME_COLOR[ex];
              if (!color) return null;
              return (
                <span key={ex} className={color}>
                  <b className="font-semibold">{ex}</b> {q.buy + q.sell}
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
              !payment ? "bg-amber-500 text-black" : "bg-slate-700 text-slate-300 hover:bg-slate-600"
            }`}
          >
            Todos
          </button>
          {country.paymentMethods.map((m) => (
            <button
              key={m.id}
              onClick={() => setPayment(m.id)}
              className={`px-3 py-1 rounded text-xs transition ${
                payment === m.id ? "bg-amber-500 text-black font-medium" : "bg-slate-700 text-slate-300 hover:bg-slate-600"
              }`}
            >
              {m.name}
            </button>
          ))}
        </div>
      </div>

      {/* ===== STATS BAR ===== */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-2.5 flex items-center justify-between gap-4 flex-wrap text-sm">
        <div className="flex items-center gap-4 flex-wrap">
          <span>
            <span className="text-slate-400">Oportunidades:</span>{" "}
            <b className="text-emerald-400">{opportunities.length}</b>
          </span>
          <span>
            <span className="text-slate-400">Mejor NETO:</span>{" "}
            <b className="text-emerald-400">{bestOpp ? `+${bestOpp.netSpreadPct.toFixed(2)}%` : "—"}</b>
          </span>
          {reputation && (
            <span className="flex items-center gap-1.5">
              <Circle className="w-3 h-3 text-emerald-400" />
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
          <Loader2 className="w-8 h-8 animate-spin text-emerald-400 mb-3" />
          <p className="text-sm text-slate-300">Escaneando 4 exchanges en paralelo…</p>
          <p className="text-xs text-slate-500 mt-1">8 requests · Binance · OKX · Bybit · Kraken</p>
        </div>
      )}

      {/* ===== REFRESH BUTTON (floating) ===== */}
      {data && (
        <button
          onClick={load}
          disabled={loading}
          className="fixed bottom-6 right-6 z-10 w-12 h-12 rounded-full bg-slate-800 border-2 border-slate-600 hover:border-emerald-500 disabled:opacity-50 flex items-center justify-center text-slate-300 hover:text-emerald-400 transition shadow-lg"
          title="Refrescar"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
        </button>
      )}

      {/* ===== OPPORTUNITY CARDS ===== */}
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
// OPPORTUNITY CARD — EXACTO al screenshot
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
    <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
      {/* ===== TOP BAR (negro): badges BUY/SELL + profit ===== */}
      <div className="bg-black px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {/* BUY badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-950 border border-emerald-600 rounded">
            <span className={`w-5 h-5 rounded-full ${buyCircle.bg} ${buyCircle.text} flex items-center justify-center text-[10px] font-bold`}>
              {EXCHANGE_INITIAL[opp.buyExchange] || "?"}
            </span>
            <span className="text-emerald-300 text-xs font-bold uppercase">BUY {opp.buyExchange}</span>
          </div>

          <span className="text-slate-400">→</span>

          {/* SELL badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-950 border border-red-600 rounded">
            <span className={`w-5 h-5 rounded-full ${sellCircle.bg} ${sellCircle.text} flex items-center justify-center text-[10px] font-bold`}>
              {EXCHANGE_INITIAL[opp.sellExchange] || "?"}
            </span>
            <span className="text-red-300 text-xs font-bold uppercase">SELL {opp.sellExchange}</span>
          </div>

          {isCross && (
            <span className="text-[10px] px-2 py-0.5 border border-amber-500 text-amber-300 rounded font-semibold tracking-wide">
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

      {/* ===== BODY: 2 columnas BUY (verde oscuro) | SELL (rojo oscuro) ===== */}
      <div className="grid grid-cols-1 sm:grid-cols-2">
        {/* ===== LEFT: COMPRAR (fondo verde muy oscuro #064E3B) ===== */}
        <div className="p-4 bg-emerald-950/60 border-r border-slate-700">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-emerald-400 uppercase tracking-wide font-semibold">COMPRAR EN</span>
            <span className="text-emerald-400 font-bold text-sm">{opp.buyExchange}</span>
          </div>

          <div className="text-2xl font-bold text-white font-mono mb-3">
            {fmtPrice(opp.buyPrice)} <span className="text-sm text-slate-400 font-sans">{fiat}</span>
          </div>

          <div className="space-y-1.5 mb-3 text-xs">
            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-400">Merchant:</span>
              <span className="text-slate-100 font-medium">{opp.buyMerchant}</span>
              {opp.buyMerchantPro && (
                <span className="text-[8px] px-1 py-0.5 bg-amber-900/50 text-amber-300 rounded font-semibold">PRO</span>
              )}
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
              <span key={m} className="text-[10px] px-2 py-0.5 bg-slate-700 text-slate-300 rounded">{m}</span>
            ))}
            {opp.buyPaymentMethods.length > 5 && (
              <span className="text-[10px] px-2 py-0.5 bg-slate-700 text-slate-500 rounded">+{opp.buyPaymentMethods.length - 5}</span>
            )}
          </div>
        </div>

        {/* ===== RIGHT: VENDER (fondo rojo muy oscuro #450A0A) ===== */}
        <div className="p-4 bg-red-950/60">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-rose-400 uppercase tracking-wide font-semibold">VENDER EN</span>
            <span className="text-rose-400 font-bold text-sm">{opp.sellExchange}</span>
          </div>

          <div className="text-2xl font-bold text-white font-mono mb-3">
            {fmtPrice(opp.sellPrice)} <span className="text-sm text-slate-400 font-sans">{fiat}</span>
          </div>

          <div className="space-y-1.5 mb-3 text-xs">
            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-400">Merchant:</span>
              <span className="text-slate-100 font-medium">{opp.sellMerchant}</span>
              {opp.sellMerchantPro && (
                <span className="text-[8px] px-1 py-0.5 bg-amber-900/50 text-amber-300 rounded font-semibold">PRO</span>
              )}
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
              <div><span className="text-slate-400">Disp:</span> <span className="text-rose-400">{opp.sellAvailableQty.toFixed(2)} {opp.asset}</span></div>
            </div>
          </div>

          <div className="flex flex-wrap gap-1">
            {opp.sellPaymentMethods.slice(0, 5).map((m) => (
              <span key={m} className="text-[10px] px-2 py-0.5 bg-slate-700 text-slate-300 rounded">{m}</span>
            ))}
            {opp.sellPaymentMethods.length > 5 && (
              <span className="text-[10px] px-2 py-0.5 bg-slate-700 text-slate-500 rounded">+{opp.sellPaymentMethods.length - 5}</span>
            )}
          </div>
        </div>
      </div>

      {/* ===== FOOTER (fondo slate-950 / azul muy oscuro) ===== */}
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
          <a
            href={opp.buyDirectUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded transition font-semibold"
          >
            <Zap className="w-3.5 h-3.5" />
            1. Comprar en {opp.buyExchange} P2P
            <ExternalLink className="w-3 h-3" />
          </a>
          <a
            href={opp.sellDirectUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded transition font-semibold"
          >
            <Zap className="w-3.5 h-3.5" />
            2. Vender en {opp.sellExchange} P2P
            <ExternalLink className="w-3 h-3" />
          </a>
          <button
            onClick={onToggle}
            className="ml-auto text-xs text-slate-400 hover:text-slate-200 transition"
          >
            {expanded ? "‹ Ocultar" : "› Detalle"}
          </button>
        </div>

        {expanded && (
          <div className="mt-3 pt-3 border-t border-slate-800 space-y-2 text-xs">
            <div className="text-[10px] uppercase text-slate-500 font-semibold tracking-wide">Cálculo del profit NETO (algoritmo)</div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 font-mono text-[11px]">
              <div>
                <div className="text-slate-500 text-[9px] font-sans">Tamaño op.</div>
                <div className="text-slate-200">{fmtPrice(opp.operationFiatAmount)} {fiat}</div>
              </div>
              <div>
                <div className="text-slate-500 text-[9px] font-sans">Asset comprado</div>
                <div className="text-slate-200">{opp.operationAssetAmount.toFixed(3)} {opp.asset}</div>
              </div>
              <div>
                <div className="text-slate-500 text-[9px] font-sans">Spread bruto</div>
                <div className="text-slate-300">+{opp.grossSpreadPct.toFixed(2)}%</div>
              </div>
              <div>
                <div className="text-slate-500 text-[9px] font-sans">Fee retiro</div>
                <div className="text-red-400">-{fmtPrice(opp.withdrawalFeeFiat)} {fiat}</div>
              </div>
              <div>
                <div className="text-slate-500 text-[9px] font-sans">Profit NETO</div>
                <div className="text-emerald-400 font-bold">+{fmtPrice(opp.netProfitForOperation)} {fiat}</div>
              </div>
              <div>
                <div className="text-slate-500 text-[9px] font-sans">Profit/1000</div>
                <div className="text-emerald-400">+{opp.netProfitOn1000.toFixed(2)}</div>
              </div>
            </div>
            {opp.commonPaymentMethod && (
              <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <Check className="w-3 h-3 text-blue-400" />
                Método de pago común: <b className="text-blue-300">{opp.commonPaymentMethod}</b> · facilita el round-trip fiat
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
