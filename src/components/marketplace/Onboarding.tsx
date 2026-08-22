"use client";

import { useState } from "react";
import { useApp } from "@/lib/store";
import { generateKeyPair, randomAlias, shortFingerprint } from "@/lib/crypto";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, ShieldCheck, Wallet, Eye, EyeOff } from "lucide-react";

export default function Onboarding() {
  const { setUser, setPrivateKey, connecting, setConnecting, setTab } = useApp();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"alias" | "wallet">("wallet");
  const [alias, setAlias] = useState("");
  const [wallet, setWallet] = useState("");
  const [torOnly, setTorOnly] = useState(false);
  const [showWallet, setShowWallet] = useState(false);

  async function handleLogin() {
    setConnecting(true);
    try {
      // Generar par de claves ECDH para cifrado E2E
      const kp = await generateKeyPair();

      // Generar wallet seudoaleatoria si no se proveyó (en MVP)
      // En producción: conectar MetaMask / WalletConnect
      let finalWallet = wallet.trim();
      if (!finalWallet) {
        const rand = new Uint8Array(20);
        crypto.getRandomValues(rand);
        finalWallet =
          "0x" +
          Array.from(rand)
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
      }

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: finalWallet,
          publicKey: kp.publicKey,
          alias: alias.trim() || undefined,
          torOnly,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setUser(data.user);
      setPrivateKey(kp.privateKey);
      setOpen(false);
      setTab("inicio");
    } catch (e) {
      console.error(e);
      alert("Error al iniciar sesión: " + (e as Error).message);
    } finally {
      setConnecting(false);
    }
  }

  function generateAlias() {
    setAlias(randomAlias());
  }

  function generateWallet() {
    const rand = new Uint8Array(20);
    crypto.getRandomValues(rand);
    const w =
      "0x" +
      Array.from(rand)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    setWallet(w);
  }

  return (
    <div className="flex items-center gap-3">
      <Button
        onClick={() => setOpen(true)}
        className="bg-emerald-600 hover:bg-emerald-700 text-white"
      >
        <Wallet className="w-4 h-4 mr-2" />
        Conectar billetera
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
              Acceso pseudónimo
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Sin KYC. Sin email. Sin datos personales. Solo necesita una
              dirección de billetera.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex gap-2 p-1 bg-slate-950 rounded-lg border border-slate-800">
              <button
                className={`flex-1 py-2 text-xs rounded-md transition ${
                  mode === "wallet"
                    ? "bg-emerald-600 text-white"
                    : "text-slate-400"
                }`}
                onClick={() => setMode("wallet")}
              >
                Conectar billetera
              </button>
              <button
                className={`flex-1 py-2 text-xs rounded-md transition ${
                  mode === "alias"
                    ? "bg-emerald-600 text-white"
                    : "text-slate-400"
                }`}
                onClick={() => setMode("alias")}
              >
                Generar identidad
              </button>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Alias público</Label>
              <div className="flex gap-2">
                <Input
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                  placeholder="satoshi_ninja_42"
                  className="bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-600"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={generateAlias}
                  className="border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  Generar
                </Button>
              </div>
              <p className="text-xs text-slate-500">
                El alias es su identidad pública. No revele su nombre real.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">
                Dirección de billetera (ETH / BTC / TRX / XMR)
              </Label>
              <div className="flex gap-2">
                <Input
                  value={showWallet ? wallet : wallet ? shortFingerprint(wallet) : ""}
                  onChange={(e) => setWallet(e.target.value)}
                  placeholder="0x… o bc1… o T… o 4…"
                  className="bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-600 font-mono text-xs"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowWallet(!showWallet)}
                  className="border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  {showWallet ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={generateWallet}
                  className="border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  Generar
                </Button>
              </div>
              <p className="text-xs text-slate-500">
                En MVP se acepta cualquier cadena. En producción: MetaMask,
                WalletConnect, o CLI.
              </p>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-slate-950 border border-slate-800 p-3">
              <div>
                <div className="text-sm font-medium text-slate-200">
                  Conexión exclusiva vía Tor
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Si activa esta opción, su perfil exigirá a las contrapartes
                  usar Tor para comunicarse con usted.
                </p>
              </div>
              <Switch checked={torOnly} onCheckedChange={setTorOnly} />
            </div>

            <div className="rounded-lg bg-emerald-950/30 border border-emerald-900/50 p-3 text-xs text-emerald-300">
              <strong>Privacidad:</strong> Su par de claves ECDH se genera
              localmente. La clave privada NUNCA sale de su navegador. Los
              mensajes entre partes se cifran E2E con AES-GCM-256.
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={handleLogin}
              disabled={connecting}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {connecting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Conectando…
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 mr-2" />
                  Entrar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
