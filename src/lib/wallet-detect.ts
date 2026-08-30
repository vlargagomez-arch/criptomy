"use client";

import { useEffect, useState, useCallback } from "react";
import { useApp, CurrentUser } from "@/lib/store";
import { generateKeyPair, randomAlias } from "@/lib/crypto";

// ============================================================
// Detección automática de wallets instaladas (EIP-6963 + EIP-1193)
// ============================================================
// EIP-6963: Multi Injected Provider Discovery
// Permite detectar TODAS las wallets instaladas (no solo MetaMask).

interface EIP6963ProviderInfo {
  uuid: string;
  name: string;
  icon: string; // data URI
  rdns: string; // reverse domain name (e.g. "io.metamask")
}

interface EIP6963ProviderDetail {
  info: EIP6963ProviderInfo;
  provider: {
    request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    on?: (event: string, cb: (...args: unknown[]) => void) => void;
    removeListener?: (event: string, cb: (...args: unknown[]) => void) => void;
    isMetaMask?: boolean;
    isCoinbaseWallet?: boolean;
    isTrust?: boolean;
    isBraveWallet?: boolean;
    isRabby?: boolean;
  };
}

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, cb: (...args: unknown[]) => void) => void;
      removeListener: (event: string, cb: (...args: unknown[]) => void) => void;
      isMetaMask?: boolean;
      isCoinbaseWallet?: boolean;
      isTrust?: boolean;
      isBraveWallet?: boolean;
      isRabby?: boolean;
    };
    trustwallet?: unknown;
    coinbaseWalletExtension?: unknown;
    brave?: { ethereum?: unknown };
  }
}

interface DetectedWallet {
  id: string;
  name: string;
  icon: string;
  rdns?: string;
  installed: boolean;
  provider: EIP6963ProviderDetail["provider"] | null;
  color: string;
  description: string;
}

// Lista de wallets conocidas con sus iconos (SVG inline para no depender de assets externos)
const KNOWN_WALLETS = [
  {
    id: "metamask",
    name: "MetaMask",
    rdns: "io.metamask",
    color: "#f6851b",
    description: "Wallet más popular para Ethereum",
    iconSvg: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><circle cx="16" cy="16" r="16" fill="#f6851b"/><path d="M25.5 8.5l-9.5-3-9.5 3 9.5 19 9.5-19z" fill="#fff" opacity="0.9"/><path d="M16 5.5l-9.5 3 9.5 19 9.5-3-9.5-16z" fill="#e2761b"/></svg>`,
  },
  {
    id: "trust",
    name: "Trust Wallet",
    rdns: "com.trustwallet.app",
    color: "#3375bb",
    description: "Wallet móvil multi-chain",
    iconSvg: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><circle cx="16" cy="16" r="16" fill="#3375bb"/><path d="M16 6l-8 4v8c0 4.4 3.6 8 8 8s8-3.6 8-8v-8l-8-4z" fill="#fff"/></svg>`,
  },
  {
    id: "coinbase",
    name: "Coinbase Wallet",
    rdns: "com.coinbase.wallet",
    color: "#0052ff",
    description: "Wallet de Coinbase",
    iconSvg: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><circle cx="16" cy="16" r="16" fill="#0052ff"/><circle cx="16" cy="16" r="6" fill="#fff"/></svg>`,
  },
  {
    id: "brave",
    name: "Brave Wallet",
    rdns: "io.brave.wallet",
    color: "#fb542b",
    description: "Wallet integrado en Brave",
    iconSvg: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><circle cx="16" cy="16" r="16" fill="#fb542b"/><path d="M16 6l6 2-2 14-4 4-4-4-2-14 6-2z" fill="#fff"/></svg>`,
  },
  {
    id: "rabby",
    name: "Rabby Wallet",
    rdns: "io.rabby",
    color: "#7676ff",
    description: "Wallet multi-chain avanzada",
    iconSvg: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><circle cx="16" cy="16" r="16" fill="#7676ff"/><text x="16" y="22" text-anchor="middle" font-size="16" fill="#fff" font-weight="bold">R</text></svg>`,
  },
];

// Detectar todas las wallets instaladas usando EIP-6963 + fallback EIP-1193
export function useDetectedWallets() {
  const [wallets, setWallets] = useState<DetectedWallet[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const detected: DetectedWallet[] = [];
    const foundRdns = new Set<string>();

    // 1. Escuchar eventos EIP-6963 (estándar moderno)
    const handleAnnounce = (event: Event) => {
      const detail = (event as CustomEvent<EIP6963ProviderDetail>).detail;
      if (!detail?.provider || !detail?.info) return;

      const known = KNOWN_WALLETS.find(
        (w) => w.rdns === detail.info.rdns
      );

      if (known && !foundRdns.has(known.rdns)) {
        foundRdns.add(known.rdns);
        detected.push({
          id: known.id,
          name: known.name,
          icon: `data:image/svg+xml;base64,${btoa(known.iconSvg)}`,
          rdns: known.rdns,
          installed: true,
          provider: detail.provider,
          color: known.color,
          description: known.description,
        });
      } else if (!known) {
        // Wallet desconocida pero detectada via EIP-6963
        detected.push({
          id: detail.info.uuid,
          name: detail.info.name,
          icon: detail.info.icon,
          installed: true,
          provider: detail.provider,
          color: "#64748b",
          description: "Wallet detectada",
        });
      }
      setWallets([...detected]);
    };

    window.addEventListener("eip6963:announceProvider", handleAnnounce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));

    // 2. Fallback: detectar via window.ethereum (EIP-1193 legacy)
    setTimeout(() => {
      if (window.ethereum && detected.length === 0) {
        const eth = window.ethereum;
        let matched = false;
        for (const known of KNOWN_WALLETS) {
          const flag = `is${known.id.charAt(0).toUpperCase()}${known.id.slice(1)}Wallet` as keyof typeof eth;
          if (flag in eth || (known.id === "metamask" && eth.isMetaMask)) {
            if (!foundRdns.has(known.rdns)) {
              detected.push({
                id: known.id,
                name: known.name,
                icon: `data:image/svg+xml;base64,${btoa(known.iconSvg)}`,
                rdns: known.rdns,
                installed: true,
                provider: eth,
                color: known.color,
                description: known.description,
              });
              matched = true;
            }
          }
        }
        if (!matched) {
          detected.push({
            id: "ethereum",
            name: "Wallet Ethereum",
            icon: `data:image/svg+xml;base64,${btoa(KNOWN_WALLETS[0].iconSvg)}`,
            installed: true,
            provider: eth,
            color: "#627eea",
            description: "Wallet compatible con EIP-1193",
          });
        }
        setWallets([...detected]);
      }
      setReady(true);
    }, 300);

    return () => {
      window.removeEventListener("eip6963:announceProvider", handleAnnounce);
    };
  }, []);

  return { wallets, ready };
}

// ============================================================
// Conexión rápida — un clic y login automático
// ============================================================

export async function connectAndLogin(
  provider: NonNullable<DetectedWallet["provider"]>
): Promise<{ user: CurrentUser; privateKey: string }> {
  // 1. Solicitar cuentas (abre popup de la wallet)
  const accounts = (await provider.request({
    method: "eth_requestAccounts",
  })) as string[];
  if (!accounts || accounts.length === 0) {
    throw new Error("No se autorizó ninguna cuenta");
  }
  const walletAddress = accounts[0];

  // 2. Generar alias y par de claves ECDH en paralelo (instantáneo)
  const alias = randomAlias();
  const kp = await generateKeyPair();

  // 3. Login en el backend (crea usuario si no existe)
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      walletAddress,
      publicKey: kp.publicKey,
      alias,
      torOnly: false,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Error en login");

  return { user: data.user, privateKey: kp.privateKey };
}

// ============================================================
// Auto-reconexión al cargar la página
// ============================================================

export function useAutoReconnect() {
  const { user, setUser, setPrivateKey } = useApp();
  const [reconnecting, setReconnecting] = useState(false);
  const { wallets } = useDetectedWallets();

  const reconnect = useCallback(async () => {
    if (user) return; // ya hay sesión
    const wallet = wallets.find((w) => w.installed && w.provider);
    if (!wallet?.provider) return;

    setReconnecting(true);
    try {
      // Verificar si la wallet ya tiene cuentas autorizadas (sin popup)
      const accounts = (await wallet.provider.request({
        method: "eth_accounts",
      })) as string[];
      if (accounts && accounts.length > 0) {
        // Hay cuentas autorizadas → reconectar silenciosamente
        const result = await connectAndLogin(wallet.provider);
        setUser(result.user);
        setPrivateKey(result.privateKey);
      }
    } catch {
      // Silencioso: si falla, el usuario usa el botón normal
    } finally {
      setReconnecting(false);
    }
  }, [user, wallets, setUser, setPrivateKey]);

  useEffect(() => {
    if (wallets.length > 0) {
      // Pequeño delay para no interrumpir el render inicial
      const timer = setTimeout(reconnect, 500);
      return () => clearTimeout(timer);
    }
  }, [wallets, reconnect]);

  return { reconnecting };
}
