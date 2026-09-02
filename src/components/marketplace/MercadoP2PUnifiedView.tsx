"use client";

import { useApp, P2PSubTab } from "@/lib/store";
import { Store, PlusCircle, ArrowLeftRight, Shield } from "lucide-react";
import MarketplaceView from "./MarketplaceView";
import CreateOfferView from "./CreateOfferView";
import MyTradesView from "./MyTradesView";
import DisputesView from "./DisputesView";

// Mercado P2P unificado — combina en UN solo menu:
//  - Explorar ofertas (antes "Mercado")
//  - Crear oferta (antes "Crear oferta")
//  - Mis trades (antes "Mis trades")
//  - Disputas (vista nueva para revisar disputas)
//
// Esto responde al requerimiento del usuario de fusionar el menu P2P.

const SUBTABS: { id: P2PSubTab; label: string; icon: React.ElementType }[] = [
  { id: "explorar", label: "Explorar ofertas", icon: Store },
  { id: "crear", label: "Crear oferta", icon: PlusCircle },
  { id: "mis-trades", label: "Mis trades", icon: ArrowLeftRight },
  { id: "disputas", label: "Disputas", icon: Shield },
];

export default function MercadoP2PUnifiedView() {
  const { p2pSubTab, setP2PSubTab } = useApp();

  return (
    <div>
      {/* Sub-nav interna */}
      <div className="border-b border-slate-800 bg-slate-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <nav className="flex gap-1 overflow-x-auto scrollbar-hide py-2">
            {SUBTABS.map((s) => {
              const Icon = s.icon;
              const active = p2pSubTab === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setP2PSubTab(s.id)}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition ${
                    active
                      ? "bg-emerald-600 text-white"
                      : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {s.label}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Contenido */}
      {p2pSubTab === "explorar" && <MarketplaceView />}
      {p2pSubTab === "crear" && <CreateOfferView />}
      {p2pSubTab === "mis-trades" && <MyTradesView />}
      {p2pSubTab === "disputas" && <DisputesView />}
    </div>
  );
}
