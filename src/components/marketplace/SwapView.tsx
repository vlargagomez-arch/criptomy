"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeftRight,
  Loader2,
  Zap,
  TrendingDown,
  ExternalLink,
  CheckCircle2,
  ArrowDown,
} from "lucide-react";
import { SUPPORTED_SWAP_TOKENS, UNISWAP_FEE_TIERS } from "@/lib/uniswap";

interface Quote {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  amountOutMin: string;
  priceImpact: number;
  fee: number;
  minimumReceived: string;
  rpc?: string;
  uniswapURL?: string;
}

export default function SwapView() {
  const { user } = useApp();
  const [tokenIn, setTokenIn] = useState("ETH");
  const [tokenOut, setTokenOut] = useState("USDT");
  const [amount, setAmount] = useState("0.1");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [swapResult, setSwapResult] = useState<{ txHash: string } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (amount && parseFloat(amount) > 0) {
      fetchQuote();
    }
  }, [tokenIn, tokenOut, amount]);

  async function fetchQuote() {
    setError("");
    setLoading(true);
    try {
      const tokenInData = SUPPORTED_SWAP_TOKENS.find((t) => t.symbol === tokenIn);
      const tokenOutData = SUPPORTED_SWAP_TOKENS.find((t) => t.symbol === tokenOut);
      if (!tokenInData || !tokenOutData) return;

      const res = await fetch(
        `/api/uniswap?op=quote&tokenIn=${tokenInData.address}&tokenOut=${tokenOutData.address}&amount=${amount}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setQuote(data);
    } catch (e) {
      setError((e as Error).message);
      setQuote(null);
    } finally {
      setLoading(false);
    }
  }

  function swapTokens() {
    const tmp = tokenIn;
    setTokenIn(tokenOut);
    setTokenOut(tmp);
  }

  async function handleSwap() {
    if (!quote) return;
    setSwapping(true);
    setError("");
    try {
      // Conectar MetaMask
      const { connectWallet } = await import("@/lib/web3");
      const { signer, address } = await connectWallet();

      if (user && address.toLowerCase() !== user.walletAddress.toLowerCase()) {
        throw new Error("Wallet conectada no coincide con su usuario");
      }

      // Ejecutar swap
      const { executeSwap } = await import("@/lib/uniswap");
      const tokenInData = SUPPORTED_SWAP_TOKENS.find((t) => t.symbol === tokenIn);
      const tokenOutData = SUPPORTED_SWAP_TOKENS.find((t) => t.symbol === tokenOut);

      const result = await executeSwap({
        signer,
        tokenIn: tokenInData!.address,
        tokenOut: tokenOutData!.address,
        amountIn: amount,
        amountOutMin: quote.amountOutMin,
        recipient: address,
      });

      setSwapResult({ txHash: result.txHash });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSwapping(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <ArrowLeftRight className="w-5 h-5 text-emerald-400" />
          Swap cripto-a-cripto
        </h1>
        <p className="text-sm text-slate-400">
          Intercambio automático vía Uniswap V3 · sin contraparte · liquidez real
        </p>
      </div>

      {/* Swap card */}
      <Card className="bg-slate-900/60 border-slate-800 p-5 space-y-3">
        {/* From */}
        <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <Label className="text-slate-400 text-xs">De</Label>
            <span className="text-[10px] text-slate-500">Balance: —</span>
          </div>
          <div className="flex gap-2">
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0"
              className="bg-transparent border-0 text-slate-100 font-mono text-xl p-0 h-auto focus-visible:ring-0"
            />
            <Select value={tokenIn} onValueChange={setTokenIn}>
              <SelectTrigger className="w-32 bg-slate-900 border-slate-700 text-slate-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700 text-slate-100">
                {SUPPORTED_SWAP_TOKENS.map((t) => (
                  <SelectItem key={t.symbol} value={t.symbol}>
                    {t.symbol}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Swap button */}
        <div className="flex justify-center">
          <Button
            onClick={swapTokens}
            size="icon"
            variant="outline"
            className="rounded-full bg-slate-900 border-slate-700 hover:bg-slate-800 h-9 w-9"
          >
            <ArrowDown className="w-4 h-4 text-emerald-400" />
          </Button>
        </div>

        {/* To */}
        <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <Label className="text-slate-400 text-xs">Para</Label>
            <span className="text-[10px] text-slate-500">
              {loading ? "consultando…" : quote ? `${quote.amountOut}` : "—"}
            </span>
          </div>
          <div className="flex gap-2">
            <div className="flex-1 text-slate-100 font-mono text-xl">
              {quote ? parseFloat(quote.amountOut).toFixed(6) : "0.0"}
            </div>
            <Select value={tokenOut} onValueChange={setTokenOut}>
              <SelectTrigger className="w-32 bg-slate-900 border-slate-700 text-slate-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700 text-slate-100">
                {SUPPORTED_SWAP_TOKENS.map((t) => (
                  <SelectItem key={t.symbol} value={t.symbol}>
                    {t.symbol}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Quote details */}
        {quote && !loading && (
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Mínimo a recibir</span>
              <span className="text-slate-300 font-mono">
                {quote.minimumReceived} {tokenOut}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 flex items-center gap-1">
                <TrendingDown className="w-3 h-3" /> Impacto de precio
              </span>
              <span className={quote.priceImpact > 3 ? "text-red-400" : "text-emerald-400"}>
                {quote.priceImpact.toFixed(2)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Fee del pool</span>
              <span className="text-slate-300">
                {(quote.fee / 10000).toFixed(2)}% ({quote.fee} bps)
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Slippage tolerance</span>
              <span className="text-slate-300">0.5%</span>
            </div>
            {quote.rpc && (
              <div className="text-[10px] text-slate-600 pt-1">
                Vía RPC: {quote.rpc}
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="p-2 rounded-md bg-red-950/50 border border-red-900/50 text-xs text-red-300">
            {error}
          </div>
        )}

        <Button
          onClick={handleSwap}
          disabled={swapping || !quote || !user}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          {swapping ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Zap className="w-4 h-4 mr-2" />
          )}
          {user ? "Ejecutar swap" : "Conecte wallet primero"}
        </Button>

        {swapResult && (
          <div className="p-3 rounded-md bg-emerald-950/30 border border-emerald-900/50">
            <div className="flex items-center gap-2 text-emerald-300 text-sm mb-2">
              <CheckCircle2 className="w-4 h-4" />
              Swap ejecutado
            </div>
            <div className="text-[10px] text-slate-500">Tx Hash:</div>
            <code className="text-xs font-mono text-emerald-400 break-all">
              {swapResult.txHash}
            </code>
            <a
              href={`https://etherscan.io/tx/${swapResult.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs text-emerald-400 hover:underline"
            >
              Ver en Etherscan <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}
      </Card>

      {/* Uniswap link */}
      {quote?.uniswapURL && (
        <Card className="bg-slate-900/40 border-slate-800 p-3 text-center">
          <a
            href={quote.uniswapURL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-emerald-400 hover:underline inline-flex items-center gap-1"
          >
            Ver en Uniswap interface <ExternalLink className="w-3 h-3" />
          </a>
        </Card>
      )}

      {/* Info */}
      <Card className="bg-slate-900/60 border-slate-800 p-5">
        <h3 className="text-sm font-semibold text-slate-100 mb-2">
          ¿Por qué Uniswap V3?
        </h3>
        <div className="space-y-2 text-xs text-slate-400">
          <p>
            <strong className="text-slate-200">Liquidez real:</strong> Los swaps
            se ejecutan contra pools de liquidez reales en Ethereum mainnet. No
            hay contraparte humana que esperar.
          </p>
          <p>
            <strong className="text-slate-200">Sin KYC:</strong> Uniswap es un
            protocolo descentralizado. Cualquiera con una wallet puede usarlo.
          </p>
          <p>
            <strong className="text-slate-200">Comisiones bajas:</strong> Fee del
            pool 0.01%-1% + gas de Ethereum. Para trades &gt; $1000 es más barato
            que un exchange centralizado.
          </p>
        </div>
        <div className="mt-3 flex flex-wrap gap-1">
          {UNISWAP_FEE_TIERS.map((tier) => (
            <Badge
              key={tier.fee}
              variant="outline"
              className="text-[10px] bg-slate-950 border-slate-700 text-slate-400"
            >
              {tier.label} — {tier.description}
            </Badge>
          ))}
        </div>
      </Card>
    </div>
  );
}
