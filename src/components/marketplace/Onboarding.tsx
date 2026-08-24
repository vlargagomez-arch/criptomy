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
import {
  Loader2,
  ShieldCheck,
  Wallet,
  AlertCircle,
  ExternalLink,
  QrCode,
  Smartphone,
  Chrome,
} from "lucide-react";

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
  const [walletType, setWalletType] = useState<"metamask" | "walletconnect">(
    "metamask"
  );
  const [wcURI, setWcURI] = useState<string | null>(null);
  const [wcStep, setWcStep] = useState<"choose" | "qr">("choose");

  useEffect(() => {
    const off = onWalletChange((addr, cid) => {
      if (addr) setWalletAddr(addr);
      if (cid) setChainId(cid);
    });
    return off;
  }, []);

  // En móvil, priorizar WalletConnect (lazy check)
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    setIsMobile(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
  }, []);

  async function handleConnectMetaMask() {
    setError("");
    setConnecting(true);
    try {
      const { address, chainId: cid } = await connectWallet();
      setWalletAddr(address);
      setChainId(cid);
      setWalletType("metamask");
      if (cid !== CHAIN_IDS.ETHEREUM_MAINNET && cid !== CHAIN_IDS.ETHEREUM_SEPOLIA) {
        setNeedsSwitch(true);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setConnecting(false);
    }
  }

  async function handleConnectWalletConnect() {
    setError("");
    setConnecting(true);
    try {
      // MVP: mostrar URI generado para que el usuario lo use en su wallet
      // En producción: usar @walletconnect/ethereum-provider (ver instrucciones en lib/walletconnect.ts)
      const { isWalletConnectConfigured, generateWalletConnectURI, SUPPORTED_WALLETS } =
        await import("@/lib/walletconnect");

      const uri = generateWalletConnectURI();
      setWcURI(uri);
      setWcStep("qr");
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
    } catch (e) {
      try {
        await addNetworkSafe();
        setNeedsSwitch(false);
      } catch (err) {
        setError((err as Error).message);
      }
    }
  }

  async function addNetworkSafe() {
    // Importar dinámicamente para evitar SSR issues
    const { addNetwork } = await import("@/lib/web3");
    await addNetwork(NETWORK_PARAMS[CHAIN_IDS.ETHEREUM_SEPOLIA]);
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
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
              Acceso pseudónimo real
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Conecte su wallet Ethereum (MetaMask desktop o cualquier wallet
              mobile vía WalletConnect). Sin KYC, sin email, sin datos personales.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Paso 1: Elegir tipo de wallet */}
            {!walletAddr && wcStep === "choose" && (
              <div className="space-y-2">
                <Label className="text-slate-300 flex items-center gap-1">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] flex items-center justify-center">1</span>
                  Método de conexión
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleConnectMetaMask}
                    disabled={connecting || !hasWallet()}
                    className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition ${
                      walletType === "metamask"
                        ? "bg-orange-950/30 border-orange-700 text-orange-300"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                    } ${!hasWallet() ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <Chrome className="w-6 h-6" />
                    <span className="text-xs font-medium">MetaMask</span>
                    <span className="text-[10px] opacity-70">Desktop</span>
                  </button>
                  <button
                    onClick={handleConnectWalletConnect}
                    disabled={connecting}
                    className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition ${
                      walletType === "walletconnect"
                        ? "bg-blue-950/30 border-blue-700 text-blue-300"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <QrCode className="w-6 h-6" />
                    <span className="text-xs font-medium">WalletConnect</span>
                    <span className="text-[10px] opacity-70">Mobile</span>
                  </button>
                </div>
                {!hasWallet() && (
                  <p className="text-[10px] text-slate-500 text-center">
                    MetaMask no detectado.{" "}
                    <a
                      href="https://metamask.io/download/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-400 hover:underline inline-flex items-center gap-1"
                    >
                      Instalar <ExternalLink className="w-2.5 h-2.5" />
                    </a>{" "}
                    o use WalletConnect desde su móvil.
                  </p>
                )}
                {isMobile && (
                  <div className="flex items-center gap-1.5 text-[10px] text-blue-400 mt-1">
                    <Smartphone className="w-3 h-3" />
                    Detectado móvil: WalletConnect recomendado
                  </div>
                )}
              </div>
            )}

            {/* WalletConnect QR step */}
            {!walletAddr && wcStep === "qr" && wcURI && (
              <div className="space-y-3">
                <div className="text-center">
                  <QrCode className="w-12 h-12 text-blue-400 mx-auto mb-2" />
                  <p className="text-sm text-slate-300 font-medium">
                    Escanee con su wallet móvil
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Abra Rainbow, Trust, MetaMask mobile u otra wallet compatible
                    y escanee este código.
                  </p>
                </div>
                <div className="p-4 rounded-md bg-white border-2 border-blue-500/50 flex items-center justify-center">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(wcURI)}`}
                    alt="WalletConnect QR"
                    className="w-48 h-48"
                  />
                </div>
                <details className="text-[10px] text-slate-500">
                  <summary className="cursor-pointer text-slate-400">
                    Ver URI completo
                  </summary>
                  <code className="block mt-1 p-2 bg-slate-950 rounded break-all font-mono">
                    {wcURI}
                  </code>
                </details>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setWcStep("choose")}
                  className="w-full border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  Volver
                </Button>
                <p className="text-[10px] text-yellow-500 text-center">
                  ⚠️ MVP: WalletConnect SDK completo no instalado. Para activar
                  conexión automática, instalar{" "}
                  <code className="text-yellow-400">
                    @walletconnect/ethereum-provider
                  </code>{" "}
                  (ver instrucciones en src/lib/walletconnect.ts).
                </p>
              </div>
            )}

            {/* Wallet conectada */}
            {walletAddr && (
              <div className="space-y-2">
                <div className="p-3 rounded-md bg-slate-950 border border-emerald-700/50">
                  <div className="text-[10px] text-slate-500 uppercase flex items-center justify-between">
                    <span>Wallet conectada</span>
                    <span className="text-emerald-400">
                      {walletType === "metamask" ? "MetaMask" : "WalletConnect"}
                    </span>
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setWalletAddr(null);
                    setChainId(null);
                  }}
                  className="w-full border-slate-700 text-slate-400 hover:bg-slate-800 text-xs"
                >
                  Desconectar y usar otra wallet
                </Button>
              </div>
            )}

            {/* Paso 2: Alias */}
            <div className="space-y-2">
              <Label className="text-slate-300 flex items-center gap-1">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] flex items-center justify-center">2</span>
                Alias público
              </Label>
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

            {/* Paso 3: Tor-only */}
            <div className="flex items-center justify-between rounded-lg bg-slate-950 border border-slate-800 p-3">
              <div>
                <div className="text-sm font-medium text-slate-200">
                  Conexión exclusiva vía Tor
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Exigir a las contrapartes usar Tor para comunicarse con usted.
                </p>
              </div>
              <Switch checked={torOnly} onCheckedChange={setTorOnly} />
            </div>

            <div className="rounded-lg bg-emerald-950/30 border border-emerald-900/50 p-3 text-xs text-emerald-300">
              <strong>Privacidad:</strong> Su par de claves ECDH se genera
              localmente. La clave privada NUNCA sale de su navegador. Los
              mensajes entre partes se cifran E2E con AES-GCM-256.
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
