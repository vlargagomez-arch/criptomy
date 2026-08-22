"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  Shield,
  Scale,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import {
  fmtCrypto,
  fmtFiat,
  fmtDate,
  timeAgo,
  avatarGradient,
} from "@/lib/format";

interface Dispute {
  id: string;
  reason: string;
  evidence: string | null;
  status: string;
  resolution: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
  opener: { alias: string; avatarSeed: string | null };
  defendant: { alias: string; avatarSeed: string | null };
  trade: {
    id: string;
    cryptoAmount: number;
    fiatAmount: number;
    asset: string;
    currency: string;
    buyer: { alias: string };
    seller: { alias: string };
  };
}

export default function DisputesView() {
  const { user, setTab } = useApp();
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchDisputes();
  }, [user]);

  async function fetchDisputes() {
    try {
      const res = await fetch(`/api/disputes?userId=${user!.id}`);
      const data = await res.json();
      setDisputes(data.disputes || []);
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
          <AlertTriangle className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-300 font-medium">
            Conecte su billetera para ver disputas
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-yellow-400" />
          Disputas
        </h1>
        <p className="text-sm text-slate-400">
          Resolución de conflictos · árbitro opcional · prueba criptográfica
        </p>
      </div>

      {/* Cómo funciona */}
      <Card className="bg-slate-900/60 border-slate-800 p-5">
        <h3 className="text-sm font-semibold text-slate-100 mb-3 flex items-center gap-2">
          <Scale className="w-4 h-4 text-emerald-400" />
          Cómo funciona la resolución de disputas
        </h3>
        <div className="grid md:grid-cols-4 gap-3 text-xs">
          {[
            {
              n: 1,
              t: "Apertura",
              d: "Cualquier parte puede abrir disputa si el trade está fundeado.",
            },
            {
              n: 2,
              t: "Revisión",
              d: "Un árbitro (designado al crear el trade) revisa la evidencia: mensajes, comprobantes, tx on-chain.",
            },
            {
              n: 3,
              t: "Resolución",
              d: "El árbitro llama a resolveDispute(tradeId, winner, reason) en el smart contract.",
            },
            {
              n: 4,
              t: "Ejecución",
              d: "El contrato envía los fondos al ganador y la comisión al feeCollector.",
            },
          ].map((s) => (
            <div
              key={s.n}
              className="p-3 rounded-md bg-slate-950 border border-slate-800"
            >
              <div className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center mb-2">
                {s.n}
              </div>
              <div className="text-slate-200 font-medium mb-0.5">{s.t}</div>
              <p className="text-slate-500 leading-relaxed">{s.d}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 p-3 rounded-md bg-amber-950/20 border border-amber-900/40 text-xs text-amber-200/90">
          <strong>Importante:</strong> Si no se designó árbitro al crear el
          trade (address(0)), la disputa no puede resolverse on-chain y los
          fondos pueden quedar bloqueados. Recomendamos siempre usar
          árbitros de confianza o multisig 2-de-3.
        </div>
      </Card>

      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-28 w-full bg-slate-900" />
          ))}
        </div>
      ) : disputes.length === 0 ? (
        <Card className="bg-slate-900/40 border-slate-800 p-12 text-center">
          <Shield className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
          <p className="text-slate-300 font-medium">
            No tiene disputas abiertas
          </p>
          <p className="text-sm text-slate-500 mt-1">
            Mantenga buena comunicación con sus contrapartes y use el chat
            cifrado para dejar constancia de todo.
          </p>
          <Button
            onClick={() => setTab("trades")}
            className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            Ver mis trades
          </Button>
        </Card>
      ) : (
        <div className="space-y-2">
          {disputes.map((d) => (
            <DisputeRow key={d.id} dispute={d} />
          ))}
        </div>
      )}
    </div>
  );
}

function DisputeRow({ dispute }: { dispute: Dispute }) {
  const statusMap: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    OPEN: {
      label: "Abierta",
      color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
      icon: Clock,
    },
    RESOLVED_BUYER: {
      label: "Resuelta (comprador)",
      color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
      icon: CheckCircle2,
    },
    RESOLVED_SELLER: {
      label: "Resuelta (vendedor)",
      color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
      icon: CheckCircle2,
    },
    CANCELLED: {
      label: "Cancelada",
      color: "bg-slate-500/10 text-slate-400 border-slate-500/30",
      icon: XCircle,
    },
  };
  const st = statusMap[dispute.status] || statusMap.OPEN;
  const StatusIcon = st.icon;

  return (
    <Card className="bg-slate-900/60 border-slate-800 p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Avatar
            className={`w-7 h-7 bg-gradient-to-br ${avatarGradient(dispute.opener.avatarSeed)}`}
          >
            <AvatarFallback className="bg-transparent text-white text-[10px]">
              {dispute.opener.alias.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs text-slate-300">
            <strong>{dispute.opener.alias}</strong> abrió disputa contra{" "}
            <strong>{dispute.defendant.alias}</strong>
          </span>
        </div>
        <Badge variant="outline" className={`text-xs ${st.color}`}>
          <StatusIcon className="w-3 h-3 mr-1" />
          {st.label}
        </Badge>
      </div>

      <div className="text-xs text-slate-400 mb-2">
        <span className="text-slate-500">Motivo: </span>
        {dispute.reason}
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="p-2 rounded bg-slate-950 border border-slate-800">
          <div className="text-[10px] text-slate-500 uppercase">Cripto</div>
          <div className="font-mono text-slate-200">
            {fmtCrypto(dispute.trade.cryptoAmount)} {dispute.trade.asset}
          </div>
        </div>
        <div className="p-2 rounded bg-slate-950 border border-slate-800">
          <div className="text-[10px] text-slate-500 uppercase">Fiat</div>
          <div className="font-mono text-emerald-400">
            {fmtFiat(dispute.trade.fiatAmount, dispute.trade.currency)}
          </div>
        </div>
        <div className="p-2 rounded bg-slate-950 border border-slate-800">
          <div className="text-[10px] text-slate-500 uppercase">Apertura</div>
          <div className="text-slate-300">{timeAgo(dispute.createdAt)}</div>
        </div>
      </div>

      {dispute.resolution && (
        <div className="mt-3 p-2 rounded bg-emerald-950/30 border border-emerald-900/50">
          <div className="text-[10px] text-emerald-500 uppercase mb-1">
            Resolución
          </div>
          <p className="text-xs text-emerald-200">{dispute.resolution}</p>
          {dispute.resolvedBy && (
            <div className="text-[10px] text-slate-500 mt-1">
              Resuelta por: <code className="font-mono">{dispute.resolvedBy}</code>
              {dispute.resolvedAt && ` · ${fmtDate(dispute.resolvedAt)}`}
            </div>
          )}
        </div>
      )}

      {dispute.evidence && (
        <div className="mt-2 text-[10px] text-slate-500">
          📎 Evidencia:{" "}
          <code className="font-mono text-slate-400">{dispute.evidence}</code>
        </div>
      )}
    </Card>
  );
}
