"use client";

import { useState, useEffect, useCallback } from "react";
import { useApp } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Bell, BellRing, Plus, Loader2, Trash2, TrendingDown, TrendingUp, Percent } from "lucide-react";

interface PriceAlert {
  id: string;
  asset: string;
  alertType: string;
  thresholdPrice: number | null;
  thresholdPercent: number | null;
  timeframeHours: number;
  triggered: boolean;
  triggeredAt: string | null;
  triggeredPrice: number | null;
  createdAt: string;
}

const ASSETS = [
  { sym: "BTC", name: "Bitcoin", icon: "₿" },
  { sym: "ETH", name: "Ethereum", icon: "Ξ" },
  { sym: "LINK", name: "Chainlink", icon: "⬡" },
  { sym: "USDT", name: "Tether", icon: "₮" },
  { sym: "USDC", name: "USD Coin", icon: "$" },
];

const ALERT_TYPES = [
  {
    id: "DIP_BELOW",
    label: "Comprar en caída (precio objetivo)",
    icon: TrendingDown,
    desc: "Avísame si el precio cae a un nivel específico. Ej: BTC <= $60,000",
  },
  {
    id: "PERCENT_DROP",
    label: "Caída porcentual (buy the dip)",
    icon: Percent,
    desc: "Avísame si el precio cae X% en las próximas horas. Ej: -5% en 24h",
  },
  {
    id: "TARGET_PRICE",
    label: "Objetivo de venta",
    icon: TrendingUp,
    desc: "Avísame si el precio sube a mi objetivo. Ej: BTC >= $80,000",
  },
];

export default function PriceAlertsView() {
  const { user } = useApp();
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/price-alerts?address=${user.walletAddress}`);
      if (!res.ok) return;
      const data = await res.json();
      setAlerts(data.alerts || []);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto p-8 text-center text-slate-400">
        Conecta tu wallet para configurar alertas de precio.
      </div>
    );
  }

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar esta alerta?")) return;
    try {
      await fetch(`/api/price-alerts?id=${id}&address=${user.walletAddress}`, { method: "DELETE" });
      setAlerts((prev) => prev.filter((a) => a.id !== id));
    } catch (e) {
      // ignore
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex justify-between items-start gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <BellRing className="w-6 h-6 text-emerald-400" />
            Alertas de Precio
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Te avisamos cuando BTC, ETH u otras criptos caigan a tu precio objetivo.
            <br />
            Notificaciones in-app + browser push (si las activas).
          </p>
        </div>
        <Button
          onClick={() => setShowCreate(true)}
          className="bg-emerald-600 hover:bg-emerald-500 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nueva alerta
        </Button>
      </div>

      {/* Lista de alertas */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
        </div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-20 text-slate-500 border border-slate-800 rounded-xl">
          <Bell className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No tienes alertas configuradas.</p>
          <p className="text-xs mt-1 mb-4">Crea tu primera alerta para comprar cripto en el momento perfecto.</p>
          <Button
            onClick={() => setShowCreate(true)}
            variant="outline"
            className="border-emerald-600 text-emerald-400 hover:bg-emerald-950"
          >
            <Plus className="w-4 h-4 mr-2" />
            Crear primera alerta
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((a) => {
            const asset = ASSETS.find((x) => x.sym === a.asset);
            const type = ALERT_TYPES.find((x) => x.id === a.alertType);
            return (
              <div
                key={a.id}
                className={`bg-slate-900 rounded-xl border ${
                  a.triggered ? "border-emerald-700/50" : "border-slate-800"
                } p-4 flex items-start gap-4`}
              >
                <div className="text-2xl shrink-0">{asset?.icon || "•"}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-semibold text-slate-100">{a.asset}</div>
                    <span className={`text-[10px] px-2 py-0.5 rounded ${
                      a.triggered
                        ? "bg-emerald-900 text-emerald-300"
                        : "bg-slate-800 text-slate-300"
                    }`}>
                      {a.triggered ? "✓ Activada" : "Activa"}
                    </span>
                    <span className="text-[11px] text-slate-500">{type?.label}</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    {a.alertType === "DIP_BELOW" && (
                      <>Avísame si <b className="text-slate-200">{a.asset}</b> cae a <b className="text-emerald-400">≤ ${a.thresholdPrice}</b></>
                    )}
                    {a.alertType === "TARGET_PRICE" && (
                      <>Avísame si <b className="text-slate-200">{a.asset}</b> sube a <b className="text-emerald-400">≥ ${a.thresholdPrice}</b></>
                    )}
                    {a.alertType === "PERCENT_DROP" && (
                      <>Avísame si <b className="text-slate-200">{a.asset}</b> cae <b className="text-red-400">{a.thresholdPercent}%</b> en {a.timeframeHours}h</>
                    )}
                  </div>
                  {a.triggered && a.triggeredPrice && (
                    <div className="text-[11px] text-emerald-400 mt-1">
                      Activada a ${a.triggeredPrice.toFixed(2)} ·{" "}
                      {new Date(a.triggeredAt || "").toLocaleString("es-CO")}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => remove(a.id)}
                  className="text-slate-500 hover:text-red-400 p-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Dialog crear */}
      <CreateAlertDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        user={user}
        onCreated={() => {
          setShowCreate(false);
          load();
        }}
      />
    </div>
  );
}

function CreateAlertDialog({ open, onOpenChange, user, onCreated }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  user: { walletAddress: string };
  onCreated: () => void;
}) {
  const [asset, setAsset] = useState("BTC");
  const [alertType, setAlertType] = useState("DIP_BELOW");
  const [thresholdPrice, setThresholdPrice] = useState("");
  const [thresholdPercent, setThresholdPercent] = useState("5");
  const [timeframeHours, setTimeframeHours] = useState("24");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setCreating(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        address: user.walletAddress,
        asset,
        alertType,
      };
      if (alertType === "DIP_BELOW" || alertType === "TARGET_PRICE") {
        body.thresholdPrice = parseFloat(thresholdPrice);
      } else if (alertType === "PERCENT_DROP") {
        body.thresholdPercent = parseFloat(thresholdPercent);
        body.timeframeHours = parseInt(timeframeHours);
      }

      const res = await fetch("/api/price-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error creando alerta");
        return;
      }
      // Reset
      setThresholdPrice("");
      onCreated();
    } catch (e) {
      setError("Error: " + (e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-md">
        <DialogHeader>
          <DialogTitle>Crear alerta de precio</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Asset */}
          <div>
            <Label className="text-xs">Cripto *</Label>
            <div className="mt-2 grid grid-cols-5 gap-2">
              {ASSETS.map((a) => (
                <button
                  key={a.sym}
                  onClick={() => setAsset(a.sym)}
                  className={`px-2 py-2 text-xs rounded-md transition ${
                    asset === a.sym
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  <div className="text-lg">{a.icon}</div>
                  <div>{a.sym}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Tipo */}
          <div>
            <Label className="text-xs">Tipo de alerta *</Label>
            <div className="mt-2 space-y-2">
              {ALERT_TYPES.map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    onClick={() => setAlertType(t.id)}
                    className={`w-full text-left p-2 rounded-md transition border ${
                      alertType === t.id
                        ? "bg-emerald-950/30 border-emerald-600"
                        : "bg-slate-800 border-slate-700 hover:border-slate-600"
                    }`}
                  >
                    <div className="flex items-center gap-2 text-xs font-medium text-slate-100">
                      <Icon className="w-4 h-4 text-emerald-400" />
                      {t.label}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">{t.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Threshold */}
          {alertType === "DIP_BELOW" && (
            <div>
              <Label className="text-xs">Precio objetivo (USD) *</Label>
              <Input
                type="number"
                value={thresholdPrice}
                onChange={(e) => setThresholdPrice(e.target.value)}
                placeholder="60000"
                step="any"
                className="mt-1 bg-slate-800 border-slate-700 text-slate-100"
              />
              <div className="text-[10px] text-slate-500 mt-1">
                Te avisamos si {asset} cae a este precio o menos.
              </div>
            </div>
          )}

          {alertType === "TARGET_PRICE" && (
            <div>
              <Label className="text-xs">Precio objetivo (USD) *</Label>
              <Input
                type="number"
                value={thresholdPrice}
                onChange={(e) => setThresholdPrice(e.target.value)}
                placeholder="80000"
                step="any"
                className="mt-1 bg-slate-800 border-slate-700 text-slate-100"
              />
              <div className="text-[10px] text-slate-500 mt-1">
                Te avisamos si {asset} sube a este precio o más.
              </div>
            </div>
          )}

          {alertType === "PERCENT_DROP" && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">% de caída *</Label>
                <Input
                  type="number"
                  value={thresholdPercent}
                  onChange={(e) => setThresholdPercent(e.target.value)}
                  placeholder="5"
                  step="0.1"
                  min="0.1"
                  max="90"
                  className="mt-1 bg-slate-800 border-slate-700 text-slate-100"
                />
              </div>
              <div>
                <Label className="text-xs">Ventana (horas) *</Label>
                <Input
                  type="number"
                  value={timeframeHours}
                  onChange={(e) => setTimeframeHours(e.target.value)}
                  placeholder="24"
                  min="1"
                  max="168"
                  className="mt-1 bg-slate-800 border-slate-700 text-slate-100"
                />
              </div>
            </div>
          )}

          {error && (
            <div className="text-xs text-red-400 bg-red-950/30 border border-red-800/50 rounded p-2">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <DialogClose className="text-slate-400 hover:text-slate-100 text-sm">Cancelar</DialogClose>
          <Button
            onClick={submit}
            disabled={creating}
            className="bg-emerald-600 hover:bg-emerald-500 text-white"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Crear alerta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
