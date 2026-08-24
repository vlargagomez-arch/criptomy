"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, PlusCircle, Check, Info, Zap, TrendingUp } from "lucide-react";
import {
  CHAINS,
  TOKENS,
  PAYMENT_METHODS,
  FIAT_CURRENCIES,
} from "@/lib/blockchain/config";
import { fmtCrypto, fmtFiat } from "@/lib/format";
import { getMarketPrice, timeSinceUpdate } from "@/lib/chainlink";

export default function CreateOfferView() {
  const { user, setTab } = useApp();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [type, setType] = useState<"BUY" | "SELL">("SELL");
  const [chain, setChain] = useState<string>("ETHEREUM");
  const [asset, setAsset] = useState<string>("ETH");
  const [amount, setAmount] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [currency, setCurrency] = useState("COP");
  const [pricePerUnit, setPricePerUnit] = useState("");
  const [priceType, setPriceType] = useState<"FIXED" | "MARKET">("FIXED");
  const [marketMargin, setMarketMargin] = useState("0");
  const [marketPrice, setMarketPrice] = useState<{
    price: number;
    source: string;
    updatedAt: number;
  } | null>(null);
  const [loadingMarketPrice, setLoadingMarketPrice] = useState(false);

  // Cargar precio de mercado de Chainlink cuando cambia el asset o currency
  useEffect(() => {
    if (priceType !== "MARKET") return;
    setLoadingMarketPrice(true);
    getMarketPrice(asset, currency)
      .then((p) => setMarketPrice(p))
      .catch(() => setMarketPrice(null))
      .finally(() => setLoadingMarketPrice(false));
  }, [asset, currency, priceType]);

  // Precio calculado con margen
  const calculatedPrice = marketPrice
    ? marketPrice.price * (1 + (parseFloat(marketMargin) || 0) / 100)
    : null;
  const [paymentWindowMin, setPaymentWindowMin] = useState("60");
  const [terms, setTerms] = useState("");
  const [selectedMethods, setSelectedMethods] = useState<string[]>([]);

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <Card className="bg-slate-900/40 border-slate-800 p-8">
          <PlusCircle className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-300 font-medium">
            Conecte su billetera para crear una oferta
          </p>
          <p className="text-sm text-slate-500 mt-1">
            Sin KYC, sin email, solo su dirección on-chain.
          </p>
        </Card>
      </div>
    );
  }

  const tokens = TOKENS.filter((t) => t.chain === (chain as keyof typeof CHAINS));

  function toggleMethod(id: string) {
    setSelectedMethods((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  }

  async function handleSubmit() {
    setError("");
    if (!amount || parseFloat(amount) <= 0) {
      setError("Indique la cantidad");
      return;
    }
    if (!pricePerUnit || parseFloat(pricePerUnit) <= 0) {
      setError("Indique el precio por unidad");
      return;
    }
    if (selectedMethods.length === 0) {
      setError("Seleccione al menos un método de pago");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creatorId: user!.id,
          type,
          chain,
          asset,
          amount,
          minAmount: minAmount || null,
          maxAmount: maxAmount || null,
          currency,
          pricePerUnit,
          priceType,
          marketMargin: priceType === "MARKET" ? marketMargin : null,
          paymentMethods: selectedMethods,
          terms,
          paymentWindowMin: parseInt(paymentWindowMin) || 60,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setSuccess(true);
      setTimeout(() => {
        setTab("mercado");
      }, 1500);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const total = (parseFloat(amount) || 0) * (parseFloat(pricePerUnit) || 0);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <PlusCircle className="w-5 h-5 text-emerald-400" />
          Publicar oferta
        </h1>
        <p className="text-sm text-slate-400">
          Sin comisión de publicación. Solo 0.25% al completar el trade.
        </p>
      </div>

      {success && (
        <Card className="bg-emerald-950/30 border-emerald-900/50 p-4 flex items-center gap-3">
          <Check className="w-5 h-5 text-emerald-400" />
          <p className="text-sm text-emerald-300">
            Oferta publicada. Redirigiendo al mercado…
          </p>
        </Card>
      )}

      <Card className="bg-slate-900/60 border-slate-800 p-5 space-y-5">
        {/* Tipo */}
        <div>
          <Label className="text-slate-300 mb-2 block">Tipo de oferta</Label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setType("SELL")}
              className={`py-3 rounded-lg border text-sm font-medium transition ${
                type === "SELL"
                  ? "bg-emerald-600 border-emerald-500 text-white"
                  : "bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-900"
              }`}
            >
              Vender cripto
            </button>
            <button
              onClick={() => setType("BUY")}
              className={`py-3 rounded-lg border text-sm font-medium transition ${
                type === "BUY"
                  ? "bg-emerald-600 border-emerald-500 text-white"
                  : "bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-900"
              }`}
            >
              Comprar cripto
            </button>
          </div>
        </div>

        {/* Cadena + asset */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-slate-300 mb-1.5 block">Blockchain</Label>
            <Select
              value={chain}
              onValueChange={(v) => {
                setChain(v);
                const first = TOKENS.find((t) => t.chain === v);
                if (first) setAsset(first.symbol);
              }}
            >
              <SelectTrigger className="bg-slate-950 border-slate-700 text-slate-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700 text-slate-100">
                {Object.values(CHAINS).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <span
                      className="w-2 h-2 rounded-full inline-block mr-2"
                      style={{ background: c.color }}
                    />
                    {c.name} ({c.symbol})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-slate-300 mb-1.5 block">Activo</Label>
            <Select value={asset} onValueChange={setAsset}>
              <SelectTrigger className="bg-slate-950 border-slate-700 text-slate-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700 text-slate-100">
                {tokens.map((t) => (
                  <SelectItem key={t.symbol} value={t.symbol}>
                    {t.symbol} — {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Cantidad */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label className="text-slate-300 mb-1.5 block">
              Cantidad total ({asset})
            </Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="bg-slate-950 border-slate-700 text-slate-100 font-mono"
            />
          </div>
          <div>
            <Label className="text-slate-300 mb-1.5 block">Mín por trade</Label>
            <Input
              type="number"
              value={minAmount}
              onChange={(e) => setMinAmount(e.target.value)}
              placeholder="0.00"
              className="bg-slate-950 border-slate-700 text-slate-100 font-mono"
            />
          </div>
          <div>
            <Label className="text-slate-300 mb-1.5 block">Máx por trade</Label>
            <Input
              type="number"
              value={maxAmount}
              onChange={(e) => setMaxAmount(e.target.value)}
              placeholder="0.00"
              className="bg-slate-950 border-slate-700 text-slate-100 font-mono"
            />
          </div>
        </div>

        {/* Precio */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-slate-300 mb-1.5 block">Moneda fiat</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger className="bg-slate-950 border-slate-700 text-slate-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700 text-slate-100">
                {FIAT_CURRENCIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.flag} {c.code} — {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-slate-300 mb-1.5 block">
              Precio por {asset} ({currency})
            </Label>
            <Input
              type="number"
              value={pricePerUnit}
              onChange={(e) => setPricePerUnit(e.target.value)}
              placeholder="0.00"
              className="bg-slate-950 border-slate-700 text-slate-100 font-mono"
            />
            {priceType === "MARKET" && calculatedPrice && (
              <Button
                type="button"
                variant="link"
                size="sm"
                className="text-emerald-400 text-xs h-auto p-0 mt-1"
                onClick={() => setPricePerUnit(calculatedPrice.toFixed(2))}
              >
                Usar precio Chainlink: {fmtFiat(calculatedPrice, currency)}
              </Button>
            )}
          </div>
        </div>

        {/* Precio Chainlink en tiempo real */}
        {priceType === "MARKET" && (
          <Card className="bg-emerald-950/20 border-emerald-900/40 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-400" />
                <div>
                  <div className="text-xs font-medium text-emerald-300">
                    Precio de mercado (Chainlink Oracle)
                  </div>
                  {loadingMarketPrice ? (
                    <div className="text-[10px] text-slate-500">
                      Consultando contrato…
                    </div>
                  ) : marketPrice ? (
                    <div className="text-[10px] text-slate-400">
                      {fmtFiat(marketPrice.price, currency)} / {asset}
                      {" · "}
                      actualizado {timeSinceUpdate(marketPrice.updatedAt)}
                    </div>
                  ) : (
                    <div className="text-[10px] text-yellow-500">
                      No hay feed Chainlink para este par. Use precio fijo.
                    </div>
                  )}
                </div>
              </div>
              {calculatedPrice && (
                <div className="text-right">
                  <div className="text-[10px] text-slate-500">Con margen {marketMargin}%</div>
                  <div className="font-mono text-emerald-400 text-sm">
                    {fmtFiat(calculatedPrice, currency)}
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Tipo de precio */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-slate-300 mb-1.5 block">Modalidad</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={priceType === "FIXED" ? "default" : "outline"}
                onClick={() => setPriceType("FIXED")}
                className={
                  priceType === "FIXED"
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                    : "border-slate-700 text-slate-400"
                }
              >
                Precio fijo
              </Button>
              <Button
                type="button"
                size="sm"
                variant={priceType === "MARKET" ? "default" : "outline"}
                onClick={() => setPriceType("MARKET")}
                className={
                  priceType === "MARKET"
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                    : "border-slate-700 text-slate-400"
                }
              >
                Precio de mercado
              </Button>
            </div>
          </div>
          {priceType === "MARKET" && (
            <div>
              <Label className="text-slate-300 mb-1.5 block">
                Margen sobre mercado (%)
              </Label>
              <Input
                type="number"
                value={marketMargin}
                onChange={(e) => setMarketMargin(e.target.value)}
                placeholder="0"
                className="bg-slate-950 border-slate-700 text-slate-100 font-mono"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Negativo = descuento, positivo = prima
              </p>
            </div>
          )}
        </div>

        {/* Resumen */}
        {total > 0 && (
          <div className="rounded-lg bg-emerald-950/30 border border-emerald-900/50 p-3 flex items-center justify-between">
            <span className="text-xs text-emerald-300">Total del trade</span>
            <span className="font-mono text-emerald-400 font-bold">
              {fmtCrypto(parseFloat(amount))} {asset} = {fmtFiat(total, currency)}
            </span>
          </div>
        )}

        {/* Métodos de pago */}
        <div>
          <Label className="text-slate-300 mb-2 block">
            Métodos de pago aceptados ({selectedMethods.length})
          </Label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {PAYMENT_METHODS.map((pm) => {
              const active = selectedMethods.includes(pm.id);
              return (
                <button
                  key={pm.id}
                  type="button"
                  onClick={() => toggleMethod(pm.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md border text-xs transition ${
                    active
                      ? "bg-emerald-950/50 border-emerald-700 text-emerald-300"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <span>{pm.icon}</span>
                  <span className="truncate">{pm.label}</span>
                  {active && <Check className="w-3 h-3 ml-auto" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Ventana de pago */}
        <div>
          <Label className="text-slate-300 mb-1.5 block">
            Ventana de pago (minutos)
          </Label>
          <Input
            type="number"
            value={paymentWindowMin}
            onChange={(e) => setPaymentWindowMin(e.target.value)}
            className="bg-slate-950 border-slate-700 text-slate-100 font-mono w-32"
          />
          <p className="text-[10px] text-slate-500 mt-1">
            Tiempo máximo que tiene el comprador para hacer el pago fiat antes
            de poder cancelar el trade.
          </p>
        </div>

        {/* Términos */}
        <div>
          <Label className="text-slate-300 mb-1.5 block">
            Términos del trade (visible públicamente)
          </Label>
          <Textarea
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
            placeholder="Ej: Solo Nequi. Horario 9am-9pm. Envíe comprobante por chat. Libero en máximo 10 min tras confirmar."
            className="bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-600 text-sm"
            rows={3}
          />
        </div>

        {/* Info */}
        <div className="rounded-md bg-slate-950 border border-slate-800 p-3 flex gap-2">
          <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <p className="text-xs text-slate-400">
            Al publicar, su oferta será visible en el mercado. Cuando alguien la
            acepte, deberá depositar los cripto en el smart contract de escrow
            dentro de 30 minutos, o el trade se cancelará.
          </p>
        </div>

        {error && (
          <div className="rounded-md bg-red-950/50 border border-red-900/50 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <Button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <PlusCircle className="w-4 h-4 mr-2" />
          )}
          Publicar oferta
        </Button>
      </Card>
    </div>
  );
}
