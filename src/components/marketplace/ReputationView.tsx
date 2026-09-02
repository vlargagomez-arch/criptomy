"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Star,
  TrendingUp,
  Award,
  AlertTriangle,
  MessageSquare,
  Loader2,
} from "lucide-react";
import {
  reputationLabel,
  avatarGradient,
  fmtDate,
  fmtCrypto,
} from "@/lib/format";

interface Feedback {
  id: string;
  rating: number;
  comment: string | null;
  trustScore: number;
  createdAt: string;
  fromUser: { alias: string; avatarSeed: string | null };
  trade: { id: string; cryptoAmount: number; escrowAsset: string | null; offer: { asset: string } | null } | null;
}

interface ReputationData {
  user: {
    id: string;
    alias: string;
    reputationScore: number;
    totalTrades: number;
    completedTrades: number;
    disputedTrades: number;
    torOnly: boolean;
    avatarSeed: string | null;
    bio: string | null;
    createdAt: string;
  };
  feedbacks: Feedback[];
}

interface PendingFeedback {
  tradeId: string;
  counterpartAlias: string;
  counterpartId: string;
}

export default function ReputationView() {
  const { user } = useApp();
  const [data, setData] = useState<ReputationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<PendingFeedback[]>([]);
  const [feedbackModal, setFeedbackModal] = useState<PendingFeedback | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchData();
  }, [user]);

  async function fetchData() {
    try {
      const res = await fetch(`/api/reputation?userId=${user!.id}`);
      const d = await res.json();
      setData(d);

      // Buscar trades completados sin feedback (simplificado: lista feedbacks pendientes)
      // En MVP: dejamos que el usuario pegue manualmente el tradeId
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
          <Star className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-300 font-medium">
            Conecte su billetera para ver su reputación
          </p>
        </Card>
      </div>
    );
  }

  if (loading || !data || !data.user) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-3">
        <Skeleton className="h-32 w-full bg-slate-900" />
        <Skeleton className="h-64 w-full bg-slate-900" />
      </div>
    );
  }

  const rep = reputationLabel(data.user.reputationScore);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <Star className="w-5 h-5 text-emerald-400" />
          Mi reputación
        </h1>
        <p className="text-sm text-slate-400">
          Acumulada a partir de feedbacks de trades completados
        </p>
      </div>

      {/* Score */}
      <Card className="bg-slate-900/60 border-slate-800 p-5">
        <div className="flex items-center gap-4">
          <div className="relative w-24 h-24">
            <svg className="w-24 h-24 -rotate-90">
              <circle
                cx="48"
                cy="48"
                r="40"
                fill="none"
                stroke="rgb(30 41 59)"
                strokeWidth="8"
              />
              <circle
                cx="48"
                cy="48"
                r="40"
                fill="none"
                stroke="rgb(16 185 129)"
                strokeWidth="8"
                strokeDasharray={`${(data.user.reputationScore / 100) * 251.2} 251.2`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-2xl font-bold ${rep.color}`}>
                {data.user.reputationScore.toFixed(0)}
              </span>
              <span className="text-[10px] text-slate-500">/ 100</span>
            </div>
          </div>
          <div>
            <div className={`text-xl font-bold ${rep.color}`}>
              {rep.label}
            </div>
            <div className="text-sm text-slate-400 mt-1">
              {data.user.completedTrades} trades completados ·{" "}
              {data.user.disputedTrades} disputados
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Alias: <span className="text-slate-300">{data.user.alias}</span>
              {" · "}
              desde {fmtDate(data.user.createdAt)}
            </div>
          </div>
        </div>
      </Card>

      {/* Dejar feedback */}
      <Card className="bg-slate-900/60 border-slate-800 p-5">
        <h3 className="text-sm font-semibold text-slate-100 mb-2 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-emerald-400" />
          Dejar feedback a una contraparte
        </h3>
        <p className="text-xs text-slate-400 mb-3">
          Si completó un trade y aún no dejó feedback, ingrese el ID del trade:
        </p>
        <div className="flex gap-2">
          <Input
            placeholder="ID del trade (de Mis Trades)"
            className="bg-slate-950 border-slate-700 text-slate-100 font-mono text-xs"
            onChange={(e) => {
              const v = e.target.value;
              if (v.length > 8) {
                setPending([
                  {
                    tradeId: v,
                    counterpartAlias: "(cargar trade)",
                    counterpartId: "",
                  },
                ]);
              }
            }}
          />
          <Button
            onClick={fetchData}
            variant="outline"
            className="border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            Actualizar
          </Button>
        </div>
        {pending.length > 0 && (
          <div className="mt-3 space-y-2">
            {pending.map((p) => (
              <div
                key={p.tradeId}
                className="flex items-center justify-between p-2 rounded-md bg-slate-950 border border-slate-800"
              >
                <div>
                  <div className="text-xs text-slate-200">
                    Trade {p.tradeId.slice(-8)}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Contraparte: {p.counterpartAlias}
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => setFeedbackModal(p)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                >
                  Dejar feedback
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Feedbacks recibidos */}
      <Card className="bg-slate-900/60 border-slate-800 p-5">
        <h3 className="text-sm font-semibold text-slate-100 mb-3 flex items-center gap-2">
          <Award className="w-4 h-4 text-emerald-400" />
          Feedbacks recibidos ({data.feedbacks.length})
        </h3>
        {data.feedbacks.length === 0 ? (
          <div className="text-center py-6">
            <Star className="w-8 h-8 text-slate-700 mx-auto mb-2" />
            <p className="text-sm text-slate-400">
              Aún no ha recibido feedback
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Complete trades para empezar a construir su reputación.
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {data.feedbacks.map((f) => (
              <div
                key={f.id}
                className="flex items-start gap-3 p-3 rounded-md bg-slate-950 border border-slate-800"
              >
                <Avatar
                  className={`w-8 h-8 shrink-0 bg-gradient-to-br ${avatarGradient(f.fromUser.avatarSeed)}`}
                >
                  <AvatarFallback className="bg-transparent text-white text-[10px]">
                    {f.fromUser.alias.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-slate-200">
                      {f.fromUser.alias}
                    </span>
                    <span className="text-xs text-yellow-400">
                      {"★".repeat(f.rating)}
                      <span className="text-slate-700">
                        {"★".repeat(5 - f.rating)}
                      </span>
                    </span>
                    {f.trade && (
                      <span className="text-[10px] text-slate-500">
                        · {fmtCrypto(f.trade.cryptoAmount)}{" "}
                        {f.trade.escrowAsset || f.trade.offer?.asset || ""}
                      </span>
                    )}
                  </div>
                  {f.comment && (
                    <p className="text-xs text-slate-400 mt-1 italic">
                      "{f.comment}"
                    </p>
                  )}
                  <div className="text-[10px] text-slate-600 mt-1">
                    {fmtDate(f.createdAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {feedbackModal && (
        <FeedbackModal
          pending={feedbackModal}
          fromUserId={user.id}
          onClose={() => setFeedbackModal(null)}
          onSent={() => {
            setFeedbackModal(null);
            fetchData();
          }}
        />
      )}
    </div>
  );
}

function FeedbackModal({
  pending,
  fromUserId,
  onClose,
  onSent,
}: {
  pending: PendingFeedback;
  fromUserId: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [trustScore, setTrustScore] = useState(80);
  const [loading, setLoading] = useState(false);

  async function handleSend() {
    setLoading(true);
    try {
      const res = await fetch("/api/reputation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tradeId: pending.tradeId,
          fromUserId,
          rating,
          comment,
          trustScore,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onSent();
    } catch (e) {
      alert("Error: " + (e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-emerald-400">
            Dejar feedback a {pending.counterpartAlias}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Su feedback será público y afectará la reputación de la
            contraparte.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label className="text-slate-300 mb-2 block">Calificación</Label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setRating(n)}
                  className={`p-1 ${
                    n <= rating ? "text-yellow-400" : "text-slate-700"
                  }`}
                >
                  <Star
                    className="w-7 h-7"
                    fill={n <= rating ? "currentColor" : "none"}
                  />
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-slate-300 mb-2 block">
              Puntuación de confianza: {trustScore}/100
            </Label>
            <input
              type="range"
              min="0"
              max="100"
              value={trustScore}
              onChange={(e) => setTrustScore(parseInt(e.target.value))}
              className="w-full accent-emerald-600"
            />
          </div>

          <div>
            <Label className="text-slate-300 mb-1.5 block">
              Comentario (opcional)
            </Label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Ej: Pago rápido, comunicación fluida, recomendado."
              className="bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-600 text-sm"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            className="border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSend}
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Enviar feedback
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
