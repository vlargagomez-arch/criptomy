"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/lib/store";
import { Card } from "@/components/ui/card";
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
  Zap,
  Copy,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  Wallet,
  ArrowDown,
} from "lucide-react";
import { formatSats, hasLightningWallet } from "@/lib/lightning";

interface Invoice {
  paymentHash: string;
  paymentRequest: string;
  amountSats: number;
  description: string;
  createdAt: number;
  expiresAt: number;
  status: "pending" | "paid" | "expired";
}

export default function LightningView() {
  const { user } = useApp();
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [generating, setGenerating] = useState(false);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [btcPrice, setBtcPrice] = useState<number | null>(null);
  const [payInvoice, setPayInvoice] = useState("");
  const [paying, setPaying] = useState(false);
  const [payResult, setPayResult] = useState<{ status: string; preimage: string } | null>(null);
  const [weblnAvailable, setWeblnAvailable] = useState(false);

  useEffect(() => {
    fetchBtcPrice();
    setWeblnAvailable(hasLightningWallet());
  }, []);

  async function fetchBtcPrice() {
    try {
      const res = await fetch("/api/lightning?op=price");
      const data = await res.json();
      setBtcPrice(data.btcUSD);
    } catch (e) {
      console.error(e);
    }
  }

  async function handleGenerateInvoice() {
    if (!amount || parseInt(amount) < 1) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/lightning?op=invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseInt(amount),
          description,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setInvoice(data);
    } catch (e) {
      alert("Error: " + (e as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  async function handlePayInvoice() {
    if (!payInvoice.startsWith("lnbc")) {
      alert("Invoice inválido. Debe empezar con 'lnbc'");
      return;
    }
    setPaying(true);
    try {
      // Si WebLN está disponible, usarlo
      if (weblnAvailable) {
        const { payInvoiceWebLN } = await import("@/lib/lightning");
        const result = await payInvoiceWebLN(payInvoice);
        if (result) {
          setPayResult({ status: "paid", preimage: result.preimage });
          return;
        }
      }
      // Fallback: simular pago vía API
      const res = await fetch("/api/lightning?op=pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoice: payInvoice }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPayResult(data);
    } catch (e) {
      alert("Error: " + (e as Error).message);
    } finally {
      setPaying(false);
    }
  }

  const usdValue = btcPrice && amount ? (parseInt(amount) / 100_000_000) * btcPrice : 0;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-400" />
          Lightning Network
        </h1>
        <p className="text-sm text-slate-400">
          Micropagos instantáneos de Bitcoin · comisiones de fracciones de centavo
        </p>
      </div>

      {/* Estado WebLN */}
      <Card className={`p-4 border ${weblnAvailable ? "bg-emerald-950/20 border-emerald-900/50" : "bg-slate-900/60 border-slate-800"}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className={`w-4 h-4 ${weblnAvailable ? "text-emerald-400" : "text-slate-500"}`} />
            <span className="text-sm font-medium text-slate-200">
              {weblnAvailable ? "Wallet Lightning detectada (WebLN)" : "Sin wallet Lightning"}
            </span>
          </div>
          {weblnAvailable ? (
            <Badge className="bg-emerald-950/50 border-emerald-700 text-emerald-400">
              <CheckCircle2 className="w-3 h-3 mr-1" /> Alby/WebLN
            </Badge>
          ) : (
            <a
              href="https://getalby.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-emerald-400 hover:underline flex items-center gap-1"
            >
              Instalar Alby <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </Card>

      {/* Precio BTC */}
      {btcPrice && (
        <Card className="bg-slate-900/60 border-slate-800 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Precio BTC (Chainlink)</span>
            <span className="font-mono text-emerald-400">
              ${btcPrice.toLocaleString("en-US", { maximumFractionDigits: 0 })} USD
            </span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-slate-400">1 sat</span>
            <span className="font-mono text-slate-300">
              ≈ ${(btcPrice / 100_000_000).toFixed(5)} USD
            </span>
          </div>
        </Card>
      )}

      {/* Generar invoice */}
      <Card className="bg-slate-900/60 border-slate-800 p-5">
        <h3 className="text-sm font-semibold text-slate-100 mb-3 flex items-center gap-2">
          <ArrowDown className="w-4 h-4 text-emerald-400" />
          Recibir pago (generar invoice)
        </h3>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-slate-300 mb-1.5 block">Cantidad (sats)</Label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="1000"
                className="bg-slate-950 border-slate-700 text-slate-100 font-mono"
              />
            </div>
            <div>
              <Label className="text-slate-300 mb-1.5 block">≈ USD</Label>
              <div className="h-10 flex items-center px-3 rounded-md bg-slate-950 border border-slate-700 font-mono text-emerald-400">
                ${usdValue.toFixed(4)}
              </div>
            </div>
          </div>
          <div>
            <Label className="text-slate-300 mb-1.5 block">Descripción</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Pago por trade P2P"
              className="bg-slate-950 border-slate-700 text-slate-100"
            />
          </div>
          <Button
            onClick={handleGenerateInvoice}
            disabled={generating || !amount}
            className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-medium"
          >
            {generating ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Zap className="w-4 h-4 mr-2" />
            )}
            Generar invoice
          </Button>
        </div>

        {invoice && (
          <div className="mt-4 space-y-3">
            <div className="p-3 rounded-md bg-slate-950 border border-yellow-700/50">
              <div className="text-[10px] text-slate-500 uppercase mb-1">
                BOLT11 Payment Request
              </div>
              <code className="text-xs font-mono text-yellow-400 break-all">
                {invoice.paymentRequest}
              </code>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  {formatSats(invoice.amountSats)}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => navigator.clipboard?.writeText(invoice.paymentRequest)}
                  className="text-slate-400 hover:text-slate-200 text-xs h-6"
                >
                  <Copy className="w-3 h-3 mr-1" /> Copiar
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Clock className="w-3 h-3" />
              Expira en 1 hora · Estado:{" "}
              <Badge variant="outline" className="text-[10px] bg-yellow-950/30 border-yellow-700 text-yellow-400">
                {invoice.status}
              </Badge>
            </div>
          </div>
        )}
      </Card>

      {/* Pagar invoice */}
      <Card className="bg-slate-900/60 border-slate-800 p-5">
        <h3 className="text-sm font-semibold text-slate-100 mb-3 flex items-center gap-2">
          <Zap className="w-4 h-4 text-yellow-400" />
          Pagar invoice
        </h3>
        <div className="space-y-3">
          <div>
            <Label className="text-slate-300 mb-1.5 block">BOLT11 invoice</Label>
            <Textarea
              value={payInvoice}
              onChange={(e) => setPayInvoice(e.target.value)}
              placeholder="lnbc10u1pwyj..."
              className="bg-slate-950 border-slate-700 text-slate-100 font-mono text-xs"
              rows={3}
            />
          </div>
          <Button
            onClick={handlePayInvoice}
            disabled={paying || !payInvoice}
            className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-medium"
          >
            {paying ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Zap className="w-4 h-4 mr-2" />
            )}
            {weblnAvailable ? "Pagar con WebLN" : "Pagar (simulado)"}
          </Button>
          {payResult && (
            <div className="p-3 rounded-md bg-emerald-950/30 border border-emerald-900/50">
              <div className="flex items-center gap-2 text-emerald-300 text-sm mb-2">
                <CheckCircle2 className="w-4 h-4" />
                Pago exitoso
              </div>
              <div className="text-[10px] text-slate-500">Preimage:</div>
              <code className="text-xs font-mono text-emerald-400 break-all">
                {payResult.preimage}
              </code>
            </div>
          )}
          {!weblnAvailable && (
            <div className="flex items-start gap-2 text-xs text-yellow-400">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>
                Sin wallet WebLN: el pago se simula. Instale Alby para pagos
                reales desde el navegador.
              </span>
            </div>
          )}
        </div>
      </Card>

      {/* Info */}
      <Card className="bg-slate-900/60 border-slate-800 p-5">
        <h3 className="text-sm font-semibold text-slate-100 mb-2">
          ¿Por qué Lightning Network?
        </h3>
        <div className="grid md:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded bg-slate-950 border border-slate-800">
            <Zap className="w-4 h-4 text-yellow-400 mb-1" />
            <div className="text-slate-200 font-medium mb-1">Instantáneo</div>
            <p className="text-slate-500">
              Pagos confirmados en milisegundos, no en bloques (10 min BTC).
            </p>
          </div>
          <div className="p-3 rounded bg-slate-950 border border-slate-800">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 mb-1" />
            <div className="text-slate-200 font-medium mb-1">Barato</div>
            <p className="text-slate-500">
              Comisión típica: 1-10 sats (menos de $0.001 USD). Ideal para micropagos.
            </p>
          </div>
          <div className="p-3 rounded bg-slate-950 border border-slate-800">
            <Wallet className="w-4 h-4 text-cyan-400 mb-1" />
            <div className="text-slate-200 font-medium mb-1">Escalable</div>
            <p className="text-slate-500">
              Millones de tx/s sin congestionar la chain principal.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
