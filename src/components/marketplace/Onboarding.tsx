"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/lib/store";
import {
  useDetectedWallets,
  connectAndLogin,
  useAutoReconnect,
} from "@/lib/wallet-detect";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck, Zap, CheckCircle2, AlertCircle } from "lucide-react";

export default function Onboarding() {
  const { setUser, setPrivateKey, setTab } = useApp();
  const { wallets, ready } = useDetectedWallets();
  const { reconnecting } = useAutoReconnect();
  const [connecting, setConnecting] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handleQuickConnect(walletId?: string) {
    setError("");
    const wallet = walletId
      ? wallets.find((w) => w.id === walletId)
      : wallets.find((w) => w.installed && w.provider);
    if (!wallet?.provider) {
      setError("No se detectó wallet. Instale MetaMask o Trust Wallet.");
      return;
    }
    setConnecting(wallet.id);
    try {
      const result = await connectAndLogin(wallet.provider);
      setUser(result.user);
      setPrivateKey(result.privateKey);
      setTab("inicio");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setConnecting(null);
    }
  }

  const installedWallets = wallets.filter((w) => w.installed);
  const hasInstalled = installedWallets.length > 0;

  return (
    <div className="flex items-center gap-2">
      {/* Botón principal: "Conectar wallet" — un clic */}
      <Button
        onClick={() => handleQuickConnect()}
        disabled={connecting !== null || reconnecting || !ready}
        className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium relative overflow-hidden"
      >
        {connecting || reconnecting ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            {reconnecting ? "Reconectando…" : "Conectando…"}
          </>
        ) : (
          <>
            <Zap className="w-4 h-4 mr-2" />
            Conectar wallet
          </>
        )}
      </Button>

      {/* Dropdown con wallets específicas (opcional) */}
      <WalletPicker
        wallets={installedWallets}
        onPick={(id) => handleQuickConnect(id)}
        connecting={connecting}
      />

      {/* Modal de error si no hay wallet */}
      {error && !hasInstalled && ready && (
        <ErrorModal error={error} onClose={() => setError("")} />
      )}

      {/* Modal de conexión rápida (visual feedback) */}
      {connecting && (
        <ConnectingModal
          wallet={installedWallets.find((w) => w.id === connecting)}
        />
      )}

      {/* Modal de error */}
      {error && hasInstalled && (
        <ErrorModal error={error} onClose={() => setError("")} />
      )}
    </div>
  );
}

// ============================================================
// Wallet Picker — dropdown con iconos de wallets instaladas
// ============================================================

function WalletPicker({
  wallets,
  onPick,
  connecting,
}: {
  wallets: ReturnType<typeof useDetectedWallets>["wallets"];
  onPick: (id: string) => void;
  connecting: string | null;
}) {
  const [open, setOpen] = useState(false);

  if (wallets.length === 0) return null;

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(!open)}
        className="border-slate-700 text-slate-300 hover:bg-slate-800"
      >
        {wallets.length} wallet{wallets.length > 1 ? "s" : ""} ▾
      </Button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full mt-1 z-50 bg-slate-900 border border-slate-700 rounded-lg shadow-xl p-2 min-w-[200px]">
            {wallets.map((w) => (
              <button
                key={w.id}
                onClick={() => {
                  onPick(w.id);
                  setOpen(false);
                }}
                disabled={connecting !== null}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-800 transition text-left"
              >
                <img
                  src={w.icon}
                  alt={w.name}
                  className="w-6 h-6 rounded-full"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-slate-200">
                    {w.name}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">
                    {w.description}
                  </div>
                </div>
                {connecting === w.id && (
                  <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================
// Modal de conexión (feedback visual)
// ============================================================

function ConnectingModal({
  wallet,
}: {
  wallet?: {
    name: string;
    icon: string;
    color: string;
  };
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-xs w-full mx-4 text-center">
        {wallet && (
          <img
            src={wallet.icon}
            alt={wallet.name}
            className="w-16 h-16 rounded-2xl mx-auto mb-3"
            style={{ boxShadow: `0 0 24px ${wallet.color}40` }}
          />
        )}
        <h3 className="text-base font-semibold text-slate-100 mb-1">
          Conectando con {wallet?.name || "wallet"}
        </h3>
        <p className="text-xs text-slate-400 mb-4">
          Confirme la conexión en la popup de su wallet
        </p>
        <div className="flex items-center justify-center gap-2 text-xs text-emerald-400">
          <Loader2 className="w-3 h-3 animate-spin" />
          Esperando confirmación…
        </div>
        <div className="mt-4 pt-3 border-t border-slate-800 text-[10px] text-slate-500">
          <ShieldCheck className="w-3 h-3 inline mr-1" />
          Sin KYC · Sin email · Sin datos personales
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Modal de error (cuando no hay wallet instalada)
// ============================================================

function ErrorModal({ error, onClose }: { error: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-sm w-full mx-4">
        <div className="flex items-start gap-3 mb-3">
          <AlertCircle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-base font-semibold text-slate-100 mb-1">
              Wallet no detectada
            </h3>
            <p className="text-xs text-slate-400">{error}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-4">
          <a
            href="https://metamask.io/download/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-1 p-3 rounded-lg bg-slate-950 border border-slate-800 hover:border-orange-700/50 transition"
          >
            <span className="text-2xl">🦊</span>
            <span className="text-xs font-medium text-slate-200">MetaMask</span>
            <span className="text-[10px] text-slate-500">Desktop</span>
          </a>
          <a
            href="https://trustwallet.com/download"
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-1 p-3 rounded-lg bg-slate-950 border border-slate-800 hover:border-blue-700/50 transition"
          >
            <span className="text-2xl">🛡️</span>
            <span className="text-xs font-medium text-slate-200">Trust Wallet</span>
            <span className="text-[10px] text-slate-500">Mobile</span>
          </a>
        </div>
        <Button
          onClick={onClose}
          className="w-full mt-4 bg-slate-800 hover:bg-slate-700 text-slate-200"
        >
          Cerrar
        </Button>
      </div>
    </div>
  );
}
