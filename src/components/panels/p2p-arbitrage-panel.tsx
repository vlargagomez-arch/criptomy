"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2, RefreshCw, ExternalLink, Shield, ChevronDown, ChevronUp,
  TrendingUp, TrendingDown, Zap, AlertCircle, Info, ArrowRight, Award,
} from "lucide-react";
import { COUNTRIES, SUPPORTED_ASSETS, type CountryConfig } from "@/lib/api-clients/catalog";
import type { ArbitrageOpportunity, ArbitrageResponse } from "@/lib/p2p-arbitrage/engine-v3";

// ============================================================
// P2PArbitragePanel — Arbitraje P2P Real · 4 exchanges en vivo
// ============================================================
// Diseño: tarjetas tipo "trade card" en vez de tabla densa.
// Cada oportunidad es una card con 3 zonas claras:
//   1. Header: rank + badges + profit destacado
//   2. Ruta: BUY exchange → SELL exchange con precios
//   3. Detalles: spread, fees, tamaño, reputation
// Expandible para ver merchant completo y URLs directas
// ============================================================

// Colores por exchange
const EXCHANGE_STYLES: Record<string, { bg: string; text: string; initial: string; ring: string }> = {
  Binance: { bg: "bg-amber-500", text: "text-black", initial: "B", ring: "ring-amber-500/30" },
  OKX:     { bg: "bg-zinc-700",  text: "text-zinc-100", initial: "O", ring: "ring-zinc-500/30" },
  Bybit:   { bg: "bg-orange-500", text: "text-white", initial: "Y", ring: "ring-orange-500/30" },
  Kraken:  { bg: "bg-purple-500", text: "text-white", initial: "K", ring: "ring-purple-500/30" },
};

function ExchangeBadge({ exchange, size = "sm" }: { exchange: string; size?: "sm" | "md" }) {
  const style = EXCHANGE_STYLES[exchange] || { bg: "bg-slate-700", text: "text-slate-100", initial: "?", ring: "" };
  const sizeClass = size === "md" ? "w-8 h-8 text-sm" : "w-6 h-6 text-[11px]";
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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        asset, fiat: country.fiat, rows: "15",
        exchanges: "binance,okx,bybit,kraken",
        minReputation: "80", minNetSpread: "0.1",
      });
      if (payment) params.set("payment", payment);
      const res = await fetch(`/api/arbitrage/p2p?${params.toString()}`);
      const json = (await res.json()) as ArbitrageResponse;
      if (!res.ok || !json.success) { setError(json.error || `HTTP ${res.status}`); return; }
      setData(json);
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
  const totalProfit = opportunities.reduce((s, o) => s + o.netProfitForOperation, 0);
  const onlineExchanges = Object.keys(quotes).length;

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
            value={String(opportunities.length)}
            sub={`de 144 combinaciones`}
            color="text-amber-400"
            icon={Award}
          />
          <KpiCard
            label="Mejor spread"
            value={bestOpp ? `+${bestOpp.netSpreadPct.toFixed(2)}%` : "—"}
            sub={bestOpp ? `+${fmtAmount(bestOpp.netProfitForOperation)} ${country.fiat}` : "Sin oportunidades"}
            color="text-emerald-400"
            icon={TrendingUp}
          />
          <KpiCard
            label="Exchanges online"
            value={`${onlineExchanges}/4`}
            sub={Object.keys(quotes).join(" · ")}
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
        opportunities.length === 0 ? (
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
            {/* Indicador de merchants filtrados */}
            {reputation && (
              <div className="flex items-center gap-2 text-[11px] text-slate-400 px-1">
                <Shield className="w-3 h-3 text-emerald-400" />
                <span>Filtro anti-estafa activo · reputación mínima <b className="text-emerald-400">{reputation.minRequired}%</b></span>
                <span className="text-slate-700">·</span>
                <span>
                  <b className="text-slate-300">{reputation.merchantsBeforeFilter}</b> escaneados →{" "}
                  <b className="text-emerald-400">{reputation.merchantsAfterFilter}</b> válidos →{" "}
                  <b className="text-red-400">{reputation.merchantsFilteredOut}</b> filtrados
                </span>
              </div>
            )}

            {/* Lista de oportunidades como tarjetas */}
            <div className="space-y-2">
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

            {/* Footer info */}
            <div className="text-[10px] text-slate-500 flex items-center gap-2 px-1 pt-2">
              <Info className="w-3 h-3 shrink-0" />
              <span>
                Profit NETO calculado después de fee de retiro crypto (TRC20 por defecto). En cross-exchange
                (Binance→OKX por ejemplo), necesitas transferir el {asset} del exchange BUY al SELL
                (~{asset === "USDT" ? "1 USDT fee" : "fee de red"}). El método de pago común facilita el round-trip fiat.
              </span>
            </div>
          </>
        )
      )}
    </div>
  );
}

// ============================================================
// KPI CARD — Tarjeta de métrica
// ============================================================
function KpiCard({ label, value, sub, color, icon: Icon }: {
  label: string; value: string; sub: string; color: string; icon: React.ElementType;
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-start gap-3">
      <div className={`w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center ${color} shrink-0`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</div>
        <div className={`text-xl font-bold ${color}`}>{value}</div>
        <div className="text-[10px] text-slate-500 truncate">{sub}</div>
      </div>
    </div>
  );
}

// ============================================================
// OPPORTUNITY CARD — Tarjeta de oportunidad
// ============================================================
function OpportunityCard({ opp, rank, fiat, expanded, onToggle }: {
  opp: ArbitrageOpportunity;
  rank: number;
  fiat: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const profitColor = opp.netProfitForOperation > 0 ? "text-emerald-400" : "text-red-400";
  const rankColor = rank === 1 ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
    : rank === 2 ? "bg-slate-700/40 text-slate-200 border-slate-600/30"
    : rank === 3 ? "bg-orange-700/20 text-orange-300 border-orange-700/30"
    : "bg-slate-800 text-slate-400 border-slate-700";

  return (
    <div className={`bg-slate-900 border ${expanded ? "border-amber-600/40" : "border-slate-800"} rounded-xl overflow-hidden transition`}>
      {/* === ZONA 1: Header con rank, ruta y profit === */}
      <button
        onClick={onToggle}
        className="w-full p-3 hover:bg-slate-800/30 transition text-left"
      >
        {/* Row 1: Rank + Ruta + Profit */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Rank badge */}
          <span className={`px-2 py-1 rounded-md text-[10px] font-bold border ${rankColor} shrink-0`}>
            #{rank}
          </span>

          {/* Ruta: BUY exchange → SELL exchange */}
          <div className="flex items-center gap-1.5 min-w-0">
            <ExchangeBadge exchange={opp.buyExchange} size="md" />
            <div className="text-xs">
              <div className="text-slate-300 font-medium leading-tight">{opp.buyExchange}</div>
              <div className="text-[9px] text-slate-500 leading-tight">comprar</div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-600 mx-1 shrink-0" />
            <ExchangeBadge exchange={opp.sellExchange} size="md" />
            <div className="text-xs">
              <div className="text-slate-300 font-medium leading-tight">{opp.sellExchange}</div>
              <div className="text-[9px] text-slate-500 leading-tight">vender</div>
            </div>
          </div>

          {/* Tipo badge */}
          <span className="text-[9px] px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded font-mono shrink-0">
            {opp.type}
          </span>

          {/* Profit destacado (right aligned) */}
          <div className="ml-auto text-right shrink-0">
            <div className={`text-lg font-bold ${profitColor} font-mono leading-tight`}>
              +{fmtAmount(opp.netProfitForOperation)} {fiat}
            </div>
            <div className="text-[10px] text-slate-500">
              +{opp.netSpreadPct.toFixed(2)}% spread neto
            </div>
          </div>

          {/* Expand icon */}
          <div className="shrink-0 text-slate-500">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>

        {/* Row 2: Métricas clave en grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-3 pt-3 border-t border-slate-800/50">
          <Metric label="Precio BUY" value={fmtPrice(opp.buyPrice)} suffix={fiat} color="text-emerald-400" />
          <Metric label="Precio SELL" value={fmtPrice(opp.sellPrice)} suffix={fiat} color="text-amber-400" />
          <Metric label="Spread bruto" value={`${opp.grossSpreadPct.toFixed(2)}%`} color="text-slate-200" />
          <Metric label="Fee retiro" value={`${opp.withdrawalFeeFiat.toFixed(0)}`} suffix={fiat} color="text-red-400" />
          <Metric label="Tamaño op." value={fmtAmount(opp.operationFiatAmount)} suffix={fiat} color="text-slate-200" />
        </div>
      </button>

      {/* === ZONA 2: Detalles expandibles === */}
      {expanded && (
        <div className="border-t border-slate-800 bg-slate-950/40 p-4 space-y-4">
          {/* Ruta visual completa */}
          <div className="flex items-center justify-between gap-2 text-xs">
            {/* BUY */}
            <div className="flex-1 bg-emerald-950/30 border border-emerald-800/40 rounded-lg p-3">
              <div className="text-[10px] uppercase text-emerald-400 font-semibold flex items-center gap-1.5 mb-2">
                <TrendingUp className="w-3 h-3" />
                Comprar en {opp.buyExchange}
              </div>
              <div className="space-y-1.5 text-slate-300">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 text-[10px] shrink-0">Merchant:</span>
                  <span className="font-medium text-slate-200 truncate">{opp.buyMerchant}</span>
                  {opp.buyMerchantPro && (
                    <span className="text-[8px] px-1 py-0.5 bg-amber-900/50 text-amber-300 rounded font-semibold shrink-0">PRO</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 text-[10px] shrink-0">Reputación:</span>
                  <div className="flex-1"><ReputationBar rate={opp.buyMerchantReputation} /></div>
                </div>
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="text-slate-500 shrink-0">Precio:</span>
                  <span className="text-emerald-400 font-mono font-semibold">{fmtPrice(opp.buyPrice)} {fiat}</span>
                </div>
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="text-slate-500 shrink-0">Mín-Max:</span>
                  <span className="text-slate-300 font-mono">
                    {fmtAmount(opp.buyMinAmount)} - {fmtAmount(opp.buyMaxAmount)} {fiat}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="text-slate-500 shrink-0">Disponible:</span>
                  <span className="text-slate-300 font-mono">{opp.buyAvailableQty.toFixed(2)} {opp.asset}</span>
                </div>
                <div className="flex items-start gap-2 text-[10px]">
                  <span className="text-slate-500 shrink-0 pt-0.5">Métodos:</span>
                  <div className="flex flex-wrap gap-1">
                    {opp.buyPaymentMethods.length > 0 ? (
                      opp.buyPaymentMethods.slice(0, 5).map((m) => (
                        <span key={m} className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded">{m}</span>
                      ))
                    ) : (
                      <span className="text-slate-600 italic">—</span>
                    )}
                  </div>
                </div>
              </div>
              <a
                href={opp.buyDirectUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1 text-[11px] px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition font-medium"
              >
                <ExternalLink className="w-3 h-3" />
                Ir a comprar
              </a>
            </div>

            {/* Arrow */}
            <div className="flex flex-col items-center gap-1 shrink-0">
              <ArrowRight className="w-5 h-5 text-slate-600 rotate-90 sm:rotate-0" />
              <span className="text-[9px] text-slate-600 font-mono whitespace-nowrap">{opp.operationAssetAmount.toFixed(2)} {opp.asset}</span>
            </div>

            {/* SELL */}
            <div className="flex-1 bg-amber-950/30 border border-amber-800/40 rounded-lg p-3">
              <div className="text-[10px] uppercase text-amber-400 font-semibold flex items-center gap-1.5 mb-2">
                <TrendingDown className="w-3 h-3" />
                Vender en {opp.sellExchange}
              </div>
              <div className="space-y-1.5 text-slate-300">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 text-[10px] shrink-0">Merchant:</span>
                  <span className="font-medium text-slate-200 truncate">{opp.sellMerchant}</span>
                  {opp.sellMerchantPro && (
                    <span className="text-[8px] px-1 py-0.5 bg-amber-900/50 text-amber-300 rounded font-semibold shrink-0">PRO</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 text-[10px] shrink-0">Reputación:</span>
                  <div className="flex-1"><ReputationBar rate={opp.sellMerchantReputation} /></div>
                </div>
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="text-slate-500 shrink-0">Precio:</span>
                  <span className="text-amber-400 font-mono font-semibold">{fmtPrice(opp.sellPrice)} {fiat}</span>
                </div>
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="text-slate-500 shrink-0">Mín-Max:</span>
                  <span className="text-slate-300 font-mono">
                    {fmtAmount(opp.sellMinAmount)} - {fmtAmount(opp.sellMaxAmount)} {fiat}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="text-slate-500 shrink-0">Disponible:</span>
                  <span className="text-slate-300 font-mono">{opp.sellAvailableQty.toFixed(2)} {opp.asset}</span>
                </div>
                <div className="flex items-start gap-2 text-[10px]">
                  <span className="text-slate-500 shrink-0 pt-0.5">Métodos:</span>
                  <div className="flex flex-wrap gap-1">
                    {opp.sellPaymentMethods.length > 0 ? (
                      opp.sellPaymentMethods.slice(0, 5).map((m) => (
                        <span key={m} className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded">{m}</span>
                      ))
                    ) : (
                      <span className="text-slate-600 italic">—</span>
                    )}
                  </div>
                </div>
              </div>
              <a
                href={opp.sellDirectUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1 text-[11px] px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition font-medium"
              >
                <ExternalLink className="w-3 h-3" />
                Ir a vender
              </a>
            </div>
          </div>

          {/* Cálculo del profit */}
          <div className="bg-slate-900/70 border border-slate-700/40 rounded-lg p-3">
            <div className="text-[10px] uppercase text-purple-400 font-semibold mb-2 flex items-center gap-1.5">
              <Info className="w-3 h-3" />
              Cálculo del profit NETO
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 text-xs">
              <CalcItem label="Tamaño op." value={`${fmtAmount(opp.operationFiatAmount)} ${fiat}`} />
              <CalcItem label="Asset comprado" value={`${opp.operationAssetAmount.toFixed(3)} ${opp.asset}`} />
              <CalcItem label="Spread bruto" value={`+${opp.grossSpreadPct.toFixed(2)}%`} color="text-slate-200" />
              <CalcItem label="Fee retiro" value={`-${fmtAmount(opp.withdrawalFeeFiat)} ${fiat}`} color="text-red-400" />
              <CalcItem label="Profit NETO" value={`+${fmtAmount(opp.netProfitForOperation)} ${fiat}`} color="text-emerald-400" bold />
              <CalcItem label="Profit/1000" value={`+${opp.netProfitOn1000.toFixed(2)}`} color="text-emerald-400" />
            </div>
            {opp.commonPaymentMethod && (
              <div className="mt-2 pt-2 border-t border-slate-800 flex items-center gap-2 text-[10px] text-slate-400">
                <Shield className="w-3 h-3 text-blue-400" />
                Método de pago común: <b className="text-blue-300">{opp.commonPaymentMethod}</b>
                <span className="text-slate-600">· facilita el round-trip fiat</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Sub-componentes
// ============================================================
function Metric({ label, value, suffix, color }: {
  label: string; value: string; suffix?: string; color?: string;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[9px] text-slate-500 uppercase tracking-wide">{label}</div>
      <div className={`text-sm font-mono ${color || "text-slate-200"}`}>
        {value}{suffix && <span className="text-[10px] text-slate-500 ml-1">{suffix}</span>}
      </div>
    </div>
  );
}

function CalcItem({ label, value, color, bold }: {
  label: string; value: string; color?: string; bold?: boolean;
}) {
  return (
    <div className="bg-slate-950/50 rounded-lg p-2">
      <div className="text-[9px] text-slate-500 uppercase tracking-wide mb-0.5">{label}</div>
      <div className={`text-xs font-mono ${bold ? "font-bold" : ""} ${color || "text-slate-200"}`}>{value}</div>
    </div>
  );
}
