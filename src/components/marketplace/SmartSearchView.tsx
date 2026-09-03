"use client";

import { useState, useCallback, useEffect } from "react";
import { Search, Loader2, TrendingUp, TrendingDown, Award, ArrowRight, Globe2, Zap, Clock, AlertTriangle, RefreshCw, Star, Filter, ShieldOff, Flame, Gauge, Activity, Sparkles, Info, HelpCircle, ExternalLink, Wallet, Coins, AlertCircle } from "lucide-react";
import { QUICK_SEARCHES } from "@/lib/scanner/interpreter";
import type { SearchResponse, SearchIntent, RankedResult } from "@/lib/scanner/types";

const RECENT_SEARCHES_KEY = "criptomy:recent-searches";

// ============================================================
// Market Intel — panel de datos de mercado
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

function fearGreedColor(value: number): string {
  if (value >= 75) return "bg-emerald-600 text-white"; // Extreme Greed
  if (value >= 55) return "bg-emerald-500 text-white"; // Greed
  if (value >= 45) return "bg-amber-500 text-white"; // Neutral
  if (value >= 25) return "bg-orange-500 text-white"; // Fear
  return "bg-red-600 text-white"; // Extreme Fear
}

function fearGreedEmoji(value: number): string {
  if (value >= 75) return "🤑";
  if (value >= 55) return "😀";
  if (value >= 45) return "😐";
  if (value >= 25) return "😨";
  return "😱";
}

export default function SmartSearchView() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [noKycOnly, setNoKycOnly] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [intel, setIntel] = useState<Intel | null>(null);
  const [intelLoading, setIntelLoading] = useState(false);

  // Cargar búsquedas recientes de localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || "[]");
      if (Array.isArray(saved)) setRecentSearches(saved.slice(0, 5));
    } catch {
      // ignore
    }
  }, []);

  // Cargar Market Intel al montar (gas, fear&greed, trending, movers, staking)
  const loadIntel = useCallback(async () => {
    setIntelLoading(true);
    try {
      const res = await fetch("/api/scanner/intel");
      if (!res.ok) return;
      const data = await res.json();
      setIntel(data as Intel);
    } catch (e) {
      console.warn("[intel] failed:", e);
    } finally {
      setIntelLoading(false);
    }
  }, []);

  useEffect(() => {
    loadIntel();
    const interval = setInterval(loadIntel, 5 * 60 * 1000); // refresh cada 5 min
    return () => clearInterval(interval);
  }, [loadIntel]);

  // Guardar búsqueda reciente
  const saveRecent = useCallback((q: string) => {
    if (typeof window === "undefined") return;
    try {
      const saved = JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || "[]");
      const filtered = (saved as string[]).filter((s) => s !== q);
      const updated = [q, ...filtered].slice(0, 5);
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
      setRecentSearches(updated);
    } catch {
      // ignore
    }
  }, []);

  // Sync URL con query
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

  const search = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    setResponse(null);
    saveRecent(q);
    // Actualizar URL para deep-linking
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
      if (!res.ok) {
        setError(data.error || "Error en la búsqueda");
        return;
      }
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

  // Filtro de solo Sin KYC en el cliente (post-search)
  const filterNoKyc = (results: RankedResult[]): RankedResult[] => {
    if (!noKycOnly) return results;
    return results.filter((r) => r.kycLevel === "NO_KYC" || r.kycLevel === "OPTIONAL");
  };

  const filteredResults = response ? filterNoKyc(response.results) : [];
  const filteredBest = response ? filterNoKyc(response.bestOption ? [response.bestOption] : []) : [];
  const filteredAlternatives = response ? filterNoKyc(response.alternatives) : [];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <Search className="w-6 h-6 text-emerald-400" />
          Buscador Web3
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Escribe lo que quieres hacer. El sistema escanea <b>11 exchanges</b> en paralelo
          (Binance, OKX, Bybit, Kraken, Coinbase, KuCoin, Gate.io, MEXC, HTX, Bitget, CoinGecko)
          y encuentra las mejores opciones con costo total real.
        </p>
      </div>

      {/* Panel explicativo — Cómo funciona (visible solo si no hay búsqueda) */}
      {!response && !loading && (
        <div className="mb-6 bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Info className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wide">
              ¿Cómo funciona el buscador?
            </h3>
          </div>
          <ol className="text-[12px] text-slate-400 space-y-1.5 list-decimal pl-4">
            <li>
              <b className="text-slate-200">Escribe tu intención</b> en lenguaje natural.
              Ej: "Quiero comprar 1000 USDT con COP", "Vender 500 USDT", "Enviar dinero a México".
            </li>
            <li>
              <b className="text-slate-200">El sistema interpreta</b> tu query y detecta: operación
              (comprar/vender/enviar), activo, monto, moneda fiat, país, método de pago.
            </li>
            <li>
              <b className="text-slate-200">Escanea 11 exchanges</b> en paralelo (en ~250ms):
              Binance, OKX, Bybit, Kraken, Coinbase, KuCoin, Gate.io, MEXC, HTX, Bitget, CoinGecko.
            </li>
            <li>
              <b className="text-slate-200">Calcula el costo total real</b> de cada opción:
              precio + comisión + costo de red + spread.
            </li>
            <li>
              <b className="text-slate-200">Ordena por costo total</b> y muestra la mejor opción
              primero (🥇) con explicación de por qué ganó.
            </li>
            <li>
              <b className="text-slate-200">NO ejecuta transacciones</b>. Solo busca, compara y
              recomienda. Tú decides si vas al exchange directo.
            </li>
          </ol>
          <div className="mt-3 pt-3 border-t border-slate-800/50 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
            <div className="flex items-center gap-1.5 text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Datos en vivo (cache 15s)
            </div>
            <div className="flex items-center gap-1.5 text-slate-400">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              APIs públicas oficiales
            </div>
            <div className="flex items-center gap-1.5 text-slate-400">
              <span className="w-2 h-2 rounded-full bg-purple-500"></span>
              Sin custodia de fondos
            </div>
            <div className="flex items-center gap-1.5 text-slate-400">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              Sin prometer rentabilidad
            </div>
          </div>
        </div>
      )}

      {/* Buscador */}
      <form onSubmit={submit} className="relative mb-4">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Quiero comprar 1000 USDT con COP"
            className="w-full px-5 py-4 pl-14 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 text-base focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
            autoFocus
          />
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            Buscar
          </button>
        </div>
      </form>

      {/* Filtro Sin KYC */}
      {(response || loading) && (
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <button
            onClick={() => setNoKycOnly((v) => !v)}
            className={`text-xs px-3 py-1.5 rounded-md transition flex items-center gap-1.5 ${
              noKycOnly
                ? "bg-teal-600 text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            <ShieldOff className="w-3.5 h-3.5" />
            Solo sin KYC obligatorio
          </button>
          {response && (
            <div className="text-xs text-slate-500 ml-auto">
              {filteredResults.length} resultados · {response.providersOk}/{response.providersChecked} providers · {response.executionTimeMs}ms
            </div>
          )}
        </div>
      )}

      {/* Quick searches + recent + market intel */}
      {!response && !loading && (
        <div className="mb-6 space-y-4">
          {/* Búsquedas recientes */}
          {recentSearches.length > 0 && (
            <div>
              <div className="text-xs text-slate-500 mb-2">Recientes:</div>
              <div className="flex gap-2 flex-wrap">
                {recentSearches.map((q) => (
                  <button
                    key={q}
                    onClick={() => {
                      setQuery(q);
                      search(q);
                    }}
                    className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-full transition"
                  >
                    {q.length > 40 ? q.slice(0, 40) + "…" : q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Market Intel panel */}
          <MarketIntelPanel intel={intel} loading={intelLoading} onRefresh={loadIntel} />

          <div>
            <div className="text-xs text-slate-500 mb-2">Búsquedas rápidas:</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {QUICK_SEARCHES.map((q) => (
                <button
                  key={q.query}
                  onClick={() => {
                    setQuery(q.query);
                    search(q.query);
                  }}
                  className="text-left p-3 bg-slate-900 border border-slate-800 rounded-lg hover:border-emerald-600/50 transition flex items-center gap-3"
                >
                  <span className="text-xl">{q.icon}</span>
                  <div>
                    <div className="text-xs text-slate-200">{q.label}</div>
                    <div className="text-[10px] text-slate-500">Toca para ejecutar</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-950/30 border border-red-800/50 rounded-lg p-4 text-sm text-red-400 mb-6">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-400 mx-auto mb-3" />
            <p className="text-sm text-slate-400">Escaneando 10 exchanges en paralelo…</p>
            <p className="text-xs text-slate-500 mt-1">Binance · OKX · Bybit · Kraken · Coinbase · KuCoin · Gate.io · MEXC · HTX · CoinGecko</p>
          </div>
        </div>
      )}

      {/* Resultados */}
      {response && !loading && (
        <SearchResults
          response={response}
          filteredBest={filteredBest}
          filteredAlternatives={filteredAlternatives}
          filteredResults={filteredResults}
          noKycOnly={noKycOnly}
          onRetry={() => search(query)}
        />
      )}
    </div>
  );
}

function SearchResults({
  response,
  filteredBest,
  filteredAlternatives,
  filteredResults,
  noKycOnly,
  onRetry,
}: {
  response: SearchResponse;
  filteredBest: RankedResult[];
  filteredAlternatives: RankedResult[];
  filteredResults: RankedResult[];
  noKycOnly: boolean;
  onRetry: () => void;
}) {
  const { intent, p2pOffers, arbitrageOpportunities, providersOk, providersChecked, errors, executionTimeMs } = response;

  const hasResults = filteredResults.length > 0 || p2pOffers.length > 0 || arbitrageOpportunities.length > 0;

  if (!hasResults) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
        <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-amber-400" />
        <p className="text-sm text-slate-300">
          No se encontraron opciones{noKycOnly ? " sin KYC obligatorio" : ""} para esta búsqueda.
        </p>
        <p className="text-xs text-slate-500 mt-2">
          Proveedores consultados: {providersOk}/{providersChecked} OK en {executionTimeMs}ms.
        </p>
        {noKycOnly && (
          <p className="text-[11px] text-slate-500 mt-2">
            Desactiva el filtro "Solo sin KYC" para ver todas las opciones disponibles.
          </p>
        )}
        {errors.length > 0 && (
          <div className="mt-4 text-left text-xs text-slate-500 space-y-1">
            {errors.slice(0, 3).map((e, i) => (
              <div key={i}>
                <b>{e.provider}:</b> {e.error}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const bestOption = filteredBest[0];

  return (
    <div className="space-y-5">
      {/* Intent badge */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center gap-3 flex-wrap">
        <IntentBadge intent={intent} />
        <div className="text-xs text-slate-500">
          {providersOk}/{providersChecked} proveedores OK · {executionTimeMs}ms · {new Date(response.timestamp).toLocaleTimeString()}
        </div>
        <button
          onClick={onRetry}
          className="ml-auto text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
        >
          <RefreshCw className="w-3 h-3" /> Actualizar
        </button>
      </div>

      {/* Cómo leer los resultados — explicación visible */}
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-lg p-3 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <HelpCircle className="w-3 h-3 text-slate-400" />
          <span className="text-[11px] uppercase text-slate-500 font-semibold">Cómo leer estos resultados</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] text-slate-400">
          <div>
            <b className="text-slate-200">Precio unit.</b>: precio del activo en el exchange (sin comisión).
          </div>
          <div>
            <b className="text-slate-200">Comisión</b>: fee taker del exchange (varía 0.02% a 0.6%).
          </div>
          <div>
            <b className="text-emerald-400">Costo total</b>: precio × cantidad + comisión + red. <b>Lo que realmente pagas.</b>
          </div>
          <div>
            <b className="text-slate-200">Precio efectivo</b>: costo total / cantidad (precio real por unidad).
          </div>
        </div>
        <div className="mt-2 text-[10px] text-slate-500 italic">
          💡 El ranking ordena por <b className="text-emerald-400">costo total</b> (no solo precio).
          A veces un exchange con precio menor termina siendo peor porque cobra más comisión.
        </div>
      </div>

      {/* Mejor opción */}
      {bestOption && (
        <ResultCard result={bestOption} highlight />
      )}

      {/* Alternativas */}
      {filteredAlternatives.length > 0 && (
        <div>
          <h3 className="text-xs uppercase tracking-wide text-slate-500 mb-2">Otras opciones</h3>
          <div className="space-y-3">
            {filteredAlternatives.map((r, i) => (
              <ResultCard key={`alt-${r.provider}-${i}`} result={r} />
            ))}
          </div>
        </div>
      )}

      {/* P2P offers */}
      {p2pOffers.length > 0 && (
        <div>
          <div className="mb-3">
            <h3 className="text-xs uppercase tracking-wide text-slate-500 mb-2">
              Ofertas P2P (Binance) · {p2pOffers.length} encontradas
            </h3>
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-lg p-3 text-[11px] text-slate-400 flex items-start gap-2">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-teal-400" />
              <div>
                <b className="text-slate-200">¿Qué es P2P?</b> Persona-a-persona. Compras
                cripto directamente a otro usuario (no al exchange), pagándole con método
                fiat (Bancolombia, Nequi, PSE, etc.). El exchange solo hace escrow
                (retiene la cripto hasta que confirmes el pago fiat).
                <span className="text-teal-400 block mt-1">
                  🔓 Tú no necesitas KYC del exchange para P2P — el advertiser ya está verificado.
                </span>
                <span className="text-amber-400 block mt-1">
                  ⚠️ Riesgo: si pagas y el advertiser no libera, debes abrir disputa. Binance
                  actúa como árbitro. Siempre verifica el precio, límites y reputation del advertiser.
                </span>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            {p2pOffers.slice(0, 8).map((o, i) => (
              <P2POfferCard key={`p2p-${o.advertiser}-${i}`} offer={o} />
            ))}
          </div>
        </div>
      )}

      {/* Arbitraje */}
      {arbitrageOpportunities.length > 0 && (
        <div>
          <div className="mb-3">
            <h3 className="text-xs uppercase tracking-wide text-slate-500 mb-2">
              Oportunidades de arbitraje detectadas · {arbitrageOpportunities.length} encontradas
            </h3>
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-lg p-3 text-[11px] text-slate-400 flex items-start gap-2">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-purple-400" />
              <div>
                <b className="text-slate-200">¿Qué es arbitraje?</b> Comprar un activo en
                un exchange donde está más barato y venderlo en otro donde está más caro,
                ganando la diferencia. En teoría libre de riesgo; en práctica tiene
                costos ocultos.
                <span className="text-amber-400 block mt-1">
                  ⚠️ El ROI mostrado es <b>estimado, no garantizado</b>. Antes de ejecutar,
                  considera: transferencia entre exchanges (puede tomar 5-30 min),
                  slippage (precio cambia mientras ejecutas), fees de retiro, requisitos
                  KYC distintos en cada exchange, y capital inmovilizado.
                </span>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            {arbitrageOpportunities.slice(0, 5).map((opp, i) => (
              <ArbitrageCard key={`arb-${i}`} opp={opp} />
            ))}
          </div>
        </div>
      )}

      {/* Errores de providers */}
      {errors.length > 0 && (
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-lg p-3">
          <div className="text-[10px] uppercase text-slate-500 mb-2">
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

function IntentBadge({ intent }: { intent: SearchIntent }) {
  const config: Record<string, { color: string; label: string; icon: React.ElementType; desc: string }> = {
    BUY: { color: "bg-emerald-900/50 text-emerald-300", label: "Comprar", icon: TrendingUp, desc: "El sistema buscará dónde comprar el activo al mejor precio" },
    SELL: { color: "bg-amber-900/50 text-amber-300", label: "Vender", icon: TrendingDown, desc: "El sistema buscará dónde vender el activo al mejor precio" },
    SEND: { color: "bg-cyan-900/50 text-cyan-300", label: "Enviar / Remesa", icon: Globe2, desc: "El sistema buscará rutas cross-border para enviar dinero" },
    ARBITRAGE: { color: "bg-purple-900/50 text-purple-300", label: "Arbitraje", icon: Award, desc: "El sistema detecta diferencias de precio entre exchanges para opportunities de arbitraje" },
    COMPARE: { color: "bg-blue-900/50 text-blue-300", label: "Comparar", icon: Search, desc: "El sistema comparará precios entre todos los exchanges" },
    FIND_P2P: { color: "bg-pink-900/50 text-pink-300", label: "Mejor P2P", icon: Star, desc: "El sistema buscará ofertas P2P persona-a-persona" },
    UNKNOWN: { color: "bg-slate-800 text-slate-400", label: "Desconocido", icon: AlertTriangle, desc: "No se pudo interpretar la intención" },
  };
  const c = config[intent.operation] || config.UNKNOWN;
  const Icon = c.icon;

  const params: { label: string; value: string | undefined; icon: React.ElementType }[] = [
    { label: "Operación", value: c.label, icon: Icon },
    { label: "Activo", value: intent.asset, icon: Coins },
    { label: "Monto", value: intent.amount ? String(intent.amount) : undefined, icon: Wallet },
    { label: "Moneda fiat", value: intent.fiat, icon: TrendingUp },
    { label: "País", value: intent.country, icon: Globe2 },
    { label: "Método pago", value: intent.paymentMethod, icon: Wallet },
  ];
  const filledParams = params.filter((p) => p.value);

  return (
    <div className="flex-1">
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold ${c.color}`}>
          <Icon className="w-4 h-4" />
          {c.label}
        </span>
        <span className="text-[11px] text-slate-400 italic">{c.desc}</span>
      </div>
      {filledParams.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {filledParams.map((p) => {
            const PIcon = p.icon;
            return (
              <div key={p.label} className="bg-slate-800/50 rounded px-2 py-1 flex items-center gap-1.5">
                <PIcon className="w-3 h-3 text-slate-500 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[9px] uppercase text-slate-500 leading-tight">{p.label}</div>
                  <div className="text-[11px] text-slate-200 font-medium truncate">{p.value}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ResultCard({ result, highlight }: { result: import("@/lib/scanner/types").RankedResult; highlight?: boolean }) {
  const badgeColors: Record<string, string> = {
    BEST: "bg-emerald-600 text-white",
    CHEAPEST: "bg-blue-600 text-white",
    MOST_LIQUID: "bg-purple-600 text-white",
    FASTEST: "bg-amber-600 text-white",
    NO_KYC: "bg-teal-600 text-white",
  };

  const badgeLabels: Record<string, string> = {
    BEST: "🥇 Mejor opción",
    CHEAPEST: "💰 Menor comisión",
    MOST_LIQUID: "🌊 Mayor liquidez",
    FASTEST: "⚡ Más rápido",
    NO_KYC: "🔓 Sin KYC obligatorio",
  };

  // Tooltip explicativo de cada badge
  const badgeTooltips: Record<string, string> = {
    BEST: "Esta opción tiene el menor costo total (precio + comisión + red) para tu operación.",
    CHEAPEST: "Esta opción tiene la menor comisión de todas las comparadas.",
    MOST_LIQUID: "Esta opción tiene el mayor volumen 24h (mayor facilidad para ejecutar la operación sin mover el precio).",
    FASTEST: "Esta opción es la más rápida en ejecutar.",
    NO_KYC: "Esta opción no requiere KYC del exchange. Puedes operar sin verificar identidad.",
  };

  // Defensivo: cualquier campo puede ser null/undefined en runtime
  const price = result.price ?? 0;
  const fee = result.fee ?? 0;
  const totalCost = result.totalCost ?? 0;
  const effectivePrice = result.effectivePrice ?? 0;
  const spread = result.spread ?? 0;
  const spreadPercent = result.spreadPercent ?? 0;
  const liquidity = result.liquidity ?? 0;
  const priceDecimals = price < 1 ? 6 : price < 100 ? 2 : 0;
  const effPriceDecimals = effectivePrice < 1 ? 6 : effectivePrice < 100 ? 4 : 2;

  // KYC badge style con tooltip
  const kycBadge = result.kycLevel === "NO_KYC"
    ? { color: "bg-teal-900/50 text-teal-300", label: "🔓 Sin KYC", tooltip: "El exchange no requiere verificación de identidad." }
    : result.kycLevel === "OPTIONAL"
      ? { color: "bg-amber-900/50 text-amber-300", label: "🔓 KYC opcional", tooltip: "El exchange permite operar sin KYC (con límites). KYC para límites más altos." }
      : result.kycLevel === "MANDATORY"
        ? { color: "bg-red-900/50 text-red-300", label: "🔒 KYC obligatorio", tooltip: "El exchange requiere verificación de identidad completa (gov ID, selfie, etc.)." }
        : { color: "bg-slate-800 text-slate-400", label: "❔ KYC no confirmado", tooltip: "No pudimos verificar los requisitos KYC de este provider." };

  // Liquidez badge con tooltip
  const liqBadge = result.liquidityTier === "TOP"
    ? { color: "bg-emerald-900/50 text-emerald-300", label: "🌊 Liquidez TOP", tooltip: "Exchange top 10 por volumen global. Alta facilidad para ejecutar órdenes grandes." }
    : result.liquidityTier === "MEDIUM"
      ? { color: "bg-slate-800 text-slate-300", label: "Liquidez media", tooltip: "Exchange top 50 por volumen. Adecuado para órdenes medianas." }
      : result.liquidityTier === "AGGREGATOR"
        ? { color: "bg-blue-900/50 text-blue-300", label: "📊 Agregador", tooltip: "No es un exchange, es un agregador (CoinGecko). Solo precio de referencia." }
        : null;

  // URL del exchange para el CTA
  const exchangeWebsites: Record<string, string> = {
    binance: "https://www.binance.com",
    okx: "https://www.okx.com",
    bybit: "https://www.bybit.com",
    kraken: "https://www.kraken.com",
    coinbase: "https://www.coinbase.com",
    kucoin: "https://www.kucoin.com",
    gate: "https://www.gate.io",
    mexc: "https://www.mexc.com",
    htx: "https://www.htx.com",
    bitget: "https://www.bitget.com",
    coingecko: "https://www.coingecko.com",
  };
  const exchangeUrl = exchangeWebsites[result.provider] || "#";

  return (
    <div className={`bg-slate-900 border rounded-xl p-4 ${highlight ? "border-emerald-600 shadow-lg shadow-emerald-900/20" : "border-slate-800"}`}>
      {/* Header con badges y nombre */}
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {result.badge && (
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase cursor-help ${badgeColors[result.badge]}`}
              title={badgeTooltips[result.badge] || ""}
            >
              {badgeLabels[result.badge] || result.badge}
            </span>
          )}
          <span className="text-base font-semibold text-slate-100">{result.providerName || "Provider"}</span>
          <span
            className={`text-[10px] px-2 py-0.5 rounded ${result.status === "ONLINE" ? "bg-emerald-900/50 text-emerald-300" : "bg-red-900/50 text-red-300"}`}
            title={result.status === "ONLINE" ? "Provider respondió correctamente al último check." : `Provider no respondió: ${result.error || "desconocido"}`}
          >
            {result.status === "ONLINE" ? "● Online" : "● " + (result.status || "OFFLINE")}
          </span>
          {kycBadge && (
            <span
              className={`text-[10px] px-2 py-0.5 rounded cursor-help ${kycBadge.color}`}
              title={kycBadge.tooltip}
            >
              {kycBadge.label}
            </span>
          )}
          {liqBadge && (
            <span
              className={`text-[10px] px-2 py-0.5 rounded cursor-help ${liqBadge.color}`}
              title={liqBadge.tooltip}
            >
              {liqBadge.label}
            </span>
          )}
        </div>
        <div className="text-right">
          <div className="text-[10px] text-slate-500">Latencia</div>
          <div className="text-xs text-slate-300" title="Tiempo de respuesta del exchange al último check">{result.latencyMs || 0}ms</div>
        </div>
      </div>

      {/* Métricas principales en grid 4 columnas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        <div>
          <div className="text-[10px] text-slate-500" title="Precio unitario del activo en el exchange">Precio unit.</div>
          <div className="text-sm text-slate-100 font-mono">
            {price > 0 ? `${price.toLocaleString(undefined, { maximumFractionDigits: priceDecimals })} ${result.fiat || ""}` : "—"}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-slate-500" title="Comisión del exchange (taker)">Comisión</div>
          <div className="text-sm text-amber-400 font-mono">
            {fee > 0 ? `${fee.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${result.feeCurrency || ""}` : "Gratis"}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-slate-500" title="Precio × cantidad + comisión + costo de red">Costo total</div>
          <div className="text-sm text-emerald-400 font-mono font-semibold">
            {totalCost > 0 ? `${totalCost.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${result.totalCostCurrency || ""}` : "—"}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-slate-500" title="Costo total dividido por la cantidad (precio real por unidad que pagas)">Precio efectivo</div>
          <div className="text-sm text-slate-100 font-mono">
            {effectivePrice > 0 ? `${effectivePrice.toLocaleString(undefined, { maximumFractionDigits: effPriceDecimals })} ${result.fiat || ""}` : "—"}
          </div>
        </div>
      </div>

      {/* Detalles secundarios */}
      {spread > 0 && (
        <div className="text-[11px] text-slate-500 mb-1" title="Diferencia entre precio de compra (ask) y venta (bid) en el libro de órdenes">
          Spread: {spread.toFixed(4)} ({spreadPercent.toFixed(3)}%)
        </div>
      )}
      {liquidity > 0 && (
        <div className="text-[11px] text-slate-500 mb-1" title="Volumen total operado en 24h. Mayor = más fácil ejecutar sin mover el precio">
          Volumen 24h: {liquidity.toLocaleString(undefined, { maximumFractionDigits: 0 })} {result.fiat || ""}
        </div>
      )}
      {result.paymentMethods && result.paymentMethods.length > 0 && (
        <div className="text-[11px] text-slate-400 mb-1" title="Métodos de pago que acepta este advertiser (P2P) o este exchange">
          Métodos: {result.paymentMethods.join(", ")}
        </div>
      )}

      {/* Razón del ranking */}
      <div className="flex items-start gap-2 mt-3 pt-3 border-t border-slate-800">
        <Info className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
        <div className="text-[11px] text-slate-300">
          {result.reason || ""}
        </div>
      </div>

      {/* Footer: tiempo + fuente + CTA */}
      <div className="flex items-center justify-between gap-3 mt-2 flex-wrap">
        <div className="flex items-center gap-3 text-[10px] text-slate-500">
          <span className="flex items-center gap-1" title="Tiempo estimado de ejecución de la operación">
            <Clock className="w-3 h-3" />
            {result.estimatedTime || "Tiempo no estimado"}
          </span>
          <span title="Origen del dato (API del exchange)">
            Fuente: {result.source || "Desconocida"}
          </span>
        </div>
        <a
          href={exchangeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded inline-flex items-center gap-1"
          title="Ir al sitio oficial del exchange (no ejecuta la operación, solo abre el sitio)"
        >
          Ver en {result.providerName}
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* KYC note detallado */}
      {result.kycNote && (
        <div className="mt-2 text-[10px] text-slate-500 italic">
          {result.kycNote}
        </div>
      )}
    </div>
  );
}

function P2POfferCard({ offer }: { offer: import("@/lib/scanner/types").P2POffer }) {
  const price = offer.price ?? 0;
  const minAmount = offer.minAmount ?? 0;
  const maxAmount = offer.maxAmount ?? 0;
  const available = offer.available ?? 0;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex items-center justify-between gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-slate-100 truncate">@{offer.advertiser || "anónimo"}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 shrink-0">
            {offer.providerName}
          </span>
          {offer.tradeCount > 0 && (
            <span className="text-[10px] text-emerald-400 shrink-0">
              {offer.tradeCount} trades
            </span>
          )}
        </div>
        <div className="text-xs text-slate-400 truncate">
          {offer.paymentMethods.length > 0 ? offer.paymentMethods.slice(0, 3).join(" · ") : "Sin método especificado"}
        </div>
        <div className="text-[10px] text-slate-500 mt-1">
          {minAmount > 0 || maxAmount > 0 ? (
            <>Límites: {minAmount.toLocaleString()} - {maxAmount.toLocaleString()} {offer.fiat}</>
          ) : (
            <>Límites no disponibles</>
          )}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-sm font-bold text-emerald-400 font-mono">
          {price > 0 ? `${price.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${offer.fiat}` : "—"}
        </div>
        <div className="text-[10px] text-slate-500">
          {available > 0 ? `${available.toLocaleString()} ${offer.asset}` : ""}
        </div>
      </div>
    </div>
  );
}

function ArbitrageCard({ opp }: { opp: import("@/lib/scanner/types").ArbitrageOpportunity }) {
  const positive = opp.netProfit > 0;
  return (
    <div className={`bg-slate-900 border rounded-lg p-4 ${positive ? "border-emerald-800/50" : "border-slate-800"}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-medium text-slate-100">
          Comprar en <b className="text-emerald-400">{opp.buyAt.provider}</b> · Vender en <b className="text-amber-400">{opp.sellAt.provider}</b>
        </div>
        <span
          className={`text-xs font-bold px-2 py-0.5 rounded ${positive ? "bg-emerald-900/50 text-emerald-300" : "bg-red-900/50 text-red-300"}`}
          title="Retorno de inversión estimado (no garantizado)"
        >
          {positive ? "+" : ""}{opp.estimatedRoiPercent.toFixed(2)}% ROI est.
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3 text-xs mb-3">
        <div>
          <div className="text-slate-500 text-[10px]" title="Precio ask en el exchange de compra">Precio compra</div>
          <div className="text-slate-100 font-mono">${opp.buyAt.price.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-slate-500 text-[10px]" title="Precio bid en el exchange de venta">Precio venta</div>
          <div className="text-slate-100 font-mono">${opp.sellAt.price.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-slate-500 text-[10px]" title="Capital × ROI después de comisiones (no garantizado)">Ganancia estimada</div>
          <div className={`font-mono ${positive ? "text-emerald-400" : "text-red-400"}`}>
            ${opp.netProfit.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Lista de supuestos */}
      <div className="bg-slate-800/50 rounded p-2 mt-2">
        <div className="text-[10px] uppercase text-slate-500 mb-1 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          Supuestos (no garantizado)
        </div>
        <ul className="text-[10px] text-slate-400 space-y-0.5 list-disc pl-4">
          {opp.assumptions.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ul>
      </div>

      {/* Warning destacado */}
      <div className="mt-2 text-[10px] text-amber-400 flex items-start gap-2 bg-amber-950/30 border border-amber-800/50 rounded p-2">
        <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
        <div>
          <b>Importante:</b> Esta es una estimación basada en precios del momento del escaneo.
          Los precios cambian constantemente. La ganancia real puede ser menor por:
          slippage, latencia, fees de transferencia entre exchanges, requisitos de KYC distintos,
          y tiempo de confirmación.
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MARKET INTEL PANEL — Gas, Fear&Greed, Trending, Movers, Staking
// ============================================================
function MarketIntelPanel({
  intel,
  loading,
  onRefresh,
}: {
  intel: Intel | null;
  loading: boolean;
  onRefresh: () => void;
}) {
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
        <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wide">
          Market Intel
        </h3>
        <button
          onClick={onRefresh}
          className="ml-auto text-[10px] text-slate-500 hover:text-emerald-400 flex items-center gap-1"
        >
          <RefreshCw className="w-3 h-3" />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        {/* Gas */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Gauge className="w-3 h-3 text-cyan-400" />
            <span className="text-[10px] uppercase tracking-wide text-slate-500">ETH Gas</span>
          </div>
          {intel.gas.status === "ONLINE" && intel.gas.gasPriceGwei > 0 ? (
            <>
              <div className="text-lg font-bold text-slate-100 font-mono">
                {intel.gas.gasPriceGwei.toFixed(1)}
                <span className="text-xs text-slate-500 ml-1">Gwei</span>
              </div>
              {intel.gas.estimatedCostUsd !== undefined && (
                <div className="text-[10px] text-slate-500 mt-1">
                  Transfer simple: ${intel.gas.estimatedCostUsd.toFixed(2)} USD
                </div>
              )}
            </>
          ) : (
            <div className="text-xs text-amber-400">No disponible</div>
          )}
        </div>

        {/* Fear & Greed */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Activity className="w-3 h-3 text-purple-400" />
            <span className="text-[10px] uppercase tracking-wide text-slate-500">Fear & Greed</span>
          </div>
          {intel.fearGreed.status === "ONLINE" ? (
            <>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${fearGreedColor(intel.fearGreed.value)}`}>
                  {fearGreedEmoji(intel.fearGreed.value)} {intel.fearGreed.value}
                </span>
                <span className="text-xs text-slate-300">{intel.fearGreed.classification}</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-1">alternative.me</div>
            </>
          ) : (
            <div className="text-xs text-amber-400">No disponible</div>
          )}
        </div>

        {/* Trending */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 sm:col-span-2">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Flame className="w-3 h-3 text-orange-400" />
            <span className="text-[10px] uppercase tracking-wide text-slate-500">Trending (CoinGecko)</span>
          </div>
          {intel.trending.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {intel.trending.slice(0, 6).map((c) => (
                <span
                  key={c.id}
                  className="text-[10px] px-2 py-0.5 bg-slate-800 rounded text-slate-300"
                >
                  {c.symbol.toUpperCase()}
                  {c.priceChangePercent24h !== undefined && (
                    <span className={c.priceChangePercent24h >= 0 ? "text-emerald-400 ml-1" : "text-red-400 ml-1"}>
                      {c.priceChangePercent24h >= 0 ? "+" : ""}{c.priceChangePercent24h.toFixed(1)}%
                    </span>
                  )}
                </span>
              ))}
            </div>
          ) : (
            <div className="text-xs text-amber-400">No disponible</div>
          )}
        </div>
      </div>

      {/* Top gainers / losers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingUp className="w-3 h-3 text-emerald-400" />
            <span className="text-[10px] uppercase tracking-wide text-slate-500">Top gainers 24h</span>
          </div>
          {intel.gainers.length > 0 ? (
            <div className="space-y-1">
              {intel.gainers.slice(0, 4).map((c) => (
                <div key={c.id} className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-300 truncate">
                    <b>{c.symbol.toUpperCase()}</b>
                    <span className="text-slate-500 ml-1">#{c.marketCapRank}</span>
                  </span>
                  <span className="text-emerald-400 font-mono">+{c.changePercent24h.toFixed(2)}%</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-amber-400">No disponible</div>
          )}
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingDown className="w-3 h-3 text-red-400" />
            <span className="text-[10px] uppercase tracking-wide text-slate-500">Top losers 24h</span>
          </div>
          {intel.losers.length > 0 ? (
            <div className="space-y-1">
              {intel.losers.slice(0, 4).map((c) => (
                <div key={c.id} className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-300 truncate">
                    <b>{c.symbol.toUpperCase()}</b>
                    <span className="text-slate-500 ml-1">#{c.marketCapRank}</span>
                  </span>
                  <span className="text-red-400 font-mono">{c.changePercent24h.toFixed(2)}%</span>
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
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Sparkles className="w-3 h-3 text-yellow-400" />
            <span className="text-[10px] uppercase tracking-wide text-slate-500">
              Staking yields (APY aprox.)
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {intel.stakingYields.slice(0, 6).map((s) => (
              <div
                key={s.asset}
                className="bg-slate-800 rounded p-2 cursor-help"
                title={s.notes}
              >
                <div className="text-xs font-semibold text-slate-100">{s.asset}</div>
                <div className="text-sm font-bold text-emerald-400 font-mono">
                  {s.apyPercent.toFixed(1)}% APY
                </div>
                <div className="text-[9px] text-slate-500 italic">{s.source}</div>
              </div>
            ))}
          </div>
          <div className="text-[10px] text-slate-500 mt-2 italic">
            ⚠️ APYs actualizados manualmente (Sept 2024). Para datos en tiempo real, integrar Staking Rewards API.
          </div>
        </div>
      )}
    </div>
  );
}
