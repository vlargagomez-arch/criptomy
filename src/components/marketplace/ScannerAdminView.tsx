"use client";

import { useState, useEffect, useCallback } from "react";
import { Activity, RefreshCw, Loader2, Server, Zap, AlertTriangle, CheckCircle2, XCircle, Globe } from "lucide-react";
import { SCANNER_PROVIDERS } from "@/lib/scanner/providers/registry";
import type { ProviderHealth } from "@/lib/scanner/types";

// Bybit tiene geo-block contra IPs de Vercel (cloud provider).
// PERO el navegador del usuario tiene IP residencial y Bybit permite CORS.
// Hacemos la verificación desde el navegador (no desde el servidor).
const BYBIT_DIRECT_URL = "https://api.bybit.com/v5/market/tickers?category=spot&symbol=BTCUSDT";

interface ClientSideCheck {
  provider: string;
  status: "ONLINE" | "OFFLINE" | "CHECKING" | "ERROR";
  latencyMs: number;
  lastPrice?: number;
  error?: string;
  viaClient: boolean; // true = verificado desde el navegador (no desde Vercel)
}

export default function ScannerAdminView() {
  const [health, setHealth] = useState<ProviderHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<number>(0);
  const [bybitClientCheck, setBybitClientCheck] = useState<ClientSideCheck>({
    provider: "bybit",
    status: "CHECKING",
    latencyMs: 0,
    viaClient: true,
  });

  const checkAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/scanner/providers");
      const data = await res.json();
      setHealth(data.providers || []);
      setLastUpdate(Date.now());
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Verificación directa de Bybit desde el navegador del usuario
  // (no desde Vercel — Vercel está bloqueado por Bybit, pero la IP del
  // usuario no). Bybit permite CORS, así que el fetch funciona.
  const checkBybitDirect = useCallback(async () => {
    setBybitClientCheck({ provider: "bybit", status: "CHECKING", latencyMs: 0, viaClient: true });
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(BYBIT_DIRECT_URL, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      clearTimeout(timeoutId);
      const latencyMs = Date.now() - start;
      if (!res.ok) {
        setBybitClientCheck({
          provider: "bybit",
          status: "ERROR",
          latencyMs,
          viaClient: true,
          error: `HTTP ${res.status} (desde tu IP)`,
        });
        return;
      }
      const data = await res.json();
      const lastPrice = data?.result?.list?.[0]?.lastPrice
        ? parseFloat(data.result.list[0].lastPrice)
        : 0;
      setBybitClientCheck({
        provider: "bybit",
        status: "ONLINE",
        latencyMs,
        lastPrice,
        viaClient: true,
      });
    } catch (err) {
      setBybitClientCheck({
        provider: "bybit",
        status: "OFFLINE",
        latencyMs: Date.now() - start,
        viaClient: true,
        error: (err as Error).message,
      });
    }
  }, []);

  useEffect(() => {
    checkAll();
    checkBybitDirect();
    const interval = setInterval(() => {
      checkAll();
      checkBybitDirect();
    }, 30_000);
    return () => clearInterval(interval);
  }, [checkAll, checkBybitDirect]);

  // Combinar health del backend con el check directo de Bybit
  const effectiveHealth: ProviderHealth[] = health.map((h) => {
    if (h.provider === "bybit" && bybitClientCheck.status !== "CHECKING") {
      // Reemplazar el status del backend con el del navegador
      return {
        ...h,
        status: bybitClientCheck.status === "ONLINE" ? "ONLINE" : bybitClientCheck.status as never,
        latencyMs: bybitClientCheck.latencyMs,
        lastError: bybitClientCheck.error || (bybitClientCheck.status === "ONLINE" ? undefined : h.lastError),
        endpointsOk: bybitClientCheck.status === "ONLINE" ? 1 : 0,
      };
    }
    return h;
  });

  const online = effectiveHealth.filter((h) => h.status === "ONLINE").length;
  const total = effectiveHealth.length;
  const avgLatency = effectiveHealth.filter((h) => h.status === "ONLINE").reduce((acc, h) => acc + h.latencyMs, 0) / (online || 1);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Activity className="w-6 h-6 text-emerald-400" />
            Estado de proveedores
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Monitoreo en vivo de cada connector. Sin API keys, solo endpoints públicos.
          </p>
        </div>
        <button
          onClick={() => {
            checkAll();
            checkBybitDirect();
          }}
          disabled={loading}
          className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-200 flex items-center gap-1"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          Verificar
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
          <div className="text-[10px] text-slate-500">Providers online</div>
          <div className="text-xl font-bold text-emerald-400">{online}/{total}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
          <div className="text-[10px] text-slate-500">Latencia promedio</div>
          <div className="text-xl font-bold text-slate-100">{avgLatency.toFixed(0)}ms</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
          <div className="text-[10px] text-slate-500">Última verificación</div>
          <div className="text-xs font-mono text-slate-300">
            {lastUpdate ? new Date(lastUpdate).toLocaleTimeString() : "—"}
          </div>
        </div>
      </div>

      {/* Lista de providers */}
      <div className="space-y-2">
        {SCANNER_PROVIDERS.map((p) => {
          const h = effectiveHealth.find((h) => h.provider === p.id);
          const status = h?.status || "OFFLINE";
          const isBybitViaClient = p.id === "bybit" && bybitClientCheck.status === "ONLINE";
          const bybitLastPrice = p.id === "bybit" ? bybitClientCheck.lastPrice : undefined;
          return (
            <div
              key={p.id}
              className="bg-slate-900 border border-slate-800 rounded-lg p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{p.logoUrl}</span>
                  <div>
                    <div className="font-semibold text-slate-100 text-sm flex items-center gap-2 flex-wrap">
                      {p.name}
                      <StatusBadge status={status} />
                      {isBybitViaClient && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-900/50 text-cyan-300 flex items-center gap-1">
                          <Globe className="w-3 h-3" />
                          vía navegador
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {p.supportsMarketData && "📊 Market data"}
                      {p.supportsP2P && " · 🤝 P2P"}
                      {p.requiresApiKey ? " · 🔑 Requiere API key" : " · 🟢 Sin auth"}
                      {isBybitViaClient && bybitLastPrice && (
                        <span className="text-emerald-400 ml-1">· BTC: ${bybitLastPrice.toFixed(0)}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-slate-500">Latencia</div>
                  <div className="text-xs font-mono text-slate-300">
                    {h?.latencyMs ? `${h.latencyMs}ms` : "—"}
                  </div>
                </div>
              </div>

              {p.notes && (
                <p className="text-[10px] text-slate-500 italic mt-2">{p.notes}</p>
              )}

              {h?.lastError && (
                <div className="text-[10px] text-red-400 mt-2">
                  ⚠️ {h.lastError}
                </div>
              )}

              <div className="flex gap-2 mt-3">
                <a
                  href={p.documentationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-slate-400 hover:text-slate-200"
                >
                  Docs oficiales ↗
                </a>
                <a
                  href={p.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-slate-400 hover:text-slate-200"
                >
                  Web ↗
                </a>
                <div className="ml-auto text-[10px] text-slate-500">
                  Rate limit: {p.rateLimitPerMin}/min
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Disclaimer */}
      <div className="mt-6 bg-slate-900 border border-slate-800 rounded-lg p-4">
        <div className="flex items-start gap-2 text-xs text-slate-400">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
          <div>
            <b className="text-slate-300">Sobre este monitoreo:</b> Los checks verifican solo
            market data público. Para endpoints que requieren API key (P2P de OKX/Bybit,
            trading privado), el status aquí solo confirma que el endpoint público responde.
            Verificación cada 30s automáticamente.
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { color: string; label: string; icon: React.ElementType }> = {
    ONLINE: { color: "bg-emerald-900/50 text-emerald-300", label: "Online", icon: CheckCircle2 },
    OFFLINE: { color: "bg-red-900/50 text-red-300", label: "Offline", icon: XCircle },
    RATE_LIMITED: { color: "bg-amber-900/50 text-amber-300", label: "Rate limited", icon: AlertTriangle },
    ERROR: { color: "bg-red-900/50 text-red-300", label: "Error", icon: AlertTriangle },
    DISABLED: { color: "bg-slate-800 text-slate-400", label: "Deshabilitado", icon: XCircle },
    REQUIRES_API_KEY: { color: "bg-amber-900/50 text-amber-300", label: "Requiere API key", icon: AlertTriangle },
  };
  const c = config[status] || config.OFFLINE;
  const Icon = c.icon;
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded inline-flex items-center gap-1 ${c.color}`}>
      <Icon className="w-2.5 h-2.5" />
      {c.label}
    </span>
  );
}
