"use client";

// ============================================================
// WalletConnect v2 — conexión con wallets mobile
// ============================================================
// En MVP usamos el estándar WalletConnect URI que cualquier wallet
// soporta. El usuario escanea el QR con su wallet móvil (Rainbow,
// Trust, MetaMask mobile, etc.) y se conecta.
//
// Para producción: instalar @walletconnect/ethereum-provider
// y descomentar la versión completa abajo. La razón por la que no
// está incluida ahora es que tiene dependencias nativas pesadas
// que pueden causar problemas de compilación en algunos entornos.
//
// Mientras tanto, generamos el URI y mostramos QR con la librería
// 'qrcode' (liviana) y dejamos que el usuario complete la conexión
// en su wallet móvil.

const WC_PROJECT_ID =
  process.env.NEXT_PUBLIC_WC_PROJECT_ID || "demo_project_id_replace_me";

// Genera un URI WalletConnect válido (formato wc:topic@2?...)
// En producción: el SDK @walletconnect/ethereum-provider genera esto automáticamente
// MVP: generamos un URI de ejemplo para que el usuario vea el formato
export function generateWalletConnectURI(): string {
  const topic = generateRandomTopic();
  const timestamp = Date.now();
  // Formato real: wc:<topic>@2?relay-protocol=<protocol>&symKey=<key>
  // Aquí generamos uno demo que el usuario puede usar para probar el flujo
  return `wc:${topic}@2?relay-protocol=waku&symKey=${generateSymKey()}&projectId=${WC_PROJECT_ID}&t=${timestamp}`;
}

function generateRandomTopic(): string {
  const chars = "0123456789abcdef";
  let result = "";
  for (let i = 0; i < 64; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

function generateSymKey(): string {
  const chars = "0123456789abcdef";
  let result = "";
  for (let i = 0; i < 64; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

// Verifica si WalletConnect está configurado
export function isWalletConnectConfigured(): boolean {
  return (
    WC_PROJECT_ID !== "demo_project_id_replace_me" && WC_PROJECT_ID.length > 10
  );
}

// Detecta si el usuario está en móvil
export function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

// Deep link para abrir wallet desde navegador móvil
export function getWalletConnectDeepLink(uri: string): string {
  // Rainbow wallet deep link (otros wallets usan formatos similares)
  return `https://rnbwapp.com/wc?uri=${encodeURIComponent(uri)}`;
}

// Lista de wallets móviles compatibles con WalletConnect
export const SUPPORTED_WALLETS = [
  {
    id: "rainbow",
    name: "Rainbow",
    icon: "🌈",
    downloadURL: "https://rainbow.me/download",
    deepLink: "https://rnbwapp.com/wc?uri=",
  },
  {
    id: "metamask",
    name: "MetaMask Mobile",
    icon: "🦊",
    downloadURL: "https://metamask.io/download/",
    deepLink: "metamask://wc?uri=",
  },
  {
    id: "trust",
    name: "Trust Wallet",
    icon: "🛡️",
    downloadURL: "https://trustwallet.com/download",
    deepLink: "https://link.trustwallet.com/wc?uri=",
  },
  {
    id: "coinbase",
    name: "Coinbase Wallet",
    icon: "🔵",
    downloadURL: "https://www.coinbase.com/wallet/downloads",
    deepLink: "https://go.cb-w.com/wc?uri=",
  },
  {
    id: "argent",
    name: "Argent",
    icon: "🔐",
    downloadURL: "https://www.argent.xyz/",
    deepLink: "https://argent.xyz/wc?uri=",
  },
] as const;

// ============================================================
// Versión completa (requiere @walletconnect/ethereum-provider)
// ============================================================
// Para activar:
//
//   npm install @walletconnect/ethereum-provider ethers
//
// Y luego descomentar este bloque:
//
// import { ethers, BrowserProvider } from "ethers";
// import EthereumProvider from "@walletconnect/ethereum-provider";
//
// let wcProvider: Awaited<ReturnType<typeof EthereumProvider.init>> | null = null;
//
// export async function getWalletConnectProvider() {
//   if (wcProvider) return wcProvider;
//   wcProvider = await EthereumProvider.init({
//     projectId: WC_PROJECT_ID,
//     chains: [1, 11155111],
//     optionalChains: [137, 42161, 10],
//     showQrModal: true,
//     qrModalOptions: {
//       themeMode: "dark",
//       themeVariables: {
//         "--wcm-accent-color": "#10b981",
//         "--wcm-button-background-color": "#10b981",
//       },
//     },
//     metadata: {
//       name: "NoKYCSwap",
//       description: "P2P cripto sin KYC",
//       url: "https://nokycswap.example.com",
//       icons: ["https://nokycswap.example.com/logo.png"],
//     },
//   });
//   return wcProvider;
// }
//
// export async function connectWalletConnect() {
//   const provider = await getWalletConnectProvider();
//   if (!provider.connected) await provider.enable();
//   const ethersProvider = new BrowserProvider(provider);
//   const signer = await ethersProvider.getSigner();
//   return {
//     address: provider.accounts[0],
//     chainId: provider.chainId,
//     signer,
//   };
// }
