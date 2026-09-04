"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2, RefreshCw, ExternalLink, Award, Shield, ChevronDown, ChevronUp,
  TrendingUp, TrendingDown, Zap, AlertCircle, Info,
} from "lucide-react";
import { COUNTRIES, SUPPORTED_ASSETS, type CountryConfig } from "@/lib/api-clients/catalog";
import type { ArbitrageOpportunity, ArbitrageResponse } from "@/lib/p2p-arbitrage/engine-v3";

// ============================================================
// P2PArbitragePanel — Panel según spec
// ============================================================
// - Selector país (6 opciones: CO, AR, BR, MX, EU, US)
// - Selector asset (USDT, BTC, ETH, BNB, SOL, USDC)
// - Selector método de pago (específico por país)
// - Auto-refresh cada 20 segundos
// - Tabla de oportunidades con fila expandible
// - URLs directas a cada exchange
// - Indicador de merchants filtrados por reputación
// - Badges por exchange con color e inicial
// ============================================================

// Colores por exchange
const EXCHANGE_STYLES: Record<string, { bg: string; text: string; initial: string }> = {
  Binance: { bg: "bg-amber-500", text: "text-black", initial: "B" },
  OKX: { bg: "bg-zinc-700", text: "text-zinc-100", initial: "O" },
  Bybit: { bg: "bg-orange-500", text: "text-white", initial: "Y" },
  Kraken: { bg: "bg-purple-500", text: "text-white", initial: "K" },
};

function ExchangeBadge({ exchange, size = "sm" }: { exchange: string; size?: "sm" | "md" }) {
  const style = EXCHANGE_STYLES[exchange] || { bg: "bg-slate-700", text: "text-slate-100", initial: "?" };
  const sizeClass = size === "md" ? "w-7 h-7 text-sm" : "w-5 h-5 text-[10px]";
  return (
    <span
      className={`inline-flex items-center justify-center rounded font-bold ${style.bg} ${style.text} ${sizeClass}`}
      title={exchange}
    >
      {style.initial}
    </span>
  );
}

function ReputationBar({ rate }: { rate: number }) {
  // rate 0-100
  const color = rate >= 95 ? "bg-emerald-500" : rate >= 80 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-12 h-1.5 bg-slate-800 rounded overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${rate}%` }} />
      </div>
      <span className="text-[9px] text-slate-400 font-mono">{rate.toFixed(1)}%</span>
    </div>
  );
}

function fmtPrice(n: number, fiat: string): string {
  if (!n) return "—";
  const decimals = n < 100 ? 2 : 0;
  return `${n.toLocaleString(undefined, { maximumFractionDigits: decimals })} ${fiat}`;
}

function fmtAmount(n: number, fiat: string): string {
  if (!n) return "—";
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M ${fiat}`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}k ${fiat}`;
  return `${n.toFixed(0)} ${fiat}`;
}

export default function P2PArbitragePanel() {
  const [country, setCountry] = useState<CountryConfig>(COUNTRIES[0]); // Colombia
  const [asset, setAsset] = useState("USDT");
  const [payment, setPayment] = useState<string>(""); // "" = all
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ArbitrageResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        asset,
        fiat: country.fiat,
        rows: "15",
        exchanges: "binance,okx,bybit,kraken",
        minReputation: "80",
        minNetSpread: "0.1",
      });
      if (payment) params.set("payment", payment);
      const res = await fetch(`/api/arbitrage/p2p?${params.toString()}`);
      const json = (await res.json()) as ArbitrageResponse;
      if (!res.ok || !json.success) {
        setError(json.error || `HTTP ${res.status}`);
        return;
      }
      setData(json);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [asset, country, payment]);

  useEffect(() => {
    load();
  }, [load]);

  // Auto-refresh cada 20 segundos
  useEffect(() => {
    const interval = setInterval(load, 20_000);
    return () => clearInterval(interval);
  }, [load]);

  // Reset payment cuando cambia el país
  useEffect(() => {
    setPayment("");
  }, [country]);

  const opportunities = data?.opportunities || [];
  const quotes = data?.quotes || {};
  const reputation = data?.reputation;

  return (
    <div>
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <Award className="w-5 h-5 text-amber-400" />
          Arbitraje P2P Real · 4 Exchanges en vivo
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Binance P2P · OKX P2P · Bybit P2P · Kraken Spot — APIs 100% públicas,
          sin API key. Filtro anti-estafa (reputación ≥ 80%). Profit NETO después de fees de retiro.
        </p>
      </div>

      {/* Selectores */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* País */}
          <div>
            <label className="text-[11px] text-slate-400">País</label>
            <select
              value={country.code}
              onChange={(e) => {
                const c = COUNTRIES.find((x) => x.code === e.target.value);
                if (c) setCountry(c);
              }}
              className="mt-1 w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 text-sm"
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.name} ({c.fiat})
                </option>
              ))}
            </select>
          </div>

          {/* Asset */}
          <div>
            <label className="text-[11px] text-slate-400">Asset</label>
            <select
              value={asset}
              onChange={(e) => setAsset(e.target.value)}
              className="mt-1 w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 text-sm"
            >
              {SUPPORTED_ASSETS.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          {/* Método de pago */}
          <div>
            <label className="text-[11px] text-slate-400">Método de pago</label>
            <select
              value={payment}
              onChange={(e) => setPayment(e.target.value)}
              className="mt-1 w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 text-sm"
            >
              <option value="">Todos</option>
              {country.paymentMethods.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Status bar */}
        <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between gap-3 flex-wrap text-xs">
          <div className="flex items-center gap-3 text-slate-400">
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
              <Zap className="w-3 h-3 text-amber-400" />
              {data ? `Actualizado: ${new Date(data.timestamp).toLocaleTimeString()}` : "—"}
            </span>
            <span className="text-slate-600">·</span>
            <span>Auto-refresh cada 20s</span>
          </div>

          {/* Quotes por exchange */}
          {Object.keys(quotes).length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {Object.entries(quotes).map(([ex, q]) => (
                <div key={ex} className="flex items-center gap-1 text-[10px]">
                  <ExchangeBadge exchange={ex} />
                  <span className="text-emerald-400">↑{q.buy}</span>
                  <span className="text-amber-400">↓{q.sell}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Indicador de merchants filtrados por reputación */}
      {reputation && (
        <div className="mb-3 px-3 py-2 bg-slate-900/50 border border-slate-800/50 rounded-lg text-xs text-slate-400 flex items-center gap-2">
          <Shield className="w-3.5 h-3.5 text-emerald-400" />
          <span>Filtro anti-estafa activo: reputación mínima <b className="text-emerald-400">{reputation.minRequired}%</b></span>
          <span className="text-slate-600">·</span>
          <span>
            <b className="text-slate-200">{reputation.merchantsBeforeFilter}</b> merchants escaneados →{" "}
            <b className="text-emerald-400">{reputation.merchantsAfterFilter}</b> válidos →{" "}
            <b className="text-red-400">{reputation.merchantsFilteredOut}</b> filtrados
          </span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 bg-red-950/30 border border-red-800/50 rounded-xl p-3 text-sm text-red-300 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      {/* Loading */}
      {loading && !data && (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-amber-400 mb-3" />
          <p className="text-sm text-slate-300">Escaneando 4 exchanges en paralelo (8 requests)…</p>
          <p className="text-xs text-slate-500 mt-1">
            Binance P2P · OKX P2P · Bybit P2P · Kraken Spot
          </p>
        </div>
      )}

      {/* Resultados */}
      {data && !loading && (
        <>
          {opportunities.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
              <AlertCircle className="w-10 h-10 mx-auto text-slate-600 mb-3" />
              <p className="text-sm text-slate-300 font-medium">No se detectaron oportunidades rentables</p>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Probablemente no hay spread suficiente entre BUY y SELL después de fees de retiro.
                Intenta con otro asset ({asset}), otro país ({country.name}), o espera al próximo refresh.
              </p>
              <button
                onClick={load}
                className="mt-4 text-xs px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition inline-flex items-center gap-1.5"
              >
                <RefreshCw className="w-3 h-3" /> Re-escanear ahora
              </button>
            </div>
          ) : (
            <>
              {/* Resumen top */}
              <div className="mb-3 text-xs text-slate-400">
                <b className="text-emerald-400">{opportunities.length}</b> oportunidades rentables encontradas ·
                ordenadas por spread neto desc ·
                top {opportunities.length} de 144 combinaciones analizadas
              </div>

              {/* Tabla de oportunidades */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                {/* Header */}
                <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-slate-800/50 text-[10px] uppercase text-slate-500 font-semibold">
                  <div className="col-span-2">BUY → SELL</div>
                  <div className="col-span-2 text-right">Precios</div>
                  <div className="col-span-2 text-right">Spread neto</div>
                  <div className="col-span-2 text-right">Fees</div>
                  <div className="col-span-2 text-right">Profit NETO</div>
                  <div className="col-span-1 text-right">Pago común</div>
                  <div className="col-span-1 text-right">Tipo</div>
                </div>

                {/* Rows */}
                {opportunities.map((opp) => {
                  const isExpanded = expandedRow === opp.id;
                  return (
                    <div key={opp.id} className="border-t border-slate-800">
                      <button
                        onClick={() => setExpandedRow(isExpanded ? null : opp.id)}
                        className="w-full grid grid-cols-12 gap-2 px-3 py-2.5 hover:bg-slate-800/30 transition text-xs text-left"
                      >
                        {/* BUY → SELL con badges */}
                        <div className="col-span-2 flex items-center gap-1.5">
                          <ExchangeBadge exchange={opp.buyExchange} />
                          <span className="text-slate-500">→</span>
                          <ExchangeBadge exchange={opp.sellExchange} />
                          {opp.buyMerchantPro && (
                            <span className="text-[8px] px-1 py-0.5 bg-amber-900/50 text-amber-300 rounded font-semibold">PRO</span>
                          )}
                        </div>

                        {/* Precios */}
                        <div className="col-span-2 text-right text-slate-300 font-mono">
                          <div className="text-emerald-400">{fmtPrice(opp.buyPrice, opp.fiat)}</div>
                          <div className="text-amber-400 text-[10px]">{fmtPrice(opp.sellPrice, opp.fiat)}</div>
                        </div>

                        {/* Spread neto */}
                        <div className="col-span-2 text-right">
                          <div className="text-emerald-400 font-mono font-bold">+{opp.netSpreadPct.toFixed(2)}%</div>
                          <div className="text-slate-500 text-[9px]">bruto {opp.grossSpreadPct.toFixed(2)}%</div>
                        </div>

                        {/* Fees */}
                        <div className="col-span-2 text-right">
                          <div className="text-red-400 font-mono">{opp.feesPct.toFixed(2)}%</div>
                          <div className="text-slate-500 text-[9px]">{opp.withdrawalFee} {opp.asset}</div>
                        </div>

                        {/* Profit NETO */}
                        <div className="col-span-2 text-right">
                          <div className="text-emerald-400 font-mono font-bold">+{fmtPrice(opp.netProfitForOperation, opp.fiat)}</div>
                          <div className="text-slate-500 text-[9px]">{opp.operationAssetAmount.toFixed(2)} {opp.asset}</div>
                        </div>

                        {/* Pago común */}
                        <div className="col-span-1 text-right">
                          {opp.commonPaymentMethod ? (
                            <span className="text-[9px] px-1.5 py-0.5 bg-blue-900/50 text-blue-300 rounded">{opp.commonPaymentMethod}</span>
                          ) : (
                            <span className="text-slate-600 text-[9px]">—</span>
                          )}
                        </div>

                        {/* Tipo */}
                        <div className="col-span-1 text-right">
                          <span className="text-[9px] text-slate-500">{opp.type}</span>
                          {isExpanded ? <ChevronUp className="w-3 h-3 inline ml-1" /> : <ChevronDown className="w-3 h-3 inline ml-1" />}
                        </div>
                      </button>

                      {/* Fila expandible */}
                      {isExpanded && (
                        <div className="bg-slate-950/30 px-3 py-3 border-t border-slate-800 text-xs">
                          <div className="grid grid-cols-2 gap-4">
                            {/* BUY side */}
                            <div className="space-y-2">
                              <div className="text-[10px] uppercase text-emerald-400 font-semibold flex items-center gap-1.5">
                                <TrendingUp className="w-3 h-3" />
                                Comprar en {opp.buyExchange}
                              </div>
                              <div className="space-y-1 text-slate-400">
                                <div className="flex justify-between">
                                  <span>Merchant:</span>
                                  <b className="text-slate-200">{opp.buyMerchant}</b>
                                </div>
                                <div className="flex justify-between">
                                  <span>Reputación:</span>
                                  <ReputationBar rate={opp.buyMerchantReputation} />
                                </div>
                                <div className="flex justify-between">
                                  <span>Órdenes:</span>
                                  <b className="text-slate-200">{opp.buyMerchantOrderCount.toLocaleString()}</b>
                                </div>
                                <div className="flex justify-between">
                                  <span>Mín-Max:</span>
                                  <b className="text-slate-200 font-mono">
                                    {fmtAmount(opp.buyMinAmount, opp.fiat)} - {fmtAmount(opp.buyMaxAmount, opp.fiat)}
                                  </b>
                                </div>
                                <div className="flex justify-between">
                                  <span>Disponible:</span>
                                  <b className="text-slate-200 font-mono">{opp.buyAvailableQty.toFixed(2)} {opp.asset}</b>
                                </div>
                                <div className="flex justify-between items-start gap-2">
                                  <span>Métodos:</span>
                                  <div className="text-right max-w-[60%]">
                                    <div className="flex flex-wrap gap-1 justify-end">
                                      {opp.buyPaymentMethods.slice(0, 4).map((m) => (
                                        <span key={m} className="text-[9px] px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded">{m}</span>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <a
                                href={opp.buyDirectUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded transition"
                              >
                                <ExternalLink className="w-3 h-3" />
                                Ir a comprar en {opp.buyExchange}
                              </a>
                            </div>

                            {/* SELL side */}
                            <div className="space-y-2">
                              <div className="text-[10px] uppercase text-amber-400 font-semibold flex items-center gap-1.5">
                                <TrendingDown className="w-3 h-3" />
                                Vender en {opp.sellExchange}
                              </div>
                              <div className="space-y-1 text-slate-400">
                                <div className="flex justify-between">
                                  <span>Merchant:</span>
                                  <b className="text-slate-200">{opp.sellMerchant}</b>
                                </div>
                                <div className="flex justify-between">
                                  <span>Reputación:</span>
                                  <ReputationBar rate={opp.sellMerchantReputation} />
                                </div>
                                <div className="flex justify-between">
                                  <span>Órdenes:</span>
                                  <b className="text-slate-200">{opp.sellMerchantOrderCount.toLocaleString()}</b>
                                </div>
                                <div className="flex justify-between">
                                  <span>Mín-Max:</span>
                                  <b className="text-slate-200 font-mono">
                                    {fmtAmount(opp.sellMinAmount, opp.fiat)} - {fmtAmount(opp.sellMaxAmount, opp.fiat)}
                                  </b>
                                </div>
                                <div className="flex justify-between">
                                  <span>Disponible:</span>
                                  <b className="text-slate-200 font-mono">{opp.sellAvailableQty.toFixed(2)} {opp.asset}</b>
                                </div>
                                <div className="flex justify-between items-start gap-2">
                                  <span>Métodos:</span>
                                  <div className="text-right max-w-[60%]">
                                    <div className="flex flex-wrap gap-1 justify-end">
                                      {opp.sellPaymentMethods.slice(0, 4).map((m) => (
                                        <span key={m} className="text-[9px] px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded">{m}</span>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <a
                                href={opp.sellDirectUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded transition"
                              >
                                <ExternalLink className="w-3 h-3" />
                                Ir a vender en {opp.sellExchange}
                              </a>
                            </div>
                          </div>

                          {/* Cálculo detallado */}
                          <div className="mt-3 pt-3 border-t border-slate-800">
                            <div className="text-[10px] uppercase text-purple-400 font-semibold mb-2 flex items-center gap-1.5">
                              <Info className="w-3 h-3" />
                              Cálculo del profit NETO (algoritmo)
                            </div>
                            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-[10px] font-mono">
                              <div>
                                <div className="text-slate-500">Tamaño op.</div>
                                <div className="text-slate-200">{fmtAmount(opp.operationFiatAmount, opp.fiat)}</div>
                              </div>
                              <div>
                                <div className="text-slate-500">Asset comprado</div>
                                <div className="text-slate-200">{opp.operationAssetAmount.toFixed(3)} {opp.asset}</div>
                              </div>
                              <div>
                                <div className="text-slate-500">Spread bruto</div>
                                <div className="text-slate-300">+{opp.grossSpreadPct.toFixed(2)}%</div>
                              </div>
                              <div>
                                <div className="text-slate-500">Fee retiro</div>
                                <div className="text-red-400">-{opp.withdrawalFeeFiat.toFixed(2)} {opp.fiat}</div>
                              </div>
                              <div>
                                <div className="text-slate-500">Profit NETO</div>
                                <div className="text-emerald-400 font-bold">+{opp.netProfitForOperation.toFixed(2)} {opp.fiat}</div>
                              </div>
                              <div>
                                <div className="text-slate-500">Profit/1000</div>
                                <div className="text-emerald-400">+{opp.netProfitOn1000.toFixed(2)}</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Footer info */}
              <div className="mt-3 text-[10px] text-slate-500 flex items-center gap-2">
                <Info className="w-3 h-3" />
                Profit NETO calculado después de fee de retiro crypto (TRC20 por defecto).
                Si cross-exchange (Binance→OKX), necesitas transferir el {asset} del exchange BUY al SELL
                (~{data.asset === "USDT" ? "1 USDT" : "~fee"} fee de red). El método de pago común
                facilita el round-trip fiat.
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
