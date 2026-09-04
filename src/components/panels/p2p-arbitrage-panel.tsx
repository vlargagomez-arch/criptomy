"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2, RefreshCw, ExternalLink, Shield, ChevronDown, ChevronUp,
  TrendingUp, TrendingDown, Zap, AlertCircle, Info, ArrowRight, Award,
  AlertTriangle, Crown,
} from "lucide-react";
import { COUNTRIES, SUPPORTED_ASSETS, type CountryConfig } from "@/lib/api-clients/catalog";
import type { ArbitrageOpportunity, ArbitrageResponse } from "@/lib/p2p-arbitrage/engine-v3";

// ============================================================
// P2PArbitragePanel — Diseño con jerarquía visual clara
// ============================================================
// Layout:
//   1. Header simple (título + refrescar)
//   2. Selectores (3 cards: País, Asset, Método de pago)
//   3. KPIs (4 cards con icono)
//   4. Banner explicativo de qué está pasando
//   5. HERO card (#1 mejor oportunidad - grande, destacada)
//   6. Top 4 oportunidades más (cards medianas en grid 2x2)
//   7. "Ver todas las N" → expande el resto como lista compacta
//
// Detalles visuales:
//   - Badge SOSPECHOSO para spreads > 30% (probables fake ads en P2P)
//   - Cada card muestra: ruta, profit destacado, métricas clave
//   - Expandible para ver detalles del merchant + URLs directas
// ============================================================

// Spread > 30% = sospechoso (probable bait/scam en P2P)
const SUSPICIOUS_SPREAD_THRESHOLD = 30;

const EXCHANGE_STYLES: Record<string, { bg: string; text: string; initial: string }> = {
  Binance: { bg: "bg-amber-500", text: "text-black", initial: "B" },
  OKX:     { bg: "bg-zinc-700",  text: "text-zinc-100", initial: "O" },
  Bybit:   { bg: "bg-orange-500", text: "text-white", initial: "Y" },
  Kraken:  { bg: "bg-purple-500", text: "text-white", initial: "K" },
};

function ExchangeBadge({ exchange, size = "sm" }: { exchange: string; size?: "sm" | "md" | "lg" }) {
  const style = EXCHANGE_STYLES[exchange] || { bg: "bg-slate-700", text: "text-slate-100", initial: "?" };
  const sizeClass = size === "lg" ? "w-10 h-10 text-base" : size === "md" ? "w-8 h-8 text-sm" : "w-6 h-6 text-[11px]";
  return (
    <span
      className={`inline-flex items-center justify-center rounded-md font-bold shrink-0 ${style.bg} ${style.text} ${sizeClass}`}
      title={exchange}
    >
      {style.initial}
    </span>
  );
}

function ReputationBar({ rate }: { rate: number }) {
  const color = rate >= 95 ? "bg-emerald-500" : rate >= 80 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-800 rounded overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${rate}%` }} />
      </div>
      <span className="text-[10px] text-slate-400 font-mono shrink-0">{rate.toFixed(1)}%</span>
    </div>
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

// Determina si una oportunidad es sospechosa (probable fake/scam en P2P)
function isSuspicious(opp: ArbitrageOpportunity): boolean {
  return opp.grossSpreadPct > SUSPICIOUS_SPREAD_THRESHOLD;
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
  const [showAll, setShowAll] = useState(false);

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
      setShowAll(false);
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

  const allOpportunities = data?.opportunities || [];
  const quotes = data?.quotes || {};
  const reputation = data?.reputation;

  // Separar oportunidades: top 1 (HERO), top 4 (medianas), resto (compacto)
  const hero = allOpportunities[0];
  const topRest = allOpportunities.slice(1, 5);
  const restOpportunities = allOpportunities.slice(5);
  const visibleRest = showAll ? restOpportunities : restOpportunities.slice(0, 0); // inicialmente oculto

  // Stats
  const bestOpp = allOpportunities[0];
  const onlineExchanges = Object.keys(quotes).length;
  const suspiciousCount = allOpportunities.filter(isSuspicious).length;
  const legitCount = allOpportunities.length - suspiciousCount;

  return (
    <div className="space-y-4">
      {/* ===== HEADER ===== */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-400" />
            Arbitraje P2P Real
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            4 exchanges en vivo · Binance · OKX · Bybit · Kraken · APIs públicas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 rounded-lg transition"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {loading ? "Escaneando..." : "Refrescar"}
          </button>
          {data && (
            <span className="text-[10px] text-slate-500 flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-400" />
              {new Date(data.timestamp).toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* ===== SELECTORES ===== */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
          <label className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold">País</label>
          <select
            value={country.code}
            onChange={(e) => {
              const c = COUNTRIES.find((x) => x.code === e.target.value);
              if (c) setCountry(c);
            }}
            className="mt-1 w-full bg-transparent text-slate-100 text-sm font-medium focus:outline-none cursor-pointer"
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code} className="bg-slate-900">
                {c.flag} {c.name} ({c.fiat})
              </option>
            ))}
          </select>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
          <label className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold">Asset</label>
          <select
            value={asset}
            onChange={(e) => setAsset(e.target.value)}
            className="mt-1 w-full bg-transparent text-slate-100 text-sm font-medium focus:outline-none cursor-pointer"
          >
            {SUPPORTED_ASSETS.map((a) => (
              <option key={a} value={a} className="bg-slate-900">{a}</option>
            ))}
          </select>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
          <label className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold">Método de pago</label>
          <select
            value={payment}
            onChange={(e) => setPayment(e.target.value)}
            className="mt-1 w-full bg-transparent text-slate-100 text-sm font-medium focus:outline-none cursor-pointer"
          >
            <option value="" className="bg-slate-900">Todos</option>
            {country.paymentMethods.map((m) => (
              <option key={m.id} value={m.id} className="bg-slate-900">{m.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ===== KPIs ===== */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard
            label="Oportunidades"
            value={String(allOpportunities.length)}
            sub={`${legitCount} reales · ${suspiciousCount} sospechosas`}
            color="text-amber-400"
            icon={Award}
          />
          <KpiCard
            label="Mejor profit"
            value={bestOpp ? `+${fmtAmount(bestOpp.netProfitForOperation)}` : "—"}
            sub={bestOpp ? `+${bestOpp.netSpreadPct.toFixed(2)}% spread` : "Sin oportunidades"}
            color="text-emerald-400"
            icon={TrendingUp}
            suffix={country.fiat}
          />
          <KpiCard
            label="Exchanges online"
            value={`${onlineExchanges}/4`}
            sub={Object.keys(quotes).join(" · ") || "—"}
            color="text-blue-400"
            icon={Zap}
          />
          <KpiCard
            label="Merchants válidos"
            value={reputation ? String(reputation.merchantsAfterFilter) : "—"}
            sub={reputation ? `${reputation.merchantsFilteredOut} filtrados (≥80%)` : "—"}
            color="text-purple-400"
            icon={Shield}
          />
        </div>
      )}

      {/* ===== BANNER ESTADO DE EXCHANGES (debug) ===== */}
      {data?.rawAdsByExchange && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
          <div className="text-[10px] uppercase text-slate-500 font-semibold mb-2 flex items-center gap-1.5">
            <Zap className="w-3 h-3 text-amber-400" />
            Estado de exchanges (data cruda recibida)
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {Object.entries(data.rawAdsByExchange).map(([ex, count]) => {
              const quoteData = data.quotes?.[ex] || { buy: 0, sell: 0 };
              const total = quoteData.buy + quoteData.sell;
              const status = total > 0 ? "ONLINE" : count > 0 ? "FILTRADO" : "SIN_DATA";
              const statusColor = status === "ONLINE" ? "text-emerald-400" : status === "FILTRADO" ? "text-amber-400" : "text-red-400";
              return (
                <div key={ex} className="bg-slate-950/40 border border-slate-800 rounded-lg p-2">
                  <div className="flex items-center justify-between mb-1">
                    <ExchangeBadge exchange={ex} />
                    <span className={`text-[9px] font-semibold ${statusColor}`}>{status}</span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    <div><b className="text-slate-300">{count}</b> ads recibidos</div>
                    <div>
                      <b className="text-emerald-400">{quoteData.buy}</b> BUY ·{" "}
                      <b className="text-amber-400">{quoteData.sell}</b> SELL válidos
                    </div>
                  </div>
                </div>
              );
            })}
            {/* Diversidad de pares en oportunidades finales */}
            {data.exchangesInOpportunities && (
              <div className="bg-purple-950/30 border border-purple-700/40 rounded-lg p-2">
                <div className="text-[10px] uppercase text-purple-400 font-semibold mb-1">Diversidad</div>
                <div className="text-[10px] text-slate-400">
                  <div>{data.exchangesInOpportunities.uniquePairs.length} rutas únicas</div>
                  <div className="text-[9px] text-slate-500">
                    {data.exchangesInOpportunities.uniquePairs.slice(0, 6).join(", ")}
                    {data.exchangesInOpportunities.uniquePairs.length > 6 && "..."}
                  </div>
                </div>
              </div>
            )}
          </div>
          {/* Warning si solo hay 1 exchange */}
          {data.exchangesInOpportunities && data.exchangesInOpportunities.uniquePairs.length <= 1 && (
            <div className="mt-2 text-[10px] text-amber-400 flex items-start gap-2">
              <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
              <span>
                Solo 1 ruta de arbitraje detectada — el cross-exchange está dando 0 resultados.
                Verifica que Binance/OKX/Bybit devuelvan data. Si todos están en el mismo
                exchange, las oportunidades son INTRA-exchange (comprar a advertiser X, vender a
                advertiser Y del mismo exchange). El cross-exchange real (Binance→OKX) requiere
                que ambos exchanges devuelvan ads válidos.
              </span>
            </div>
          )}
        </div>
      )}

      {/* ===== BANNER FILTROS ANTI-ESTAFA ===== */}
      {data?.reputation && (
        <div className="bg-emerald-950/30 border border-emerald-700/40 rounded-xl p-3">
          <div className="text-[10px] uppercase text-emerald-400 font-semibold mb-2 flex items-center gap-1.5">
            <Shield className="w-3 h-3" />
            Filtros anti-estafa aplicados
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
            <div className="bg-slate-950/40 rounded-lg p-2">
              <div className="text-slate-500 text-[9px] uppercase">Reputación mínima</div>
              <div className="text-emerald-400 font-bold">{data.reputation.minRequired}%</div>
              <div className="text-[9px] text-slate-500">{data.reputation.filteredByReputation} filtrados</div>
            </div>
            <div className="bg-slate-950/40 rounded-lg p-2">
              <div className="text-slate-500 text-[9px] uppercase">Órdenes mínimas</div>
              <div className="text-emerald-400 font-bold">≥ 50</div>
              <div className="text-[9px] text-slate-500">{data.reputation.filteredByOrders} cuentas nuevas</div>
            </div>
            <div className="bg-slate-950/40 rounded-lg p-2">
              <div className="text-slate-500 text-[9px] uppercase">Banda precio mercado</div>
              <div className="text-emerald-400 font-bold">
                {fmtPrice(data.reputation.priceBand.low)} - {fmtPrice(data.reputation.priceBand.high)}
              </div>
              <div className="text-[9px] text-slate-500">{data.reputation.filteredByPriceBand} bait ads</div>
            </div>
            <div className="bg-slate-950/40 rounded-lg p-2">
              <div className="text-slate-500 text-[9px] uppercase">Precio mercado (mediana)</div>
              <div className="text-amber-400 font-bold font-mono">{fmtPrice(data.reputation.marketPrice)}</div>
              <div className="text-[9px] text-slate-500">referencia para filtros</div>
            </div>
          </div>
          <div className="mt-2 text-[10px] text-slate-400 flex items-start gap-2">
            <Info className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <b className="text-slate-300">{data.reputation.merchantsBeforeFilter}</b> merchants escaneados →{" "}
              <b className="text-emerald-400">{data.reputation.merchantsAfterFilter}</b> válidos →{" "}
              <b className="text-red-400">{data.reputation.merchantsFilteredOut}</b> filtrados por estafa.
              Bait ads (precio demasiado bajo para ser real) se descartan automáticamente.
            </span>
          </div>
        </div>
      )}

      {/* ===== BANNER EXPLICATIVO ===== */}
      {data && allOpportunities.length > 0 && (
        <div className="bg-emerald-950/30 border border-emerald-700/40 rounded-xl p-3 text-xs text-slate-300 flex items-start gap-2">
          <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <b className="text-emerald-300">Cómo funciona el arbitraje:</b> Compras {asset} barato en un exchange
            (pago con {country.paymentMethods[0]?.name || "fiat local"}) y lo vendes más caro en otro.
            El profit NETO ya descuenta el fee de retiro crypto (1 {asset} = ~{fmtAmount(bestOpp?.withdrawalFeeFiat || 0)} {country.fiat}).
            <span className="text-slate-500"> · Filtro anti-estafa: merchants con reputación ≥ 80%.</span>
            {suspiciousCount > 0 && (
              <span className="text-amber-400"> · {suspiciousCount} oportunidades marcadas como SOSPECHOSAS (spread &gt; 30% — probables fake ads).</span>
            )}
          </div>
        </div>
      )}

      {/* ===== ERROR ===== */}
      {error && (
        <div className="bg-red-950/30 border border-red-800/50 rounded-xl p-4 text-sm text-red-300 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      {/* ===== LOADING ===== */}
      {loading && !data && (
        <div className="flex flex-col items-center justify-center py-16 bg-slate-900/30 border border-slate-800 rounded-xl">
          <Loader2 className="w-8 h-8 animate-spin text-amber-400 mb-3" />
          <p className="text-sm text-slate-300">Escaneando 4 exchanges en paralelo…</p>
          <p className="text-xs text-slate-500 mt-1">8 requests · Binance · OKX · Bybit · Kraken</p>
        </div>
      )}

      {/* ===== RESULTADOS ===== */}
      {data && !loading && (
        allOpportunities.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
            <AlertCircle className="w-10 h-10 mx-auto text-slate-600 mb-3" />
            <p className="text-sm text-slate-300 font-medium">No se detectaron oportunidades rentables</p>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              No hay spread suficiente entre BUY y SELL después de fees de retiro.
              Prueba con otro asset/país o espera al próximo refresh (20s).
            </p>
          </div>
        ) : (
          <>
            {/* ===== HERO CARD: oportunidad #1 ===== */}
            {hero && (
              <HeroOpportunityCard
                opp={hero}
                fiat={country.fiat}
                expanded={expandedRow === hero.id}
                onToggle={() => setExpandedRow(expandedRow === hero.id ? null : hero.id)}
              />
            )}

            {/* ===== TOP 4 oportunidades más en grid 2x2 ===== */}
            {topRest.length > 0 && (
              <div>
                <div className="text-xs uppercase text-slate-500 font-semibold mb-2 flex items-center gap-1.5">
                  <TrendingUp className="w-3 h-3" />
                  Siguientes mejores oportunidades
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {topRest.map((opp, i) => (
                    <OpportunityCard
                      key={opp.id}
                      opp={opp}
                      rank={i + 2}
                      fiat={country.fiat}
                      compact
                      expanded={expandedRow === opp.id}
                      onToggle={() => setExpandedRow(expandedRow === opp.id ? null : opp.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* ===== Resto de oportunidades (compacto, expandible) ===== */}
            {restOpportunities.length > 0 && (
              <div>
                <button
                  onClick={() => setShowAll(!showAll)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition text-xs text-slate-400"
                >
                  <span className="flex items-center gap-2">
                    {showAll ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    {showAll
                      ? `Ocultar (${restOpportunities.length} oportunidades más)`
                      : `Ver las otras ${restOpportunities.length} oportunidades`
                    }
                  </span>
                  <span className="text-slate-600">{restOpportunities.length} restantes</span>
                </button>

                {showAll && (
                  <div className="mt-2 space-y-2">
                    {restOpportunities.map((opp, i) => (
                      <OpportunityCard
                        key={opp.id}
                        opp={opp}
                        rank={i + 6}
                        fiat={country.fiat}
                        compact
                        expanded={expandedRow === opp.id}
                        onToggle={() => setExpandedRow(expandedRow === opp.id ? null : opp.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Footer info */}
            <div className="text-[10px] text-slate-500 flex items-center gap-2 px-1 pt-2">
              <Info className="w-3 h-3 shrink-0" />
              <span>
                Spread &gt; 30% = oportunidad sospechosa (probable fake ad en P2P: el merchant ofrece a precio imposible para estafar).
                Valida siempre que el merchant tenga muchas órdenes completadas y reputación ≥ 95% antes de operar.
              </span>
            </div>
          </>
        )
      )}
    </div>
  );
}

// ============================================================
// KPI CARD
// ============================================================
function KpiCard({ label, value, sub, color, icon: Icon, suffix }: {
  label: string; value: string; sub: string; color: string; icon: React.ElementType; suffix?: string;
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-start gap-3">
      <div className={`w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center ${color} shrink-0`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</div>
        <div className={`text-xl font-bold ${color} leading-tight`}>
          {value}{suffix && <span className="text-xs text-slate-500 ml-1 font-normal">{suffix}</span>}
        </div>
        <div className="text-[10px] text-slate-500 truncate">{sub}</div>
      </div>
    </div>
  );
}

// ============================================================
// HERO OPPORTUNITY CARD — #1 mejor oportunidad, grande y destacada
// ============================================================
function HeroOpportunityCard({ opp, fiat, expanded, onToggle }: {
  opp: ArbitrageOpportunity; fiat: string; expanded: boolean; onToggle: () => void;
}) {
  const suspicious = isSuspicious(opp);
  return (
    <div className={`relative bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-900 border-2 ${suspicious ? "border-red-600/40" : "border-amber-600/40"} rounded-2xl overflow-hidden shadow-xl shadow-amber-900/20`}>
      {/* Glow effect */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />

      <div className="relative p-4">
        {/* Header con corona */}
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 shrink-0">
            <Crown className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-amber-400 font-bold">MEJOR OPORTUNIDAD</div>
            <div className="text-[10px] text-slate-400">Spread neto +{opp.netSpreadPct.toFixed(2)}% · Profit estimado</div>
          </div>
          {suspicious && (
            <span className="ml-auto text-[10px] px-2 py-1 bg-red-900/50 border border-red-700/50 text-red-300 rounded-md font-semibold flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              SOSPECHOSO
            </span>
          )}
        </div>

        {/* Ruta visual grande */}
        <div className="flex items-center justify-between gap-3 bg-slate-950/40 rounded-xl p-3 mb-3">
          {/* BUY */}
          <div className="flex-1 text-center">
            <ExchangeBadge exchange={opp.buyExchange} size="lg" />
            <div className="text-[10px] text-slate-500 uppercase mt-1">COMPRAR EN</div>
            <div className="text-sm font-semibold text-slate-200">{opp.buyExchange}</div>
            <div className="text-lg font-bold text-emerald-400 font-mono mt-1">
              {fmtPrice(opp.buyPrice)}
              <span className="text-xs text-slate-500 ml-1">{fiat}</span>
            </div>
          </div>

          {/* Arrow */}
          <div className="flex flex-col items-center gap-1 shrink-0">
            <ArrowRight className="w-6 h-6 text-amber-400" />
            <span className="text-[10px] text-slate-400 font-mono whitespace-nowrap">
              {opp.operationAssetAmount.toFixed(1)} {opp.asset}
            </span>
          </div>

          {/* SELL */}
          <div className="flex-1 text-center">
            <ExchangeBadge exchange={opp.sellExchange} size="lg" />
            <div className="text-[10px] text-slate-500 uppercase mt-1">VENDER EN</div>
            <div className="text-sm font-semibold text-slate-200">{opp.sellExchange}</div>
            <div className="text-lg font-bold text-amber-400 font-mono mt-1">
              {fmtPrice(opp.sellPrice)}
              <span className="text-xs text-slate-500 ml-1">{fiat}</span>
            </div>
          </div>
        </div>

        {/* Profit destacado */}
        <div className="flex items-center justify-between gap-3 bg-emerald-950/40 border border-emerald-700/40 rounded-xl p-3 mb-3">
          <div>
            <div className="text-[10px] text-emerald-400 uppercase font-semibold">Profit NETO en esta operación</div>
            <div className="text-[10px] text-slate-500">
              Tamaño: {fmtAmount(opp.operationFiatAmount)} {fiat} · después de fee retiro
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-emerald-400 font-mono leading-tight">
              +{fmtAmount(opp.netProfitForOperation)}
              <span className="text-base text-slate-400 ml-1">{fiat}</span>
            </div>
            <div className="text-xs text-emerald-500/80">+{opp.netSpreadPct.toFixed(2)}% spread neto</div>
          </div>
        </div>

        {/* Métricas rápidas en grid */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          <HeroMetric label="Spread bruto" value={`+${opp.grossSpreadPct.toFixed(2)}%`} color="text-slate-200" />
          <HeroMetric label="Fee retiro" value={`${opp.withdrawalFee} ${opp.asset}`} sub={`${fmtAmount(opp.withdrawalFeeFiat)} ${fiat}`} color="text-red-400" />
          <HeroMetric label="Tamaño op." value={`${fmtAmount(opp.operationFiatAmount)}`} sub={fiat} color="text-slate-200" />
          <HeroMetric label="Pago común" value={opp.commonPaymentMethod || "—"} color="text-blue-400" />
        </div>

        {/* Botones de acción */}
        <div className="flex items-center gap-2">
          <a
            href={opp.buyDirectUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 inline-flex items-center justify-center gap-1.5 text-sm px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition font-medium"
          >
            <ExternalLink className="w-4 h-4" />
            Ir a comprar en {opp.buyExchange}
          </a>
          <a
            href={opp.sellDirectUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 inline-flex items-center justify-center gap-1.5 text-sm px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition font-medium"
          >
            <ExternalLink className="w-4 h-4" />
            Ir a vender en {opp.sellExchange}
          </a>
          <button
            onClick={onToggle}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition flex items-center gap-1 text-sm"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {expanded ? "Ocultar" : "Detalles"}
          </button>
        </div>

        {/* Detalles expandibles */}
        {expanded && (
          <div className="mt-3 pt-3 border-t border-slate-800 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* BUY merchant */}
              <div className="bg-emerald-950/30 border border-emerald-800/40 rounded-lg p-3">
                <div className="text-[10px] uppercase text-emerald-400 font-semibold flex items-center gap-1.5 mb-2">
                  <TrendingUp className="w-3 h-3" />
                  Comprar a: {opp.buyMerchant}
                  {opp.buyMerchantPro && <span className="text-[8px] px-1 py-0.5 bg-amber-900/50 text-amber-300 rounded font-semibold">PRO</span>}
                </div>
                <div className="space-y-2 text-xs">
                  <div>
                    <div className="text-[9px] text-slate-500 uppercase mb-1">Reputación ({opp.buyMerchantOrderCount.toLocaleString()} órdenes)</div>
                    <ReputationBar rate={opp.buyMerchantReputation} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <div className="text-slate-500">Mín-Max</div>
                      <div className="text-slate-300 font-mono">{fmtAmount(opp.buyMinAmount)} - {fmtAmount(opp.buyMaxAmount)} {fiat}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Disponible</div>
                      <div className="text-slate-300 font-mono">{opp.buyAvailableQty.toFixed(2)} {opp.asset}</div>
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-[10px] mb-1">Métodos de pago</div>
                    <div className="flex flex-wrap gap-1">
                      {opp.buyPaymentMethods.slice(0, 6).map((m) => (
                        <span key={m} className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded text-[10px]">{m}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* SELL merchant */}
              <div className="bg-amber-950/30 border border-amber-800/40 rounded-lg p-3">
                <div className="text-[10px] uppercase text-amber-400 font-semibold flex items-center gap-1.5 mb-2">
                  <TrendingDown className="w-3 h-3" />
                  Vender a: {opp.sellMerchant}
                  {opp.sellMerchantPro && <span className="text-[8px] px-1 py-0.5 bg-amber-900/50 text-amber-300 rounded font-semibold">PRO</span>}
                </div>
                <div className="space-y-2 text-xs">
                  <div>
                    <div className="text-[9px] text-slate-500 uppercase mb-1">Reputación ({opp.sellMerchantOrderCount.toLocaleString()} órdenes)</div>
                    <ReputationBar rate={opp.sellMerchantReputation} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <div className="text-slate-500">Mín-Max</div>
                      <div className="text-slate-300 font-mono">{fmtAmount(opp.sellMinAmount)} - {fmtAmount(opp.sellMaxAmount)} {fiat}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Disponible</div>
                      <div className="text-slate-300 font-mono">{opp.sellAvailableQty.toFixed(2)} {opp.asset}</div>
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-[10px] mb-1">Métodos de pago</div>
                    <div className="flex flex-wrap gap-1">
                      {opp.sellPaymentMethods.slice(0, 6).map((m) => (
                        <span key={m} className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded text-[10px]">{m}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Cálculo */}
            <div className="bg-slate-950/50 border border-slate-700/40 rounded-lg p-3">
              <div className="text-[10px] uppercase text-purple-400 font-semibold mb-2 flex items-center gap-1.5">
                <Info className="w-3 h-3" />
                Cálculo del profit NETO (algoritmo)
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs">
                <CalcItem label="Tamaño op." value={`${fmtAmount(opp.operationFiatAmount)} ${fiat}`} />
                <CalcItem label="Asset comprado" value={`${opp.operationAssetAmount.toFixed(3)} ${opp.asset}`} />
                <CalcItem label="Spread bruto" value={`+${opp.grossSpreadPct.toFixed(2)}%`} color="text-slate-200" />
                <CalcItem label="Fee retiro" value={`-${fmtAmount(opp.withdrawalFeeFiat)} ${fiat}`} color="text-red-400" />
                <CalcItem label="Profit NETO" value={`+${fmtAmount(opp.netProfitForOperation)} ${fiat}`} color="text-emerald-400" bold />
                <CalcItem label="Profit/1000" value={`+${opp.netProfitOn1000.toFixed(2)}`} color="text-emerald-400" />
              </div>
            </div>

            {/* Warning si sospechoso */}
            {suspicious && (
              <div className="bg-red-950/30 border border-red-700/50 rounded-lg p-3 flex items-start gap-2 text-xs text-red-300">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <b>Oportunidad sospechosa:</b> spread bruto &gt; 30% es prácticamente imposible en P2P real.
                  El merchant probablemente ofrece a precio imposible para estafar (recibe tu fiat pero nunca libera el crypto).
                  <b> Verifica en el exchange directamente</b> antes de operar. Si la oferta parece demasiado buena para ser verdad, lo es.
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function HeroMetric({ label, value, sub, color }: {
  label: string; value: string; sub?: string; color: string;
}) {
  return (
    <div className="bg-slate-950/40 rounded-lg p-2">
      <div className="text-[9px] text-slate-500 uppercase tracking-wide">{label}</div>
      <div className={`text-xs font-mono font-semibold ${color} truncate`}>{value}</div>
      {sub && <div className="text-[9px] text-slate-500 truncate">{sub}</div>}
    </div>
  );
}

// ============================================================
// OPPORTUNITY CARD — para top 5 y resto (compacta)
// ============================================================
function OpportunityCard({ opp, rank, fiat, compact, expanded, onToggle }: {
  opp: ArbitrageOpportunity;
  rank: number;
  fiat: string;
  compact?: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const suspicious = isSuspicious(opp);
  const rankColor = rank <= 3
    ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
    : "bg-slate-800 text-slate-400 border-slate-700";

  return (
    <div className={`bg-slate-900 border ${suspicious ? "border-red-700/30" : expanded ? "border-amber-600/40" : "border-slate-800"} rounded-xl overflow-hidden transition`}>
      <button
        onClick={onToggle}
        className="w-full p-3 hover:bg-slate-800/30 transition text-left"
      >
        {/* Row 1: Rank, ruta, profit, expand */}
        <div className="flex items-center gap-3">
          <span className={`px-2 py-1 rounded-md text-[10px] font-bold border ${rankColor} shrink-0`}>
            #{rank}
          </span>

          <div className="flex items-center gap-1.5 min-w-0">
            <ExchangeBadge exchange={opp.buyExchange} size="md" />
            <ArrowRight className="w-3 h-3 text-slate-600 shrink-0" />
            <ExchangeBadge exchange={opp.sellExchange} size="md" />
          </div>

          {suspicious && (
            <span className="text-[9px] px-1.5 py-0.5 bg-red-900/50 border border-red-700/40 text-red-300 rounded font-semibold flex items-center gap-1 shrink-0">
              <AlertTriangle className="w-2.5 h-2.5" />
              SOSPECHOSO
            </span>
          )}

          <div className="ml-auto text-right shrink-0">
            <div className={`text-base font-bold font-mono leading-tight ${opp.netProfitForOperation > 0 ? "text-emerald-400" : "text-red-400"}`}>
              +{fmtAmount(opp.netProfitForOperation)} {fiat}
            </div>
            <div className="text-[10px] text-slate-500">+{opp.netSpreadPct.toFixed(2)}% neto</div>
          </div>

          <div className="shrink-0 text-slate-500">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>

        {/* Row 2: Métricas clave */}
        <div className="grid grid-cols-4 gap-2 mt-2 pt-2 border-t border-slate-800/50">
          <MiniMetric label="BUY" value={fmtPrice(opp.buyPrice)} suffix={fiat} color="text-emerald-400" />
          <MiniMetric label="SELL" value={fmtPrice(opp.sellPrice)} suffix={fiat} color="text-amber-400" />
          <MiniMetric label="Spread bruto" value={`+${opp.grossSpreadPct.toFixed(1)}%`} color={suspicious ? "text-red-400" : "text-slate-200"} />
          <MiniMetric label="Tamaño op." value={fmtAmount(opp.operationFiatAmount)} suffix={fiat} color="text-slate-200" />
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-800 bg-slate-950/40 p-3 space-y-3">
          {/* Detalles merchants */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {/* BUY */}
            <div className="bg-emerald-950/30 border border-emerald-800/40 rounded-lg p-2">
              <div className="text-[10px] uppercase text-emerald-400 font-semibold mb-1.5 flex items-center gap-1.5">
                <TrendingUp className="w-3 h-3" />
                Comprar a: {opp.buyMerchant}
                {opp.buyMerchantPro && <span className="text-[8px] px-1 py-0.5 bg-amber-900/50 text-amber-300 rounded font-semibold">PRO</span>}
              </div>
              <div className="space-y-1.5">
                <ReputationBar rate={opp.buyMerchantReputation} />
                <div className="text-[10px] text-slate-400 font-mono">
                  {fmtAmount(opp.buyMinAmount)} - {fmtAmount(opp.buyMaxAmount)} {fiat} · {opp.buyAvailableQty.toFixed(1)} {opp.asset} disp.
                </div>
                <div className="flex flex-wrap gap-1">
                  {opp.buyPaymentMethods.slice(0, 4).map((m) => (
                    <span key={m} className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded text-[9px]">{m}</span>
                  ))}
                </div>
              </div>
              <a
                href={opp.buyDirectUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-[11px] px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded transition font-medium"
              >
                <ExternalLink className="w-3 h-3" />
                Comprar
              </a>
            </div>

            {/* SELL */}
            <div className="bg-amber-950/30 border border-amber-800/40 rounded-lg p-2">
              <div className="text-[10px] uppercase text-amber-400 font-semibold mb-1.5 flex items-center gap-1.5">
                <TrendingDown className="w-3 h-3" />
                Vender a: {opp.sellMerchant}
                {opp.sellMerchantPro && <span className="text-[8px] px-1 py-0.5 bg-amber-900/50 text-amber-300 rounded font-semibold">PRO</span>}
              </div>
              <div className="space-y-1.5">
                <ReputationBar rate={opp.sellMerchantReputation} />
                <div className="text-[10px] text-slate-400 font-mono">
                  {fmtAmount(opp.sellMinAmount)} - {fmtAmount(opp.sellMaxAmount)} {fiat} · {opp.sellAvailableQty.toFixed(1)} {opp.asset} disp.
                </div>
                <div className="flex flex-wrap gap-1">
                  {opp.sellPaymentMethods.slice(0, 4).map((m) => (
                    <span key={m} className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded text-[9px]">{m}</span>
                  ))}
                </div>
              </div>
              <a
                href={opp.sellDirectUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-[11px] px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded transition font-medium"
              >
                <ExternalLink className="w-3 h-3" />
                Vender
              </a>
            </div>
          </div>

          {/* Cálculo */}
          <div className="bg-slate-900/70 border border-slate-700/40 rounded-lg p-2">
            <div className="text-[9px] uppercase text-purple-400 font-semibold mb-1.5 flex items-center gap-1">
              <Info className="w-3 h-3" />
              Cálculo del profit NETO
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-[10px]">
              <CalcItem label="Tamaño op." value={`${fmtAmount(opp.operationFiatAmount)} ${fiat}`} small />
              <CalcItem label="Asset comprado" value={`${opp.operationAssetAmount.toFixed(2)} ${opp.asset}`} small />
              <CalcItem label="Spread bruto" value={`+${opp.grossSpreadPct.toFixed(2)}%`} color="text-slate-200" small />
              <CalcItem label="Fee retiro" value={`-${fmtAmount(opp.withdrawalFeeFiat)} ${fiat}`} color="text-red-400" small />
              <CalcItem label="Profit NETO" value={`+${fmtAmount(opp.netProfitForOperation)} ${fiat}`} color="text-emerald-400" bold small />
              <CalcItem label="Profit/1000" value={`+${opp.netProfitOn1000.toFixed(2)}`} color="text-emerald-400" small />
            </div>
          </div>

          {/* Warning si sospechoso */}
          {suspicious && (
            <div className="bg-red-950/30 border border-red-700/50 rounded-lg p-2 flex items-start gap-2 text-[10px] text-red-300">
              <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
              <span>
                <b>Sospechoso:</b> spread &gt; 30% es prácticamente imposible en P2P real. Probable fake ad (merchant recibe pago pero no libera crypto). Verifica en el exchange antes de operar.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MiniMetric({ label, value, suffix, color }: {
  label: string; value: string; suffix?: string; color: string;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[9px] text-slate-500 uppercase tracking-wide">{label}</div>
      <div className={`text-xs font-mono ${color} truncate`}>
        {value}{suffix && <span className="text-[10px] text-slate-500 ml-1">{suffix}</span>}
      </div>
    </div>
  );
}

function CalcItem({ label, value, color, bold, small }: {
  label: string; value: string; color?: string; bold?: boolean; small?: boolean;
}) {
  return (
    <div className={`${small ? "bg-slate-950/40" : "bg-slate-950/50"} rounded p-1.5`}>
      <div className={`text-slate-500 uppercase tracking-wide mb-0.5 ${small ? "text-[8px]" : "text-[9px]"}`}>{label}</div>
      <div className={`font-mono ${bold ? "font-bold" : ""} ${color || "text-slate-200"} ${small ? "text-[10px]" : "text-xs"}`}>{value}</div>
    </div>
  );
}
