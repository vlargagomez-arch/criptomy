"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import {
  Search, Loader2, TrendingUp, TrendingDown, Zap, Clock, AlertTriangle,
  RefreshCw, ShieldOff, Flame, Gauge, Activity, Sparkles, Info, Wallet,
  Coins, ArrowRight, ArrowUpRight, BarChart3, Radio, Eye, ChevronDown,
  ChevronUp, ExternalLink, Check, X, AlertCircle, Shield, Lock, Unlock,
  Building2, CreditCard, Globe2, Star, Award, Target,
} from "lucide-react";
import { QUICK_SEARCHES } from "@/lib/scanner/interpreter";
import type { SearchResponse, SearchIntent, RankedResult, P2POffer, ArbitrageOpportunity } from "@/lib/scanner/types";

const RECENT_KEY = "criptomy:recent-searches";

// ============================================================
// HELPERS
// ============================================================
function fmtPrice(n: number, decimals?: number): string {
  if (!n) return "—";
  const d = decimals ?? (n < 1 ? 6 : n < 100 ? 4 : 2);
  return n.toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: d > 2 ? 2 : 0 });
}
function fmtPct(n: number): string { return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`; }
function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `hace ${s}s`;
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  return `hace ${Math.floor(s / 3600)}h`;
}
function fmtCurrency(n: number, currency: string): string {
  if (!n) return "—";
  const symbol = currency === "EUR" ? "€" : currency === "USD" ? "$" : currency === "COP" ? "$" : "";
  return `${symbol}${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

// Provider metadata
const PROVIDER_META: Record<string, { logo: string; rank: string; trust: string; vol: string; since: string; countries: string; desc: string; url: (a: string, q: string) => string }> = {
  binance:   { logo: "🟧", rank: "#1",  trust: "Alta",      vol: "$15B+", since: "2017", countries: "Global (excl. USA)", desc: "Mayor exchange del mundo. KYC obligatorio.", url: (a, q) => `https://www.binance.com/en/trade/${a}_${q}?type=spot` },
  okx:       { logo: "⚫", rank: "#5",  trust: "Alta",      vol: "$3B+",  since: "2017", countries: "Global", desc: "Top 5 global. KYC obligatorio.", url: (a, q) => `https://www.okx.com/trade-spot/${a.toLowerCase()}-${q.toLowerCase()}` },
  bybit:     { logo: "🟡", rank: "#3",  trust: "Alta",      vol: "$5B+",  since: "2018", countries: "Global (excl. USA/UK)", desc: "Top 3 global.", url: (a, q) => `https://www.bybit.com/en-US/trade/spot/${a}${q}` },
  kraken:    { logo: "🟣", rank: "#10", trust: "Muy alta", vol: "$1B+",  since: "2011", countries: "USA + Europa", desc: "Exchange más regulado.", url: (a, q) => `https://www.kraken.com/prices/${a.toLowerCase()}` },
  coinbase:  { logo: "🔵", rank: "#3",  trust: "Muy alta", vol: "$2B+",  since: "2012", countries: "USA + Europa", desc: "Listado en NASDAQ.", url: (a, q) => `https://www.coinbase.com/price/${a.toLowerCase()}` },
  kucoin:    { logo: "🟢", rank: "#8",  trust: "Media-alta",vol: "$1B+",  since: "2017", countries: "Global", desc: "Top 10.", url: (a, q) => `https://www.kucoin.com/trade/${a}-${q}` },
  gate:      { logo: "🚪", rank: "#15", trust: "Media",     vol: "$500M+",since: "2013", countries: "Global", desc: "Top 20.", url: (a, q) => `https://www.gate.io/trade/${a}_${q}` },
  mexc:      { logo: "🟪", rank: "#10", trust: "Media",     vol: "$1B+",  since: "2018", countries: "Global", desc: "KYC opcional (único).", url: (a, q) => `https://www.mexc.com/exchange/${a}_${q}` },
  htx:       { logo: "🔥", rank: "#15", trust: "Media",     vol: "$500M+",since: "2013", countries: "Asia", desc: "Antes Huobi.", url: (a, q) => `https://www.htx.com/en-us/exchange/${a.toLowerCase()}_${q.toLowerCase()}/` },
  bitget:    { logo: "🎯", rank: "#10", trust: "Media",     vol: "$1B+",  since: "2018", countries: "Global", desc: "Fees más baratos (0.05%).", url: (a, q) => `https://www.bitget.com/spot/${a}${q}_SPBL` },
  bingx:     { logo: "🟦", rank: "#20", trust: "Media",     vol: "$300M+",since: "2018", countries: "Global", desc: "Top 20.", url: (a, q) => `https://www.bingx.com/en/spot/${a}-${q}/` },
  bitvavo:   { logo: "🟠", rank: "#25", trust: "Alta EU",   vol: "$200M+",since: "2017", countries: "Europa (MiCA)", desc: "Top 5 Europa. Regulado DNB.", url: (a, q) => `https://bitvavo.com/en/trade/${a}-${q === "USD" ? "EUR" : q}` },
  coingecko: { logo: "🦎", rank: "N/A", trust: "Referencia",vol: "N/A",   since: "2014", countries: "Global", desc: "Agregador. Precios de referencia.", url: (a, q) => `https://www.coingecko.com/en/coins/${a.toLowerCase()}` },
};

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function SmartSearchView() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<"totalCost" | "fee" | "liquidity" | "latency">("totalCost");
  const [advancedMode, setAdvancedMode] = useState(false);
  const [selectedResult, setSelectedResult] = useState<RankedResult | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
      if (Array.isArray(saved)) setRecentSearches(saved.slice(0, 5));
    } catch {}
  }, []);

  const saveRecent = useCallback((q: string) => {
    if (typeof window === "undefined") return;
    try {
      const saved = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
      const updated = [q, ...(saved as string[]).filter((s) => s !== q)].slice(0, 5);
      localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
      setRecentSearches(updated);
    } catch {}
  }, []);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setLoading(true); setError(null); setResponse(null); setSelectedResult(null);
    saveRecent(q);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("q", q);
      window.history.replaceState({}, "", url.toString());
    }
    try {
      const res = await fetch("/api/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: q }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Error"); return; }
      setResponse(data as SearchResponse);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [saveRecent]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const urlQuery = params.get("q");
    if (urlQuery && !query) { setQuery(urlQuery); search(urlQuery); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onlineResults = useMemo(() => {
    if (!response) return [];
    let arr = response.results.filter((r) => r.status === "ONLINE" && r.rank > 0);
    arr = [...arr].sort((a, b) => {
      if (sortBy === "fee") return (a.fee || 0) - (b.fee || 0);
      if (sortBy === "liquidity") return (b.liquidity || 0) - (a.liquidity || 0);
      if (sortBy === "latency") return (a.latencyMs || 0) - (b.latencyMs || 0);
      return (a.totalCost || 0) - (b.totalCost || 0);
    });
    return arr;
  }, [response, sortBy]);

  const hasResults = onlineResults.length > 0 || (response?.p2pOffers.length || 0) > 0;
  const bestOption = onlineResults[0];

  return (
    <div className="min-h-screen bg-slate-950">
      {/* ===== HERO ===== */}
      <div className="relative overflow-hidden border-b border-slate-800">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-950/30 via-slate-950 to-slate-950" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(16,185,129,0.08),transparent_50%)]" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12 pb-6 sm:pb-8">
          <div className="text-center mb-6 sm:mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/50 border border-emerald-800/50 text-xs text-emerald-400 mb-4">
              <Radio className="w-3 h-3" />
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Escaneando 13 exchanges en tiempo real
            </div>
            <h1 className="text-3xl sm:text-5xl font-bold text-slate-100 mb-3 tracking-tight">
              Buscador <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">Web3</span>
            </h1>
            <p className="text-sm text-slate-400 max-w-2xl mx-auto">
              Compara precios, comisiones y métodos de pago en todos los exchanges. Como Google Flights, pero para cripto.
            </p>
          </div>

          {/* Search bar */}
          <form onSubmit={(e) => { e.preventDefault(); search(query); }} className="relative max-w-3xl mx-auto">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/20 to-teal-600/20 rounded-2xl blur-xl group-focus-within:opacity-100 opacity-50 transition" />
              <div className="relative flex items-center bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden focus-within:border-emerald-600 transition">
                <Search className="absolute left-4 sm:left-5 w-5 h-5 text-slate-500" />
                <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
                  placeholder="Quiero comprar 2000 USDT en Europa..."
                  className="flex-1 px-12 sm:px-14 py-3 sm:py-4 bg-transparent text-slate-100 text-base sm:text-lg placeholder:text-slate-600 focus:outline-none"
                  autoFocus />
                <button type="submit" disabled={loading || !query.trim()}
                  className="m-1.5 px-4 sm:px-5 py-2.5 sm:py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl text-sm font-semibold flex items-center gap-2 transition">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  <span className="hidden sm:inline">Buscar</span>
                </button>
              </div>
            </div>
          </form>

          {/* Recent searches */}
          {recentSearches.length > 0 && !response && !loading && (
            <div className="max-w-3xl mx-auto mt-4 flex items-center justify-center gap-2 flex-wrap">
              <span className="text-xs text-slate-600">Recientes:</span>
              {recentSearches.map((q) => (
                <button key={q} onClick={() => { setQuery(q); search(q); }}
                  className="text-xs px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-full transition">
                  {q.length > 35 ? q.slice(0, 35) + "…" : q}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ===== CONTENT ===== */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* LOADING */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-16 sm:py-20">
            <div className="relative w-16 h-16 mb-6">
              <div className="absolute inset-0 rounded-full border-4 border-slate-800" />
              <div className="absolute inset-0 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
            </div>
            <p className="text-sm text-slate-300 font-medium mb-1">Escaneando 13 exchanges en paralelo…</p>
            <p className="text-xs text-slate-500">Binance · OKX · Bybit · Kraken · Coinbase · Bitvavo · y más</p>
          </div>
        )}

        {/* ERROR */}
        {error && (
          <div className="max-w-lg mx-auto bg-red-950/30 border border-red-800/50 rounded-xl p-6 text-center">
            <AlertTriangle className="w-8 h-8 mx-auto mb-3 text-red-400" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {/* ===== RESULTS ===== */}
        {response && !loading && hasResults && (
          <ResultsView
            response={response}
            onlineResults={onlineResults}
            sortBy={sortBy}
            setSortBy={setSortBy}
            advancedMode={advancedMode}
            setAdvancedMode={setAdvancedMode}
            selectedResult={selectedResult}
            setSelectedResult={setSelectedResult}
            onRetry={() => search(query)}
          />
        )}

        {/* NO RESULTS */}
        {response && !loading && !hasResults && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 sm:p-12 text-center">
            <AlertCircle className="w-10 h-10 mx-auto text-slate-600 mb-3" />
            <p className="text-sm text-slate-300 font-medium">No encontramos una oferta que coincida exactamente con tus parámetros</p>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Podemos ampliar la búsqueda a otras opciones:
            </p>
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-md mx-auto">
              {[
                { label: "🔄 Otra moneda", q: `Quiero comprar ${intent?.asset || "USDT"} con USD` },
                { label: "💳 Otro método de pago", q: `Quiero comprar ${intent?.amount || 100} ${intent?.asset || "USDT"} con tarjeta` },
                { label: "🌍 Otro país/región", q: `Quiero comprar ${intent?.amount || 100} ${intent?.asset || "USDT"} en USA` },
                { label: "📊 Mostrar todas las opciones", q: `Comparar ${intent?.asset || "USDT"}` },
              ].map((s) => (
                <button key={s.label} onClick={() => { setQuery(s.q); search(s.q); }}
                  className="text-xs px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition text-left">
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* INITIAL STATE */}
        {!response && !loading && !error && (
          <div className="space-y-6">
            {/* Quick searches */}
            <div>
              <h3 className="text-xs uppercase tracking-wide text-slate-500 mb-3 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5" /> Prueba estas búsquedas
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {QUICK_SEARCHES.map((q) => (
                  <button key={q.query} onClick={() => { setQuery(q.query); search(q.query); }}
                    className="text-left flex items-center gap-2 p-3 bg-slate-900 border border-slate-800 rounded-xl hover:border-emerald-600/50 transition group">
                    <span className="text-lg">{q.icon}</span>
                    <span className="text-xs text-slate-300 group-hover:text-slate-100">{q.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* How it works */}
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5 sm:p-6">
              <h3 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2">
                <Info className="w-4 h-4 text-emerald-400" /> ¿Cómo funciona?
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { step: 1, icon: Search, title: "Escribe tu intención", desc: "Lenguaje natural: comprar, vender, enviar, comparar" },
                  { step: 2, icon: BarChart3, title: "Escanea 13 exchanges", desc: "Binance, OKX, Kraken, Bitvavo y más en paralelo" },
                  { step: 3, icon: Check, title: "Compara y elige", desc: "Costo total, comisiones, tiempo, KYC. Tú decides." },
                ].map((s) => {
                  const Icon = s.icon;
                  return (
                    <div key={s.step} className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-600/20 border border-emerald-600/50 flex items-center justify-center text-xs font-bold text-emerald-400 shrink-0">{s.step}</div>
                      <div>
                        <div className="text-sm font-medium text-slate-200 flex items-center gap-1.5"><Icon className="w-3.5 h-3.5 text-emerald-400" /> {s.title}</div>
                        <p className="text-xs text-slate-500 mt-0.5">{s.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 pt-4 border-t border-slate-800 text-[11px] text-slate-500 flex items-start gap-2">
                <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span>CriptoMy compara opciones. El pago y la operación son realizados por el proveedor seleccionado. CriptoMy no custodia tus fondos. Los precios pueden cambiar antes de confirmar.</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// RESULTS VIEW
// ============================================================
function ResultsView({ response, onlineResults, sortBy, setSortBy, advancedMode, setAdvancedMode, selectedResult, setSelectedResult, onRetry }: {
  response: SearchResponse; onlineResults: RankedResult[]; sortBy: string; setSortBy: any;
  advancedMode: boolean; setAdvancedMode: any; selectedResult: RankedResult | null; setSelectedResult: any; onRetry: () => void;
}) {
  const { intent, p2pOffers, arbitrageOpportunities, providersOk, providersChecked, executionTimeMs } = response;
  const best = onlineResults[0];
  const isBuy = intent.operation === "BUY";
  const isSell = intent.operation === "SELL";
  const operationLabel = intent.operation === "BUY" ? "Comprar" : intent.operation === "SELL" ? "Vender" : "Comparar";
  const amount = intent.amount || 0;
  const asset = intent.asset || "";
  const fiat = intent.fiat || "";

  // Generate human summary
  const cheapestCost = best?.totalCost || 0;
  const avgCost = onlineResults.length > 0
    ? onlineResults.reduce((s, r) => s + r.totalCost, 0) / onlineResults.length
    : 0;
  const savingsVsAvg = avgCost > 0 ? ((avgCost - cheapestCost) / avgCost) * 100 : 0;
  const worstCost = onlineResults.length > 1 ? onlineResults[onlineResults.length - 1].totalCost : 0;
  const savingsVsWorst = worstCost > 0 ? worstCost - cheapestCost : 0;

  // Detectar info faltante
  const missingPaymentMethod = !intent.paymentMethod && (intent.operation === "BUY" || intent.operation === "SELL");
  const missingFiat = !intent.fiat;

  // "Por cada €1 recibes X" calculation
  const perUnit = best && best.totalCost > 0 && amount > 0 ? amount / best.totalCost : 0;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* ===== MISSING INFO DETECTION ===== */}
      {(missingPaymentMethod || missingFiat) && (
        <div className="bg-amber-950/30 border border-amber-700/40 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs text-amber-300 font-medium mb-2">
                Para darte una comparación más precisa necesitamos saber cómo quieres pagar.
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                {missingFiat && (
                  <>
                    <span className="text-[10px] text-amber-400">Moneda:</span>
                    {["EUR", "USD", "GBP", "COP"].map((c) => (
                      <button key={c} onClick={() => { const nq = `${intent.raw} con ${c}`; search(nq); }}
                        className="text-[11px] px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded transition">
                        {c}
                      </button>
                    ))}
                  </>
                )}
                {missingPaymentMethod && (
                  <>
                    <span className="text-[10px] text-amber-400 ml-2">Método:</span>
                    {["Transferencia bancaria", "Tarjeta", "Otro"].map((m) => (
                      <button key={m} onClick={() => { const nq = `${intent.raw} con ${m}`; search(nq); }}
                        className="text-[11px] px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded transition">
                        {m}
                      </button>
                    ))}
                  </>
                )}
                <button onClick={() => {}} className="text-[11px] px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded transition ml-1">
                  Mostrar todas las opciones
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== HUMAN SUMMARY ===== */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white">
              {operationLabel} {amount > 0 ? amount.toLocaleString() : ""} {asset}
              {fiat && <span className="text-slate-500 font-normal text-base"> con {fiat}</span>}
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Encontramos <b className="text-emerald-400">{onlineResults.length}</b> opciones disponibles
              {p2pOffers.length > 0 && <>, más <b className="text-pink-400">{p2pOffers.length}</b> ofertas P2P</>}.
              {best && <span className="text-slate-300"> Necesitas desde <b className="text-emerald-400">{best.totalCostHuman || fmtCurrency(best.totalCost, fiat)}</b>.</span>}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500">
              <span className="text-emerald-400 font-bold">{providersOk}</span>/{providersChecked} exchanges · {executionTimeMs}ms
            </span>
            <button onClick={onRetry} className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition" title="Re-escanear">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* "En términos simples" */}
        {best && (
          <div className="bg-emerald-950/30 border border-emerald-800/40 rounded-lg p-3 sm:p-4">
            <div className="text-xs text-emerald-400 font-semibold uppercase mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> En términos simples
            </div>
            <p className="text-sm text-slate-200 leading-relaxed">
              {best.explanation || `La mejor opción es ${best.providerName} con un costo total de ${best.totalCostHuman || fmtCurrency(best.totalCost, fiat)}.`}
            </p>
            {/* Por cada €1 recibes X */}
            {perUnit > 0 && fiat && (
              <p className="text-xs text-slate-400 mt-2">
                Por cada {fiat === "EUR" ? "€1" : fiat === "USD" ? "$1" : `1 ${fiat}`} recibirías aproximadamente <b className="text-emerald-400">{perUnit.toFixed(4)} {asset}</b> {best.fee > 0 ? "después de comisiones" : "sin comisión"}.
              </p>
            )}
            {/* Savings */}
            {savingsVsAvg > 0.5 && (
              <p className="text-xs text-emerald-400 mt-2 flex items-center gap-1">
                <Award className="w-3 h-3" /> Ahorras aproximadamente {savingsVsAvg.toFixed(1)}% vs el promedio
                {savingsVsWorst > 0 && <span className="text-slate-500"> ({fmtCurrency(savingsVsWorst, fiat)} vs la opción más cara)</span>}.
              </p>
            )}
            <div className="mt-3 flex items-center gap-2 flex-wrap text-[11px]">
              <span className="text-slate-500">Datos en tiempo real ·</span>
              <span className="text-slate-400">Actualizado hace {timeAgo(response.timestamp)}</span>
            </div>
          </div>
        )}

        {/* Disclaimer */}
        <div className="mt-3 text-[11px] text-slate-500 flex items-start gap-2">
          <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
          <span>CriptoMy compara las opciones. El pago y la operación son realizados por el proveedor seleccionado. CriptoMy no custodia tus fondos. Las condiciones finales pueden cambiar antes de confirmar.</span>
        </div>
      </div>

      {/* ===== SORT + MODE ===== */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1">
          <span className="text-xs text-slate-500 mr-2">Ordenar:</span>
          {([
            { id: "totalCost", label: "💰 Menor costo" },
            { id: "fee", label: "📉 Menor comisión" },
            { id: "liquidity", label: "🌊 Mayor liquidez" },
            { id: "latency", label: "⚡ Más rápido" },
          ] as const).map((opt) => (
            <button key={opt.id} onClick={() => setSortBy(opt.id)}
              className={`text-xs px-2.5 py-1 rounded transition ${sortBy === opt.id ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}>
              {opt.label}
            </button>
          ))}
        </div>
        <button onClick={() => setAdvancedMode(!advancedMode)}
          className="ml-auto text-xs px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded transition flex items-center gap-1">
          {advancedMode ? <Eye className="w-3 h-3" /> : <BarChart3 className="w-3 h-3" />}
          {advancedMode ? "Modo simple" : "Modo avanzado"}
        </button>
      </div>

      {/* ===== RESULT CARDS ===== */}
      <div className="space-y-3">
        {onlineResults.slice(0, advancedMode ? 12 : 5).map((r, i) => (
          <ResultCard key={`${r.provider}-${i}`} result={r} rank={i + 1} fiat={fiat} onSelect={() => setSelectedResult(selectedResult?.provider === r.provider ? null : r)} expanded={selectedResult?.provider === r.provider} advancedMode={advancedMode} />
        ))}
      </div>

      {/* ===== COMPARISON TABLE ===== */}
      {onlineResults.length > 1 && (
        <div>
          <h3 className="text-xs uppercase tracking-wide text-slate-500 mb-3 flex items-center gap-2">
            <BarChart3 className="w-3.5 h-3.5" /> Comparación rápida
          </h3>
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden overflow-x-auto">
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-800/50 text-slate-500 uppercase text-[10px] sm:text-[11px]">
                  <th className="px-3 py-2 text-left">Opción</th>
                  <th className="px-3 py-2 text-right">Pagas</th>
                  <th className="px-3 py-2 text-right hidden sm:table-cell">Recibes</th>
                  <th className="px-3 py-2 text-right">Comisión</th>
                  <th className="px-3 py-2 text-right hidden sm:table-cell">Tiempo</th>
                  <th className="px-3 py-2 text-center">KYC</th>
                </tr>
              </thead>
              <tbody>
                {onlineResults.slice(0, 6).map((r, i) => {
                  const meta = PROVIDER_META[r.provider];
                  return (
                    <tr key={i} className="border-t border-slate-800 hover:bg-slate-800/30 transition cursor-pointer" onClick={() => setSelectedResult(r)}>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <span>{meta?.logo || "❓"}</span>
                          <span className="text-slate-200 font-medium">{r.providerName}</span>
                          {i === 0 && <span className="text-[9px] px-1 py-0.5 bg-emerald-900/50 text-emerald-300 rounded">🥇</span>}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right text-emerald-400 font-mono font-semibold">{r.totalCostHuman || fmtCurrency(r.totalCost, fiat)}</td>
                      <td className="px-3 py-2.5 text-right text-slate-300 font-mono hidden sm:table-cell">{amount} {asset}</td>
                      <td className="px-3 py-2.5 text-right text-amber-400 font-mono">{r.feeHuman || fmtCurrency(r.fee, fiat)}</td>
                      <td className="px-3 py-2.5 text-right text-slate-400 hidden sm:table-cell">{r.estimatedTime || "—"}</td>
                      <td className="px-3 py-2.5 text-center">
                        {r.kycLevel === "NO_KYC" ? <span className="text-[10px] text-teal-400">🔓 No</span>
                        : r.kycLevel === "OPTIONAL" ? <span className="text-[10px] text-amber-400">🔓 Opc.</span>
                        : r.kycLevel === "MANDATORY" ? <span className="text-[10px] text-red-400">🔒 Sí</span>
                        : <span className="text-[10px] text-slate-500">❔</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== P2P OFFERS ===== */}
      {p2pOffers.length > 0 && (
        <div>
          <h3 className="text-xs uppercase tracking-wide text-slate-500 mb-3 flex items-center gap-2">
            <Star className="w-3.5 h-3.5 text-pink-400" /> Ofertas P2P (Binance) · {p2pOffers.length} encontradas
            <span className="text-teal-400">· 🔓 Sin KYC para ti</span>
          </h3>
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden overflow-x-auto">
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-800/50 text-slate-500 uppercase text-[10px]">
                  <th className="px-3 py-2 text-left">Vendedor</th>
                  <th className="px-3 py-2 text-right">Precio</th>
                  <th className="px-3 py-2 text-right hidden sm:table-cell">Límites</th>
                  <th className="px-3 py-2 text-right hidden sm:table-cell">Métodos</th>
                  <th className="px-3 py-2 text-right">Trades</th>
                </tr>
              </thead>
              <tbody>
                {p2pOffers.slice(0, 8).map((o, i) => (
                  <tr key={i} className="border-t border-slate-800 hover:bg-slate-800/30 transition">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-[10px] text-white font-bold shrink-0">{(o.advertiser || "?").slice(0, 2).toUpperCase()}</div>
                        <span className="text-slate-200 font-medium">@{o.advertiser}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right text-emerald-400 font-mono font-bold">{fmtPrice(o.price)} <span className="text-[10px] text-slate-500">{o.fiat}</span></td>
                    <td className="px-3 py-2.5 text-right text-slate-400 font-mono hidden sm:table-cell">{o.minAmount > 0 ? `${(o.minAmount / 1000).toFixed(0)}k` : "—"} - {o.maxAmount > 0 ? `${(o.maxAmount / 1000).toFixed(0)}k` : "—"}</td>
                    <td className="px-3 py-2.5 text-slate-400 hidden sm:table-cell">{o.paymentMethods.slice(0, 2).join(", ") || "—"}</td>
                    <td className="px-3 py-2.5 text-right text-slate-300 font-mono">{o.tradeCount > 0 ? o.tradeCount.toLocaleString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== SELECTED RESULT DETAIL ===== */}
      {selectedResult && <ResultDetail result={selectedResult} />}

      {/* ===== ERRORS (collapsed) ===== */}
      {response.errors.length > 0 && (
        <details className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-3">
          <summary className="text-xs text-slate-500 cursor-pointer flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
            {response.errors.length} providers no respondieron
          </summary>
          <div className="mt-2 space-y-1">
            {response.errors.map((e, i) => (
              <div key={i} className="text-[11px] text-slate-500"><b className="text-slate-400">{e.provider}:</b> {e.error}</div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

// ============================================================
// RESULT CARD
// ============================================================
function ResultCard({ result, rank, fiat, onSelect, expanded, advancedMode }: {
  result: RankedResult; rank: number; fiat: string; onSelect: () => void; expanded: boolean; advancedMode: boolean;
}) {
  const meta = PROVIDER_META[result.provider] || { logo: "❓", desc: "" };
  const isBest = rank === 1;
  const kycBadge = result.kycLevel === "NO_KYC" ? { color: "text-teal-400", label: "🔓 Sin KYC" }
    : result.kycLevel === "OPTIONAL" ? { color: "text-amber-400", label: "🔓 KYC opcional" }
    : result.kycLevel === "MANDATORY" ? { color: "text-red-400", label: "🔒 KYC obligatorio" }
    : { color: "text-slate-400", label: "❔ KYC" };
  const url = PROVIDER_META[result.provider]?.url(result.asset || "BTC", result.fiat || "USDT") || "#";

  return (
    <div className={`bg-slate-900 border rounded-xl overflow-hidden transition ${isBest ? "border-emerald-600/50" : "border-slate-800"}`}>
      {/* Top row: rank + provider + price + CTA */}
      <div className="p-3 sm:p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {/* Left: rank + provider */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${isBest ? "bg-emerald-950/50 text-emerald-400" : "bg-slate-800 text-slate-400"}`}>
              {isBest ? "🥇" : `#${rank}`}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base">{meta.logo}</span>
                <span className="text-sm font-bold text-slate-100">{result.providerName}</span>
                {result.badge === "CHEAPEST" && <span className="text-[9px] px-1 py-0.5 bg-blue-900/50 text-blue-300 rounded">💰</span>}
                {result.badge === "MOST_LIQUID" && <span className="text-[9px] px-1 py-0.5 bg-purple-900/50 text-purple-300 rounded">🌊</span>}
                {result.badge === "NO_KYC" && <span className="text-[9px] px-1 py-0.5 bg-teal-900/50 text-teal-300 rounded">🔓</span>}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">{meta.desc || ""}</div>
            </div>
          </div>

          {/* Right: cost + CTA */}
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-lg sm:text-xl font-bold text-emerald-400 font-mono leading-tight">
                {result.totalCostHuman || fmtCurrency(result.totalCost, fiat)}
              </div>
              <div className="text-[10px] text-slate-500">
                {result.exchangeRateHuman || `≈ ${fmtPrice(result.effectivePrice)} ${fiat}/${result.asset}`}
              </div>
            </div>
            <a href={url} target="_blank" rel="noopener noreferrer"
              className={`flex items-center gap-1 text-xs px-3 py-2 rounded-lg transition font-semibold shrink-0 ${isBest ? "bg-emerald-600 hover:bg-emerald-500 text-white" : "bg-slate-800 hover:bg-slate-700 text-slate-200"}`}>
              Ver oferta <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Metrics row */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-3 pt-3 border-t border-slate-800">
          <div>
            <div className="text-[9px] text-slate-500 uppercase">Pagas</div>
            <div className="text-sm text-white font-mono">{result.totalCostHuman || fmtCurrency(result.totalCost, fiat)}</div>
          </div>
          <div>
            <div className="text-[9px] text-slate-500 uppercase">Recibes</div>
            <div className="text-sm text-emerald-400 font-mono">{result.amount} {result.asset}</div>
          </div>
          <div>
            <div className="text-[9px] text-slate-500 uppercase">Comisión</div>
            <div className="text-sm text-amber-400 font-mono">{result.feeHuman || fmtCurrency(result.fee, fiat)}</div>
          </div>
          <div>
            <div className="text-[9px] text-slate-500 uppercase">Tiempo</div>
            <div className="text-sm text-slate-300">{result.estimatedTime || "—"}</div>
          </div>
          <div>
            <div className="text-[9px] text-slate-500 uppercase">KYC</div>
            <div className={`text-sm ${kycBadge.color}`}>{kycBadge.label}</div>
          </div>
        </div>

        {/* Explanation */}
        {result.explanation && (
          <div className="mt-3 text-xs text-slate-400 bg-slate-950/30 rounded-lg p-2.5 flex items-start gap-2">
            <Info className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
            <span>{result.explanation}</span>
          </div>
        )}

        {/* Warnings */}
        {result.warnings && result.warnings.length > 0 && (
          <div className="mt-2 space-y-1">
            {result.warnings.map((w, i) => (
              <div key={i} className="text-[11px] text-amber-400 flex items-start gap-1.5">
                <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}

        {/* Advanced mode details */}
        {advancedMode && (
          <div className="mt-3 pt-3 border-t border-slate-800 grid grid-cols-3 sm:grid-cols-6 gap-2 text-[11px] font-mono">
            <div><div className="text-slate-500 text-[9px]">Precio</div><div className="text-slate-300">{fmtPrice(result.price)}</div></div>
            <div><div className="text-slate-500 text-[9px]">Spread</div><div className="text-slate-300">{result.spreadPercent?.toFixed(3) || "—"}%</div></div>
            <div><div className="text-slate-500 text-[9px]">Vol 24h</div><div className="text-slate-300">{result.liquidity ? `${(result.liquidity / 1e6).toFixed(1)}M` : "—"}</div></div>
            <div><div className="text-slate-500 text-[9px]">Latencia</div><div className="text-slate-300">{result.latencyMs}ms</div></div>
            <div><div className="text-slate-500 text-[9px]">Source</div><div className="text-slate-300">{result.source}</div></div>
            <div><div className="text-slate-500 text-[9px]">Tier</div><div className="text-slate-300">{result.liquidityTier}</div></div>
          </div>
        )}

        {/* Toggle detail */}
        <button onClick={onSelect} className="mt-2 text-xs text-slate-500 hover:text-slate-300 transition flex items-center gap-1">
          {expanded ? (<><ChevronUp className="w-3 h-3" /> Ocultar detalle</>) : (<><ChevronDown className="w-3 h-3" /> Ver cómo funciona</>)}
        </button>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="bg-slate-950/40 border-t border-slate-800 p-4 space-y-4">
          {/* Steps */}
          {result.steps && result.steps.length > 0 && (
            <div>
              <div className="text-xs uppercase text-emerald-400 font-semibold mb-3 flex items-center gap-1.5">
                <Zap className="w-3 h-3" /> Así funcionaría
              </div>
              <ol className="space-y-2">
                {result.steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-3 text-xs">
                    <div className="w-6 h-6 rounded-full bg-emerald-600/20 border border-emerald-600/50 flex items-center justify-center text-[10px] font-bold text-emerald-400 shrink-0">{i + 1}</div>
                    <span className="text-slate-300 pt-0.5">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {/* Calculator */}
          <div className="bg-slate-900 rounded-lg p-3">
            <div className="text-xs uppercase text-purple-400 font-semibold mb-2 flex items-center gap-1.5">
              <Calculator className="w-3 h-3" /> ¿Cuánto recibiré?
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div><div className="text-slate-500 text-[10px]">Quieres</div><div className="text-slate-200 font-mono">{result.amount} {result.asset}</div></div>
              <div><div className="text-slate-500 text-[10px]">Pagas</div><div className="text-white font-mono font-bold">{result.totalCostHuman || fmtCurrency(result.totalCost, fiat)}</div></div>
              <div><div className="text-slate-500 text-[10px]">Comisiones</div><div className="text-amber-400 font-mono">{result.feeHuman || fmtCurrency(result.fee, fiat)}</div></div>
              <div><div className="text-slate-500 text-[10px]">Tipo de cambio</div><div className="text-slate-300 font-mono">{result.exchangeRateHuman || "—"}</div></div>
            </div>
            {/* Price explanation */}
            {result.effectivePrice > 0 && result.asset && fiat && (
              <div className="mt-2 pt-2 border-t border-slate-800 text-[11px] text-slate-400">
                Por cada {fiat === "EUR" ? "€1" : fiat === "USD" ? "$1" : `1 ${fiat}`} recibirías aproximadamente <b className="text-emerald-400">{(1 / result.effectivePrice).toFixed(6)} {result.asset}</b> {result.fee > 0 ? "después de comisiones" : "sin comisión"}.
              </div>
            )}
          </div>
          {/* Network explanation */}
          {result.asset === "USDT" && (
            <div className="bg-blue-950/20 border border-blue-800/30 rounded-lg p-3 text-[11px]">
              <div className="text-blue-400 font-semibold mb-1 flex items-center gap-1"><Globe2 className="w-3 h-3" /> Red de envío</div>
              <p className="text-slate-400">
                Los {result.asset} se envían por una red blockchain (Tron/TRC20, Ethereum/ERC20, o Polygon).
                La red más común y económica es <b className="text-slate-300">Tron (TRC20)</b> — fee de retiro ~1 USDT.
              </p>
              <p className="text-amber-400 mt-1.5 flex items-start gap-1">
                <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                <span>La red de envío debe coincidir con la red compatible con tu wallet receptora. Si envías por la red equivocada, puedes perder los fondos.</span>
              </p>
            </div>
          )}
          {/* Payment methods */}
          {result.paymentMethods && result.paymentMethods.length > 0 && (
            <div className="bg-slate-900 rounded-lg p-3">
              <div className="text-xs text-slate-400 font-medium mb-2 flex items-center gap-1"><CreditCard className="w-3 h-3" /> Métodos de pago disponibles</div>
              <div className="flex flex-wrap gap-1.5">
                {result.paymentMethods.map((m) => (
                  <span key={m} className="text-[11px] px-2 py-1 bg-slate-800 text-slate-300 rounded">{m}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// RESULT DETAIL (full view when selected)
// ============================================================
function ResultDetail({ result }: { result: RankedResult }) {
  const meta = PROVIDER_META[result.provider] || { logo: "❓", desc: "" };
  const url = PROVIDER_META[result.provider]?.url(result.asset || "BTC", result.fiat || "USDT") || "#";

  return (
    <div className="bg-slate-900 border border-emerald-600/40 rounded-xl p-4 sm:p-5">
      <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
        <Zap className="w-4 h-4 text-emerald-400" /> Cómo completar esta operación
      </h3>

      {result.steps && (
        <ol className="space-y-3 mb-4">
          {result.steps.map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-emerald-600/20 border border-emerald-600/50 flex items-center justify-center text-xs font-bold text-emerald-400 shrink-0">{i + 1}</div>
              <div className="flex-1">
                <span className="text-sm text-slate-300">{step}</span>
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className="flex items-center gap-2 flex-wrap mt-4 pt-4 border-t border-slate-800">
        <a href={url} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition font-bold">
          <ExternalLink className="w-4 h-4" /> Ir a {result.providerName}
        </a>
        <span className="text-[11px] text-slate-500">⚠️ Los precios y comisiones pueden cambiar antes de confirmar.</span>
      </div>
    </div>
  );
}

function Calculator({ className }: { className?: string }) {
  return <span className={className}>🧮</span>;
}
