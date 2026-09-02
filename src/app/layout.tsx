import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "CriptoMy — P2P sin KYC · Retos Gaming · NFT Marketplace",
  description:
    "Plataforma P2P para compra y venta de criptomonedas sin KYC, retos P2P gaming con apuestas en USDT, y marketplace de NFTs multi-chain. Con MetaMask, escrow on-chain, chat cifrado E2E. Inspirada en LocalBitcoins.",
  keywords: [
    "P2P",
    "cripto",
    "sin KYC",
    "Bitcoin",
    "Ethereum",
    "Polygon",
    "Base",
    "Monero",
    "Tron",
    "escrow",
    "LocalBitcoins",
    "NFT",
    "gaming",
    "retos",
    "privacidad",
  ],
  authors: [{ name: "CriptoMy" }],
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning className="dark">
      <head>
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
      </head>
      <body className="bg-slate-950 text-slate-100 antialiased min-h-screen flex flex-col">
        {children}
        <Toaster />
        {/* Service worker para browser push notifications */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js').catch(e => console.warn('SW register failed:', e));
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
