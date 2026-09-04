"use client";

import { useState, useEffect, useCallback } from "react";
import {
  TrendingUp, Loader2, ArrowRight, AlertTriangle, Check, X,
  RefreshCw, Globe2, Shield, Activity, ExternalLink, Info,
  Wallet, Coins, Award, Eye, AlertCircle, Sparkles,
} from "lucide-react";

// ============================================================
// P2PArbitrageView — Sección Arbitraje P2P dentro de Earn
// ============================================================
// Responde al requerimiento del usuario:
//   "dentro de Earts o Ear, crear una sección ahí de arbitraje P2P,
//    ya sabe que tiene que incluir Binance, Kraken, Bitvavo"
//   "el mercado P2P que coincida con los mismos números o las mismas
//    cantidades del momento de compra y de venta"
//
// Combina:
//   - Binance P2P (BUY + SELL) — el mayor mercado P2P de LATAM
//   - Kraken spot — referencia regulada
//   - Bitvavo spot — exchange holandés con liquidez EU
//   - Coinbase spot — referencia USA
//
// Muestra oportunidades de arbitraje entre advertisers P2P
// donde las cantidades (min-max) se cruzan — es decir,
// operaciones REALMENTE ejecutables.
// ============================================================

const ASSETS = [
  { id: "USDT", name: "USDT", icon: "💵" },
  { id: "USDC", name: "USDC", icon: "💵" },
  { id: "BTC", name: "BTC", icon: "₿" },
  { id: "ETH", name: "ETH", icon: "Ξ" },
];

const FIATS = [
  { id: "COP", name: "Peso Colombiano", flag: "🇨🇴" },
  { id: "MXN", name: "Peso Mexicano", flag: "🇲🇽" },
  { id: "ARS", name: "Peso Argentino", flag: "🇦🇷" },
  { id: "BRL", name: "Real Brasileño", flag: "🇧🇷" },
  { id: "PEN", name: "Sol Peruano", flag: "🇵🇪" },
  { id: "CLP", name: "Peso Chileno", flag: "🇨🇱" },
  { id: "VES", name: "Bolívar Venezolano", flag: "🇻🇪" },
  { id: "DOP", name: "Peso Dominicano", flag: "🇩🇴" },
  { id: "USD", name: "Dólar USA", flag: "🇺🇸" },
  { id: "EUR", name: "Euro", flag: "🇪🇺" },
];

interface BuySellOffer {
  provider: string;
  advertiser: string;
  asset: string;
  fiat: string;
  tradeType: "BUY" | "SELL";
  price: number;
  minAmount: number;
  maxAmount: number;
  available: number;
  paymentMethods: string[];
  tradeCount: number;
  completionRate?: number;
}

interface Opportunity {
  asset: string;
  fiat: string;
  buyAt: BuySellOffer;
  sellAt: BuySellOffer;
  matchedRange: { min: number; max: number; executable: boolean };
  spread: number;
  spreadPercent: number;
  estimatedProfit: number;
  estimatedRoiPercent: number;
  spotReference: { provider: string; price: number; note: string } | null;
  timestamp: number;
  warnings: string[];
}

interface ApiResponse {
  asset: string;
  fiat: string;
  opportunities: Opportunity[];
  buyOffers: BuySellOffer[];
  sellOffers: BuySellOffer[];
  spotRef: unknown;
  spotProviders: unknown[];
  providers: { id: string; name: string; role: string; status: string; note?: string }[];
  timestamp: number;
  error?: string;
}

function fmtPrice(n: number, decimals?: number): string {
  if (!n) return "—";
  const d = decimals ?? (n < 1 ? 6 : n < 100 ? 4 : 2);
  return n.toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: d > 2 ? 2 : 0 });
}

function fmtAmount(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}k`;
  return n.toFixed(0);
}

export default function P2PArbitrageView() {
  const [asset, setAsset] = useState("USDT");
  const [fiat, setFiat] = useState("COP");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/scanner/p2p-arbitrage?asset=${asset}&fiat=${fiat}`);
      const json = await res.json() as ApiResponse;
      if (!res.ok) {
        setError(json.error || "Error al escanear");
        return;
      }
      setData(json);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [asset, fiat]);

  useEffect(() => {
    load();
  }, [load]);

  // Auto-refresh cada 30s
  useEffect(() => {
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [load]);

  const opps = data?.opportunities || [];
  const buyOffers = data?.buyOffers || [];
  const sellOffers = data?.sellOffers || [];
  const providers = data?.providers || [];

  return (
    <div>
      {/* Header de la sección */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <Award className="w-5 h-5 text-purple-400" />
          Arbitraje P2P
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Comprar cripto P2P barato y vender más caro, ganando la diferencia.
          Solo muestra oportunidades donde las cantidades de compra y venta
          coinciden — operaciones realmente ejecutables.
        </p>
      </div>

      {/* Selector de asset y fiat */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] text-slate-400">Activo (lo que arbitraremos)</label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {ASSETS.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setAsset(a.id)}
                  className={`px-3 py-1.5 text-xs rounded-lg transition flex items-center gap-1 ${
                    asset === a.id
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  <span>{a.icon}</span>
                  {a.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[11px] text-slate-400">Moneda (fiat local)</label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {FIATS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFiat(f.id)}
                  className={`px-3 py-1.5 text-xs rounded-lg transition flex items-center gap-1 ${
                    fiat === f.id
                      ? "bg-blue-600 text-white"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  <span>{f.flag}</span>
                  {f.id}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Refresh + status bar */}
        <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 transition"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              {loading ? "Escaneando..." : "Refrescar"}
            </button>
            <span className="text-slate-600">·</span>
            <span className="flex items-center gap-1.5">
              <Activity className="w-3 h-3" />
              {data ? `Actualizado: ${new Date(data.timestamp).toLocaleTimeString()}` : "—"}
            </span>
            <span className="text-slate-600">·</span>
            <span>Auto-refresh cada 30s</span>
          </div>
          <div className="text-xs text-slate-500">
            Escaneando: {providers.map((p) => `${p.name} (${p.role})`).join(" · ") || "Binance P2P, Kraken, Bitvavo, Coinbase"}
          </div>
        </div>
      </div>

      {/* Providers activos */}
      {providers.length > 0 && (
        <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {providers.map((p) => {
            const online = p.status === "ONLINE";
            return (
              <div
                key={p.id}
                className={`p-2.5 rounded-lg border text-xs ${
                  online
                    ? "bg-emerald-950/30 border-emerald-800/50"
                    : "bg-slate-900/30 border-slate-800"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-slate-200">{p.name}</span>
                  <span className={`w-1.5 h-1.5 rounded-full ${online ? "bg-emerald-500" : "bg-slate-600"}`} />
                </div>
                <div className="text-[10px] text-slate-400">{p.role}</div>
                {p.note && <div className="text-[10px] text-slate-500 italic mt-0.5">{p.note}</div>}
              </div>
            );
          })}
        </div>
      )}

      {/* KPIs */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <KPI
            label="Oportunidades"
            value={String(opps.length)}
            sub={`${opps.filter((o) => o.matchedRange.executable).length} ejecutables`}
            color="text-purple-400"
          />
          <KPI
            label="Mejor ROI"
            value={opps.length > 0 ? `${opps[0].estimatedRoiPercent.toFixed(2)}%` : "—"}
            sub={opps.length > 0 ? `Spread ${opps[0].spreadPercent.toFixed(2)}%` : "Sin oportunidades"}
            color="text-emerald-400"
          />
          <KPI
            label="Ofertas BUY"
            value={String(buyOffers.length)}
            sub="Compradores de cripto"
            color="text-emerald-400"
          />
          <KPI
            label="Ofertas SELL"
            value={String(sellOffers.length)}
            sub="Vendedores de cripto"
            color="text-amber-400"
          />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 bg-red-950/30 border border-red-800/50 rounded-xl p-4 text-sm text-red-300 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      {/* Loading state */}
      {loading && !data && (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-purple-400 mb-3" />
          <p className="text-sm text-slate-300">Escaneando Binance P2P + Kraken + Bitvavo + Coinbase…</p>
          <p className="text-xs text-slate-500 mt-1">Compra + Venta + Matching de cantidades</p>
        </div>
      )}

      {/* Oportunidades detectadas */}
      {data && !loading && (
        <>
          {opps.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
              <AlertTriangle className="w-10 h-10 mx-auto text-slate-600 mb-3" />
              <p className="text-sm text-slate-300 font-medium">No se detectaron oportunidades de arbitraje</p>
              <p className="text-xs text-slate-500 mt-1">
                Esto puede deberse a:
                <br />
                • No hay suficientes ofertas P2P BUY/SELL para {asset}/{fiat}
                <br />
                • Los rangos de cantidad no se cruzan (no hay matching)
                <br />
                • El spread es muy bajo (&lt; 0.5%) para ser rentable
                <br />
                • Binance P2P está temporalmente bloqueando esta región
              </p>
              <button
                onClick={load}
                className="mt-4 text-xs px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition inline-flex items-center gap-1.5"
              >
                <RefreshCw className="w-3 h-3" /> Intentar de nuevo
              </button>
            </div>
          ) : (
            <>
              {/* Lista de oportunidades */}
              <div className="space-y-3 mb-6">
                <h3 className="text-xs uppercase tracking-wide text-slate-500 mb-2 flex items-center gap-2">
                  <Award className="w-3.5 h-3.5 text-purple-400" />
                  Oportunidades detectadas · {opps.length} encontradas (ordenadas por ROI)
                </h3>
                {opps.map((opp, i) => (
                  <OpportunityCard
                    key={`opp-${i}`}
                    opp={opp}
                    rank={i + 1}
                    expanded={expanded === i}
                    onToggle={() => setExpanded(expanded === i ? null : i)}
                  />
                ))}
              </div>

              {/* Tabla de ofertas BUY (compradores) y SELL (vendedores) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <OffersTable
                  title={`Ofertas BUY · ${asset}/${fiat}`}
                  icon={TrendingUp}
                  iconColor="text-emerald-400"
                  offers={buyOffers}
                  type="BUY"
                />
                <OffersTable
                  title={`Ofertas SELL · ${asset}/${fiat}`}
                  icon={TrendingUp}
                  iconColor="text-amber-400"
                  offers={sellOffers}
                  type="SELL"
                />
              </div>

              {/* Explicación */}
              <div className="mt-6 bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
                <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <Info className="w-3.5 h-3.5 text-purple-400" />
                  ¿Cómo funciona el arbitraje P2P?
                </h3>
                <ol className="text-[12px] text-slate-400 space-y-2 list-decimal pl-4">
                  <li>
                    El sistema escanea en paralelo las ofertas <b className="text-emerald-400">BUY</b> (anuncios de
                    vendedores que venden cripto a cambio de fiat) y <b className="text-amber-400">SELL</b> (anuncios de
                    compradores que compran cripto pagando fiat) en Binance P2P.
                  </li>
                  <li>
                    Para cada par (BUY, SELL) donde SELL {'>'} BUY, calcula el <b className="text-slate-200">spread</b> (ganancia
                    por unidad). Si el spread es {'>'} 0.5%, es candidato.
                  </li>
                  <li>
                    <b className="text-purple-400">Matching de cantidades:</b> calcula la intersección entre el rango
                    min-max del BUY y el rango min-max del SELL. Si hay intersección, la operación es ejecutable
                    (no podrías operar más de lo que ambos aceptan).
                  </li>
                  <li>
                    Muestra la ganancia estimada operando el monto máximo del rango matched, considerando
                    que compras al precio BUY y vendes al precio SELL.
                  </li>
                  <li>
                    Ordena por ROI descendente y muestra la referencia spot de Kraken, Bitvavo y Coinbase para que
                    veas si el P2P está por encima o por debajo del mercado spot global.
                  </li>
                </ol>
                <div className="mt-4 pt-4 border-t border-slate-800/50 text-[10px] text-amber-400 flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <div>
                    <b>Riesgos reales:</b> el precio P2P cambia entre que inicias la compra y la venta.
                    Los advertisers pueden cancelar. Puede haber demoras en la liberación del escrow.
                    El spread debe cubrir el tiempo que llevas la operación. El ROI mostrado es bruto,
                    sin contar posibles costos de transferencia entre métodos de pago.
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

// ============================================================
// KPI Component
// ============================================================
function KPI({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
      <div className="text-[10px] text-slate-500 uppercase">{label}</div>
      <div className={`text-xl font-bold ${color || "text-slate-100"}`}>{value}</div>
      {sub && <div className="text-[10px] text-slate-500">{sub}</div>}
    </div>
  );
}

// ============================================================
// Opportunity Card
// ============================================================
function OpportunityCard({
  opp, rank, expanded, onToggle,
}: {
  opp: Opportunity; rank: number; expanded: boolean; onToggle: () => void;
}) {
  const positive = opp.estimatedProfit > 0;
  const fiat = opp.fiat;

  return (
    <div className={`bg-slate-900 border rounded-xl p-4 ${positive ? "border-emerald-800/50" : "border-slate-800"}`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${positive ? "bg-emerald-950/50 text-emerald-400" : "bg-red-950/50 text-red-400"}`}>
            #{rank}
          </div>
          <div>
            <div className="text-sm font-medium text-slate-100 flex items-center gap-2 flex-wrap">
              <span className="text-emerald-400 font-semibold">Comprar a @{opp.buyAt.advertiser}</span>
              <ArrowRight className="w-3 h-3 text-slate-500" />
              <span className="text-amber-400 font-semibold">Vender a @{opp.sellAt.advertiser}</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {opp.asset}/{fiat} · Ambos en {opp.buyAt.provider}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className={`text-lg font-bold ${positive ? "text-emerald-400" : "text-red-400"}`}>
            +{opp.estimatedRoiPercent.toFixed(2)}%
          </div>
          <div className="text-[9px] text-slate-500 uppercase">ROI est.</div>
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        <div>
          <div className="text-[9px] text-slate-500 uppercase">Precio compra (BUY)</div>
          <div className="text-sm text-emerald-400 font-mono font-semibold">
            {fmtPrice(opp.buyAt.price)} {fiat}
          </div>
        </div>
        <div>
          <div className="text-[9px] text-slate-500 uppercase">Precio venta (SELL)</div>
          <div className="text-sm text-amber-400 font-mono font-semibold">
            {fmtPrice(opp.sellAt.price)} {fiat}
          </div>
        </div>
        <div>
          <div className="text-[9px] text-slate-500 uppercase">Spread</div>
          <div className={`text-sm font-mono ${positive ? "text-emerald-400" : "text-red-400"}`}>
            {opp.spreadPercent.toFixed(2)}%
          </div>
        </div>
        <div>
          <div className="text-[9px] text-slate-500 uppercase">Ganancia est.</div>
          <div className={`text-sm font-mono font-bold ${positive ? "text-emerald-400" : "text-red-400"}`}>
            +{fmtPrice(opp.estimatedProfit, 2)} {fiat}
          </div>
        </div>
      </div>

      {/* Matching de cantidades — la clave */}
      <div className="bg-slate-800/50 rounded-lg p-3 mb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[11px] font-semibold text-purple-400 flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5" />
            Matching de cantidades (rango ejecutable)
          </div>
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${opp.matchedRange.executable ? "bg-emerald-900/50 text-emerald-300" : "bg-red-900/50 text-red-300"}`}>
            {opp.matchedRange.executable ? "✓ Ejecutable" : "✗ No ejecutable"}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-[11px]">
          <div className="bg-slate-900/50 rounded p-2">
            <div className="text-slate-500 text-[10px] uppercase">BUY acepta</div>
            <div className="text-slate-300 font-mono">
              {fmtAmount(opp.buyAt.minAmount)} - {fmtAmount(opp.buyAt.maxAmount)} {fiat}
            </div>
          </div>
          <div className="bg-slate-900/50 rounded p-2">
            <div className="text-slate-500 text-[10px] uppercase">SELL acepta</div>
            <div className="text-slate-300 font-mono">
              {fmtAmount(opp.sellAt.minAmount)} - {fmtAmount(opp.sellAt.maxAmount)} {fiat}
            </div>
          </div>
          <div className={`rounded p-2 ${opp.matchedRange.executable ? "bg-emerald-950/40" : "bg-red-950/30"}`}>
            <div className="text-slate-500 text-[10px] uppercase">Rango matched</div>
            <div className={`font-mono font-bold ${opp.matchedRange.executable ? "text-emerald-300" : "text-red-300"}`}>
              {fmtAmount(opp.matchedRange.min)} - {fmtAmount(opp.matchedRange.max)} {fiat}
            </div>
          </div>
        </div>
      </div>

      {/* Spot reference */}
      {opp.spotReference && (
        <div className="bg-blue-950/30 border border-blue-900/50 rounded-lg p-2.5 mb-3 text-[11px] flex items-start gap-2">
          <Globe2 className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
          <div>
            <span className="text-slate-400">Referencia spot ({opp.spotReference.provider}):</span>{" "}
            <b className="text-blue-300 font-mono">{fmtPrice(opp.spotReference.price)} {fiat}</b>{" "}
            <span className="text-slate-500">· {opp.spotReference.note}</span>
          </div>
        </div>
      )}

      {/* Advertiser info */}
      <div className="grid grid-cols-2 gap-2 mb-3 text-[11px]">
        <div className="bg-slate-800/30 rounded p-2">
          <div className="text-emerald-400 text-[10px] uppercase mb-1">Comprador (@{opp.buyAt.advertiser})</div>
          <div className="text-slate-400 space-y-0.5">
            <div>Trades: <b className="text-slate-300">{opp.buyAt.tradeCount.toLocaleString()}</b></div>
            <div>Completion: <b className="text-slate-300">{opp.buyAt.completionRate ? `${(opp.buyAt.completionRate * 100).toFixed(0)}%` : "—"}</b></div>
            <div>Métodos: <b className="text-slate-300">{opp.buyAt.paymentMethods.join(", ") || "—"}</b></div>
          </div>
        </div>
        <div className="bg-slate-800/30 rounded p-2">
          <div className="text-amber-400 text-[10px] uppercase mb-1">Vendedor (@{opp.sellAt.advertiser})</div>
          <div className="text-slate-400 space-y-0.5">
            <div>Trades: <b className="text-slate-300">{opp.sellAt.tradeCount.toLocaleString()}</b></div>
            <div>Completion: <b className="text-slate-300">{opp.sellAt.completionRate ? `${(opp.sellAt.completionRate * 100).toFixed(0)}%` : "—"}</b></div>
            <div>Métodos: <b className="text-slate-300">{opp.sellAt.paymentMethods.join(", ") || "—"}</b></div>
          </div>
        </div>
      </div>

      {/* Toggle warnings */}
      <button
        onClick={onToggle}
        className="text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-1 transition"
      >
        {expanded ? <X className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
        {expanded ? "Ocultar advertencias" : `Ver ${opp.warnings.length} advertencias`}
      </button>

      {expanded && (
        <div className="mt-2 pt-2 border-t border-slate-800 space-y-1">
          {opp.warnings.map((w, i) => (
            <div key={i} className="text-[10px] text-amber-300 flex items-start gap-1.5">
              <span className="shrink-0">⚠</span>
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Offers Table (BUY or SELL)
// ============================================================
function OffersTable({
  title, icon: Icon, iconColor, offers, type,
}: {
  title: string;
  icon: React.ElementType;
  iconColor: string;
  offers: BuySellOffer[];
  type: "BUY" | "SELL";
}) {
  return (
    <div>
      <h3 className="text-xs uppercase tracking-wide text-slate-500 mb-2 flex items-center gap-2">
        <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
        {title} · {offers.length} ofertas
      </h3>
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-slate-800/50 text-[9px] uppercase text-slate-500 font-semibold">
          <div className="col-span-4">Advertiser</div>
          <div className="col-span-2 text-right">Precio</div>
          <div className="col-span-3 text-right">Límites</div>
          <div className="col-span-2 text-right">Trades</div>
          <div className="col-span-1 text-right">Disp.</div>
        </div>
        {offers.slice(0, 10).map((o, i) => (
          <div key={`${type}-${o.advertiser}-${i}`} className="grid grid-cols-12 gap-2 px-3 py-2.5 border-t border-slate-800 hover:bg-slate-800/30 transition text-[11px]">
            <div className="col-span-4 flex items-center gap-2 min-w-0">
              <div className={`w-6 h-6 rounded-full ${type === "BUY" ? "bg-emerald-900/50" : "bg-amber-900/50"} flex items-center justify-center text-[10px] font-bold text-white shrink-0`}>
                {o.advertiser.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-slate-200 font-medium truncate">@{o.advertiser}</div>
                <div className="text-[9px] text-slate-500 truncate">{o.paymentMethods.slice(0, 2).join(", ")}</div>
              </div>
            </div>
            <div className={`col-span-2 text-right font-mono font-bold ${type === "BUY" ? "text-emerald-400" : "text-amber-400"}`}>
              {fmtPrice(o.price)}
            </div>
            <div className="col-span-3 text-right text-slate-400 font-mono">
              {fmtAmount(o.minAmount)} - {fmtAmount(o.maxAmount)}
              <div className="text-[9px] text-slate-500">{o.fiat}</div>
            </div>
            <div className="col-span-2 text-right text-slate-300 font-mono">
              {o.tradeCount > 0 ? o.tradeCount.toLocaleString() : "—"}
              {o.completionRate !== undefined && o.completionRate >= 0.95 && (
                <div className="text-[9px] text-emerald-400">✓ {(o.completionRate * 100).toFixed(0)}%</div>
              )}
            </div>
            <div className="col-span-1 text-right text-slate-500 font-mono text-[10px]">
              {o.available > 0 ? fmtAmount(o.available) : "—"}
            </div>
          </div>
        ))}
        {offers.length === 0 && (
          <div className="px-3 py-6 text-center text-xs text-slate-500">
            No hay ofertas {type} disponibles en este momento.
          </div>
        )}
      </div>
    </div>
  );
}
