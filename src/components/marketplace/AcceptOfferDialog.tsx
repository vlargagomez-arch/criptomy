"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Lock, AlertCircle } from "lucide-react";
import { encryptMessage } from "@/lib/crypto";
import { fmtCrypto, fmtFiat } from "@/lib/format";
import { PAYMENT_METHODS, CHAINS } from "@/lib/blockchain/config";

interface OfferCreator {
  id: string;
  alias: string;
  reputationScore: number;
  totalTrades: number;
  avatarSeed: string | null;
  torOnly: boolean;
  publicKey?: string | null;
}

interface Offer {
  id: string;
  type: "BUY" | "SELL";
  chain: keyof typeof CHAINS;
  asset: string;
  amount: number;
  minAmount: number | null;
  maxAmount: number | null;
  currency: string;
  pricePerUnit: number;
  paymentMethods: string;
  terms: string;
  paymentWindowMin: number;
  creator: OfferCreator;
}

interface Props {
  offer: Offer;
  onClose: () => void;
}

export default function AcceptOfferDialog({ offer, onClose }: Props) {
  const { user, privateKey, setTab } = useApp();
  const [amount, setAmount] = useState<string>("");
  const [method, setMethod] = useState<string>("");
  const [paymentDetails, setPaymentDetails] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Cargar publicKey de la contraparte si no viene
  useEffect(() => {
    if (!offer.creator.publicKey && offer.creator.id) {
      fetch(`/api/reputation?userId=${offer.creator.id}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.user?.publicKey) {
            offer.creator.publicKey = d.user.publicKey;
          }
        })
        .catch(() => {});
    }
  }, [offer]);

  const chain = CHAINS[offer.chain];
  const methods = offer.paymentMethods.split(",");

  const amountNum = parseFloat(amount) || 0;
  const fiatTotal = amountNum * offer.pricePerUnit;
  const isSell = offer.type === "SELL";
  // Para SELL offer: el que acepta es comprador (paga fiat, recibe cripto)
  // Para BUY offer: el que acepta es vendedor (recibe fiat, envía cripto)
  const myRole = isSell ? "comprador" : "vendedor";

  const min = offer.minAmount || 0;
  const max = offer.maxAmount || offer.amount;
  const validAmount = amountNum >= min && amountNum <= max;

  async function handleSubmit() {
    setError("");
    if (!user) return;
    if (!validAmount) {
      setError(
        `Cantidad debe estar entre ${min} y ${max} ${offer.asset}`
      );
      return;
    }
    if (!method) {
      setError("Seleccione un método de pago");
      return;
    }
    if (!paymentDetails.trim()) {
      setError("Indique sus datos de pago (Nequi, cuenta, etc.)");
      return;
    }

    setLoading(true);
    try {
      // Cifrar los paymentDetails con la clave pública del creador
      let encryptedDetails = paymentDetails;
      if (offer.creator.publicKey && privateKey) {
        const enc = await encryptMessage(
          paymentDetails,
          offer.creator.publicKey,
          privateKey
        );
        encryptedDetails = JSON.stringify({
          ciphertext: enc.ciphertext,
          nonce: enc.nonce,
        });
      }

      const res = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offerId: offer.id,
          buyerId: user.id,
          cryptoAmount: amountNum,
          paymentMethod: method,
          paymentDetails: encryptedDetails,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      onClose();
      setTab("trades");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-emerald-400">
            {isSell ? "Comprar" : "Vender"} {offer.asset} a{" "}
            {offer.creator.alias}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Usted será el <strong>{myRole}</strong>. El smart contract de
            escrow retendrá los fondos hasta que se complete el pago fiat.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Resumen */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-md bg-slate-950 border border-slate-800 p-3">
              <div className="text-[10px] text-slate-500 uppercase">Cadena</div>
              <div className="flex items-center gap-1.5 text-slate-200">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: chain?.color }}
                />
                {chain?.name}
              </div>
            </div>
            <div className="rounded-md bg-slate-950 border border-slate-800 p-3">
              <div className="text-[10px] text-slate-500 uppercase">Precio</div>
              <div className="text-slate-200 font-mono text-xs">
                {fmtFiat(offer.pricePerUnit, offer.currency)}/{offer.asset}
              </div>
            </div>
          </div>

          {/* Cantidad */}
          <div className="space-y-1.5">
            <Label className="text-slate-300">
              Cantidad de {offer.asset} a {isSell ? "comprar" : "vender"}
            </Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`${min} - ${max}`}
              className="bg-slate-950 border-slate-700 text-slate-100 font-mono"
            />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>
                Min: {fmtCrypto(min)} · Max: {fmtCrypto(max)}
              </span>
              {amountNum > 0 && (
                <span className="text-emerald-400 font-medium">
                  Total: {fmtFiat(fiatTotal, offer.currency)}
                </span>
              )}
            </div>
          </div>

          {/* Método de pago */}
          <div className="space-y-1.5">
            <Label className="text-slate-300">Método de pago</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger className="bg-slate-950 border-slate-700 text-slate-100">
                <SelectValue placeholder="Seleccione…" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700 text-slate-100">
                {methods.map((m) => {
                  const pm = PAYMENT_METHODS.find((p) => p.id === m);
                  return (
                    <SelectItem key={m} value={m}>
                      {pm?.icon} {pm?.label || m}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Detalles de pago (se cifran) */}
          <div className="space-y-1.5">
            <Label className="text-slate-300 flex items-center gap-1.5">
              <Lock className="w-3 h-3 text-emerald-400" />
              Sus datos de pago / contacto
            </Label>
            <Textarea
              value={paymentDetails}
              onChange={(e) => setPaymentDetails(e.target.value)}
              placeholder={
                isSell
                  ? "Ej: Nequi 3001234567 - María. Enviaré comprobante por chat."
                  : "Ej: Cuenta Bancolomba ahorros 123-456-789. Envío comprobante tras recibir pago."
              }
              className="bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-600 text-sm font-mono"
              rows={3}
            />
            <p className="text-[10px] text-slate-500 flex items-center gap-1">
              <Lock className="w-2.5 h-2.5" />
              Se cifra E2E con la clave pública de {offer.creator.alias}. El
              servidor no puede leerlo.
            </p>
          </div>

          {error && (
            <div className="rounded-md bg-red-950/50 border border-red-900/50 p-2.5 text-xs text-red-300 flex items-start gap-2">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {/* Términos del creador */}
          {offer.terms && (
            <div className="rounded-md bg-slate-950 border border-slate-800 p-3">
              <div className="text-[10px] text-slate-500 uppercase mb-1">
                Términos del {isSell ? "vendedor" : "comprador"}
              </div>
              <p className="text-xs text-slate-300">{offer.terms}</p>
            </div>
          )}
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
            onClick={handleSubmit}
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : null}
            Iniciar trade
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
