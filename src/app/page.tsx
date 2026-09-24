"use client";

import { useEffect } from "react";
import { useApp, TabKey } from "@/lib/store";
import Header from "@/components/marketplace/Header";
import HomeView from "@/components/marketplace/HomeView";
import EnviarRecibirView from "@/components/marketplace/EnviarRecibirView";
import MercadoP2PUnifiedView from "@/components/marketplace/MercadoP2PUnifiedView";
import PriceAlertsView from "@/components/marketplace/PriceAlertsView";
import EarnView from "@/components/marketplace/EarnView";
import EscrowMarketplaceView from "@/components/marketplace/EscrowMarketplaceView";

const VALID_TABS: TabKey[] = [
  "inicio", "earn", "enviar-recibir",
  "mercado-p2p", "escrow", "alertas",
];

export default function Home() {
  const { tab, setTab } = useApp();

  // Sync URL ?tab= con el store al montar y al cambiar la URL
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const urlTab = params.get("tab") as TabKey | null;
    if (urlTab && VALID_TABS.includes(urlTab) && urlTab !== tab) {
      setTab(urlTab);
    }
  }, [tab, setTab]);

  // Escuchar cambios de URL (back/forward)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => {
      const params = new URLSearchParams(window.location.search);
      const urlTab = params.get("tab") as TabKey | null;
      if (urlTab && VALID_TABS.includes(urlTab) && urlTab !== useApp.getState().tab) {
        useApp.getState().setTab(urlTab);
      }
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <Header />
      <main className="flex-1">
        {tab === "inicio" && <HomeView />}
        {tab === "earn" && <EarnView />}
        {tab === "enviar-recibir" && <EnviarRecibirView />}
        {tab === "mercado-p2p" && <MercadoP2PUnifiedView />}
        {tab === "escrow" && <EscrowMarketplaceView />}
        {tab === "alertas" && <PriceAlertsView />}
      </main>
      <footer className="mt-auto border-t border-slate-800 bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 py-6 text-xs text-slate-600 text-center">
          © 2026 CriptoMy · Web3 LATAM · Sin custodia · Sin KYC forzado
          <br />
          ⚠️ Operar cripto puede ser ilegal en tu jurisdicción. No custodiamos tus fondos.
          Datos de mercado vía APIs públicas oficiales.
        </div>
      </footer>
    </div>
  );
}
