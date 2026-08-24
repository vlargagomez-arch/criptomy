"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  Shield,
  Scale,
  Clock,
  CheckCircle2,
  XCircle,
  Upload,
  FileText,
  ExternalLink,
  Loader2,
  Globe,
  Hash,
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

interface KlerosInfo {
  costEth: string;
  costUSD: number | null;
}

export default function DisputesView() {
  const { user, setTab } = useApp();
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [klerosInfo, setKlerosInfo] = useState<KlerosInfo | null>(null);
  const [uploadModal, setUploadModal] = useState<Dispute | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchDisputes();
    fetchKlerosInfo();
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

  async function fetchKlerosInfo() {
    try {
      const res = await fetch("/api/kleros?op=cost");
      const data = await res.json();
      if (data.costEth) {
        // Convertir a USD usando Chainlink
        const priceRes = await fetch("/api/price?pair=ETH/USD");
        const priceData = await priceRes.json();
        setKlerosInfo({
          costEth: data.costEth,
          costUSD: priceData?.price
            ? parseFloat(data.costEth) * priceData.price
            : null,
        });
      }
    } catch (e) {
      console.error(e);
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
          Arbitraje descentralizado vía Kleros · evidencia en IPFS
        </p>
      </div>

      {/* Cómo funciona: Kleros + IPFS */}
      <Card className="bg-slate-900/60 border-slate-800 p-5">
        <h3 className="text-sm font-semibold text-slate-100 mb-3 flex items-center gap-2">
          <Scale className="w-4 h-4 text-emerald-400" />
          Arbitraje descentralizado con Kleros Court
        </h3>
        <div className="grid md:grid-cols-5 gap-3 text-xs">
          {[
            {
              n: 1,
              t: "Abrir disputa",
              d: "Cualquiera de las partes la abre localmente con motivo.",
              icon: AlertTriangle,
            },
            {
              n: 2,
              t: "Subir evidencia a IPFS",
              d: "Screenshots, comprobantes, chat. Se sube a IPFS y devuelve un CID.",
              icon: Upload,
            },
            {
              n: 3,
              t: "Crear caso en Kleros",
              d: "Se crea el caso on-chain en Kleros Court pagando el fee de arbitraje.",
              icon: Scale,
            },
            {
              n: 4,
              t: "Jurados votan",
              d: "Jurados aleatorios (con stake PNK) revisan la evidencia y votan (24-72h).",
              icon: Clock,
            },
            {
              n: 5,
              t: "Resolución ejecutada",
              d: "El smart contract de escrow ejecuta la resolución (libera o devuelve fondos).",
              icon: CheckCircle2,
            },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.n}
                className="p-3 rounded-md bg-slate-950 border border-slate-800"
              >
                <div className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center mb-2">
                  {s.n}
                </div>
                <Icon className="w-3.5 h-3.5 text-emerald-400 mb-1" />
                <div className="text-slate-200 font-medium mb-0.5 text-xs">
                  {s.t}
                </div>
                <p className="text-slate-500 leading-relaxed text-[10px]">
                  {s.d}
                </p>
              </div>
            );
          })}
        </div>
        {klerosInfo && (
          <div className="mt-3 p-2 rounded-md bg-emerald-950/30 border border-emerald-900/50 text-xs text-emerald-300 flex items-center justify-between">
            <span>
              Costo actual de arbitraje en Kleros Court (General):
            </span>
            <span className="font-mono">
              {parseFloat(klerosInfo.costEth).toFixed(4)} ETH
              {klerosInfo.costUSD && (
                <span className="text-slate-400 ml-2">
                  ≈ ${klerosInfo.costUSD.toFixed(2)} USD
                </span>
              )}
            </span>
          </div>
        )}
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
            <DisputeRow
              key={d.id}
              dispute={d}
              onUploadEvidence={() => setUploadModal(d)}
            />
          ))}
        </div>
      )}

      {uploadModal && (
        <UploadEvidenceModal
          dispute={uploadModal}
          onClose={() => setUploadModal(null)}
          onUploaded={() => {
            setUploadModal(null);
            fetchDisputes();
          }}
        />
      )}
    </div>
  );
}

function DisputeRow({
  dispute,
  onUploadEvidence,
}: {
  dispute: Dispute;
  onUploadEvidence: () => void;
}) {
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

  const hasIPFSEvidence =
    dispute.evidence &&
    (dispute.evidence.startsWith("Qm") || dispute.evidence.startsWith("bafy"));

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

      {/* Evidencia */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {dispute.evidence ? (
          <a
            href={`https://ipfs.io/ipfs/${dispute.evidence}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-emerald-400 hover:underline"
          >
            <Globe className="w-3 h-3" />
            Ver evidencia IPFS: {dispute.evidence.slice(0, 12)}…
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
        ) : (
          <span className="text-xs text-slate-500">Sin evidencia adjunta</span>
        )}
        {dispute.status === "OPEN" && (
          <Button
            size="sm"
            variant="outline"
            onClick={onUploadEvidence}
            className="ml-auto border-emerald-700/50 text-emerald-300 hover:bg-emerald-950/30 text-xs h-7"
          >
            <Upload className="w-3 h-3 mr-1" />
            {hasIPFSEvidence ? "Actualizar evidencia" : "Subir a IPFS + Kleros"}
          </Button>
        )}
      </div>

      {dispute.resolution && (
        <div className="mt-3 p-2 rounded bg-emerald-950/30 border border-emerald-900/50">
          <div className="text-[10px] text-emerald-500 uppercase mb-1">
            Resolución
          </div>
          <p className="text-xs text-emerald-200">{dispute.resolution}</p>
        </div>
      )}
    </Card>
  );
}

// ============================================================
// Modal: Subir evidencia a IPFS + crear caso en Kleros
// ============================================================

function UploadEvidenceModal({
  dispute,
  onClose,
  onUploaded,
}: {
  dispute: Dispute;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const { user } = useApp();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    cid: string;
    url: string;
    size: number;
  } | null>(null);
  const [creatingKleros, setCreatingKleros] = useState(false);
  const [klerosResult, setKlerosResult] = useState<{
    disputeID: string;
    txHash: string;
    caseURL: string;
    cost: string;
  } | null>(null);
  const [error, setError] = useState("");

  async function handleUploadToIPFS() {
    setError("");
    if (!title.trim() || !description.trim()) {
      setError("Complete título y descripción");
      return;
    }
    setUploading(true);
    try {
      const evidence = {
        tradeId: dispute.trade.id,
        title,
        description,
        submittedBy: user?.walletAddress || "anonymous",
        submittedAt: Math.floor(Date.now() / 1000),
        chain: "ETHEREUM",
        cryptoAmount: dispute.trade.cryptoAmount,
        fiatAmount: dispute.trade.fiatAmount,
        paymentMethod: dispute.trade.buyer.alias, // placeholder
      };
      const res = await fetch("/api/ipfs?op=upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: JSON.stringify(evidence, null, 2),
          filename: `evidence-${dispute.id}.json`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUploadResult({
        cid: data.cid,
        url: data.url,
        size: data.size,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function handleCreateKlerosDispute() {
    setError("");
    if (!uploadResult) {
      setError("Suba la evidencia a IPFS primero");
      return;
    }
    setCreatingKleros(true);
    try {
      // 1. Conectar wallet
      const { connectWallet } = await import("@/lib/web3");
      const { signer, address } = await connectWallet();
      if (
        address.toLowerCase() !== user?.walletAddress?.toLowerCase()
      ) {
        throw new Error("Wallet conectada no coincide con su usuario");
      }

      // 2. Crear disputa en Kleros
      const { createKlerosDispute } = await import("@/lib/kleros");
      const result = await createKlerosDispute({
        signer,
        numberOfChoices: 2, // comprador gana / vendedor gana
        evidenceCID: uploadResult.cid,
        metaEvidenceCID: uploadResult.cid, // simplificado: misma evidencia
      });

      setKlerosResult({
        disputeID: result.disputeID,
        txHash: result.txHash,
        caseURL: `https://court.kleros.io/cases/${result.disputeID}`,
        cost: result.arbitrationCost,
      });

      // Actualizar la disputa local con el CID
      await fetch("/api/disputes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tradeId: dispute.trade.id,
          openerId: user!.id,
          reason: `${dispute.reason} [Kleros #${result.disputeID}] [IPFS: ${uploadResult.cid}]`,
          evidence: uploadResult.cid,
        }),
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreatingKleros(false);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-emerald-400 flex items-center gap-2">
            <Scale className="w-5 h-5" />
            Escalar a Kleros Court
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Suba evidencia a IPFS (descentralizada e inmutable) y cree un caso
            en Kleros Court para arbitraje descentralizado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Paso 1: Detalles de la evidencia */}
          {!uploadResult && (
            <>
              <div className="space-y-2">
                <Label className="text-slate-300">Título de la evidencia</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ej: Comprobante de pago Nequi enviado"
                  className="bg-slate-950 border-slate-700 text-slate-100"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Descripción detallada</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Explique qué evidencia se adjunta, fechas, montos, IDs de transacción…"
                  className="bg-slate-950 border-slate-700 text-slate-100 text-sm"
                  rows={4}
                />
              </div>
              <div className="rounded-md bg-slate-950 border border-slate-800 p-3 text-xs text-slate-400">
                <div className="flex items-center gap-1.5 mb-1">
                  <FileText className="w-3 h-3 text-emerald-400" />
                  <span className="text-slate-300">¿Qué incluir?</span>
                </div>
                Comprobantes de pago, capturas de chat, hash de transacciones
                on-chain, IDs de cuenta fiat (sin datos sensibles).
              </div>
              <Button
                onClick={handleUploadToIPFS}
                disabled={uploading}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Subiendo a IPFS…
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Subir evidencia a IPFS
                  </>
                )}
              </Button>
            </>
          )}

          {/* Paso 2: Confirmar subida IPFS */}
          {uploadResult && !klerosResult && (
            <div className="space-y-3">
              <Card className="bg-emerald-950/30 border-emerald-900/50 p-3">
                <div className="flex items-center gap-2 text-emerald-300 text-sm mb-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Evidencia subida a IPFS
                </div>
                <div className="text-xs space-y-1">
                  <div className="flex items-center gap-2">
                    <Hash className="w-3 h-3 text-slate-500" />
                    <span className="text-slate-500">CID:</span>
                    <code className="text-emerald-400 font-mono text-[11px] break-all">
                      {uploadResult.cid}
                    </code>
                  </div>
                  <div className="text-slate-500">
                    Tamaño: {uploadResult.size} bytes
                  </div>
                </div>
                <a
                  href={uploadResult.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-xs text-emerald-400 hover:underline"
                >
                  Ver en gateway IPFS <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </Card>

              <div className="rounded-md bg-blue-950/30 border border-blue-900/50 p-3 text-xs text-blue-200">
                <div className="flex items-center gap-1.5 mb-2">
                  <Scale className="w-3 h-3" />
                  <span className="font-medium">Crear caso en Kleros Court</span>
                </div>
                <p className="text-slate-400 mb-2">
                  Esto creará una disputa on-chain en Kleros Court (Ethereum
                  mainnet). Jurados aleatorios revisarán la evidencia y votarán.
                </p>
                {klerosInfo && (
                  <div className="text-[10px] text-slate-400">
                    Costo: {parseFloat(klerosInfo.costEth).toFixed(4)} ETH
                    {klerosInfo.costUSD && (
                      <span className="ml-1">
                        ≈ ${klerosInfo.costUSD.toFixed(2)} USD
                      </span>
                    )}
                  </div>
                )}
              </div>

              <Button
                onClick={handleCreateKlerosDispute}
                disabled={creatingKleros}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                {creatingKleros ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creando disputa on-chain…
                  </>
                ) : (
                  <>
                    <Scale className="w-4 h-4 mr-2" />
                    Crear caso en Kleros (firmar tx)
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Paso 3: Confirmación Kleros */}
          {klerosResult && (
            <Card className="bg-emerald-950/30 border-emerald-900/50 p-4 space-y-3">
              <div className="flex items-center gap-2 text-emerald-300">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-medium">Caso creado en Kleros Court</span>
              </div>
              <div className="text-xs space-y-2">
                <div>
                  <span className="text-slate-500">Dispute ID:</span>{" "}
                  <code className="text-emerald-400 font-mono">
                    #{klerosResult.disputeID}
                  </code>
                </div>
                <div>
                  <span className="text-slate-500">Tx Hash:</span>{" "}
                  <code className="text-slate-300 font-mono text-[10px] break-all">
                    {klerosResult.txHash}
                  </code>
                </div>
                <div>
                  <span className="text-slate-500">Costo:</span>{" "}
                  <span className="text-slate-300">
                    {klerosResult.cost} ETH
                  </span>
                </div>
              </div>
              <a
                href={klerosResult.caseURL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-emerald-400 hover:underline"
              >
                Ver caso en Kleros Court <ExternalLink className="w-3 h-3" />
              </a>
              <Button
                onClick={onUploaded}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Listo
              </Button>
            </Card>
          )}

          {error && (
            <div className="rounded-md bg-red-950/50 border border-red-900/50 p-2.5 text-xs text-red-300">
              {error}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
