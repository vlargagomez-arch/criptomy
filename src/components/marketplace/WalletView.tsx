"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Wallet,
  Copy,
  Shield,
  Star,
  TrendingUp,
  ArrowLeftRight,
  AlertTriangle,
  Key,
  ExternalLink,
} from "lucide-react";
import {
  CHAINS,
  ChainConfig,
} from "@/lib/blockchain/config";
import {
  reputationLabel,
  avatarGradient,
  fmtDate,
} from "@/lib/format";

interface DashboardData {
  user: {
    id: string;
    alias: string;
    walletAddress: string;
    reputationScore: number;
    totalTrades: number;
    completedTrades: number;
    disputedTrades: number;
    torOnly: boolean;
    avatarSeed: string | null;
    bio: string | null;
    publicKey: string | null;
  };
  stats: {
    activeOffers: number;
    activeTrades: number;
    openDisputes: number;
    reputation: number;
    totalTrades: number;
    completedTrades: number;
    disputedTrades: number;
  };
  recentFeedbacks: Array<{
    id: string;
    rating: number;
    comment: string | null;
    createdAt: string;
    fromUser: { alias: string; avatarSeed: string | null };
  }>;
}

export default function WalletView() {
  const { user, setTab } = useApp();
  const [dash, setDash] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchDashboard();
  }, [user]);

  async function fetchDashboard() {
    try {
      const res = await fetch(`/api/dashboard?userId=${user!.id}`);
      const data = await res.json();
      setDash(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <Card className="bg-slate-900/40 border-slate-800 p-8">
          <Wallet className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-300 font-medium">
            Conecte su billetera para ver su panel
          </p>
        </Card>
      </div>
    );
  }

  if (loading || !dash) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        <Skeleton className="h-32 w-full bg-slate-900" />
        <Skeleton className="h-48 w-full bg-slate-900" />
      </div>
    );
  }

  const rep = reputationLabel(dash.user.reputationScore);
  const chains = Object.values(CHAINS);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <Wallet className="w-5 h-5 text-emerald-400" />
          Mi panel
        </h1>
        <p className="text-sm text-slate-400">
          Identidad pseudónima · sin datos personales
        </p>
      </div>

      {/* Identidad */}
      <Card className="bg-slate-900/60 border-slate-800 p-5">
        <div className="flex items-start gap-4">
          <Avatar
            className={`w-16 h-16 bg-gradient-to-br ${avatarGradient(dash.user.avatarSeed)}`}
          >
            <AvatarFallback className="bg-transparent text-white text-xl">
              {dash.user.alias.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-slate-100">
                {dash.user.alias}
              </h2>
              {dash.user.torOnly && (
                <Badge
                  variant="outline"
                  className="text-[10px] bg-emerald-950/50 border-emerald-700 text-emerald-400"
                >
                  <Shield className="w-2.5 h-2.5 mr-1" />
                  Tor-only
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <code className="text-xs text-slate-400 font-mono bg-slate-950 px-2 py-1 rounded break-all">
                {dash.user.walletAddress}
              </code>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-slate-500 hover:text-slate-200"
                onClick={() =>
                  navigator.clipboard?.writeText(dash.user.walletAddress)
                }
              >
                <Copy className="w-3 h-3" />
              </Button>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className={`text-sm font-medium ${rep.color}`}>
                ★ {dash.user.reputationScore.toFixed(0)}/100 · {rep.label}
              </span>
              <span className="text-xs text-slate-500">
                · miembro desde {fmtDate(dash.user.createdAt || new Date())}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={TrendingUp}
          label="Reputación"
          value={dash.user.reputationScore.toFixed(0)}
          sub="/ 100"
          color="text-emerald-400"
        />
        <StatCard
          icon={Star}
          label="Trades OK"
          value={String(dash.stats.completedTrades)}
          sub={`de ${dash.stats.totalTrades} totales`}
          color="text-cyan-400"
        />
        <StatCard
          icon={ArrowLeftRight}
          label="Activos"
          value={String(dash.stats.activeTrades)}
          sub={`${dash.stats.activeOffers} ofertas`}
          color="text-yellow-400"
        />
        <StatCard
          icon={AlertTriangle}
          label="Disputas"
          value={String(dash.stats.disputedTrades)}
          sub={dash.stats.openDisputes > 0 ? `${dash.stats.openDisputes} abiertas` : "ninguna abierta"}
          color="text-red-400"
        />
      </div>

      {/* Claves */}
      <Card className="bg-slate-900/60 border-slate-800 p-5">
        <h3 className="text-sm font-semibold text-slate-100 mb-3 flex items-center gap-2">
          <Key className="w-4 h-4 text-emerald-400" />
          Claves criptográficas
        </h3>
        <div className="space-y-3 text-xs">
          <div>
            <div className="text-slate-500 uppercase text-[10px] mb-1">
              Billetera (identidad on-chain)
            </div>
            <code className="font-mono text-slate-300 break-all">
              {dash.user.walletAddress}
            </code>
          </div>
          <div>
            <div className="text-slate-500 uppercase text-[10px] mb-1">
              Clave pública ECDH (para cifrado E2E)
            </div>
            {dash.user.publicKey ? (
              <code className="font-mono text-emerald-400 break-all text-[11px]">
                {dash.user.publicKey.slice(0, 80)}…
              </code>
            ) : (
              <span className="text-yellow-400">
                No publicada (los mensajes no se pueden cifrar)
              </span>
            )}
          </div>
          <div>
            <div className="text-slate-500 uppercase text-[10px] mb-1">
              Clave privada ECDH
            </div>
            <span className="text-slate-400">
              Se almacena solo en este navegador (localStorage). Nunca se envía
              al servidor.
            </span>
          </div>
        </div>
      </Card>

      {/* Multi-chain */}
      <Card className="bg-slate-900/60 border-slate-800 p-5">
        <h3 className="text-sm font-semibold text-slate-100 mb-3">
          Cadenas soportadas
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {chains.map((c) => (
            <a
              key={c.id}
              href={`${c.explorerUrl}/address/${dash.user.walletAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block p-3 rounded-md bg-slate-950 border border-slate-800 hover:border-emerald-700/50 transition"
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ background: c.color }}
                />
                <span className="text-xs font-medium text-slate-200">
                  {c.name}
                </span>
              </div>
              <div className="text-[10px] text-slate-500">
                {c.symbol} · {c.hasSmartContracts ? "smart contracts" : "UTXO"}
              </div>
              <div className="text-[10px] text-emerald-500 mt-1 flex items-center gap-1">
                Ver en explorer <ExternalLink className="w-2.5 h-2.5" />
              </div>
            </a>
          ))}
        </div>
        <p className="text-[10px] text-slate-500 mt-3">
          Nota: en MVP se usa una sola dirección para todas las cadenas. En
          producción, cada cadena tendría su dirección derivada.
        </p>
      </Card>

      {/* Feedbacks recientes */}
      <Card className="bg-slate-900/60 border-slate-800 p-5">
        <h3 className="text-sm font-semibold text-slate-100 mb-3 flex items-center gap-2">
          <Star className="w-4 h-4 text-emerald-400" />
          Feedbacks recientes recibidos
        </h3>
        {dash.recentFeedbacks.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-4">
            Aún no ha recibido feedback. Complete su primer trade.
          </p>
        ) : (
          <div className="space-y-2">
            {dash.recentFeedbacks.map((f) => (
              <div
                key={f.id}
                className="flex items-start gap-2 p-2 rounded-md bg-slate-950 border border-slate-800"
              >
                <Avatar
                  className={`w-6 h-6 shrink-0 bg-gradient-to-br ${avatarGradient(f.fromUser.avatarSeed)}`}
                >
                  <AvatarFallback className="bg-transparent text-white text-[10px]">
                    {f.fromUser.alias.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-200">
                      {f.fromUser.alias}
                    </span>
                    <span className="text-[10px] text-yellow-400">
                      {"★".repeat(f.rating)}
                      <span className="text-slate-700">
                        {"★".repeat(5 - f.rating)}
                      </span>
                    </span>
                  </div>
                  {f.comment && (
                    <p className="text-xs text-slate-400 mt-0.5">{f.comment}</p>
                  )}
                </div>
                <span className="text-[10px] text-slate-600">
                  {fmtDate(f.createdAt)}
                </span>
              </div>
            ))}
          </div>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setTab("reputacion")}
          className="w-full mt-3 border-slate-700 text-slate-300 hover:bg-slate-800"
        >
          Ver reputación completa
        </Button>
      </Card>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <Card className="bg-slate-900/60 border-slate-800 p-4">
      <Icon className={`w-4 h-4 ${color} mb-2`} />
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-slate-300">{label}</div>
      <div className="text-[10px] text-slate-500">{sub}</div>
    </Card>
  );
}
