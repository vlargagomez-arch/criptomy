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
import DeployContractView from "@/components/marketplace/DeployContractView";
import LightningView from "@/components/marketplace/LightningView";
import SwapView from "@/components/marketplace/SwapView";
import P2PView from "@/components/marketplace/P2PView";
import RetosP2PView from "@/components/marketplace/RetosP2PView";

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
        {tab === "swap" && <SwapView />}
        {tab === "lightning" && <LightningView />}
        {tab === "p2p" && <P2PView />}
        {tab === "retos" && <RetosP2PView />}
        {tab === "billetera" && <WalletView />}
        {tab === "reputacion" && <ReputationView />}
        {tab === "disputas" && <DisputesView />}
        {tab === "deploy" && <DeployContractView />}
        {tab === "tor" && <TorGuideView />}
      </main>
      <Footer />
    </div>
  );
}

function Footer() {
  const { setTab } = useApp();
  return (
    <footer className="mt-auto border-t border-slate-800 bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          {/* Logo + descripción */}
          <div className="col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center">
                <span className="text-white font-bold text-sm">₿</span>
              </div>
              <span className="text-sm font-bold text-slate-100">
                NoKYC<span className="text-emerald-400">Swap</span>
              </span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed max-w-sm">
              Plataforma P2P para compra y venta de criptomonedas sin KYC, con
              escrow on-chain, chat cifrado y soporte para Tor. Inspirada en
              LocalBitcoins, mejorada con DeFi.
            </p>
            <div className="flex items-center gap-2 mt-4">
              <span className="px-2 py-0.5 text-[10px] rounded bg-slate-900 border border-slate-800 text-slate-400">ETH</span>
              <span className="px-2 py-0.5 text-[10px] rounded bg-slate-900 border border-slate-800 text-slate-400">BTC</span>
              <span className="px-2 py-0.5 text-[10px] rounded bg-slate-900 border border-slate-800 text-slate-400">TRX</span>
              <span className="px-2 py-0.5 text-[10px] rounded bg-slate-900 border border-slate-800 text-slate-400">XMR</span>
            </div>
          </div>

          {/* Enlaces Trade */}
          <div>
            <h4 className="text-xs font-semibold text-slate-300 mb-3">Trade</h4>
            <ul className="space-y-2">
              <li>
                <button onClick={() => setTab("mercado")} className="text-xs text-slate-500 hover:text-emerald-400 transition">
                  Mercado P2P
                </button>
              </li>
              <li>
                <button onClick={() => setTab("crear")} className="text-xs text-slate-500 hover:text-emerald-400 transition">
                  Crear oferta
                </button>
              </li>
              <li>
                <button onClick={() => setTab("trades")} className="text-xs text-slate-500 hover:text-emerald-400 transition">
                  Mis trades
                </button>
              </li>
            </ul>
          </div>

          {/* Enlaces DeFi */}
          <div>
            <h4 className="text-xs font-semibold text-slate-300 mb-3">DeFi</h4>
            <ul className="space-y-2">
              <li>
                <button onClick={() => setTab("swap")} className="text-xs text-slate-500 hover:text-emerald-400 transition">
                  Swap (Uniswap)
                </button>
              </li>
              <li>
                <button onClick={() => setTab("lightning")} className="text-xs text-slate-500 hover:text-emerald-400 transition">
                  Lightning Network
                </button>
              </li>
              <li>
                <button onClick={() => setTab("p2p")} className="text-xs text-slate-500 hover:text-emerald-400 transition">
                  Red P2P
                </button>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-[10px] text-slate-600">
            © 2026 NoKYCSwap · Software educativo · Sin auditoría profesional
          </div>
          <div className="text-[10px] text-amber-600/70 text-center sm:text-right max-w-md">
            ⚠️ Operar exchanges sin KYC puede ser ilegal en tu jurisdicción. Consulta a un abogado antes de usar con fondos reales.
          </div>
        </div>
      </div>
    </footer>
  );
}
