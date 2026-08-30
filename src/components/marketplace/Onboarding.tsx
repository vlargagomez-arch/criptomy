"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/lib/store";
import { generateKeyPair, randomAlias } from "@/lib/crypto";
import {
  connectWallet,
  hasWallet,
  onWalletChange,
  NETWORK_PARAMS,
  CHAIN_IDS,
  switchNetwork,
} from "@/lib/web3";
import { MOBILE_WALLETS, isMobileDevice } from "@/lib/walletconnect";
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
import { Loader2, ShieldCheck, Wallet, AlertCircle, ExternalLink, Smartphone } from "lucide-react";

const NETWORK_LABELS: Record<number, string> = {
  [CHAIN_IDS.ETHEREUM_MAINNET]: "Ethereum Mainnet",
  [CHAIN_IDS.ETHEREUM_SEPOLIA]: "Sepolia Testnet",
};

export default function Onboarding() {
  const { setUser, setPrivateKey, connecting, setConnecting, setTab } = useApp();
  const [open, setOpen] = useState(false);
  const [alias, setAlias] = useState("");
  const [torOnly, setTorOnly] = useState(false);
  const [walletAddr, setWalletAddr] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [needsSwitch, setNeedsSwitch] = useState(false);
  const [showMobileOptions, setShowMobileOptions] = useState(false);

  useEffect(() => {
    const off = onWalletChange((addr, cid) => {
      if (addr) setWalletAddr(addr);
      if (cid) setChainId(cid);
    });
    return off;
  }, []);

  // Auto-detectar móvil al abrir
  useEffect(() => {
    if (open && isMobileDevice()) {
      setShowMobileOptions(true);
    }
  }, [open]);

  async function handleConnectMetaMask() {
    setError("");
    setConnecting(true);
    try {
      const { address, chainId: cid } = await connectWallet();
      setWalletAddr(address);
      setChainId(cid);
      if (cid !== CHAIN_IDS.ETHEREUM_MAINNET && cid !== CHAIN_IDS.ETHEREUM_SEPOLIA) {
        setNeedsSwitch(true);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setConnecting(false);
    }
  }

  async function handleSwitchToSepolia() {
    setError("");
    try {
      await switchNetwork(NETWORK_PARAMS[CHAIN_IDS.ETHEREUM_SEPOLIA].chainId);
      setNeedsSwitch(false);
    } catch {
      try {
        const { addNetwork } = await import("@/lib/web3");
        await addNetwork(NETWORK_PARAMS[CHAIN_IDS.ETHEREUM_SEPOLIA]);
        setNeedsSwitch(false);
      } catch (err) {
        setError((err as Error).message);
      }
    }
  }

  async function handleLogin() {
    if (!walletAddr) {
      setError("Conecte una wallet primero");
      return;
    }
    setConnecting(true);
    try {
      const kp = await generateKeyPair();
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: walletAddr,
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
      setError((e as Error).message);
    } finally {
      setConnecting(false);
    }
  }

  function generateAlias() {
    setAlias(randomAlias());
  }

  return (
    <div className="flex items-center gap-3">
      <Button
        onClick={() => setOpen(true)}
        className="bg-emerald-600 hover:bg-emerald-700 text-white"
      >
        <Wallet className="w-4 h-4 mr-2" />
        Conectar wallet
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
              Conectar wallet
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Sin KYC · Sin email · Sin datos personales
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Wallet conectada */}
            {walletAddr ? (
              <div className="space-y-3">
                <div className="p-3 rounded-md bg-slate-950 border border-emerald-700/50">
                  <div className="text-[10px] text-slate-500 uppercase mb-1">
                    Wallet conectada ✓
                  </div>
                  <code className="text-sm font-mono text-emerald-400 break-all">
                    {walletAddr}
                  </code>
                  {chainId && (
                    <div className="text-[10px] text-slate-400 mt-1">
                      Red: {NETWORK_LABELS[chainId] || `Chain ID ${chainId}`}
                    </div>
                  )}
                </div>
                {needsSwitch && (
                  <div className="p-2 rounded-md bg-yellow-950/40 border border-yellow-900/50 text-xs text-yellow-300">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Recomendamos Sepolia Testnet para pruebas.
                    </div>
                    <Button
                      size="sm"
                      onClick={handleSwitchToSepolia}
                      className="w-full bg-yellow-600 hover:bg-yellow-700 text-white"
                    >
                      Cambiar a Sepolia
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Opción 1: MetaMask (desktop o in-app browser) */}
                <button
                  onClick={handleConnectMetaMask}
                  disabled={connecting}
                  className="w-full flex items-center gap-3 p-4 rounded-lg border border-orange-700/50 bg-orange-950/20 hover:bg-orange-950/40 transition"
                >
                  <span className="text-3xl">🦊</span>
                  <div className="flex-1 text-left">
                    <div className="text-sm font-medium text-slate-100">
                      MetaMask
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {hasWallet()
                        ? "Clic para conectar"
                        : "No detectado — instale la extensión"}
                    </div>
                  </div>
                  {connecting && (
                    <Loader2 className="w-4 h-4 animate-spin text-orange-400" />
                  )}
                </button>

                {/* Opción 2: Abrir en wallet móvil (deep link) */}
                <button
                  onClick={() => setShowMobileOptions(!showMobileOptions)}
                  className="w-full flex items-center gap-3 p-4 rounded-lg border border-slate-700 bg-slate-950 hover:bg-slate-800 transition"
                >
                  <Smartphone className="w-7 h-7 text-blue-400" />
                  <div className="flex-1 text-left">
                    <div className="text-sm font-medium text-slate-100">
                      Conectar desde el móvil
                    </div>
                    <div className="text-[10px] text-slate-400">
                      MetaMask, Trust, Coinbase
                    </div>
                  </div>
                </button>

                {/* Mostrar opciones móviles */}
                {showMobileOptions && (
                  <div className="space-y-2 p-3 rounded-lg bg-slate-950 border border-slate-800">
                    <p className="text-[10px] text-slate-400 mb-2">
                      Toque su wallet para abrir esta página dentro del browser
                      de la app. Luego use el botón MetaMask de arriba.
                    </p>
                    {MOBILE_WALLETS.map((w) => (
                      <a
                        key={w.id}
                        href={w.getDeepLink()}
                        className="flex items-center gap-2 p-2 rounded-md hover:bg-slate-800 transition"
                      >
                        <span className="text-xl">{w.icon}</span>
                        <span className="text-xs font-medium text-slate-200 flex-1">
                          {w.name}
                        </span>
                        <ExternalLink className="w-3 h-3 text-slate-500" />
                      </a>
                    ))}
                  </div>
                )}

                {!hasWallet() && !isMobileDevice() && (
                  <div className="text-center">
                    <a
                      href="https://metamask.io/download/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-emerald-400 hover:underline inline-flex items-center gap-1"
                    >
                      Descargar MetaMask <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </>
            )}

            {/* Alias */}
            <div className="space-y-2">
              <Label className="text-slate-300">
                Alias público (opcional)
              </Label>
              <div className="flex gap-2">
                <Input
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                  placeholder="satoshi_ninja_42 (auto-generado)"
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
            </div>

            {/* Tor-only */}
            <div className="flex items-center justify-between rounded-lg bg-slate-950 border border-slate-800 p-3">
              <div>
                <div className="text-sm font-medium text-slate-200">
                  Conexión vía Tor
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Exigir Tor a las contrapartes
                </p>
              </div>
              <Switch checked={torOnly} onCheckedChange={setTorOnly} />
            </div>

            {error && (
              <div className="rounded-md bg-red-950/50 border border-red-900/50 p-2.5 text-xs text-red-300 flex items-start gap-2">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                {error}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              onClick={handleLogin}
              disabled={connecting || !walletAddr}
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
                  Entrar a la plataforma
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
