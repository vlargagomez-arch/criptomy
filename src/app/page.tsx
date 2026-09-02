"use client";

import { useApp } from "@/lib/store";
import Header from "@/components/marketplace/Header";
import HomeView from "@/components/marketplace/HomeView";
import MarketplaceView from "@/components/marketplace/MarketplaceView";
import CreateOfferView from "@/components/marketplace/CreateOfferView";
import MyTradesView from "@/components/marketplace/MyTradesView";
import RetosP2PView from "@/components/marketplace/RetosP2PView";
import NFTMarketplaceView from "@/components/marketplace/NFTMarketplaceView";
import NFTDropsView from "@/components/marketplace/NFTDropsView";
import PriceAlertsView from "@/components/marketplace/PriceAlertsView";
import WalletView from "@/components/marketplace/WalletView";
import ReputationView from "@/components/marketplace/ReputationView";

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
        {tab === "retos" && <RetosP2PView />}
        {tab === "nft" && <NFTMarketplaceView />}
        {tab === "drops" && <NFTDropsView />}
        {tab === "alertas" && <PriceAlertsView />}
        {tab === "billetera" && <WalletView />}
        {tab === "reputacion" && <ReputationView />}
      </main>
      <footer className="mt-auto border-t border-slate-800 bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 py-6 text-xs text-slate-600 text-center">
          © 2026 CriptoMy · P2P sin KYC + Retos + NFT · Software educativo
          <br />
          ⚠️ Operar exchanges sin KYC puede ser ilegal en tu jurisdicción.
        </div>
      </footer>
    </div>
  );
}
