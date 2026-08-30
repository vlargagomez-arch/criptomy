"use client";

// ============================================================
// Conexión mobile — deep links directos (sin SDK pesado)
// ============================================================
// En lugar de WalletConnect SDK (que causa OOM en el servidor),
// usamos deep links directos a las wallets móviles.
// Esto abre la dapp DENTRO del browser de la wallet, donde
// window.ethereum ya está inyectado. Funciona inmediatamente,
// sin projectId ni relay server.

// Detectar si el usuario está en móvil
export function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

// Generar deep link para MetaMask mobile
// Abre la dapp dentro del browser de MetaMask
export function getMetaMaskDeepLink(): string {
  if (typeof window === "undefined") return "";
  const url = window.location.host + window.location.pathname;
  return `https://metamask.app.link/dapp/${url}`;
}

// Generar deep link para Trust Wallet
export function getTrustWalletDeepLink(): string {
  if (typeof window === "undefined") return "";
  const url = window.location.host + window.location.pathname;
  return `https://link.trustwallet.com/open_url?coin_id=60&url=${encodeURIComponent("https://" + url)}`;
}

// Generar deep link para Coinbase Wallet
export function getCoinbaseDeepLink(): string {
  if (typeof window === "undefined") return "";
  const url = window.location.href;
  return `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(url)}`;
}

// Lista de wallets móviles con deep links
export const MOBILE_WALLETS = [
  {
    id: "metamask",
    name: "MetaMask",
    icon: "🦊",
    color: "#f6851b",
    downloadURL: "https://metamask.io/download/",
    getDeepLink: getMetaMaskDeepLink,
  },
  {
    id: "trust",
    name: "Trust Wallet",
    icon: "🛡️",
    color: "#3375bb",
    downloadURL: "https://trustwallet.com/download",
    getDeepLink: getTrustWalletDeepLink,
  },
  {
    id: "coinbase",
    name: "Coinbase Wallet",
    icon: "🔵",
    color: "#0052ff",
    downloadURL: "https://www.coinbase.com/wallet/downloads",
    getDeepLink: getCoinbaseDeepLink,
  },
] as const;

// Verificar si está dentro del browser de una wallet (window.ethereum disponible)
export function isInWalletBrowser(): boolean {
  if (typeof window === "undefined") return false;
  return !!window.ethereum;
}
