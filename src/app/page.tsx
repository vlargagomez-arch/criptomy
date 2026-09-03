"use client";

import { useEffect } from "react";
import { useApp, TabKey } from "@/lib/store";
import Header from "@/components/marketplace/Header";
import HomeView from "@/components/marketplace/HomeView";
import SmartSearchView from "@/components/marketplace/SmartSearchView";
import EnviarView from "@/components/marketplace/EnviarView";
import RecibirView from "@/components/marketplace/RecibirView";
import RemesasView from "@/components/marketplace/RemesasView";
import TarjetaView from "@/components/marketplace/TarjetaView";
import MercadoP2PUnifiedView from "@/components/marketplace/MercadoP2PUnifiedView";
import RetosP2PView from "@/components/marketplace/RetosP2PView";
import PriceAlertsView from "@/components/marketplace/PriceAlertsView";
import OportunidadesView from "@/components/marketplace/OportunidadesView";
import ProveedoresView from "@/components/marketplace/ProveedoresView";
import ComparadorView from "@/components/marketplace/ComparadorView";
import ComplianceView from "@/components/marketplace/ComplianceView";
import AdminView from "@/components/marketplace/AdminView";
import ScannerAdminView from "@/components/marketplace/ScannerAdminView";
import WalletView from "@/components/marketplace/WalletView";
import ReputationView from "@/components/marketplace/ReputationView";

const VALID_TABS: TabKey[] = [
  "inicio", "buscador", "dashboard", "enviar", "recibir",
  "mercado-p2p", "retos", "alertas", "remesas", "tarjeta",
  "oportunidades", "proveedores", "comparador", "scanner-admin", "compliance",
  "admin", "billetera", "reputacion",
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
        {tab === "buscador" && <SmartSearchView />}
        {tab === "dashboard" && <HomeView />}
        {tab === "enviar" && <EnviarView />}
        {tab === "recibir" && <RecibirView />}
        {tab === "remesas" && <RemesasView />}
        {tab === "tarjeta" && <TarjetaView />}
        {tab === "mercado-p2p" && <MercadoP2PUnifiedView />}
        {tab === "retos" && <RetosP2PView />}
        {tab === "alertas" && <PriceAlertsView />}
        {tab === "oportunidades" && <OportunidadesView />}
        {tab === "proveedores" && <ProveedoresView />}
        {tab === "comparador" && <ComparadorView />}
        {tab === "scanner-admin" && <ScannerAdminView />}
        {tab === "compliance" && <ComplianceView />}
        {tab === "admin" && <AdminView />}
        {tab === "billetera" && <WalletView />}
        {tab === "reputacion" && <ReputationView />}
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
