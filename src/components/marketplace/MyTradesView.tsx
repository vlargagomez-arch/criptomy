"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeftRight,
  TrendingUp,
  ArrowDownLeft,
  ArrowUpRight,
  Loader2,
  Lock,
  Send,
  Shield,
  AlertTriangle,
  Star,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import {
  fmtCrypto,
  fmtFiat,
  fmtDate,
  timeAgo,
  tradeStatusLabel,
  tradeStatusColor,
  reputationLabel,
  avatarGradient,
} from "@/lib/format";
import { CHAINS, PAYMENT_METHODS } from "@/lib/blockchain/config";
import TradeChat from "./TradeChat";

interface TradeParty {
  id: string;
  alias: string;
  reputationScore: number;
  avatarSeed: string | null;
  publicKey?: string | null;
}

interface Trade {
  id: string;
  cryptoAmount: number;
  fiatAmount: number;
  pricePerUnit: number;
  paymentMethod: string;
  paymentDetails: string;
  escrowAddress: string | null;
  escrowTxHash: string | null;
  releaseTxHash: string | null;
  escrowChain: keyof typeof CHAINS | null;
  escrowAsset: string | null;
  status: string;
  createdAt: string;
  escrowFundedAt: string | null;
  paymentSentAt: string | null;
  paymentConfirmedAt: string | null;
  releasedAt: string | null;
  completedAt: string | null;
  buyer: TradeParty;
  seller: TradeParty;
  offer: {
    id: string;
    chain: keyof typeof CHAINS;
    asset: string;
    currency: string;
    paymentWindowMin: number;
    terms: string;
  };
}

export default function MyTradesView() {
  const { user } = useApp();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Trade | null>(null);
  const [role, setRole] = useState<string>("all");

  useEffect(() => {
    if (!user) return;
    fetchTrades();
  }, [user, role]);

  async function fetchTrades() {
    setLoading(true);
    try {
      const res = await fetch(`/api/trades?userId=${user!.id}&role=${role}`);
      const data = await res.json();
      setTrades(data.trades || []);
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
          <ArrowLeftRight className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-300 font-medium">
            Conecte su billetera para ver sus trades
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-emerald-400" />
            Mis trades
          </h1>
          <p className="text-sm text-slate-400">
            {trades.length} trade(s) · rol: {role === "all" ? "todos" : role === "buyer" ? "comprador" : "vendedor"}
          </p>
        </div>
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger className="w-40 bg-slate-950 border-slate-700 text-slate-100 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-slate-900 border-slate-700 text-slate-100">
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="buyer">Como comprador</SelectItem>
            <SelectItem value="seller">Como vendedor</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full bg-slate-900" />
          ))}
        </div>
      ) : trades.length === 0 ? (
        <Card className="bg-slate-900/40 border-slate-800 p-12 text-center">
          <ArrowLeftRight className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-300 font-medium">No tiene trades todavía</p>
          <p className="text-sm text-slate-500 mt-1">
            Acepte una oferta en el mercado para empezar.
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {trades.map((t) => (
            <TradeRow
              key={t.id}
              trade={t}
              currentUserId={user.id}
              onClick={() => setSelected(t)}
            />
          ))}
        </div>
      )}

      {selected && (
        <TradeDetailModal
          trade={selected}
          currentUserId={user.id}
          onClose={() => setSelected(null)}
          onUpdate={() => fetchTrades()}
        />
      )}
    </div>
  );
}

function TradeRow({
  trade,
  currentUserId,
  onClick,
}: {
  trade: Trade;
  currentUserId: string;
  onClick: () => void;
}) {
  const isBuyer = trade.buyer.id === currentUserId;
  const counterpart = isBuyer ? trade.seller : trade.buyer;
  const chain = trade.escrowChain ? CHAINS[trade.escrowChain] : null;
  const rep = reputationLabel(counterpart.reputationScore);
  const pm = PAYMENT_METHODS.find((p) => p.id === trade.paymentMethod);

  return (
    <Card
      onClick={onClick}
      className="bg-slate-900/60 border-slate-800 p-4 hover:border-emerald-700/40 transition cursor-pointer"
    >
      <div className="grid grid-cols-12 gap-3 items-center">
        <div className="col-span-12 sm:col-span-3">
          <div className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                isBuyer
                  ? "bg-emerald-950/50 border border-emerald-700/50"
                  : "bg-orange-950/50 border border-orange-700/50"
              }`}
            >
              {isBuyer ? (
                <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
              ) : (
                <ArrowUpRight className="w-4 h-4 text-orange-400" />
              )}
            </div>
            <div>
              <div className="text-[10px] text-slate-500 uppercase">
                {isBuyer ? "Comprando" : "Vendiendo"}
              </div>
              <div className="text-sm font-bold text-slate-100">
                {fmtCrypto(trade.cryptoAmount)} {trade.offer.asset}
              </div>
            </div>
          </div>
        </div>

        <div className="col-span-6 sm:col-span-3">
          <div className="text-[10px] text-slate-500 uppercase">Total fiat</div>
          <div className="text-sm font-mono text-emerald-400">
            {fmtFiat(trade.fiatAmount, trade.offer.currency)}
          </div>
          <div className="text-[10px] text-slate-500">
            {pm?.icon} {pm?.label || trade.paymentMethod}
          </div>
        </div>

        <div className="col-span-6 sm:col-span-3">
          <div className="text-[10px] text-slate-500 uppercase">
            Contraparte
          </div>
          <div className="flex items-center gap-1.5">
            <Avatar
              className={`w-5 h-5 bg-gradient-to-br ${avatarGradient(counterpart.avatarSeed)}`}
            >
              <AvatarFallback className="bg-transparent text-white text-[9px]">
                {counterpart.alias.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-slate-200">{counterpart.alias}</span>
          </div>
          <div className={`text-[10px] ${rep.color}`}>
            ★ {counterpart.reputationScore.toFixed(0)} ·{" "}
            {timeAgo(trade.createdAt)}
          </div>
        </div>

        <div className="col-span-12 sm:col-span-3 flex sm:justify-end">
          <Badge
            variant="outline"
            className={`text-xs py-1 ${tradeStatusColor(trade.status)}`}
          >
            {tradeStatusLabel(trade.status)}
          </Badge>
        </div>
      </div>
    </Card>
  );
}

function TradeDetailModal({
  trade,
  currentUserId,
  onClose,
  onUpdate,
}: {
  trade: Trade;
  currentUserId: string;
  onClose: () => void;
  onUpdate: () => void;
}) {
  const { privateKey, escrowAddress } = useApp();
  const isBuyer = trade.buyer.id === currentUserId;
  const isSeller = trade.seller.id === currentUserId;
  const counterpart = isBuyer ? trade.seller : trade.buyer;
  const chain = trade.escrowChain ? CHAINS[trade.escrowChain] : null;
  const pm = PAYMENT_METHODS.find((p) => p.id === trade.paymentMethod);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState("");
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");

  async function ensureSigner() {
    const { connectWallet } = await import("@/lib/web3");
    const { signer, address } = await connectWallet();
    // Verificar que la wallet conectada coincide con el usuario logueado
    if (
      address.toLowerCase() !==
      (isSeller ? trade.seller : trade.buyer)?.walletAddress?.toLowerCase()
    ) {
      throw new Error(
        `Wallet conectada (${address}) no coincide con su usuario. Conecte la wallet correcta.`
      );
    }
    return signer;
  }

  async function updateStatus(status: string, extra: Record<string, unknown> = {}) {
    setActionLoading(true);
    setActionMsg("");
    try {
      const res = await fetch(`/api/trades/${trade.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onUpdate();
      onClose();
    } catch (e) {
      alert("Error: " + (e as Error).message);
    } finally {
      setActionLoading(false);
    }
  }

  // ====== Acciones on-chain reales (vía MetaMask + ethers) ======

  // Vendedor: fondear el escrow (createTrade + fundTrade)
  async function fundEscrowOnChain() {
    setActionLoading(true);
    setActionMsg("Conectando MetaMask…");
    try {
      if (!escrowAddress) {
        throw new Error(
          "No hay contrato de escrow desplegado. Vaya a la pestaña Desplegar contrato primero."
        );
      }
      const signer = await ensureSigner();

      // 1. computeTradeId determinista
      const { toBytes32 } = await import("@/lib/web3");
      const tradeId = toBytes32(trade.id);
      const tradeHash = toBytes32(`${trade.id}-${Date.now()}`);

      // 2. Aprobar y fondear (createTrade + fundTrade)
      setActionMsg("Confirmando createTrade en MetaMask…");
      const { createTradeOnChain, fundTradeOnChain } = await import("@/lib/web3");

      const tokenAddress = "0x0000000000000000000000000000000000000000"; // ETH nativo por ahora
      const arbitrator = "0x0000000000000000000000000000000000000000"; // sin árbitro

      // createTrade
      const createTxHash = await createTradeOnChain({
        escrowAddress,
        signer,
        tradeId,
        buyer: trade.buyer.walletAddress,
        arbitrator,
        token: tokenAddress,
        amount: String(trade.cryptoAmount),
        decimals: 18,
        paymentWindowSec: trade.offer.paymentWindowMin * 60,
        tradeHash,
      });

      setActionMsg("Confirmando fundTrade en MetaMask (enviar ETH al contrato)…");
      const fundTxHash = await fundTradeOnChain({
        escrowAddress,
        signer,
        tradeId,
        token: tokenAddress,
        amount: String(trade.cryptoAmount),
        decimals: 18,
      });

      setActionMsg("Transacción confirmada ✓");
      await updateStatus("ESCROW_FUNDED", {
        escrowAddress,
        escrowTxHash: fundTxHash,
      });
    } catch (e) {
      setActionMsg("");
      alert("Error on-chain: " + (e as Error).message);
    } finally {
      setActionLoading(false);
    }
  }

  // Vendedor: liberar fondos al comprador (releaseToBuyer)
  async function releaseOnChain() {
    setActionLoading(true);
    setActionMsg("Conectando MetaMask…");
    try {
      if (!escrowAddress) throw new Error("No hay contrato desplegado");
      const signer = await ensureSigner();
      const { toBytes32, releaseToBuyerOnChain } = await import("@/lib/web3");
      const tradeId = toBytes32(trade.id);

      setActionMsg("Confirmando releaseToBuyer en MetaMask…");
      const txHash = await releaseToBuyerOnChain({
        escrowAddress,
        signer,
        tradeId,
      });

      setActionMsg("Fondos liberados ✓");
      await updateStatus("COMPLETED", { releaseTxHash: txHash });
    } catch (e) {
      setActionMsg("");
      alert("Error on-chain: " + (e as Error).message);
    } finally {
      setActionLoading(false);
    }
  }

  // Cancelar trade on-chain
  async function cancelOnChain() {
    setActionLoading(true);
    setActionMsg("Conectando MetaMask…");
    try {
      if (!escrowAddress) {
        // Si no hay contrato, solo actualizamos DB
        await updateStatus("CANCELLED");
        return;
      }
      const signer = await ensureSigner();
      const { toBytes32, cancelTradeOnChain } = await import("@/lib/web3");
      const tradeId = toBytes32(trade.id);

      setActionMsg("Confirmando cancel en MetaMask…");
      await cancelTradeOnChain({ escrowAddress, signer, tradeId });

      setActionMsg("Trade cancelado ✓");
      await updateStatus("CANCELLED");
    } catch (e) {
      setActionMsg("");
      alert("Error on-chain: " + (e as Error).message);
    } finally {
      setActionLoading(false);
    }
  }

  // Abrir disputa on-chain + en DB
  async function openDisputeOnChain() {
    if (!disputeReason.trim()) return;
    setActionLoading(true);
    setActionMsg("Conectando MetaMask…");
    try {
      if (escrowAddress) {
        const signer = await ensureSigner();
        const { toBytes32, raiseDisputeOnChain } = await import("@/lib/web3");
        const tradeId = toBytes32(trade.id);
        setActionMsg("Confirmando raiseDispute en MetaMask…");
        await raiseDisputeOnChain({ escrowAddress, signer, tradeId });
      }

      // Abrir disputa en DB
      const res = await fetch("/api/disputes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tradeId: trade.id,
          openerId: currentUserId,
          reason: disputeReason,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDisputeOpen(false);
      onUpdate();
      onClose();
    } catch (e) {
      setActionMsg("");
      alert("Error: " + (e as Error).message);
    } finally {
      setActionLoading(false);
    }
  }

  // Pasos del flujo
  const steps = [
    { key: "PENDING_ESCROW", label: "Esperando escrow", icon: Shield },
    { key: "ESCROW_FUNDED", label: "Escrow activo", icon: Lock },
    { key: "PAYMENT_SENT", label: "Pago enviado", icon: Send },
    { key: "PAYMENT_CONFIRMED", label: "Pago confirmado", icon: CheckCircle2 },
    { key: "COMPLETED", label: "Completado", icon: Star },
  ];
  const currentStepIdx = steps.findIndex((s) => s.key === trade.status);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-emerald-400 flex items-center justify-between">
            <span>Trade {trade.id.slice(-8)}</span>
            <Badge
              variant="outline"
              className={`text-xs ${tradeStatusColor(trade.status)}`}
            >
              {tradeStatusLabel(trade.status)}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="detalle">
          <TabsList className="grid w-full grid-cols-3 bg-slate-950 border border-slate-800">
            <TabsTrigger value="detalle" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
              Detalle
            </TabsTrigger>
            <TabsTrigger value="flujo" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
              Flujo
            </TabsTrigger>
            <TabsTrigger value="chat" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
              Chat E2E
            </TabsTrigger>
          </TabsList>

          {/* Detalle */}
          <TabsContent value="detalle" className="space-y-3 mt-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <Card className="bg-slate-950 border-slate-800 p-3">
                <div className="text-[10px] text-slate-500 uppercase">Cantidad</div>
                <div className="font-mono text-slate-100">
                  {fmtCrypto(trade.cryptoAmount)} {trade.offer.asset}
                </div>
              </Card>
              <Card className="bg-slate-950 border-slate-800 p-3">
                <div className="text-[10px] text-slate-500 uppercase">Total fiat</div>
                <div className="font-mono text-emerald-400">
                  {fmtFiat(trade.fiatAmount, trade.offer.currency)}
                </div>
              </Card>
              <Card className="bg-slate-950 border-slate-800 p-3">
                <div className="text-[10px] text-slate-500 uppercase">Precio</div>
                <div className="font-mono text-slate-200 text-xs">
                  {fmtFiat(trade.pricePerUnit, trade.offer.currency)}/{trade.offer.asset}
                </div>
              </Card>
              <Card className="bg-slate-950 border-slate-800 p-3">
                <div className="text-[10px] text-slate-500 uppercase">Método</div>
                <div className="text-slate-200 text-xs">
                  {pm?.icon} {pm?.label || trade.paymentMethod}
                </div>
              </Card>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <Card className="bg-slate-950 border-slate-800 p-3">
                <div className="text-[10px] text-slate-500 uppercase">Comprador</div>
                <div className="text-slate-200 text-xs">
                  {trade.buyer.alias}
                  {isBuyer && (
                    <span className="ml-1 text-emerald-400">(usted)</span>
                  )}
                </div>
              </Card>
              <Card className="bg-slate-950 border-slate-800 p-3">
                <div className="text-[10px] text-slate-500 uppercase">Vendedor</div>
                <div className="text-slate-200 text-xs">
                  {trade.seller.alias}
                  {isSeller && (
                    <span className="ml-1 text-emerald-400">(usted)</span>
                  )}
                </div>
              </Card>
            </div>

            {trade.offer.terms && (
              <Card className="bg-slate-950 border-slate-800 p-3">
                <div className="text-[10px] text-slate-500 uppercase mb-1">
                  Términos
                </div>
                <p className="text-xs text-slate-300">{trade.offer.terms}</p>
              </Card>
            )}

            {trade.escrowAddress && (
              <Card className="bg-slate-950 border-slate-800 p-3">
                <div className="text-[10px] text-slate-500 uppercase">
                  Escrow on-chain
                </div>
                <div className="font-mono text-xs text-emerald-400 break-all">
                  {trade.escrowAddress}
                </div>
                {trade.escrowTxHash && (
                  <div className="font-mono text-[10px] text-slate-500 mt-1 break-all">
                    tx: {trade.escrowTxHash}
                  </div>
                )}
              </Card>
            )}

            <div className="text-[10px] text-slate-500 space-y-0.5">
              <div>Creado: {fmtDate(trade.createdAt)}</div>
              {trade.escrowFundedAt && <div>Escrow fondeado: {fmtDate(trade.escrowFundedAt)}</div>}
              {trade.paymentSentAt && <div>Pago enviado: {fmtDate(trade.paymentSentAt)}</div>}
              {trade.paymentConfirmedAt && <div>Pago confirmado: {fmtDate(trade.paymentConfirmedAt)}</div>}
              {trade.completedAt && <div>Completado: {fmtDate(trade.completedAt)}</div>}
            </div>
          </TabsContent>

          {/* Flujo */}
          <TabsContent value="flujo" className="space-y-4 mt-3">
            <div className="space-y-2">
              {steps.map((s, i) => {
                const Icon = s.icon;
                const done = i < currentStepIdx;
                const current = i === currentStepIdx;
                return (
                  <div
                    key={s.key}
                    className={`flex items-center gap-3 p-2 rounded-md ${
                      current
                        ? "bg-emerald-950/30 border border-emerald-900/50"
                        : done
                        ? "opacity-60"
                        : "opacity-30"
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        done
                          ? "bg-emerald-600 text-white"
                          : current
                          ? "bg-emerald-950 border border-emerald-700 text-emerald-400"
                          : "bg-slate-800 text-slate-500"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm text-slate-200">{s.label}</div>
                      {current && (
                        <div className="text-[10px] text-emerald-400">
                          En curso…
                        </div>
                      )}
                    </div>
                    {done && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Acciones según rol y estado */}
            <div className="border-t border-slate-800 pt-3 space-y-2">
              <div className="text-xs text-slate-400 mb-2">
                Acciones disponibles ({isBuyer ? "comprador" : "vendedor"}):
              </div>

              {isSeller && trade.status === "PENDING_ESCROW" && (
                <Button
                  onClick={fundEscrowOnChain}
                  disabled={actionLoading}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Lock className="w-4 h-4 mr-2" />
                  {escrowAddress
                    ? "Depositar en escrow (on-chain real)"
                    : "Depositar en escrow (registro local)"}
                </Button>
              )}

              {isBuyer && trade.status === "ESCROW_FUNDED" && (
                <Button
                  onClick={() => updateStatus("PAYMENT_SENT")}
                  disabled={actionLoading}
                  className="w-full bg-cyan-600 hover:bg-cyan-700 text-white"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Marcar pago enviado
                </Button>
              )}

              {isSeller && trade.status === "PAYMENT_SENT" && (
                <>
                  <Button
                    onClick={() => updateStatus("PAYMENT_CONFIRMED")}
                    disabled={actionLoading}
                    variant="outline"
                    className="w-full border-teal-700 text-teal-300 hover:bg-teal-950/30"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Confirmar recepción del pago
                  </Button>
                  <Button
                    onClick={releaseOnChain}
                    disabled={actionLoading}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <Star className="w-4 h-4 mr-2" />
                    Liberar fondos del escrow (on-chain real)
                  </Button>
                </>
              )}

              {(trade.status === "PENDING_ESCROW" ||
                trade.status === "ESCROW_FUNDED" ||
                trade.status === "PAYMENT_SENT") && (
                <Button
                  onClick={cancelOnChain}
                  disabled={actionLoading}
                  variant="outline"
                  className="w-full border-slate-700 text-slate-400 hover:bg-slate-800"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Cancelar trade
                </Button>
              )}

              {(trade.status === "ESCROW_FUNDED" ||
                trade.status === "PAYMENT_SENT") && (
                <Button
                  onClick={() => setDisputeOpen(!disputeOpen)}
                  disabled={actionLoading}
                  variant="outline"
                  className="w-full border-red-900/50 text-red-400 hover:bg-red-950/30"
                >
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Abrir disputa{escrowAddress ? " (on-chain)" : ""}
                </Button>
              )}

              {disputeOpen && (
                <div className="space-y-2 p-3 rounded-md bg-red-950/20 border border-red-900/40">
                  <textarea
                    value={disputeReason}
                    onChange={(e) => setDisputeReason(e.target.value)}
                    placeholder="Explique el motivo de la disputa…"
                    className="w-full bg-slate-950 border border-slate-700 text-slate-100 text-sm p-2 rounded-md"
                    rows={3}
                  />
                  <Button
                    onClick={openDisputeOnChain}
                    disabled={actionLoading || !disputeReason.trim()}
                    className="w-full bg-red-600 hover:bg-red-700 text-white"
                  >
                    {escrowAddress
                      ? "Confirmar disputa on-chain"
                      : "Confirmar disputa"}
                  </Button>
                </div>
              )}

              {actionMsg && (
                <div className="flex items-center gap-2 text-xs text-emerald-300 bg-emerald-950/30 border border-emerald-900/50 p-2 rounded-md">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {actionMsg}
                </div>
              )}

              {trade.status === "COMPLETED" && (
                <Card className="bg-emerald-950/30 border-emerald-900/50 p-3 text-center">
                  <Star className="w-6 h-6 text-emerald-400 mx-auto mb-1" />
                  <p className="text-sm text-emerald-300 font-medium">
                    Trade completado
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    No olvide dejar feedback a {counterpart.alias} en la
                    pestaña Reputación.
                  </p>
                </Card>
              )}

              {trade.status === "DISPUTED" && (
                <Card className="bg-red-950/30 border-red-900/50 p-3 text-center">
                  <AlertTriangle className="w-6 h-6 text-red-400 mx-auto mb-1" />
                  <p className="text-sm text-red-300 font-medium">
                    Trade en disputa
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Un árbitro revisará el caso. Tiempo estimado: 24-48h.
                  </p>
                </Card>
              )}

              {actionLoading && (
                <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Procesando…
                </div>
              )}
            </div>
          </TabsContent>

          {/* Chat */}
          <TabsContent value="chat" className="mt-3">
            <TradeChat
              tradeId={trade.id}
              currentUserId={currentUserId}
              counterpartPublicKey={counterpart.publicKey}
              myPrivateKey={privateKey}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
