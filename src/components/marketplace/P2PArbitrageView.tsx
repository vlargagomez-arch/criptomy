"use client";

import { useState, useEffect, useCallback } from "react";
import {
  TrendingUp, Loader2, ArrowRight, AlertTriangle, Check, X,
  RefreshCw, Globe2, Shield, Activity, ExternalLink, Info,
  Wallet, Coins, Award, Eye, AlertCircle, Sparkles, Zap, UserCog,
} from "lucide-react";
import { scanAllP2PFromBrowser, type P2PProviderResult as ClientP2PResult } from "@/lib/p2p-arbitrage/client-p2p";

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
  rank?: number;
  buyAt: BuySellOffer;
  sellAt: BuySellOffer;
  matchedRange: { min: number; max: number; executable: boolean };
  type?: "INTRA-EXCHANGE" | "CROSS-EXCHANGE";
  crossExchange?: boolean;
  operationSize?: number;
  // v1 fields (legacy)
  spread?: number;
  spreadPercent?: number;
  estimatedProfit?: number;
  estimatedRoiPercent?: number;
  // v2 fields (nuevo algoritmo)
  grossSpread?: number;
  grossSpreadPercent?: number;
  withdrawalFee?: number;
  withdrawalFeeFiat?: number;
  netProfit?: number;
  netSpreadPercent?: number;
  unitsBought?: number;
  grossRevenue?: number;
  grossProfit?: number;
  spotReference: { provider: string; price: number; note: string } | null;
  timestamp: number;
  warnings: string[];
}

interface P2PProvider {
  providerId: string;
  providerName: string;
  offers: BuySellOffer[];
  status: string; // "ONLINE" | "ERROR" | "DISABLED"
  error?: string;
  latencyMs?: number;
  viaProxy?: boolean; // true si la llamada fue vía Cloudflare Worker proxy
}

interface ApiStats {
  totalBuyOffers: number;
  totalSellOffers: number;
  afterReputationFilterBuy: number;
  afterReputationFilterSell: number;
  topNBuy: number;
  topNSell: number;
  crossMatched: number;
  afterNetSpreadFilter: number;
  finalOpportunities: number;
}

interface ApiResponse {
  asset: string;
  fiat: string;
  opportunities: Opportunity[];
  buyOffers: BuySellOffer[];
  sellOffers: BuySellOffer[];
  filteredBuy?: BuySellOffer[];
  filteredSell?: BuySellOffer[];
  spotRef: unknown;
  spotProviders: unknown[];
  p2pProviders?: P2PProvider[];
  stats?: ApiStats;
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

  // Client-side fetch state — para exchanges bloqueados desde server
  const [clientLoading, setClientLoading] = useState(false);
  const [clientResults, setClientResults] = useState<ClientP2PResult[]>([]);
  const [clientError, setClientError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Si hay ofertas client-side, las mandamos vía POST para que el engine
      // las considere en el cross-match. Si no, GET simple.
      const clientBuyOffers = clientResults.filter((p) => p.offers.length > 0 && p.offers[0]?.tradeType === "BUY").flatMap((p) => p.offers);
      const clientSellOffers = clientResults.filter((p) => p.offers.length > 0 && p.offers[0]?.tradeType === "SELL").flatMap((p) => p.offers);

      let res: Response;
      if (clientBuyOffers.length > 0 || clientSellOffers.length > 0) {
        res = await fetch(`/api/scanner/p2p-arbitrage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            asset, fiat,
            clientBuyOffers,
            clientSellOffers,
            withdrawalNetwork: "TRC20",
          }),
        });
      } else {
        res = await fetch(`/api/scanner/p2p-arbitrage?asset=${asset}&fiat=${fiat}`);
      }
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
  }, [asset, fiat, clientResults]);

  useEffect(() => {
    load();
  }, [load]);

  // Auto-refresh cada 30s
  useEffect(() => {
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [load]);

  // ============================================================
  // CLIENT-SIDE FETCH — para exchanges bloqueados desde server
  // (OKX, HTX, KuCoin, Bitget) que el navegador del usuario SÍ
  // puede acceder.
  // ============================================================
  const loadClientSide = useCallback(async (tradeType: "BUY" | "SELL") => {
    setClientLoading(true);
    setClientError(null);
    try {
      const results = await scanAllP2PFromBrowser({ asset, fiat, tradeType });
      setClientResults((prev) => {
        // Merge: actualizar solo los que vienen del fetch actual
        const others = prev.filter((p) => {
          const tradeTypeOfNew = results.find((r) => r.providerId === p.providerId);
          return !tradeTypeOfNew || results.find((r) => r.providerId === p.providerId)?.offers.length === 0 && p.offers.length > 0;
        });
        // Remove providers that match current results
        const newIds = results.map((r) => r.providerId);
        const keptOthers = prev.filter((p) => !newIds.includes(p.providerId));
        return [...keptOthers, ...results];
      });
    } catch (e) {
      setClientError((e as Error).message);
    } finally {
      setClientLoading(false);
    }
  }, [asset, fiat]);

  // Extraer ofertas combinadas (server + client)
  const serverBuyOffers = data?.buyOffers || [];
  const serverSellOffers = data?.sellOffers || [];
  const clientBuyOffers = clientResults
    .filter((p) => p.offers.length > 0)
    .flatMap((p) => p.offers);
  const allBuyOffers = [...serverBuyOffers, ...clientBuyOffers];
  const allSellOffers = clientResults.length > 0
    ? [...serverSellOffers, ...clientResults.filter((p) => p.offers.length > 0).flatMap((p) => p.offers)]
    : serverSellOffers;

  const opps = data?.opportunities || [];
  const buyOffers = allBuyOffers;
  const sellOffers = allSellOffers;
  const p2pProviders = data?.p2pProviders || [];
  const onlineProviders = p2pProviders.filter((p) => p.status === "ONLINE");
  const disabledProviders = p2pProviders.filter((p) => p.status !== "ONLINE");

  // Para exchanges bloqueados en server, mostrar estado del client fetch
  const clientProviderStatus = (providerId: string): { status?: string; offers?: number; error?: string } => {
    const c = clientResults.find((p) => p.providerId === providerId);
    if (c) return { status: c.status, offers: c.offers.length, error: c.error };
    return {};
  };

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
            Escaneando: <b className="text-emerald-400">{onlineProviders.length}</b> P2P online + <b className="text-amber-400">{disabledProviders.length}</b> bloqueados + Kraken/Bitvavo/Coinbase spot
          </div>
        </div>
      </div>

      {/* P2P Providers — grid detallado mostrando TODOS los exchanges intentados */}
      {p2pProviders.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xs uppercase tracking-wide text-slate-500 mb-2 flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-purple-400" />
            Exchanges P2P escaneados · {onlineProviders.length} online + {disabledProviders.length} bloqueados
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {p2pProviders.map((p) => {
              const online = p.status === "ONLINE";
              const cs = clientProviderStatus(p.providerId);
              const clientOnline = cs.status === "ONLINE";
              const clientOffers = cs.offers || 0;
              // Show as "online" if either server OR client succeeded
              const effectivelyOnline = online || clientOnline;
              const viaProxy = p.viaProxy === true;
              return (
                <div
                  key={p.providerId}
                  className={`p-3 rounded-lg border text-xs ${
                    effectivelyOnline
                      ? "bg-emerald-950/30 border-emerald-800/50"
                      : "bg-amber-950/20 border-amber-800/30"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-slate-200">{p.providerName}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                      effectivelyOnline
                        ? "bg-emerald-600/30 text-emerald-300"
                        : "bg-amber-600/30 text-amber-300"
                    }`}>
                      {effectivelyOnline ? "🟢 ONLINE" : "🔴 BLOQUEADO"}
                    </span>
                  </div>
                  {effectivelyOnline ? (
                    <div className="text-[10px] text-slate-400">
                      <div>{(p.offers?.length || 0) + clientOffers} ofertas encontradas</div>
                      {online ? (
                        <div className="text-slate-500">
                          {viaProxy ? "☁️ Vía Cloudflare Worker proxy" : "Vía server"} · Latencia: {p.latencyMs || 0}ms
                        </div>
                      ) : (
                        <div className="text-emerald-500/80">Vía tu navegador · {clientOffers} ofertas</div>
                      )}
                    </div>
                  ) : (
                    <div className="text-[10px] text-amber-400/80 italic">
                      {p.error || "No disponible"}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Banner: Configurar Cloudflare Worker proxy */}
          {disabledProviders.length > 0 && (
            <div className="mt-3 p-3 bg-purple-950/30 border border-purple-700/40 rounded-lg">
              <div className="text-xs text-purple-200 font-medium flex items-center gap-1.5 mb-1">
                <Zap className="w-3.5 h-3.5 text-purple-400" />
                Solución: activar TODOS los exchanges bloqueados con Cloudflare Worker proxy (gratis, 5 min)
              </div>
              <div className="text-[10px] text-slate-400 mb-2">
                Los exchanges P2P (OKX, MEXC, KuCoin, Bitget, Gate.io, HTX) bloquean llamadas desde servidores cloud (Vercel).
                Cloudflare Workers corren en la red de Cloudflare cuyas IPs NO están bloqueadas — solución definitiva.
                Una vez configurado, todos los providers pasan a ONLINE.
              </div>
              <div className="text-[10px] text-slate-400 mb-2">
                <b className="text-slate-300">Paso 1:</b> Crea un Worker gratis en dash.cloudflare.com → Workers & Pages → Create Worker<br/>
                <b className="text-slate-300">Paso 2:</b> Pega el código de <code className="text-emerald-400">docs/cloudflare-p2p-proxy/worker.js</code> y deploy<br/>
                <b className="text-slate-300">Paso 3:</b> Copia la URL del Worker<br/>
                <b className="text-slate-300">Paso 4:</b> En Vercel → Settings → Environment Variables, agrega <code className="text-emerald-400">P2P_PROXY_URL</code> con esa URL<br/>
                <b className="text-slate-300">Paso 5:</b> Redeploy en Vercel — todos los exchanges se activan automáticamente
              </div>
              <a
                href="https://dash.cloudflare.com/?to=/:account/workers"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition"
              >
                <ExternalLink className="w-3 h-3" />
                Crear Worker en Cloudflare
              </a>
              <span className="ml-2 text-[10px] text-slate-500">
                Ver docs/cloudflare-p2p-proxy/README.md para guía paso a paso
              </span>
            </div>
          )}

          {/* Botón: Escanear desde el navegador para exchanges bloqueados */}
          {disabledProviders.length > 0 && (
            <div className="mt-3 p-3 bg-slate-900/70 border border-purple-700/30 rounded-lg">
              <div className="flex items-start gap-2 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-slate-200 font-medium flex items-center gap-1.5 mb-1">
                    <UserCog className="w-3.5 h-3.5 text-purple-400" />
                    Alternativa: escanear desde el navegador (sin proxy)
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Tu navegador SÍ puede acceder a esos exchanges (tu IP residencial no está bloqueada).
                    Click en los botones abajo y tu navegador hará el fetch directo.
                    Primero visita el sitio del exchange en otra pestaña para que se seteen las cookies.
                  </div>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  onClick={() => loadClientSide("BUY")}
                  disabled={clientLoading}
                  className="text-xs px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg transition flex items-center gap-1.5"
                >
                  {clientLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                  Escanear BUY desde mi navegador
                </button>
                <button
                  onClick={() => loadClientSide("SELL")}
                  disabled={clientLoading}
                  className="text-xs px-3 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-lg transition flex items-center gap-1.5"
                >
                  {clientLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                  Escanear SELL desde mi navegador
                </button>
              </div>
              {clientError && (
                <div className="mt-2 text-[10px] text-red-400 bg-red-950/30 p-2 rounded">
                  Error: {clientError}
                </div>
              )}
              <div className="mt-2 text-[10px] text-slate-500 flex items-center gap-1 flex-wrap">
                <span>Visita antes para setear cookies:</span>
                {disabledProviders.map((p) => {
                  const url = p.providerId === "okx-p2p" ? "https://www.okx.com/p2p"
                    : p.providerId === "htx-p2p" ? "https://www.htx.com/p2p"
                    : p.providerId === "kucoin-p2p" ? "https://www.kucoin.com/p2p"
                    : p.providerId === "bitget-p2p" ? "https://www.bitget.com/p2p"
                    : p.providerId === "gate-p2p" ? "https://www.gate.com/p2p"
                    : "#";
                  return (
                    <a
                      key={p.providerId}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-400 hover:text-emerald-300 underline"
                    >
                      {p.providerName}
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {/* Info explicativa */}
          <div className="mt-2 text-[10px] text-slate-500 bg-slate-900/50 border border-slate-800/50 rounded-lg p-2.5">
            <Info className="w-3 h-3 inline mr-1 text-purple-400" />
            <b className="text-slate-400">¿Por qué algunos exchanges están bloqueados desde server?</b> La mayoría de los exchanges P2P
            (OKX, HTX, KuCoin, Bitget, Gate.io) usan APIs internas no documentadas que bloquean llamadas
            desde servidores cloud (Vercel) mediante Cloudflare/Akamai. <b className="text-slate-400">Binance P2P</b> y <b className="text-slate-400">Bybit P2P</b> SÍ funcionan desde server.
            Para OKX, HTX, KuCoin y Bitget, usa el botón "Escanear desde mi navegador" arriba — tu IP no está bloqueada y podrás ver sus ofertas.
          </div>
        </div>
      )}

      {/* KPIs */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <KPI
            label="Oportunidades"
            value={String(opps.length)}
            sub={data.stats ? `de ${data.stats.crossMatched} combinaciones` : `${opps.filter((o) => o.matchedRange.executable).length} ejecutables`}
            color="text-purple-400"
          />
          <KPI
            label="Mejor spread neto"
            value={opps.length > 0 ? `${(opps[0].netSpreadPercent ?? opps[0].estimatedRoiPercent ?? 0).toFixed(2)}%` : "—"}
            sub={opps.length > 0 ? `Profit ${fmtPrice(opps[0].netProfit ?? opps[0].estimatedProfit ?? 0, 2)} ${fiat}` : "Sin oportunidades"}
            color="text-emerald-400"
          />
          <KPI
            label="Ofertas BUY"
            value={data.stats ? `${data.stats.afterReputationFilterBuy}` : String(buyOffers.length)}
            sub={data.stats ? `de ${data.stats.totalBuyOffers} (filtro ≥80%)` : "Compradores"}
            color="text-emerald-400"
          />
          <KPI
            label="Ofertas SELL"
            value={data.stats ? `${data.stats.afterReputationFilterSell}` : String(sellOffers.length)}
            sub={data.stats ? `de ${data.stats.totalSellOffers} (filtro ≥80%)` : "Vendedores"}
            color="text-amber-400"
          />
        </div>
      )}

      {/* Algoritmo pipeline — visualización del flujo */}
      {data?.stats && (
        <div className="mb-6 bg-slate-900/50 border border-slate-800 rounded-xl p-3">
          <div className="text-[10px] uppercase text-slate-500 mb-2 flex items-center gap-1.5">
            <Activity className="w-3 h-3 text-purple-400" />
            Pipeline del algoritmo (v2)
          </div>
          <div className="flex items-center gap-1 text-[10px] overflow-x-auto">
            <PipelineStep label="Fetch" value={`${data.stats.totalBuyOffers + data.stats.totalSellOffers}`} desc="ofertas 4 exchanges" color="text-blue-400" />
            <ArrowRight className="w-3 h-3 text-slate-600 shrink-0" />
            <PipelineStep label="Filtro reputación ≥80%" value={`${data.stats.afterReputationFilterBuy + data.stats.afterReputationFilterSell}`} desc="merchant válidos" color="text-cyan-400" />
            <ArrowRight className="w-3 h-3 text-slate-600 shrink-0" />
            <PipelineStep label="Top 12×12" value={String(data.stats.crossMatched)} desc="combinaciones" color="text-purple-400" />
            <ArrowRight className="w-3 h-3 text-slate-600 shrink-0" />
            <PipelineStep label="NetSpread ≥0.1%" value={String(data.stats.afterNetSpreadFilter)} desc="filtradas" color="text-amber-400" />
            <ArrowRight className="w-3 h-3 text-slate-600 shrink-0" />
            <PipelineStep label="Top 30" value={String(data.stats.finalOpportunities)} desc="mejores" color="text-emerald-400" />
          </div>
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
                    El sistema escanea en paralelo las ofertas <b className="text-emerald-400">BUY</b> y
                    <b className="text-amber-400">SELL</b> en <b className="text-slate-200">TODOS</b> los
                    exchanges P2P disponibles (Binance, Bybit, OKX, HTX, KuCoin, Bitget, Gate.io — los que
                    respondan). Solo Binance P2P responde de forma confiable desde el server (los demás
                    están bloqueados por WAF).
                  </li>
                  <li>
                    Para cada par (BUY, SELL) donde SELL {'>'} BUY, calcula el <b className="text-slate-200">spread</b> (ganancia
                    por unidad). Si el spread es {'>'} 0.5% (intra-exchange) o {'>'} 1% (cross-exchange),
                    es candidato.
                  </li>
                  <li>
                    <b className="text-blue-400">INTRA-exchange:</b> comprador y vendedor están en el mismo exchange
                    (ej. Binance). Más simple, no hay transfer entre exchanges.
                  </li>
                  <li>
                    <b className="text-purple-400">CROSS-exchange:</b> comprador en un exchange, vendedor en otro.
                    Requiere transferir el cripto entre exchanges (5-30 min + fees de retiro/deposito).
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
                    sin contar posibles costos de transferencia entre métodos de pago. Para cross-exchange,
                    considera fees de retiro + deposito + el tiempo de la transferencia on-chain.
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
// Pipeline Step — visualización del flujo del algoritmo
// ============================================================
function PipelineStep({ label, value, desc, color }: { label: string; value: string; desc: string; color: string }) {
  return (
    <div className="shrink-0 px-2.5 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg min-w-[100px]">
      <div className="text-[9px] text-slate-500 uppercase mb-0.5">{label}</div>
      <div className={`text-base font-bold ${color}`}>{value}</div>
      <div className="text-[9px] text-slate-500">{desc}</div>
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
  // v2 campos (preferidos) o fallback a v1
  const netProfit = opp.netProfit ?? opp.estimatedProfit ?? 0;
  const netSpreadPct = opp.netSpreadPercent ?? opp.estimatedRoiPercent ?? 0;
  const grossSpreadPct = opp.grossSpreadPercent ?? opp.spreadPercent ?? 0;
  const grossSpread = opp.grossSpread ?? opp.spread ?? 0;
  const operationSize = opp.operationSize ?? opp.matchedRange.max ?? 0;
  const withdrawalFeeFiat = opp.withdrawalFeeFiat ?? 0;
  const withdrawalFeeAsset = opp.withdrawalFee ?? 0;
  const unitsBought = opp.unitsBought ?? (operationSize > 0 && opp.buyAt.price > 0 ? operationSize / opp.buyAt.price : 0);
  const grossRevenue = opp.grossRevenue ?? (unitsBought * opp.sellAt.price);
  const grossProfit = opp.grossProfit ?? (grossRevenue - operationSize);

  const positive = netProfit > 0;
  const fiat = opp.fiat;
  const isCross = opp.type === "CROSS-EXCHANGE" || opp.crossExchange;
  const sameProvider = opp.buyAt.provider === opp.sellAt.provider;

  return (
    <div className={`bg-slate-900 border rounded-xl p-4 ${positive ? (isCross ? "border-purple-800/50" : "border-emerald-800/50") : "border-slate-800"}`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${positive ? "bg-emerald-950/50 text-emerald-400" : "bg-red-950/50 text-red-400"}`}>
            #{rank}
          </div>
          <div>
            <div className="text-sm font-medium text-slate-100 flex items-center gap-2 flex-wrap">
              <span className="text-emerald-400 font-semibold">Comprar a @{opp.buyAt.advertiser}</span>
              <span className="text-[9px] px-1.5 py-0.5 bg-emerald-900/40 text-emerald-300 rounded">{opp.buyAt.provider}</span>
              <ArrowRight className="w-3 h-3 text-slate-500" />
              <span className="text-amber-400 font-semibold">Vender a @{opp.sellAt.advertiser}</span>
              <span className="text-[9px] px-1.5 py-0.5 bg-amber-900/40 text-amber-300 rounded">{opp.sellAt.provider}</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
              <span>{opp.asset}/{fiat}</span>
              {isCross ? (
                <span className="text-[9px] px-1.5 py-0.5 bg-purple-900/50 text-purple-300 rounded font-semibold">CROSS-EXCHANGE</span>
              ) : (
                <span className="text-[9px] px-1.5 py-0.5 bg-blue-900/50 text-blue-300 rounded font-semibold">INTRA-EXCHANGE</span>
              )}
              {sameProvider && <span className="text-slate-500">(mismo exchange)</span>}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className={`text-lg font-bold ${positive ? "text-emerald-400" : "text-red-400"}`}>
            +{netSpreadPct.toFixed(2)}%
          </div>
          <div className="text-[9px] text-slate-500 uppercase">Spread neto</div>
        </div>
      </div>

      {/* Métricas principales — v2 con desglose */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        <div>
          <div className="text-[9px] text-slate-500 uppercase">Precio BUY</div>
          <div className="text-sm text-emerald-400 font-mono font-semibold">
            {fmtPrice(opp.buyAt.price)} {fiat}
          </div>
        </div>
        <div>
          <div className="text-[9px] text-slate-500 uppercase">Precio SELL</div>
          <div className="text-sm text-amber-400 font-mono font-semibold">
            {fmtPrice(opp.sellAt.price)} {fiat}
          </div>
        </div>
        <div>
          <div className="text-[9px] text-slate-500 uppercase">Spread bruto</div>
          <div className="text-sm text-slate-300 font-mono">
            {grossSpreadPct.toFixed(2)}%
            <div className="text-[9px] text-slate-500">{fmtPrice(grossSpread, 2)} {fiat}/u</div>
          </div>
        </div>
        <div>
          <div className="text-[9px] text-slate-500 uppercase">Profit neto</div>
          <div className={`text-sm font-mono font-bold ${positive ? "text-emerald-400" : "text-red-400"}`}>
            +{fmtPrice(netProfit, 2)} {fiat}
          </div>
        </div>
      </div>

      {/* Cálculo detallado del profit (v2) */}
      <div className="bg-slate-950/50 border border-slate-800/50 rounded-lg p-3 mb-3 text-[11px]">
        <div className="text-[10px] uppercase text-purple-400 mb-2 flex items-center gap-1.5">
          <TrendingUp className="w-3 h-3" />
          Cálculo del profit neto (algoritmo v2)
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono">
          <div>
            <div className="text-slate-500 text-[10px]">Tamaño op.</div>
            <div className="text-slate-200">{fmtAmount(operationSize)} {fiat}</div>
          </div>
          <div>
            <div className="text-slate-500 text-[10px]">Unidades compradas</div>
            <div className="text-slate-200">{unitsBought.toFixed(4)} {opp.asset}</div>
          </div>
          <div>
            <div className="text-slate-500 text-[10px]">Revenue bruto</div>
            <div className="text-amber-300">{fmtPrice(grossRevenue, 2)} {fiat}</div>
          </div>
          <div>
            <div className="text-slate-500 text-[10px]">Profit bruto</div>
            <div className="text-emerald-300">+{fmtPrice(grossProfit, 2)} {fiat}</div>
          </div>
          <div>
            <div className="text-slate-500 text-[10px]">Fee retiro {isCross ? "(TRC20)" : ""}</div>
            <div className="text-red-400">
              {isCross ? `−${fmtPrice(withdrawalFeeFiat, 2)} ${fiat}` : "—"}
              {isCross && <div className="text-[9px] text-slate-500">{withdrawalFeeAsset} {opp.asset}</div>}
            </div>
          </div>
          <div>
            <div className="text-slate-500 text-[10px]">Profit NETO</div>
            <div className={`font-bold ${positive ? "text-emerald-400" : "text-red-400"}`}>
              +{fmtPrice(netProfit, 2)} {fiat}
            </div>
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
          <div className="col-span-4">Advertiser / Exchange</div>
          <div className="col-span-2 text-right">Precio</div>
          <div className="col-span-3 text-right">Límites</div>
          <div className="col-span-2 text-right">Trades</div>
          <div className="col-span-1 text-right">Disp.</div>
        </div>
        {offers.slice(0, 15).map((o, i) => (
          <div key={`${type}-${o.provider}-${o.advertiser}-${i}`} className="grid grid-cols-12 gap-2 px-3 py-2.5 border-t border-slate-800 hover:bg-slate-800/30 transition text-[11px]">
            <div className="col-span-4 flex items-center gap-2 min-w-0">
              <div className={`w-6 h-6 rounded-full ${type === "BUY" ? "bg-emerald-900/50" : "bg-amber-900/50"} flex items-center justify-center text-[10px] font-bold text-white shrink-0`}>
                {o.advertiser.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-slate-200 font-medium truncate">@{o.advertiser}</div>
                <div className="text-[9px] text-slate-500 truncate">
                  <span className="text-purple-400">{o.provider}</span>
                  {o.paymentMethods.length > 0 && (
                    <> · {o.paymentMethods.slice(0, 2).join(", ")}</>
                  )}
                </div>
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
