"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import {
  Search, Loader2, TrendingUp, TrendingDown, Award, ArrowRight, Globe2, Zap,
  Clock, AlertTriangle, RefreshCw, Star, Filter, ShieldOff, Flame, Gauge,
  Activity, Sparkles, Info, HelpCircle, ExternalLink, Wallet, Coins, AlertCircle,
  ArrowUpRight, ArrowDownRight, BarChart3, Radio, ShieldCheck, Eye,
} from "lucide-react";
import { QUICK_SEARCHES } from "@/lib/scanner/interpreter";
import type { SearchResponse, SearchIntent, RankedResult, P2POffer, ArbitrageOpportunity } from "@/lib/scanner/types";

const RECENT_SEARCHES_KEY = "criptomy:recent-searches";

// ============================================================
// Market Intel interface
// ============================================================
interface Intel {
  gas: { gasPriceGwei: number; estimatedCostUsd?: number; status: string; error?: string };
  fearGreed: { value: number; classification: string; status: string };
  trending: {
    id: string; name: string; symbol: string; marketCapRank?: number;
    priceBtc: number; priceUsd?: number; priceChangePercent24h?: number;
  }[];
  gainers: {
    id: string; symbol: string; name: string; priceUsd: number;
    changePercent24h: number; marketCapRank?: number;
  }[];
  losers: {
    id: string; symbol: string; name: string; priceUsd: number;
    changePercent24h: number; marketCapRank?: number;
  }[];
  stakingYields: { asset: string; apyPercent: number; source: string; notes: string }[];
}

// ============================================================
// Helpers
// ============================================================
function fearGreedColor(value: number): string {
  if (value >= 75) return "bg-emerald-500 text-white";
  if (value >= 55) return "bg-emerald-400 text-white";
  if (value >= 45) return "bg-amber-400 text-white";
  if (value >= 25) return "bg-orange-500 text-white";
  return "bg-red-500 text-white";
}

function fearGreedEmoji(value: number): string {
  if (value >= 75) return "🤑";
  if (value >= 55) return "😀";
  if (value >= 45) return "😐";
  if (value >= 25) return "😨";
  return "😱";
}

function fearGreedBar(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function fmtPrice(n: number, decimals?: number): string {
  if (!n) return "—";
  const d = decimals ?? (n < 1 ? 6 : n < 100 ? 4 : 2);
  return n.toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: d > 2 ? 2 : 0 });
}

function fmtPct(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

function timeAgo(ts: number): string {
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 60) return `hace ${sec}s`;
  if (sec < 3600) return `hace ${Math.floor(sec / 60)} min`;
  return `hace ${Math.floor(sec / 3600)}h`;
}

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function SmartSearchView() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [noKycOnly, setNoKycOnly] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [intel, setIntel] = useState<Intel | null>(null);
  const [intelLoading, setIntelLoading] = useState(false);
  const [sortBy, setSortBy] = useState<"totalCost" | "fee" | "liquidity" | "latency">("totalCost");

  // Cargar recientes
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || "[]");
      if (Array.isArray(saved)) setRecentSearches(saved.slice(0, 5));
    } catch {}
  }, []);

  // Cargar Market Intel
  const loadIntel = useCallback(async () => {
    setIntelLoading(true);
    try {
      const res = await fetch("/api/scanner/intel");
      if (!res.ok) return;
      const data = await res.json();
      setIntel(data as Intel);
    } catch {}
    finally { setIntelLoading(false); }
  }, []);

  useEffect(() => {
    loadIntel();
    const interval = setInterval(loadIntel, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadIntel]);

  // Sync URL ?q=
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const urlQuery = params.get("q");
    if (urlQuery && !query) {
      setQuery(urlQuery);
      search(urlQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveRecent = useCallback((q: string) => {
    if (typeof window === "undefined") return;
    try {
      const saved = JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || "[]");
      const updated = [q, ...(saved as string[]).filter((s) => s !== q)].slice(0, 5);
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
      setRecentSearches(updated);
    } catch {}
  }, []);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    setResponse(null);
    saveRecent(q);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("q", q);
      window.history.replaceState({}, "", url.toString());
    }
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Error"); return; }
      setResponse(data as SearchResponse);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [saveRecent]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    search(query);
  };

  // Filtrado + re-sort en cliente
  // IMPORTANTE: Mostramos TODOS los exchanges (online + offline + error + disabled)
  // El usuario quiere ver todas las opciones desglosadas con su información.
  const filteredResults = useMemo(() => {
    if (!response) return [];
    let arr = response.results;
    if (noKycOnly) arr = arr.filter((r) => r.kycLevel === "NO_KYC" || r.kycLevel === "OPTIONAL");
    // Primero los ONLINE (rank>0) ordenados según sortBy; luego offline/error al final
    const online = arr.filter((r) => r.status === "ONLINE" && r.rank > 0);
    const offline = arr.filter((r) => r.status !== "ONLINE" || r.rank === 0);
    online.sort((a, b) => {
      if (sortBy === "fee") return (a.fee || 0) - (b.fee || 0);
      if (sortBy === "liquidity") return (b.liquidity || 0) - (a.liquidity || 0);
      if (sortBy === "latency") return (a.latencyMs || 0) - (b.latencyMs || 0);
      return (a.totalCost || 0) - (b.totalCost || 0);
    });
    return [...online, ...offline];
  }, [response, noKycOnly, sortBy]);

  // Para la "best option" solo consideramos ONLINE
  const onlineResults = useMemo(
    () => (response?.results || []).filter((r) => r.status === "ONLINE" && r.rank > 0),
    [response]
  );

  const hasResults = filteredResults.length > 0 ||
    (response?.p2pOffers.length || 0) > 0 ||
    (response?.arbitrageOpportunities.length || 0) > 0;

  return (
    <div className="min-h-screen bg-slate-950">
      {/* HERO SECTION — buscador principal */}
      <div className="relative overflow-hidden border-b border-slate-800">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-950/30 via-slate-950 to-slate-950" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(16,185,129,0.08),transparent_50%)]" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-12 pb-8">
          {/* Logo + título */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/50 border border-emerald-800/50 text-xs text-emerald-400 mb-4">
              <Radio className="w-3 h-3" />
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Escaneando 11 exchanges en tiempo real
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-slate-100 mb-3 tracking-tight">
              Buscador <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">Web3</span>
            </h1>
            <p className="text-sm text-slate-400 max-w-2xl mx-auto">
              Escribe lo que quieres hacer. El sistema escanea Binance, OKX, Bybit, Kraken, Coinbase,
              KuCoin, Gate.io, MEXC, HTX, Bitget y CoinGecko en paralelo y encuentra las mejores
              opciones con costo total real.
            </p>
          </div>

          {/* Buscador grande */}
          <form onSubmit={submit} className="relative max-w-3xl mx-auto">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/20 to-teal-600/20 rounded-2xl blur-xl group-focus-within:opacity-100 opacity-50 transition" />
              <div className="relative flex items-center bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden focus-within:border-emerald-600 transition">
                <Search className="absolute left-5 w-5 h-5 text-slate-500" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Quiero comprar 1000 USDT con COP…"
                  className="flex-1 px-14 py-4 bg-transparent text-slate-100 text-lg placeholder:text-slate-600 focus:outline-none"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={loading || !query.trim()}
                  className="m-1.5 px-5 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold flex items-center gap-2 transition"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  Buscar
                </button>
              </div>
            </div>
          </form>

          {/* Stats bar */}
          <div className="max-w-3xl mx-auto mt-4 flex items-center justify-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {response ? `${response.providersOk}/${response.providersChecked} providers OK` : "Listo para escanear"}
            </span>
            {response && (
              <>
                <span>·</span>
                <span>{response.executionTimeMs}ms</span>
                <span>·</span>
                <span>{timeAgo(response.timestamp)}</span>
              </>
            )}
          </div>

          {/* Búsquedas recientes */}
          {recentSearches.length > 0 && !response && !loading && (
            <div className="max-w-3xl mx-auto mt-4 flex items-center justify-center gap-2 flex-wrap">
              <span className="text-xs text-slate-600">Recientes:</span>
              {recentSearches.map((q) => (
                <button
                  key={q}
                  onClick={() => { setQuery(q); search(q); }}
                  className="text-xs px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-full transition"
                >
                  {q.length > 35 ? q.slice(0, 35) + "…" : q}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* LOADING STATE — profesional con skeleton */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="relative w-16 h-16 mb-6">
              <div className="absolute inset-0 rounded-full border-4 border-slate-800" />
              <div className="absolute inset-0 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
            </div>
            <p className="text-sm text-slate-300 font-medium mb-1">Escaneando 11 exchanges en paralelo…</p>
            <p className="text-xs text-slate-500">
              Binance · OKX · Bybit · Kraken · Coinbase · KuCoin · Gate.io · MEXC · HTX · Bitget · CoinGecko
            </p>
          </div>
        )}

        {/* ERROR */}
        {error && (
          <div className="max-w-lg mx-auto bg-red-950/30 border border-red-800/50 rounded-xl p-6 text-center">
            <AlertTriangle className="w-8 h-8 mx-auto mb-3 text-red-400" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {/* RESULTADOS */}
        {response && !loading && hasResults && (
          <ResultsLayout
            response={response}
            filteredResults={filteredResults}
            onlineResults={onlineResults}
            noKycOnly={noKycOnly}
            setNoKycOnly={setNoKycOnly}
            sortBy={sortBy}
            setSortBy={setSortBy}
            onRetry={() => search(query)}
          />
        )}

        {/* NO HAY RESULTADOS */}
        {response && !loading && !hasResults && (
          <NoResults response={response} noKycOnly={noKycOnly} setNoKycOnly={setNoKycOnly} />
        )}

        {/* ESTADO INICIAL — sin búsqueda aún */}
        {!response && !loading && !error && (
          <InitialState
            recentSearches={recentSearches}
            intel={intel}
            intelLoading={intelLoading}
            onSearch={(q) => { setQuery(q); search(q); }}
            onRefreshIntel={loadIntel}
          />
        )}
      </div>
    </div>
  );
}

// ============================================================
// RESULTS LAYOUT — vista de resultados profesional
// ============================================================
function ResultsLayout({
  response,
  filteredResults,
  onlineResults,
  noKycOnly,
  setNoKycOnly,
  sortBy,
  setSortBy,
  onRetry,
}: {
  response: SearchResponse;
  filteredResults: RankedResult[];
  onlineResults: RankedResult[];
  noKycOnly: boolean;
  setNoKycOnly: (v: boolean) => void;
  sortBy: "totalCost" | "fee" | "liquidity" | "latency";
  setSortBy: (v: "totalCost" | "fee" | "liquidity" | "latency") => void;
  onRetry: () => void;
}) {
  const best = onlineResults[0];
  const alternatives = onlineResults.slice(1, 6);
  const offlineResults = filteredResults.filter((r) => r.status !== "ONLINE" || r.rank === 0);
  const { intent, p2pOffers, arbitrageOpportunities, providersOk, providersChecked, errors, executionTimeMs } = response;

  return (
    <div className="space-y-6">
      {/* INTENT BAR — qué entendió el sistema */}
      <IntentBar intent={intent} providersOk={providersOk} providersChecked={providersChecked} executionTimeMs={executionTimeMs} onRetry={onRetry} />

      {/* FILTROS Y ORDEN */}
      {(filteredResults.length > 0 || p2pOffers.length > 0) && (
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setNoKycOnly(!noKycOnly)}
            className={`text-xs px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
              noKycOnly ? "bg-teal-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            <ShieldOff className="w-3.5 h-3.5" />
            Solo sin KYC
          </button>

          <div className="flex items-center gap-1 ml-auto">
            <span className="text-xs text-slate-500 mr-2">Ordenar:</span>
            {([
              { id: "totalCost", label: "Costo total" },
              { id: "fee", label: "Comisión" },
              { id: "liquidity", label: "Liquidez" },
              { id: "latency", label: "Velocidad" },
            ] as const).map((opt) => (
              <button
                key={opt.id}
                onClick={() => setSortBy(opt.id)}
                className={`text-xs px-2.5 py-1 rounded transition ${
                  sortBy === opt.id ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* MEJOR OPCIÓN — destacada */}
      {best && <BestOptionCard result={best} />}

      {/* TABLA COMPARATIVA — TODOS los exchanges (online + offline + error + disabled) */}
      {filteredResults.length > 0 && (
        <FullProviderTable results={filteredResults} sortBy={sortBy} />
      )}

      {/* P2P OFFERS */}
      {p2pOffers.length > 0 && (
        <P2PSection offers={p2pOffers} />
      )}

      {/* ARBITRAJE */}
      {arbitrageOpportunities.length > 0 && (
        <ArbitrageSection opportunities={arbitrageOpportunities} />
      )}

      {/* RESUMEN DE ERRORES */}
      {errors.length > 0 && (
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
          <div className="text-xs uppercase text-slate-500 mb-2 flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
            Providers no disponibles ({errors.length})
          </div>
          <div className="space-y-1">
            {errors.map((e, i) => (
              <div key={i} className="text-[11px] text-slate-500">
                <b className="text-slate-400">{e.provider}:</b> {e.error}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// INTENT BAR — qué entendió el sistema
// ============================================================
function IntentBar({
  intent, providersOk, providersChecked, executionTimeMs, onRetry,
}: {
  intent: SearchIntent; providersOk: number; providersChecked: number; executionTimeMs: number; onRetry: () => void;
}) {
  const config: Record<string, { color: string; bg: string; label: string; icon: React.ElementType; desc: string }> = {
    BUY: { color: "text-emerald-300", bg: "bg-emerald-950/50 border-emerald-800/50", label: "Comprar", icon: TrendingUp, desc: "Buscar dónde comprar al mejor precio" },
    SELL: { color: "text-amber-300", bg: "bg-amber-950/50 border-amber-800/50", label: "Vender", icon: TrendingDown, desc: "Buscar dónde vender al mejor precio" },
    SEND: { color: "text-cyan-300", bg: "bg-cyan-950/50 border-cyan-800/50", label: "Enviar / Remesa", icon: Globe2, desc: "Buscar rutas cross-border" },
    ARBITRAGE: { color: "text-purple-300", bg: "bg-purple-950/50 border-purple-800/50", label: "Arbitraje", icon: Award, desc: "Detectar diferencias de precio entre exchanges" },
    COMPARE: { color: "text-blue-300", bg: "bg-blue-950/50 border-blue-800/50", label: "Comparar", icon: BarChart3, desc: "Comparar precios entre todos los exchanges" },
    FIND_P2P: { color: "text-pink-300", bg: "bg-pink-950/50 border-pink-800/50", label: "Mejor P2P", icon: Star, desc: "Buscar ofertas persona-a-persona" },
    UNKNOWN: { color: "text-slate-300", bg: "bg-slate-800 border-slate-700", label: "Desconocido", icon: AlertTriangle, desc: "No se pudo interpretar" },
  };
  const c = config[intent.operation] || config.UNKNOWN;
  const Icon = c.icon;

  const params: { label: string; value: string | undefined; icon: React.ElementType }[] = [
    { label: "Activo", value: intent.asset, icon: Coins },
    { label: "Monto", value: intent.amount ? String(intent.amount) : undefined, icon: Wallet },
    { label: "Moneda", value: intent.fiat, icon: TrendingUp },
    { label: "País", value: intent.country, icon: Globe2 },
  ];
  const filled = params.filter((p) => p.value);

  return (
    <div className={`rounded-xl border p-4 ${c.bg}`}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-10 h-10 rounded-lg bg-slate-900/50 flex items-center justify-center ${c.color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <div className={`text-base font-bold ${c.color}`}>{c.label}</div>
              <div className="text-[11px] text-slate-400">{c.desc}</div>
            </div>
          </div>
          {filled.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {filled.map((p) => {
                const PIcon = p.icon;
                return (
                  <div key={p.label} className="flex items-center gap-1.5 bg-slate-900/60 rounded-lg px-2.5 py-1">
                    <PIcon className="w-3 h-3 text-slate-500" />
                    <span className="text-[10px] text-slate-500 uppercase">{p.label}:</span>
                    <span className="text-xs text-slate-200 font-medium">{p.value}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <div className="text-xs text-slate-400">
              <span className="text-emerald-400 font-bold">{providersOk}</span>
              <span className="text-slate-600">/{providersChecked}</span> providers
            </div>
            <div className="text-[10px] text-slate-500">{executionTimeMs}ms · {timeAgo(Date.now())}</div>
          </div>
          <button
            onClick={onRetry}
            className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition"
            title="Re-escanear"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// BEST OPTION CARD — tarjeta destacada 🥇
// ============================================================
function BestOptionCard({ result }: { result: RankedResult }) {
  const price = result.price ?? 0;
  const fee = result.fee ?? 0;
  const totalCost = result.totalCost ?? 0;
  const effectivePrice = result.effectivePrice ?? 0;
  const spread = result.spread ?? 0;
  const spreadPercent = result.spreadPercent ?? 0;
  const liquidity = result.liquidity ?? 0;

  // URLs de trading específicas del par (no homepage genérico)
  // Cada exchange tiene una URL de trading del par BTC/USDT, ETH/USDT, etc.
  const exchangeTradeUrls: Record<string, (asset: string, quote: string) => string> = {
    binance: (a, q) => `https://www.binance.com/en/trade/${a}_${q}?type=spot`,
    okx: (a, q) => `https://www.okx.com/trade-spot/${a.toLowerCase()}-${q.toLowerCase()}`,
    bybit: (a, q) => `https://www.bybit.com/en-US/trade/spot/${a}${q}`,
    kraken: (a, q) => `https://www.kraken.com/prices/${a.toLowerCase()}`,
    coinbase: (a, q) => `https://www.coinbase.com/price/${a.toLowerCase()}`,
    kucoin: (a, q) => `https://www.kucoin.com/trade/${a}-${q}`,
    gate: (a, q) => `https://www.gate.io/trade/${a}_${q}`,
    mexc: (a, q) => `https://www.mexc.com/exchange/${a}_${q}`,
    htx: (a, q) => `https://www.htx.com/en-us/exchange/${a.toLowerCase()}_${q.toLowerCase()}/`,
    bitget: (a, q) => `https://www.bitget.com/spot/${a}${q}_SPBL`,
    bingx: (a, q) => `https://www.bingx.com/en/spot/${a}-${q}/`,
    coingecko: (a, q) => `https://www.coingecko.com/en/coins/${a.toLowerCase()}`,
  };

  // Información de reputación del exchange
  const exchangeInfo: Record<string, { rank: string; trust: string; vol24h: string; since: string; desc: string }> = {
    binance: { rank: "#1", trust: "Alta", vol24h: "$15B+", since: "2017", desc: "Mayor exchange del mundo por volumen. Liquidez extrema. KYC obligatorio." },
    okx: { rank: "#5", trust: "Alta", vol24h: "$3B+", since: "2017", desc: "Top 5 global. Liquidez TOP. KYC obligatorio." },
    bybit: { rank: "#3", trust: "Alta", vol24h: "$5B+", since: "2018", desc: "Top 3 global. Liquidez TOP. KYC obligatorio." },
    kraken: { rank: "#10", trust: "Muy alta", vol24h: "$1B+", since: "2011", desc: "Exchange más regulado de USA/Europa. Confianza institucional." },
    coinbase: { rank: "#3", trust: "Muy alta", vol24h: "$2B+", since: "2012", desc: "Exchange regulado de USA. Listado en NASDAQ. Máxima confianza." },
    kucoin: { rank: "#8", trust: "Media-alta", vol24h: "$1B+", since: "2017", desc: "Top 10. Amplia variedad de tokens. KYC obligatorio." },
    gate: { rank: "#15", trust: "Media", vol24h: "$500M+", since: "2013", desc: "Top 20. Buena liquidez para altcoins." },
    mexc: { rank: "#10", trust: "Media", vol24h: "$1B+", since: "2018", desc: "Top 10. Listado rápido de tokens. KYC opcional (único)." },
    htx: { rank: "#15", trust: "Media", vol24h: "$500M+", since: "2013", desc: "Antes Huobi. Top 20. Liquidez media." },
    bitget: { rank: "#10", trust: "Media", vol24h: "$1B+", since: "2018", desc: "Top 10. Fees más baratos (0.05% taker). Copy trading." },
    bingx: { rank: "#20", trust: "Media", vol24h: "$300M+", since: "2018", desc: "Top 20. No bloquea Vercel. Reemplazo de Bybit en el buscador." },
    coingecko: { rank: "N/A", trust: "Referencia", vol24h: "N/A", since: "2014", desc: "Agregador (no exchange). Precios de referencia de miles de fuentes." },
  };

  const info = exchangeInfo[result.provider] || { rank: "?", trust: "?", vol24h: "?", since: "?", desc: "" };
  const tradeUrl = exchangeTradeUrls[result.provider]?.(result.asset || "BTC", result.fiat || "USDT") || "#";
  const url = tradeUrl;

  const kycInfo = result.kycLevel === "NO_KYC"
    ? { color: "text-teal-300", bg: "bg-teal-950/50", label: "🔓 Sin KYC" }
    : result.kycLevel === "OPTIONAL"
      ? { color: "text-amber-300", bg: "bg-amber-950/50", label: "🔓 KYC opcional" }
      : result.kycLevel === "MANDATORY"
        ? { color: "text-red-300", bg: "bg-red-950/50", label: "🔒 KYC obligatorio" }
        : { color: "text-slate-400", bg: "bg-slate-800", label: "❔ KYC" };

  return (
    <div className="relative bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-900 border-2 border-emerald-600/50 rounded-2xl p-5 shadow-xl shadow-emerald-900/20 overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-600/10 rounded-full blur-3xl -mr-16 -mt-16" />

      <div className="relative flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-600 flex items-center justify-center text-2xl font-bold text-white">
            🥇
          </div>
          <div>
            <div className="text-lg font-bold text-slate-100">{result.providerName}</div>
            <div className="text-xs text-slate-400 flex items-center gap-2 flex-wrap">
              {info.rank !== "?" && (
                <span className="text-[10px] px-1.5 py-0.5 bg-slate-800 rounded text-slate-300">
                  Rank {info.rank}
                </span>
              )}
              {info.trust !== "?" && (
                <span className="text-[10px] text-slate-400">Confianza: {info.trust}</span>
              )}
              {info.since !== "?" && (
                <span className="text-[10px] text-slate-600">· Desde {info.since}</span>
              )}
              {result.liquidityTier === "TOP" && <span>🌊 TOP</span>}
              {result.liquidityTier === "MEDIUM" && <span>Med</span>}
              {result.liquidityTier === "AGGREGATOR" && <span>📊 Agregador</span>}
              <span className={kycInfo.color}>{kycInfo.label}</span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-slate-500 uppercase">Latencia</div>
          <div className="text-sm text-slate-300 font-mono">{result.latencyMs || 0}ms</div>
        </div>
      </div>

      {/* Descripción del exchange */}
      {info.desc && (
        <div className="mb-3 text-[11px] text-slate-500 italic bg-slate-800/30 rounded-lg px-3 py-2">
          {info.desc}
        </div>
      )}

      {/* Métricas principales — grid 4 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <Metric label="Precio unit." value={price > 0 ? `${fmtPrice(price)} ${result.fiat || ""}` : "—"} tooltip="Precio del activo en el exchange (sin comisión)" />
        <Metric label="Comisión" value={fee > 0 ? `${fmtPrice(fee, 4)} ${result.feeCurrency || ""}` : "Gratis"} color="text-amber-400" tooltip="Fee taker del exchange" />
        <Metric label="Costo total" value={totalCost > 0 ? `${fmtPrice(totalCost)} ${result.totalCostCurrency || ""}` : "—"} color="text-emerald-400" bold tooltip="Precio × cantidad + comisión + red. Lo que realmente pagas." />
        <Metric label="Precio efectivo" value={effectivePrice > 0 ? `${fmtPrice(effectivePrice, 6)} ${result.fiat || ""}` : "—"} tooltip="Costo total / cantidad (precio real por unidad)" />
      </div>

      {/* Detalles secundarios */}
      <div className="space-y-1 mb-4">
        {spread > 0 && (
          <div className="text-[11px] text-slate-500 flex items-center gap-2">
            <span className="w-1 h-1 rounded-full bg-slate-600" />
            Spread: <span className="text-slate-400">{spread.toFixed(4)} ({spreadPercent.toFixed(3)}%)</span>
          </div>
        )}
        {liquidity > 0 && (
          <div className="text-[11px] text-slate-500 flex items-center gap-2">
            <span className="w-1 h-1 rounded-full bg-slate-600" />
            Volumen 24h: <span className="text-slate-400">{liquidity.toLocaleString(undefined, { maximumFractionDigits: 0 })} {result.fiat}</span>
          </div>
        )}
        {result.paymentMethods && result.paymentMethods.length > 0 && (
          <div className="text-[11px] text-slate-500 flex items-center gap-2">
            <span className="w-1 h-1 rounded-full bg-slate-600" />
            Métodos: <span className="text-slate-400">{result.paymentMethods.join(", ")}</span>
          </div>
        )}
      </div>

      {/* Razón del ranking */}
      <div className="flex items-start gap-2 pt-3 border-t border-slate-800">
        <Info className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
        <div className="text-[11px] text-slate-300">{result.reason}</div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 mt-4 pt-3 border-t border-slate-800">
        <div className="text-[10px] text-slate-500 flex items-center gap-2">
          <Clock className="w-3 h-3" />
          {result.estimatedTime || "—"}
          <span className="text-slate-700 mx-1">·</span>
          <span>Fuente: {result.source}</span>
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg inline-flex items-center gap-1.5 transition"
        >
          Ver en {result.providerName}
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}

function Metric({ label, value, color, bold, tooltip }: { label: string; value: string; color?: string; bold?: boolean; tooltip?: string }) {
  return (
    <div title={tooltip}>
      <div className="text-[10px] text-slate-500 uppercase">{label}</div>
      <div className={`text-sm font-mono ${color || "text-slate-100"} ${bold ? "font-bold" : ""}`}>{value}</div>
    </div>
  );
}

// ============================================================
// FULL PROVIDER TABLE — TODOS los exchanges (online + offline + error)
// Muestra cada exchange con su status, info, KYC, liquidez, precio, error
// Responde al requerimiento: "que salga todas las opciones desglosada con su respectiva información"
// ============================================================

// Metadata estática de cada exchange (logo, rank, trust, KYC, vol, país, descripción)
const PROVIDER_META: Record<string, {
  logo: string; rank: string; trust: string; vol24h: string; since: string; kyc: string;
  countries: string; desc: string; url: string;
}> = {
  binance:   { logo: "🟧", rank: "#1",  trust: "Alta",      vol24h: "$15B+", since: "2017", kyc: "Obligatorio", countries: "Global (excl. USA)", desc: "Mayor exchange del mundo por volumen. Liquidez extrema.", url: "https://www.binance.com" },
  okx:       { logo: "⚫", rank: "#5",  trust: "Alta",      vol24h: "$3B+",  since: "2017", kyc: "Obligatorio", countries: "Global", desc: "Top 5 global. Liquidez TOP.", url: "https://www.okx.com" },
  bybit:     { logo: "🟡", rank: "#3",  trust: "Alta",      vol24h: "$5B+",  since: "2018", kyc: "Obligatorio", countries: "Global (excl. USA/UK)", desc: "Top 3 global. Bloqueado desde Vercel.", url: "https://www.bybit.com" },
  kraken:    { logo: "🟣", rank: "#10", trust: "Muy alta", vol24h: "$1B+",  since: "2011", kyc: "Obligatorio", countries: "USA + Europa", desc: "Exchange más regulado. Confianza institucional.", url: "https://www.kraken.com" },
  coinbase:  { logo: "🔵", rank: "#3",  trust: "Muy alta", vol24h: "$2B+",  since: "2012", kyc: "Obligatorio", countries: "USA + Europa", desc: "Listado en NASDAQ. Máxima confianza.", url: "https://www.coinbase.com" },
  kucoin:    { logo: "🟢", rank: "#8",  trust: "Media-alta",vol24h: "$1B+",  since: "2017", kyc: "Obligatorio", countries: "Global", desc: "Top 10. Amplia variedad de tokens.", url: "https://www.kucoin.com" },
  gate:      { logo: "🚪", rank: "#15", trust: "Media",     vol24h: "$500M+",since: "2013", kyc: "Obligatorio", countries: "Global", desc: "Top 20. Buena liquidez para altcoins.", url: "https://www.gate.io" },
  mexc:      { logo: "🟪", rank: "#10", trust: "Media",     vol24h: "$1B+",  since: "2018", kyc: "Opcional",    countries: "Global", desc: "Top 10. Listado rápido de tokens.", url: "https://www.mexc.com" },
  htx:       { logo: "🔥", rank: "#15", trust: "Media",     vol24h: "$500M+",since: "2013", kyc: "Obligatorio", countries: "Asia", desc: "Antes Huobi. Top 20.", url: "https://www.htx.com" },
  bitget:    { logo: "🎯", rank: "#10", trust: "Media",     vol24h: "$1B+",  since: "2018", kyc: "Obligatorio", countries: "Global", desc: "Top 10. Fees más baratos (0.05% taker).", url: "https://www.bitget.com" },
  bingx:     { logo: "🟦", rank: "#20", trust: "Media",     vol24h: "$300M+",since: "2018", kyc: "Obligatorio", countries: "Global", desc: "Top 20. No bloquea Vercel.", url: "https://www.bingx.com" },
  coingecko: { logo: "🦎", rank: "N/A", trust: "Referencia",vol24h: "N/A",   since: "2014", kyc: "N/A",         countries: "Global", desc: "Agregador (no exchange). Precios de referencia.", url: "https://www.coingecko.com" },
};

function FullProviderTable({ results, sortBy }: { results: RankedResult[]; sortBy: string }) {
  const onlineCount = results.filter((r) => r.status === "ONLINE" && r.rank > 0).length;
  const offlineCount = results.length - onlineCount;

  return (
    <div>
      <h3 className="text-xs uppercase tracking-wide text-slate-500 mb-3 flex items-center gap-2">
        <BarChart3 className="w-3.5 h-3.5" />
        Todos los exchanges · {onlineCount} online + {offlineCount} sin datos
        <span className="text-emerald-400">· orden: {sortBy}</span>
      </h3>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-slate-800/50 text-[10px] uppercase text-slate-500 font-semibold">
          <div className="col-span-3">Exchange</div>
          <div className="col-span-2 text-right">Precio</div>
          <div className="col-span-2 text-right">Costo total</div>
          <div className="col-span-1 text-right">KYC</div>
          <div className="col-span-2 text-right">Liquidez</div>
          <div className="col-span-2 text-right">Estado</div>
        </div>

        {/* Rows — TODOS los exchanges, online primero, luego offline */}
        {results.map((r, i) => {
          const isOnline = r.status === "ONLINE" && r.rank > 0;
          const price = r.price ?? 0;
          const fee = r.fee ?? 0;
          const totalCost = r.totalCost ?? 0;
          const liquidity = r.liquidity ?? 0;
          const meta = PROVIDER_META[r.provider] || { logo: "❓", rank: "?", trust: "?", vol24h: "?", since: "?", kyc: "?", countries: "?", desc: "", url: "#" };

          // Status visual
          const statusBadge = isOnline
            ? <span className="text-[9px] px-1.5 py-0.5 bg-emerald-900/50 text-emerald-300 rounded">🟢 ONLINE</span>
            : r.status === "DISABLED"
              ? <span className="text-[9px] px-1.5 py-0.5 bg-slate-800 text-slate-500 rounded">⚫ DISABLED</span>
              : <span className="text-[9px] px-1.5 py-0.5 bg-amber-900/50 text-amber-300 rounded">🔴 {r.status}</span>;

          // KYC badge
          const kycBadge = r.kycLevel === "NO_KYC"
            ? "🔓 Sin KYC"
            : r.kycLevel === "OPTIONAL"
              ? "🔓 Opcional"
              : r.kycLevel === "MANDATORY"
                ? "🔒 Obligatorio"
                : "❔ ?";

          const kycColor = r.kycLevel === "NO_KYC" || r.kycLevel === "OPTIONAL"
            ? "text-teal-400" : r.kycLevel === "MANDATORY" ? "text-red-400" : "text-slate-500";

          return (
            <div
              key={`row-${r.provider}-${i}`}
              className={`grid grid-cols-12 gap-2 px-4 py-3 border-t border-slate-800 transition text-xs ${isOnline ? "hover:bg-slate-800/30" : "bg-slate-950/30"}`}
              title={meta.desc}
            >
              {/* Exchange name + logo + rank */}
              <div className="col-span-3 flex items-center gap-2 min-w-0">
                <span className="text-base shrink-0">{meta.logo}</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`font-medium ${isOnline ? "text-slate-100" : "text-slate-500"}`}>{r.providerName}</span>
                    <span className="text-[9px] px-1 py-0.5 bg-slate-800 rounded text-slate-400">#{meta.rank}</span>
                    {r.badge === "BEST" && <span className="text-[9px] px-1 py-0.5 bg-emerald-900/50 text-emerald-300 rounded">🥇</span>}
                    {r.badge === "CHEAPEST" && <span className="text-[9px] px-1 py-0.5 bg-blue-900/50 text-blue-300 rounded">💰</span>}
                    {r.badge === "MOST_LIQUID" && <span className="text-[9px] px-1 py-0.5 bg-purple-900/50 text-purple-300 rounded">🌊</span>}
                    {r.badge === "NO_KYC" && <span className="text-[9px] px-1 py-0.5 bg-teal-900/50 text-teal-300 rounded">🔓</span>}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">{meta.countries} · {meta.vol24h} vol · desde {meta.since}</div>
                </div>
              </div>

              {/* Precio */}
              <div className="col-span-2 text-right text-slate-300 font-mono">
                {price > 0 ? fmtPrice(price) : "—"}
              </div>

              {/* Costo total */}
              <div className="col-span-2 text-right text-emerald-400 font-mono font-semibold">
                {totalCost > 0 ? fmtPrice(totalCost) : "—"}
              </div>

              {/* KYC */}
              <div className={`col-span-1 text-right text-[10px] ${kycColor}`}>
                {kycBadge}
              </div>

              {/* Liquidez */}
              <div className="col-span-2 text-right text-slate-500 font-mono">
                {liquidity > 0 ? `${(liquidity / 1e6).toFixed(1)}M` : "—"}
              </div>

              {/* Estado */}
              <div className="col-span-2 text-right flex flex-col items-end gap-1">
                {statusBadge}
                {!isOnline && r.reason && (
                  <div className="text-[9px] text-slate-600 italic line-clamp-1">{r.reason}</div>
                )}
                {isOnline && r.latencyMs !== undefined && (
                  <div className="text-[9px] text-slate-500">{r.latencyMs}ms</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Leyenda */}
      <div className="mt-2 text-[10px] text-slate-500 flex items-center gap-3 flex-wrap">
        <span>🟢 ONLINE — datos en vivo</span>
        <span>🔴 ERROR — falló el escaneo</span>
        <span>⚫ DISABLED — bloqueado por el exchange</span>
        <span className="ml-auto">Volumen y latencia del último escaneo. Refresca cada 15s.</span>
      </div>
    </div>
  );
}

// ============================================================
// P2P SECTION — ofertas persona-a-persona
// ============================================================
function P2PSection({ offers }: { offers: P2POffer[] }) {
  return (
    <div>
      <h3 className="text-xs uppercase tracking-wide text-slate-500 mb-3 flex items-center gap-2">
        <Star className="w-3.5 h-3.5 text-pink-400" />
        Ofertas P2P (Binance) · {offers.length} encontradas
        <span className="text-teal-400">· 🔓 Sin KYC para ti</span>
      </h3>

      {/* Explicación */}
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-3 mb-3 text-[11px] text-slate-400 flex items-start gap-2">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-teal-400" />
        <div>
          <b className="text-slate-200">¿Qué es P2P?</b> Compras cripto directamente a otro usuario,
          pagándole con fiat (Bancolombia, Nequi, PSE). El exchange solo hace escrow.
          <span className="text-teal-400 block mt-1">🔓 Tú no necesitas KYC — el advertiser ya está verificado.</span>
        </div>
      </div>

      {/* Tabla P2P */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-slate-800/50 text-[10px] uppercase text-slate-500 font-semibold">
          <div className="col-span-3">Vendedor</div>
          <div className="col-span-2 text-right">Precio</div>
          <div className="col-span-2 text-right">Límites</div>
          <div className="col-span-3">Métodos</div>
          <div className="col-span-2 text-right">Trades</div>
        </div>
        {offers.slice(0, 10).map((o, i) => {
          const price = o.price ?? 0;
          const min = o.minAmount ?? 0;
          const max = o.maxAmount ?? 0;
          const avail = o.available ?? 0;
          return (
            <div key={`p2p-${o.advertiser}-${i}`} className="grid grid-cols-12 gap-2 px-4 py-3 border-t border-slate-800 hover:bg-slate-800/30 transition text-xs">
              <div className="col-span-3 flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-[10px] text-white font-bold shrink-0">
                  {(o.advertiser || "?").slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-slate-200 font-medium truncate">@{o.advertiser || "anónimo"}</div>
                  <div className="text-[9px] text-slate-500">{o.providerName}</div>
                </div>
              </div>
              <div className="col-span-2 text-right text-emerald-400 font-mono font-bold">
                {price > 0 ? fmtPrice(price, 0) : "—"}
                <div className="text-[9px] text-slate-500">{o.fiat}</div>
              </div>
              <div className="col-span-2 text-right text-slate-400 font-mono text-[11px]">
                {min > 0 ? `${(min / 1000).toFixed(0)}k` : "—"} - {max > 0 ? `${(max / 1000).toFixed(0)}k` : "—"}
                <div className="text-[9px] text-slate-500">{avail > 0 ? `${avail.toFixed(0)} ${o.asset} disp.` : ""}</div>
              </div>
              <div className="col-span-3 text-slate-400 text-[11px] truncate">
                {o.paymentMethods.length > 0 ? o.paymentMethods.slice(0, 2).join(", ") : "—"}
              </div>
              <div className="col-span-2 text-right text-slate-300 font-mono">
                {o.tradeCount > 0 ? o.tradeCount.toLocaleString() : "—"}
                {o.completionRate !== undefined && o.completionRate >= 0.95 && (
                  <div className="text-[9px] text-emerald-400">✓ {(o.completionRate * 100).toFixed(0)}% success</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// ARBITRAGE SECTION — oportunidades con visual profesional
// ============================================================
function ArbitrageSection({ opportunities }: { opportunities: ArbitrageOpportunity[] }) {
  return (
    <div>
      <h3 className="text-xs uppercase tracking-wide text-slate-500 mb-3 flex items-center gap-2">
        <Award className="w-3.5 h-3.5 text-purple-400" />
        Oportunidades de arbitraje · {opportunities.length} detectadas
      </h3>

      {/* Explicación */}
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-3 mb-3 text-[11px] text-slate-400 flex items-start gap-2">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-purple-400" />
        <div>
          <b className="text-slate-200">¿Qué es arbitraje?</b> Comprar en un exchange donde está más
          barato y vender en otro donde está más caro, ganando la diferencia.
          <span className="text-amber-400 block mt-1">
            ⚠️ El ROI mostrado es <b>estimado, no garantizado</b>. Considera: transferencia entre exchanges
            (5-30 min), slippage, fees de retiro, KYC distinto en cada exchange, capital inmovilizado.
          </span>
        </div>
      </div>

      {/* Cards de arbitraje */}
      <div className="space-y-3">
        {opportunities.slice(0, 5).map((opp, i) => (
          <ArbitrageCard key={`arb-${i}`} opp={opp} rank={i + 1} />
        ))}
      </div>
    </div>
  );
}

function ArbitrageCard({ opp, rank }: { opp: ArbitrageOpportunity; rank: number }) {
  const [expanded, setExpanded] = useState(false);
  const positive = opp.netProfit > 0;
  const spreadPct = opp.spreadPercent;
  const roi = opp.estimatedRoiPercent;

  // Barra de progreso visual del ROI
  const roiBarWidth = Math.max(0, Math.min(100, Math.abs(roi) * 10));

  // Info de cada exchange (comprador y vendedor)
  const exchangeInfo: Record<string, { rank: string; trust: string; vol: string; kyc: string; transferTime: string; withdrawFee: string }> = {
    Binance: { rank: "#1", trust: "Alta", vol: "$15B+", kyc: "Obligatorio", transferTime: "Inmediato (red BSC/Polygon)", withdrawFee: "$1-5 USDT" },
    OKX: { rank: "#5", trust: "Alta", vol: "$3B+", kyc: "Obligatorio", transferTime: "5-15 min", withdrawFee: "$1-3 USDT" },
    Bybit: { rank: "#3", trust: "Alta", vol: "$5B+", kyc: "Obligatorio", transferTime: "5-15 min", withdrawFee: "$1-3 USDT" },
    Kraken: { rank: "#10", trust: "Muy alta", vol: "$1B+", kyc: "Obligatorio", transferTime: "5-30 min", withdrawFee: "$2-5 USDT" },
    Coinbase: { rank: "#3", trust: "Muy alta", vol: "$2B+", kyc: "Obligatorio", transferTime: "5-30 min", withdrawFee: "$1-3 USDT" },
    KuCoin: { rank: "#8", trust: "Media-alta", vol: "$1B+", kyc: "Obligatorio", transferTime: "5-15 min", withdrawFee: "$1-3 USDT" },
    "Gate.io": { rank: "#15", trust: "Media", vol: "$500M+", kyc: "Obligatorio", transferTime: "5-15 min", withdrawFee: "$1-3 USDT" },
    MEXC: { rank: "#10", trust: "Media", vol: "$1B+", kyc: "Opcional", transferTime: "5-15 min", withdrawFee: "$1-3 USDT" },
    "HTX (Huobi)": { rank: "#15", trust: "Media", vol: "$500M+", kyc: "Obligatorio", transferTime: "5-15 min", withdrawFee: "$1-3 USDT" },
    Bitget: { rank: "#10", trust: "Media", vol: "$1B+", kyc: "Obligatorio", transferTime: "5-15 min", withdrawFee: "$0.5-2 USDT" },
    BingX: { rank: "#20", trust: "Media", vol: "$300M+", kyc: "Obligatorio", transferTime: "5-15 min", withdrawFee: "$1-3 USDT" },
    CoinGecko: { rank: "N/A", trust: "Referencia", vol: "N/A", kyc: "N/A", transferTime: "N/A", withdrawFee: "N/A" },
  };

  const buyInfo = exchangeInfo[opp.buyAt.provider] || { rank: "?", trust: "?", vol: "?", kyc: "?", transferTime: "?", withdrawFee: "?" };
  const sellInfo = exchangeInfo[opp.sellAt.provider] || { rank: "?", trust: "?", vol: "?", kyc: "?", transferTime: "?", withdrawFee: "?" };

  // Pasos a seguir para ejecutar el arbitraje
  const steps = [
    `1. Deposita $${opp.capital} USD en ${opp.buyAt.provider} (KYC: ${buyInfo.kyc})`,
    `2. Compra ${opp.asset} a $${opp.buyAt.price.toFixed(4)} en ${opp.buyAt.provider} (Rank ${buyInfo.rank}, Confianza ${buyInfo.trust})`,
    `3. Retira ${opp.asset} de ${opp.buyAt.provider} a tu wallet (${buyInfo.transferTime}, fee: ${buyInfo.withdrawFee})`,
    `4. Transfiere ${opp.asset} de tu wallet a ${opp.sellAt.provider} (gas de red ~$1-5)`,
    `5. Vende ${opp.asset} a $${opp.sellAt.price.toFixed(4)} en ${opp.sellAt.provider} (Rank ${sellInfo.rank}, Confianza ${sellInfo.trust})`,
    `6. Retira los USD de ${opp.sellAt.provider} (${sellInfo.transferTime}, fee: ${sellInfo.withdrawFee})`,
  ];

  return (
    <div className={`bg-slate-900 border rounded-xl p-4 ${positive ? "border-emerald-800/50" : "border-slate-800"}`}>
      {/* Header con ranking y exchanges */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${positive ? "bg-emerald-950/50 text-emerald-400" : "bg-red-950/50 text-red-400"}`}>
            #{rank}
          </div>
          <div>
            <div className="text-sm font-medium text-slate-100 flex items-center gap-2">
              Comprar en <b className="text-emerald-400">{opp.buyAt.provider}</b>
              <ArrowRight className="w-3 h-3 text-slate-500" />
              Vender en <b className="text-amber-400">{opp.sellAt.provider}</b>
            </div>
            <div className="text-[10px] text-slate-500">{opp.asset} · Capital: ${opp.capital.toLocaleString()}</div>
          </div>
        </div>
        <div className="text-right">
          <div className={`text-lg font-bold ${positive ? "text-emerald-400" : "text-red-400"}`}>
            {positive ? "+" : ""}{roi.toFixed(2)}%
          </div>
          <div className="text-[9px] text-slate-500 uppercase">ROI est.</div>
        </div>
      </div>

      {/* Métricas en grid */}
      <div className="grid grid-cols-4 gap-3 mb-3">
        <div>
          <div className="text-[9px] text-slate-500 uppercase">Precio compra</div>
          <div className="text-sm text-slate-100 font-mono">${opp.buyAt.price.toFixed(4)}</div>
          <div className="text-[9px] text-slate-600">{buyInfo.rank} · {buyInfo.trust}</div>
        </div>
        <div>
          <div className="text-[9px] text-slate-500 uppercase">Precio venta</div>
          <div className="text-sm text-slate-100 font-mono">${opp.sellAt.price.toFixed(4)}</div>
          <div className="text-[9px] text-slate-600">{sellInfo.rank} · {sellInfo.trust}</div>
        </div>
        <div>
          <div className="text-[9px] text-slate-500 uppercase">Spread</div>
          <div className={`text-sm font-mono ${positive ? "text-emerald-400" : "text-red-400"}`}>{spreadPct.toFixed(2)}%</div>
        </div>
        <div>
          <div className="text-[9px] text-slate-500 uppercase">Ganancia neta</div>
          <div className={`text-sm font-mono font-bold ${positive ? "text-emerald-400" : "text-red-400"}`}>
            ${opp.netProfit.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Info detallada de cada exchange */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="bg-slate-800/50 rounded-lg p-2">
          <div className="text-[10px] uppercase text-emerald-400 mb-1">📍 {opp.buyAt.provider} (compra)</div>
          <div className="text-[10px] text-slate-400 space-y-0.5">
            <div>Rank global: <b className="text-slate-300">{buyInfo.rank}</b></div>
            <div>Confianza: <b className="text-slate-300">{buyInfo.trust}</b></div>
            <div>Vol 24h: <b className="text-slate-300">{buyInfo.vol}</b></div>
            <div>KYC: <b className="text-slate-300">{buyInfo.kyc}</b></div>
            <div>Retiro: <b className="text-slate-300">{buyInfo.transferTime}</b></div>
            <div>Fee retiro: <b className="text-slate-300">{buyInfo.withdrawFee}</b></div>
          </div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-2">
          <div className="text-[10px] uppercase text-amber-400 mb-1">💰 {opp.sellAt.provider} (venta)</div>
          <div className="text-[10px] text-slate-400 space-y-0.5">
            <div>Rank global: <b className="text-slate-300">{sellInfo.rank}</b></div>
            <div>Confianza: <b className="text-slate-300">{sellInfo.trust}</b></div>
            <div>Vol 24h: <b className="text-slate-300">{sellInfo.vol}</b></div>
            <div>KYC: <b className="text-slate-300">{sellInfo.kyc}</b></div>
            <div>Retiro: <b className="text-slate-300">{sellInfo.transferTime}</b></div>
            <div>Fee retiro: <b className="text-slate-300">{sellInfo.withdrawFee}</b></div>
          </div>
        </div>
      </div>

      {/* Barra visual de ROI */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
          <span>ROI estimado</span>
          <span>{roi.toFixed(2)}%</span>
        </div>
        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${positive ? "bg-gradient-to-r from-emerald-600 to-emerald-400" : "bg-red-600"}`}
            style={{ width: `${roiBarWidth}%` }}
          />
        </div>
      </div>

      {/* Botón expandir */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-1 transition"
      >
        {expanded ? "Ocultar" : "Ver"} pasos a seguir + supuestos + advertencias
        {expanded ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
      </button>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-slate-800 space-y-3">
          {/* Pasos a seguir */}
          <div>
            <div className="text-[10px] uppercase text-emerald-400 mb-1">📋 Pasos para ejecutar</div>
            <ol className="text-[10px] text-slate-400 space-y-1 list-decimal pl-4">
              {steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          </div>

          {/* Supuestos */}
          <div>
            <div className="text-[10px] uppercase text-slate-500 mb-1">Supuestos del cálculo</div>
            <ul className="text-[10px] text-slate-400 space-y-0.5 list-disc pl-4">
              {opp.assumptions.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </div>

          {/* Warning */}
          <div className="text-[10px] text-amber-400 bg-amber-950/30 border border-amber-800/50 rounded p-2 flex items-start gap-2">
            <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
            <div>
              <b>Importante:</b> Estimación basada en precios del momento del escaneo. Los precios
              cambian constantemente. La ganancia real puede ser menor por: slippage, latencia,
              fees de transferencia, KYC distinto en cada exchange, gas de red, y tiempo de
              confirmación. El capital queda inmovilizado durante la transferencia (5-30 min).
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// NO RESULTS
// ============================================================
function NoResults({ response, noKycOnly, setNoKycOnly }: { response: SearchResponse; noKycOnly: boolean; setNoKycOnly: (v: boolean) => void }) {
  return (
    <div className="max-w-lg mx-auto text-center py-12">
      <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-amber-400" />
      <p className="text-sm text-slate-300 mb-2">
        No se encontraron opciones{noKycOnly ? " sin KYC obligatorio" : ""} para esta búsqueda.
      </p>
      <p className="text-xs text-slate-500 mb-4">
        Proveedores consultados: {response.providersOk}/{response.providersChecked} OK en {response.executionTimeMs}ms.
      </p>
      {noKycOnly && (
        <button
          onClick={() => setNoKycOnly(false)}
          className="text-xs text-emerald-400 hover:text-emerald-300"
        >
          Desactivar filtro "Solo sin KYC" para ver todas las opciones →
        </button>
      )}
    </div>
  );
}

// ============================================================
// INITIAL STATE — sin búsqueda, muestra Quick + Market Intel
// ============================================================
function InitialState({
  recentSearches, intel, intelLoading, onSearch, onRefreshIntel,
}: {
  recentSearches: string[];
  intel: Intel | null;
  intelLoading: boolean;
  onSearch: (q: string) => void;
  onRefreshIntel: () => void;
}) {
  return (
    <div className="space-y-8">
      {/* Búsquedas rápidas */}
      <div>
        <h3 className="text-xs uppercase tracking-wide text-slate-500 mb-3 flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-emerald-400" />
          Búsquedas rápidas
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {QUICK_SEARCHES.map((q) => (
            <button
              key={q.query}
              onClick={() => onSearch(q.query)}
              className="text-left p-4 bg-slate-900 border border-slate-800 rounded-xl hover:border-emerald-600/50 hover:bg-slate-800/50 transition group"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{q.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-slate-200 font-medium">{q.label}</div>
                  <div className="text-[10px] text-slate-500 group-hover:text-emerald-400 transition">Click para ejecutar →</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Market Intel Panel */}
      <MarketIntelPanel intel={intel} loading={intelLoading} onRefresh={onRefreshIntel} />

      {/* Cómo funciona */}
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Info className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wide">
            ¿Cómo funciona el buscador?
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { step: 1, title: "Escribe tu intención", desc: "Lenguaje natural: comprar, vender, enviar, arbitraje" },
            { step: 2, title: "Escanea 11 exchanges", desc: "Binance, OKX, Kraken, Coinbase, KuCoin y más en paralelo" },
            { step: 3, title: "Calcula costo total", desc: "Precio + comisión + red. Ordena por mejor opción" },
          ].map((s) => (
            <div key={s.step} className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-emerald-600/20 border border-emerald-600/50 flex items-center justify-center text-xs font-bold text-emerald-400 shrink-0">
                {s.step}
              </div>
              <div>
                <div className="text-sm text-slate-200 font-medium">{s.title}</div>
                <div className="text-[11px] text-slate-500">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-slate-800 flex items-center gap-4 flex-wrap text-[10px] text-slate-400">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Datos en vivo (cache 15s)</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500" /> APIs públicas oficiales</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-purple-500" /> Sin custodia de fondos</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" /> Sin prometer rentabilidad</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MARKET INTEL PANEL
// ============================================================
function MarketIntelPanel({ intel, loading, onRefresh }: { intel: Intel | null; loading: boolean; onRefresh: () => void }) {
  if (loading && !intel) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-3 text-slate-400">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-xs">Cargando Market Intel…</span>
      </div>
    );
  }
  if (!intel) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Activity className="w-4 h-4 text-emerald-400" />
        <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wide">Market Intel</h3>
        <button onClick={onRefresh} className="ml-auto text-[10px] text-slate-500 hover:text-emerald-400 flex items-center gap-1 transition">
          <RefreshCw className="w-3 h-3" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        {/* Gas */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <Gauge className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[10px] uppercase tracking-wide text-slate-500">ETH Gas</span>
          </div>
          {intel.gas.status === "ONLINE" && intel.gas.gasPriceGwei > 0 ? (
            <>
              <div className="text-2xl font-bold text-slate-100 font-mono">
                {intel.gas.gasPriceGwei.toFixed(1)}
                <span className="text-xs text-slate-500 ml-1">Gwei</span>
              </div>
              {intel.gas.estimatedCostUsd !== undefined && (
                <div className="text-[10px] text-slate-500 mt-1">Transfer: ${intel.gas.estimatedCostUsd.toFixed(2)}</div>
              )}
            </>
          ) : (
            <div className="text-sm text-amber-400">No disponible</div>
          )}
        </div>

        {/* Fear & Greed */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <Activity className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-[10px] uppercase tracking-wide text-slate-500">Fear & Greed</span>
          </div>
          {intel.fearGreed.status === "ONLINE" ? (
            <>
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-2 py-1 rounded text-sm font-bold ${fearGreedColor(intel.fearGreed.value)}`}>
                  {fearGreedEmoji(intel.fearGreed.value)} {intel.fearGreed.value}
                </span>
              </div>
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mb-1">
                <div className={`h-full rounded-full transition-all`} style={{ width: `${fearGreedBar(intel.fearGreed.value)}%`, backgroundColor: intel.fearGreed.value >= 50 ? "#10b981" : "#ef4444" }} />
              </div>
              <div className="text-[10px] text-slate-400">{intel.fearGreed.classification}</div>
            </>
          ) : (
            <div className="text-sm text-amber-400">No disponible</div>
          )}
        </div>

        {/* Trending */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:col-span-2">
          <div className="flex items-center gap-1.5 mb-2">
            <Flame className="w-3.5 h-3.5 text-orange-400" />
            <span className="text-[10px] uppercase tracking-wide text-slate-500">Trending (CoinGecko)</span>
          </div>
          {intel.trending.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {intel.trending.slice(0, 6).map((c) => (
                <span key={c.id} className="text-[11px] px-2 py-1 bg-slate-800 rounded-lg text-slate-300">
                  {c.symbol.toUpperCase()}
                  {c.priceChangePercent24h !== undefined && (
                    <span className={c.priceChangePercent24h >= 0 ? "text-emerald-400 ml-1" : "text-red-400 ml-1"}>
                      {fmtPct(c.priceChangePercent24h)}
                    </span>
                  )}
                </span>
              ))}
            </div>
          ) : (
            <div className="text-sm text-amber-400">No disponible</div>
          )}
        </div>
      </div>

      {/* Gainers / Losers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-1.5 mb-3">
            <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[10px] uppercase tracking-wide text-slate-500">Top gainers 24h</span>
          </div>
          {intel.gainers.length > 0 ? (
            <div className="space-y-1.5">
              {intel.gainers.slice(0, 4).map((c) => (
                <div key={c.id} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-slate-200 font-medium">{c.symbol.toUpperCase()}</span>
                    <span className="text-slate-600">#{c.marketCapRank}</span>
                  </div>
                  <span className="text-emerald-400 font-mono">{fmtPct(c.changePercent24h)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-amber-400">No disponible</div>
          )}
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-1.5 mb-3">
            <ArrowDownRight className="w-3.5 h-3.5 text-red-400" />
            <span className="text-[10px] uppercase tracking-wide text-slate-500">Top losers 24h</span>
          </div>
          {intel.losers.length > 0 ? (
            <div className="space-y-1.5">
              {intel.losers.slice(0, 4).map((c) => (
                <div key={c.id} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-slate-200 font-medium">{c.symbol.toUpperCase()}</span>
                    <span className="text-slate-600">#{c.marketCapRank}</span>
                  </div>
                  <span className="text-red-400 font-mono">{fmtPct(c.changePercent24h)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-amber-400">No disponible</div>
          )}
        </div>
      </div>

      {/* Staking Yields */}
      {intel.stakingYields.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-1.5 mb-3">
            <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
            <span className="text-[10px] uppercase tracking-wide text-slate-500">Staking Yields (APY aprox.)</span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {intel.stakingYields.slice(0, 6).map((s) => (
              <div key={s.asset} className="bg-slate-800 rounded-lg p-2 cursor-help text-center" title={s.notes}>
                <div className="text-xs font-semibold text-slate-100">{s.asset}</div>
                <div className="text-sm font-bold text-emerald-400 font-mono">{s.apyPercent.toFixed(1)}%</div>
                <div className="text-[9px] text-slate-500">APY</div>
              </div>
            ))}
          </div>
          <div className="text-[9px] text-slate-500 mt-2 italic">
            APYs referenciales (Sept 2024). Para datos en tiempo real, integrar Staking Rewards API.
          </div>
        </div>
      )}
    </div>
  );
}
