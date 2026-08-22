"use client";

import { useApp } from "@/lib/store";
import Header from "@/components/marketplace/Header";
import HomeView from "@/components/marketplace/HomeView";
import MarketplaceView from "@/components/marketplace/MarketplaceView";
import CreateOfferView from "@/components/marketplace/CreateOfferView";
import MyTradesView from "@/components/marketplace/MyTradesView";
import WalletView from "@/components/marketplace/WalletView";
import ReputationView from "@/components/marketplace/ReputationView";
import DisputesView from "@/components/marketplace/DisputesView";
import TorGuideView from "@/components/marketplace/TorGuideView";

export default function Home() {
  const { tab } = useApp();

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <Header />
      <main className="flex-1">
        {tab === "inicio" && <HomeView />}
        {tab === "mercado" && <MarketplaceView />}
        {tab === "crear" && <CreateOfferView />}
        {tab === "trades" && <MyTradesView />}
        {tab === "billetera" && <WalletView />}
        {tab === "reputacion" && <ReputationView />}
        {tab === "disputas" && <DisputesView />}
        {tab === "tor" && <TorGuideView />}
      </main>
      <Footer />
    </div>
  );
}

function Footer() {
  return (
    <footer className="mt-auto border-t border-slate-800 bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 py-6 text-xs text-slate-500 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <strong className="text-slate-400">NoKYCSwap</strong> · MVP técnico ·{" "}
            <span className="text-emerald-500">sin KYC</span> · sin custodia ·
            código abierto
          </div>
          <div className="flex items-center gap-3">
            <span>Multi-chain:</span>
            <span className="text-slate-400">ETH</span>·
            <span className="text-slate-400">BTC</span>·
            <span className="text-slate-400">TRX</span>·
            <span className="text-slate-400">XMR</span>
          </div>
        </div>
        <p className="text-[10px] text-slate-600 leading-relaxed">
          <strong className="text-amber-600/80">Aviso:</strong> Este software es
          de carácter educativo y técnico. LocalBitcoins cerró en febrero de
          2023 por presión regulatoria. Operar exchanges sin KYC puede violar
          leyes de su jurisdicción (Colombia: Circular 029/2014
          Superfinanciera; UE: MiCA; EE.UU.: FinCEN MSB). Consulte a un abogado
          antes de desplegarlo con fondos reales.
        </p>
      </div>
    </footer>
  );
}
