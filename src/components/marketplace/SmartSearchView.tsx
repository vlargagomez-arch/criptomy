"use client";

import { useState, useCallback } from "react";
import { Search, Loader2, TrendingUp, TrendingDown, Award, ArrowRight, Globe2, Zap, Clock, AlertTriangle, RefreshCw, Star } from "lucide-react";
import { QUICK_SEARCHES } from "@/lib/scanner/interpreter";
import type { SearchResponse, SearchIntent } from "@/lib/scanner/types";

export default function SmartSearchView() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    setResponse(null);
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
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    search(query);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <Search className="w-6 h-6 text-emerald-400" />
          Buscador Web3
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Escribe lo que quieres hacer. El sistema escanea múltiples proveedores
          (Binance, OKX, Bybit, Kraken, Coinbase, CoinGecko) y encuentra las mejores opciones.
        </p>
      </div>

      {/* Buscador */}
      <form onSubmit={submit} className="relative mb-6">
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

      {/* Quick searches */}
      {!response && !loading && (
        <div className="mb-6">
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
            <p className="text-sm text-slate-400">Escaneando proveedores…</p>
            <p className="text-xs text-slate-500 mt-1">Binance, OKX, Bybit, Kraken, Coinbase, CoinGecko</p>
          </div>
        </div>
      )}

      {/* Resultados */}
      {response && !loading && (
        <SearchResults response={response} onRetry={() => search(query)} />
      )}
    </div>
  );
}

function SearchResults({ response, onRetry }: { response: SearchResponse; onRetry: () => void }) {
  const { intent, results, bestOption, alternatives, p2pOffers, arbitrageOpportunities, providersOk, providersChecked, errors, executionTimeMs } = response;

  if (results.length === 0 && p2pOffers.length === 0 && arbitrageOpportunities.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
        <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-amber-400" />
        <p className="text-sm text-slate-300">
          No se encontraron opciones para esta búsqueda.
        </p>
        <p className="text-xs text-slate-500 mt-2">
          Proveedores consultados: {providersOk}/{providersChecked} OK.
        </p>
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

      {/* Mejor opción */}
      {bestOption && (
        <ResultCard result={bestOption} highlight />
      )}

      {/* Alternativas */}
      {alternatives.length > 0 && (
        <div>
          <h3 className="text-xs uppercase tracking-wide text-slate-500 mb-2">Otras opciones</h3>
          <div className="space-y-3">
            {alternatives.map((r) => (
              <ResultCard key={r.provider} result={r} />
            ))}
          </div>
        </div>
      )}

      {/* P2P offers */}
      {p2pOffers.length > 0 && (
        <div>
          <h3 className="text-xs uppercase tracking-wide text-slate-500 mb-2">
            Ofertas P2P (Binance) · {p2pOffers.length} encontradas
          </h3>
          <div className="space-y-2">
            {p2pOffers.slice(0, 8).map((o, i) => (
              <P2POfferCard key={i} offer={o} />
            ))}
          </div>
        </div>
      )}

      {/* Arbitraje */}
      {arbitrageOpportunities.length > 0 && (
        <div>
          <h3 className="text-xs uppercase tracking-wide text-slate-500 mb-2">
            Oportunidades de arbitraje detectadas
          </h3>
          <div className="space-y-2">
            {arbitrageOpportunities.slice(0, 5).map((opp, i) => (
              <ArbitrageCard key={i} opp={opp} />
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
  const config: Record<string, { color: string; label: string; icon: React.ElementType }> = {
    BUY: { color: "bg-emerald-900/50 text-emerald-300", label: "Comprar", icon: TrendingUp },
    SELL: { color: "bg-amber-900/50 text-amber-300", label: "Vender", icon: TrendingDown },
    SEND: { color: "bg-cyan-900/50 text-cyan-300", label: "Enviar", icon: Globe2 },
    ARBITRAGE: { color: "bg-purple-900/50 text-purple-300", label: "Arbitraje", icon: Award },
    COMPARE: { color: "bg-blue-900/50 text-blue-300", label: "Comparar", icon: Search },
    FIND_P2P: { color: "bg-pink-900/50 text-pink-300", label: "Mejor P2P", icon: Star },
    UNKNOWN: { color: "bg-slate-800 text-slate-400", label: "Desconocido", icon: AlertTriangle },
  };
  const c = config[intent.operation] || config.UNKNOWN;
  const Icon = c.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${c.color}`}>
      <Icon className="w-3 h-3" />
      {c.label}
      {intent.amount && <span className="opacity-70">· {intent.amount}</span>}
      {intent.asset && <span className="opacity-70">· {intent.asset}</span>}
      {intent.fiat && <span className="opacity-70">· {intent.fiat}</span>}
      {intent.country && <span className="opacity-70">· {intent.country}</span>}
    </span>
  );
}

function ResultCard({ result, highlight }: { result: import("@/lib/scanner/types").RankedResult; highlight?: boolean }) {
  const badgeColors: Record<string, string> = {
    BEST: "bg-emerald-600 text-white",
    CHEAPEST: "bg-blue-600 text-white",
    MOST_LIQUID: "bg-purple-600 text-white",
    FASTEST: "bg-amber-600 text-white",
  };

  return (
    <div className={`bg-slate-900 border rounded-xl p-4 ${highlight ? "border-emerald-600 shadow-lg shadow-emerald-900/20" : "border-slate-800"}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          {result.badge && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${badgeColors[result.badge]}`}>
              {result.badge === "BEST" ? "🥇 Mejor opción" : result.badge === "CHEAPEST" ? "💰 Menor comisión" : "🌊 Mayor liquidez"}
            </span>
          )}
          <span className="text-base font-semibold text-slate-100">{result.providerName}</span>
          <span className={`text-[10px] px-2 py-0.5 rounded ${result.status === "ONLINE" ? "bg-emerald-900/50 text-emerald-300" : "bg-red-900/50 text-red-300"}`}>
            {result.status === "ONLINE" ? "● Online" : "● " + result.status}
          </span>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-slate-500">Latencia</div>
          <div className="text-xs text-slate-300">{result.latencyMs}ms</div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        <div>
          <div className="text-[10px] text-slate-500">Precio unit.</div>
          <div className="text-sm text-slate-100 font-mono">
            {result.price.toLocaleString(undefined, { maximumFractionDigits: result.price < 1 ? 6 : 2 })} {result.fiat}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-slate-500">Comisión</div>
          <div className="text-sm text-amber-400 font-mono">
            {result.fee.toLocaleString(undefined, { maximumFractionDigits: 4 })} {result.feeCurrency}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-slate-500">Costo total</div>
          <div className="text-sm text-emerald-400 font-mono font-semibold">
            {result.totalCost.toLocaleString(undefined, { maximumFractionDigits: 2 })} {result.totalCostCurrency}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-slate-500">Precio efectivo</div>
          <div className="text-sm text-slate-100 font-mono">
            {result.effectivePrice.toLocaleString(undefined, { maximumFractionDigits: result.effectivePrice < 1 ? 6 : 4 })} {result.fiat}
          </div>
        </div>
      </div>

      {result.spread !== undefined && result.spread > 0 && (
        <div className="text-[11px] text-slate-500 mb-1">
          Spread: {result.spread.toFixed(4)} ({result.spreadPercent?.toFixed(3)}%)
        </div>
      )}
      {result.liquidity !== undefined && result.liquidity > 0 && (
        <div className="text-[11px] text-slate-500 mb-1">
          Volumen 24h: {result.liquidity.toLocaleString(undefined, { maximumFractionDigits: 0 })} {result.fiat}
        </div>
      )}
      {result.paymentMethods && result.paymentMethods.length > 0 && (
        <div className="text-[11px] text-slate-400 mb-1">
          Métodos: {result.paymentMethods.join(", ")}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 mt-2 pt-2 border-t border-slate-800">
        <div className="text-[10px] text-slate-500">
          {result.reason}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 mt-2">
        <div className="text-[10px] text-slate-500 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {result.estimatedTime}
        </div>
        <div className="text-[10px] text-slate-500">
          Fuente: {result.source}
        </div>
      </div>

      {result.kycNote && (
        <div className="mt-2 text-[10px] text-slate-500 italic">
          {result.kycNote}
        </div>
      )}
    </div>
  );
}

function P2POfferCard({ offer }: { offer: import("@/lib/scanner/types").P2POffer }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex items-center justify-between gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-slate-100">@{offer.advertiser}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
            {offer.providerName}
          </span>
        </div>
        <div className="text-xs text-slate-400">
          {offer.paymentMethods.slice(0, 3).join(" · ")}
        </div>
        <div className="text-[10px] text-slate-500 mt-1">
          Límites: {offer.minAmount.toLocaleString()} - {offer.maxAmount.toLocaleString()} {offer.fiat}
        </div>
      </div>
      <div className="text-right">
        <div className="text-sm font-bold text-emerald-400 font-mono">
          {offer.price.toLocaleString(undefined, { maximumFractionDigits: 2 })} {offer.fiat}
        </div>
        <div className="text-[10px] text-slate-500">
          Disponible: {offer.available.toLocaleString()} {offer.asset}
        </div>
      </div>
    </div>
  );
}

function ArbitrageCard({ opp }: { opp: import("@/lib/scanner/types").ArbitrageOpportunity }) {
  const positive = opp.netProfit > 0;
  return (
    <div className={`bg-slate-900 border rounded-lg p-3 ${positive ? "border-emerald-800/50" : "border-slate-800"}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium text-slate-100">
          Comprar en <b className="text-emerald-400">{opp.buyAt.provider}</b> · Vender en <b className="text-amber-400">{opp.sellAt.provider}</b>
        </div>
        <span className={`text-xs font-bold ${positive ? "text-emerald-400" : "text-red-400"}`}>
          {positive ? "+" : ""}{opp.estimatedRoiPercent.toFixed(2)}% ROI
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3 text-xs mb-2">
        <div>
          <div className="text-slate-500 text-[10px]">Precio compra</div>
          <div className="text-slate-100 font-mono">${opp.buyAt.price.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-slate-500 text-[10px]">Precio venta</div>
          <div className="text-slate-100 font-mono">${opp.sellAt.price.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-slate-500 text-[10px]">Ganancia estimada</div>
          <div className={`font-mono ${positive ? "text-emerald-400" : "text-red-400"}`}>
            ${opp.netProfit.toFixed(2)}
          </div>
        </div>
      </div>
      <div className="text-[10px] text-slate-500 italic">
        Supuestos: capital ${opp.capital} · fees ${opp.feesEstimated.toFixed(2)} · NO incluye transferencia entre exchanges
      </div>
    </div>
  );
}
