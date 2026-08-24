import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "NoKYCSwap — P2P cripto sin KYC · escrow on-chain",
  description:
    "Plataforma P2P para compra y venta de criptomonedas sin KYC, con escrow por smart contract, multi-chain (ETH, BTC, TRX, XMR), chat cifrado E2E y soporte Tor. Inspirada en LocalBitcoins.",
  keywords: [
    "P2P",
    "cripto",
    "sin KYC",
    "Bitcoin",
    "Ethereum",
    "Monero",
    "Tron",
    "escrow",
    "LocalBitcoins",
    "Tor",
    "privacidad",
  ],
  authors: [{ name: "NoKYCSwap" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning className="dark">
      <body className="bg-slate-950 text-slate-100 antialiased min-h-screen flex flex-col">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
