"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2, RefreshCw, ExternalLink, Shield, ChevronDown,
  TrendingUp, TrendingDown, Zap, AlertCircle, Info, ArrowRight,
  AlertTriangle, Check, User, Clock, Radio, ArrowLeftRight,
} from "lucide-react";
import { COUNTRIES, SUPPORTED_ASSETS, type CountryConfig } from "@/lib/api-clients/catalog";
import type { ArbitrageOpportunity, ArbitrageResponse } from "@/lib/p2p-arbitrage/engine-v3";

// ============================================================
// P2PArbitragePanel — Replicación exacta del screenshot ArbitrajePro
// ============================================================
// Estructura:
//   HEADER: Título "Arbitraje P2P Real (4 exchanges)" + subtítulo
//           Badges estado derecha: ● En vivo | Oportunidades: 91 | Próx: 13s | Últ: 00:22:13 p.m. | Refrescar
//
//   FILTROS: 3 dropdowns (co Colombia COP, USDT, Todo método de pag)
//            Anuncios: Binance 30 · OKX 30 · Bybit 30 (amarillo)
//            Pagos: [Todos] [Nequi] [Davivienda S.A] [Bancolombia S.A] [Daviplata] [Bre-B Keys]
//            (Todos = activo amarillo, otros gris)
//
//   STATS BAR: Oportunidades: 91 | Mejor NETO: +2.05% | ✓ Reputación mín: 80% (1 merchants filtrados)
//              * Arbitraje real: comprar barato en un P2P, vender caro en otro · fee de retiro ya descontado
//
//   CARDS (repetible):
//     TOP BAR (negro): [BUY OKX] → [SELL Bybit] [CROSS-EXCHANGE badge]
//                      +2.05% (verde grande)
//                      bruto +2.36% · fees -0.32% (gris pequeño)
//     LEFT (verde oscuro #022C22):
//       COMPRAR EN .............. OKX (verde)
//       3,086 COP (blanco grande)
//       👤 Merchant: HTCAMBIOSCRIP (gris)
//       ✓ Reputación: 97.5% · 5992 ordenes
//       LÍMITES DE OPERACIÓN
//         Min: 1,000,000 COP (blanco)
//         Max: 19,850,602.42 COP (blanco)
//         Disp: 6432.47 USDT (verde)
//       [Nequi] [Bancolombia] [Las llaves (Bre-B)]
//     RIGHT (rojo oscuro #450A0A):
//       VENDER EN .............. Bybit (rojo)
//       3,158.98 COP (blanco grande)
//       👤 Merchant: mbsola (gris)
//       ✓ Reputación: 88.0% · 12973 ordenes
//       LÍMITES DE OPERACIÓN
//         Min: 50,000 COP
//         Max: 4,147,114.31 COP
//         Disp: 26919.09 USDT (rojo)
//       [Nequi] [Bancolombia] [Bre-B Keys]
//     FOOTER (negro):
//       Operación: 1,000,000 COP (324.04 USDT) · Fee retiro: 1 USDT (rojo)
//       Profit NETO: +20489.76 COP (~$20.49 USD/$1000) (verde bold)
//       ⚡ 1. Comprar en OKX P2P ↗ (verde)
//       ⚡ 2. Vender en Bybit P2P ↗ (rojo)
//       > Detalle (gris link)
// ============================================================

// Colores de exchange (logos circulares)
const EXCHANGE_COLORS: Record<string, { bg: string; text: string; border: string; ring: string }> = {
  Binance: { bg: "bg-amber-950", text: "text-amber-400", border: "border-amber-500", ring: "ring-amber-500/30" },
  OKX:     { bg: "bg-slate-950", text: "text-cyan-400", border: "border-cyan-500", ring: "ring-cyan-500/30" },
  Bybit:   { bg: "bg-slate-950", text: "text-orange-400", border: "border-orange-500", ring: "ring-orange-500/30" },
  Kraken:  { bg: "bg-slate-950", text: "text-purple-400", border: "border-purple-500", ring: "ring-purple-500/30" },
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

  // Totales anuncios (sumar buy+sell por exchange)
  const totalAds = Object.values(quotes).reduce((s, q) => s + q.buy + q.sell, 0);

  return (
    <div className="space-y-3 text-slate-100">
      {/* ===== HEADER ===== */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold text-white">
            Arbitraje P2P Real <span className="text-slate-500 font-normal text-lg">(4 exchanges)</span>
          </h2>
          <p className="text-sm text-slate-400 mt-1 max-w-3xl">
            Compra barato en Binance/OKX/Bybit P2P o Kraken Spot, vende caro en otro.
            Anuncios reales en vivo de 4 exchanges en paralelo. Profit NETO después de fees de retiro crypto.
          </p>
        </div>

        {/* Badges de estado derecha */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-950 border border-emerald-700 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-emerald-400 font-medium">En vivo</span>
          </span>
          <span className="text-slate-500">Oportunidades: <b className="text-slate-200">{opportunities.length}</b></span>
          <span className="text-slate-600">|</span>
          <span className="flex items-center gap-1 text-slate-500">
            <Clock className="w-3 h-3" />
            Próx: <b className="text-slate-200">{refreshIn}s</b>
          </span>
          {data && (
            <>
              <span className="text-slate-600">|</span>
              <span className="text-slate-500">Últ: <b className="text-slate-200">{new Date(data.timestamp).toLocaleTimeString()}</b></span>
            </>
          )}
          <span className="text-slate-600">|</span>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-white text-slate-900 rounded transition disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Refrescar
          </button>
        </div>
      </div>

      {/* ===== FILTROS ===== */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
        {/* Fila 1: dropdowns + anuncios count */}
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

          {/* Anuncios count derecha */}
          <div className="ml-auto flex items-center gap-3 text-xs">
            <span className="text-slate-500">Anuncios:</span>
            {Object.entries(quotes).map(([ex, q]) => {
              const style = EXCHANGE_COLORS[ex];
              if (!style) return null;
              return (
                <span key={ex} className={style.text}>
                  <b className="font-semibold">{ex}</b> {q.buy + q.sell}
                </span>
              );
            })}
          </div>
        </div>

        {/* Fila 2: tags de pago */}
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-400">Pagos:</span>
          <button
            onClick={() => setPayment("")}
            className={`px-3 py-1 rounded-full text-xs font-medium transition ${
              !payment
                ? "bg-amber-500 text-black"
                : "bg-slate-700 text-slate-300 hover:bg-slate-600"
            }`}
          >
            Todos
          </button>
          {country.paymentMethods.map((m) => (
            <button
              key={m.id}
              onClick={() => setPayment(m.id)}
              className={`px-3 py-1 rounded-full text-xs transition ${
                payment === m.id
                  ? "bg-amber-500 text-black font-medium"
                  : "bg-slate-700 text-slate-300 hover:bg-slate-600"
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
          <span><span className="text-slate-500">Oportunidades:</span> <b className="text-white">{opportunities.length}</b></span>
          <span>
            <span className="text-slate-500">Mejor NETO:</span>{" "}
            <b className="text-emerald-400">{bestOpp ? `+${bestOpp.netSpreadPct.toFixed(2)}%` : "—"}</b>
          </span>
          {reputation && (
            <span className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-slate-500">Reputación mín:</span>
              <b className="text-emerald-400">{reputation.minRequired}%</b>
              <span className="text-slate-500 text-xs">({reputation.merchantsFilteredOut} merchants filtrados)</span>
            </span>
          )}
          {suspiciousCount > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-amber-400">
              <AlertTriangle className="w-3 h-3" />
              {suspiciousCount} sospechosas
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
// OPPORTUNITY CARD — EXACTO como el screenshot
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
  const buyStyle = EXCHANGE_COLORS[opp.buyExchange];
  const sellStyle = EXCHANGE_COLORS[opp.sellExchange];

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
      {/* ===== TOP BAR: badges + profit ===== */}
      <div className="bg-black px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
        {/* Izquierda: BUY → SELL + badges */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Badge BUY */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-950 border border-emerald-600 rounded">
            <span className={`w-5 h-5 rounded-full ${buyStyle.bg} border-2 ${buyStyle.border} flex items-center justify-center text-[10px] font-bold ${buyStyle.text}`}>
              {EXCHANGE_INITIAL[opp.buyExchange] || "?"}
            </span>
            <span className="text-emerald-300 text-xs font-bold uppercase">BUY {opp.buyExchange}</span>
          </div>

          <span className="text-slate-400">→</span>

          {/* Badge SELL */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-950 border border-red-600 rounded">
            <span className={`w-5 h-5 rounded-full ${sellStyle.bg} border-2 ${sellStyle.border} flex items-center justify-center text-[10px] font-bold ${sellStyle.text}`}>
              {EXCHANGE_INITIAL[opp.sellExchange] || "?"}
            </span>
            <span className="text-red-300 text-xs font-bold uppercase">SELL {opp.sellExchange}</span>
          </div>

          {/* Badge CROSS-EXCHANGE */}
          {isCross && (
            <span className="text-[10px] px-2 py-0.5 border border-amber-500 text-amber-300 rounded font-semibold tracking-wide">
              CROSS-EXCHANGE
            </span>
          )}
          {suspicious && (
            <span className="text-[10px] px-2 py-0.5 border border-red-500 text-red-300 rounded font-semibold flex items-center gap-1">
              <AlertTriangle className="w-2.5 h-2.5" />
              SOSPECHOSO
            </span>
          )}
        </div>

        {/* Derecha: profit grande */}
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
        {/* ===== LEFT: COMPRAR (fondo verde muy oscuro) ===== */}
        <div className="p-4 bg-emerald-950/40 border-r border-slate-700">
          {/* Header interno */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-blue-400 uppercase tracking-wide font-semibold">COMPRAR EN</span>
            <span className="text-emerald-400 font-bold text-sm">{opp.buyExchange}</span>
          </div>

          {/* Precio principal */}
          <div className="text-2xl font-bold text-white font-mono mb-3">
            {fmtPrice(opp.buyPrice)} <span className="text-sm text-slate-400 font-sans">{fiat}</span>
          </div>

          {/* Info vendedor */}
          <div className="space-y-1.5 mb-3 text-xs">
            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-slate-400">Merchant:</span>
              <span className="text-slate-200 font-medium">{opp.buyMerchant}</span>
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

          {/* Límites de operación */}
          <div className="border border-slate-700/50 rounded p-2 mb-3 text-[11px] font-mono">
            <div className="text-slate-500 uppercase text-[9px] mb-1 font-sans tracking-wide">Límites de operación</div>
            <div className="space-y-0.5">
              <div><span className="text-slate-500">Min:</span> <span className="text-white">{fmtPrice(opp.buyMinAmount)} {fiat}</span></div>
              <div><span className="text-slate-500">Max:</span> <span className="text-white">{fmtPrice(opp.buyMaxAmount)} {fiat}</span></div>
              <div><span className="text-slate-500">Disp:</span> <span className="text-emerald-400">{opp.buyAvailableQty.toFixed(2)} {opp.asset}</span></div>
            </div>
          </div>

          {/* Tags de pago */}
          <div className="flex flex-wrap gap-1">
            {opp.buyPaymentMethods.slice(0, 4).map((m) => (
              <span key={m} className="text-[10px] px-2 py-0.5 bg-slate-700 text-slate-300 rounded">{m}</span>
            ))}
            {opp.buyPaymentMethods.length > 4 && (
              <span className="text-[10px] px-2 py-0.5 bg-slate-700 text-slate-500 rounded">+{opp.buyPaymentMethods.length - 4}</span>
            )}
          </div>
        </div>

        {/* ===== RIGHT: VENDER (fondo rojo muy oscuro) ===== */}
        <div className="p-4 bg-red-950/40">
          {/* Header interno */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-blue-400 uppercase tracking-wide font-semibold">VENDER EN</span>
            <span className="text-red-400 font-bold text-sm">{opp.sellExchange}</span>
          </div>

          {/* Precio principal */}
          <div className="text-2xl font-bold text-white font-mono mb-3">
            {fmtPrice(opp.sellPrice)} <span className="text-sm text-slate-400 font-sans">{fiat}</span>
          </div>

          {/* Info comprador */}
          <div className="space-y-1.5 mb-3 text-xs">
            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-slate-400">Merchant:</span>
              <span className="text-slate-200 font-medium">{opp.sellMerchant}</span>
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

          {/* Límites de operación */}
          <div className="border border-slate-700/50 rounded p-2 mb-3 text-[11px] font-mono">
            <div className="text-slate-500 uppercase text-[9px] mb-1 font-sans tracking-wide">Límites de operación</div>
            <div className="space-y-0.5">
              <div><span className="text-slate-500">Min:</span> <span className="text-white">{fmtPrice(opp.sellMinAmount)} {fiat}</span></div>
              <div><span className="text-slate-500">Max:</span> <span className="text-white">{fmtPrice(opp.sellMaxAmount)} {fiat}</span></div>
              <div><span className="text-slate-500">Disp:</span> <span className="text-red-400">{opp.sellAvailableQty.toFixed(2)} {opp.asset}</span></div>
            </div>
          </div>

          {/* Tags de pago */}
          <div className="flex flex-wrap gap-1">
            {opp.sellPaymentMethods.slice(0, 4).map((m) => (
              <span key={m} className="text-[10px] px-2 py-0.5 bg-slate-700 text-slate-300 rounded">{m}</span>
            ))}
            {opp.sellPaymentMethods.length > 4 && (
              <span className="text-[10px] px-2 py-0.5 bg-slate-700 text-slate-500 rounded">+{opp.sellPaymentMethods.length - 4}</span>
            )}
          </div>
        </div>
      </div>

      {/* ===== FOOTER (negro): operación + botones + profit ===== */}
      <div className="bg-black px-4 py-3">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3 text-xs">
          {/* Izquierda: operación */}
          <div className="text-slate-400">
            Operación: <b className="text-white">{fmtPrice(opp.operationFiatAmount)} {fiat}</b>
            <span className="text-slate-500"> ({opp.operationAssetAmount.toFixed(2)} {opp.asset})</span>
            <span className="text-slate-600 mx-2">·</span>
            Fee retiro: <b className="text-red-400">{opp.withdrawalFee} {opp.asset}</b>
          </div>

          {/* Derecha: profit final */}
          <div>
            <span className="text-slate-400">Profit NETO: </span>
            <b className="text-emerald-400 text-base font-mono">+{fmtPrice(opp.netProfitForOperation)} {fiat}</b>
            <span className="text-slate-500 text-[10px] ml-1">
              (~${(opp.netProfitForOperation / 4100).toFixed(2)} USD/$1000)
            </span>
          </div>
        </div>

        {/* Botones de acción */}
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
            className="ml-auto text-xs text-slate-500 hover:text-slate-300 transition"
          >
            {expanded ? "Ocultar detalle" : "> Detalle"}
          </button>
        </div>

        {/* Detalle expandible */}
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
            {suspicious && (
              <div className="bg-red-950/30 border border-red-700/40 rounded p-2 text-[11px] text-red-300 flex items-start gap-2">
                <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                <span>
                  Spread &gt; 30% es prácticamente imposible en P2P real. Probable bait ad — el merchant recibe tu pago pero no libera el crypto. Verifica en el exchange directamente antes de operar.
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
