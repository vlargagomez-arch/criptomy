"use client";

import { useApp } from "@/lib/store";
import Header from "@/components/marketplace/Header";
import HomeView from "@/components/marketplace/HomeView";
import ComprarView from "@/components/marketplace/ComprarView";
import VenderView from "@/components/marketplace/VenderView";
import EnviarView from "@/components/marketplace/EnviarView";
import RecibirView from "@/components/marketplace/RecibirView";
import RemesasView from "@/components/marketplace/RemesasView";
import TarjetaView from "@/components/marketplace/TarjetaView";
import MercadoP2PUnifiedView from "@/components/marketplace/MercadoP2PUnifiedView";
import RetosP2PView from "@/components/marketplace/RetosP2PView";
import NFTMarketplaceView from "@/components/marketplace/NFTMarketplaceView";
import NFTDropsView from "@/components/marketplace/NFTDropsView";
import PriceAlertsView from "@/components/marketplace/PriceAlertsView";
import OportunidadesView from "@/components/marketplace/OportunidadesView";
import ProveedoresView from "@/components/marketplace/ProveedoresView";
import ComparadorView from "@/components/marketplace/ComparadorView";
import ComplianceView from "@/components/marketplace/ComplianceView";
import AdminView from "@/components/marketplace/AdminView";
import WalletView from "@/components/marketplace/WalletView";
import ReputationView from "@/components/marketplace/ReputationView";

export default function Home() {
  const { tab } = useApp();

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <Header />
      <main className="flex-1">
        {tab === "inicio" && <HomeView />}
        {tab === "dashboard" && <HomeView />}
        {tab === "comprar" && <ComprarView />}
        {tab === "vender" && <VenderView />}
        {tab === "enviar" && <EnviarView />}
        {tab === "recibir" && <RecibirView />}
        {tab === "remesas" && <RemesasView />}
        {tab === "tarjeta" && <TarjetaView />}
        {tab === "mercado-p2p" && <MercadoP2PUnifiedView />}
        {tab === "retos" && <RetosP2PView />}
        {tab === "nft" && <NFTMarketplaceView />}
        {tab === "drops" && <NFTDropsView />}
        {tab === "alertas" && <PriceAlertsView />}
        {tab === "oportunidades" && <OportunidadesView />}
        {tab === "proveedores" && <ProveedoresView />}
        {tab === "comparador" && <ComparadorView />}
        {tab === "compliance" && <ComplianceView />}
        {tab === "admin" && <AdminView />}
        {tab === "billetera" && <WalletView />}
        {tab === "reputacion" && <ReputationView />}
      </main>
      <footer className="mt-auto border-t border-slate-800 bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 py-6 text-xs text-slate-600 text-center">
          © 2026 CriptoMy · Web3 LATAM · Sin custodia · Sin KYC forzado
          <br />
          ⚠️ Operar cripto puede ser ilegal en tu jurisdicción. On-ramp/off-ramp/tarjetas/remesas
          prestados por terceros regulados. No custodiamos tus fondos.
        </div>
      </footer>
    </div>
  );
}
