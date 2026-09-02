"use client";

import { useApp, TabKey } from "@/lib/store";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Home, Store, PlusCircle, ArrowLeftRight, Trophy, Wallet, Star,
  Image as ImageIcon, CalendarClock, Bell, LogOut, Copy,
  ShoppingBag, TrendingDown, Send, Download, Sparkles, Grid3x3,
  Globe2, CreditCard, ShieldAlert, Settings,
} from "lucide-react";
import { reputationLabel, avatarGradient } from "@/lib/format";
import Onboarding from "./Onboarding";
import NotificationBell from "./NotificationBell";

type NavItem = { key: TabKey; label: string; icon: React.ElementType };

// Nav del top: agrupado en secciones lógicas
const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: "Inicio",
    items: [
      { key: "dashboard", label: "Inicio", icon: Home },
    ],
  },
  {
    title: "Operaciones",
    items: [
      { key: "comprar", label: "Comprar", icon: ShoppingBag },
      { key: "vender", label: "Vender", icon: TrendingDown },
      { key: "enviar", label: "Enviar", icon: Send },
      { key: "recibir", label: "Recibir", icon: Download },
      { key: "remesas", label: "Remesas", icon: Globe2 },
      { key: "tarjeta", label: "Tarjeta", icon: CreditCard },
    ],
  },
  {
    title: "Mercado",
    items: [
      { key: "mercado-p2p", label: "Mercado P2P", icon: Store },
      { key: "retos", label: "Retos", icon: Trophy },
      { key: "nft", label: "NFT", icon: ImageIcon },
      { key: "drops", label: "Drops", icon: CalendarClock },
    ],
  },
  {
    title: "Descubrir",
    items: [
      { key: "oportunidades", label: "Oportunidades", icon: Sparkles },
      { key: "proveedores", label: "Proveedores", icon: Grid3x3 },
      { key: "comparador", label: "Comparador", icon: ShoppingBag },
      { key: "alertas", label: "Alertas", icon: Bell },
    ],
  },
  {
    title: "Sistema",
    items: [
      { key: "compliance", label: "Compliance", icon: ShieldAlert },
      { key: "admin", label: "Admin", icon: Settings },
    ],
  },
];

const ALL_NAV = NAV_SECTIONS.flatMap((s) => s.items);

export default function Header() {
  const { user, tab, setTab, logout } = useApp();
  const rep = user ? reputationLabel(user.reputationScore) : null;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Logo */}
          <button
            onClick={() => setTab("inicio")}
            className="flex items-center gap-2 shrink-0"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center">
              <span className="text-white font-bold text-lg">₿</span>
            </div>
            <div className="hidden sm:block">
              <div className="text-sm font-bold text-slate-100 leading-tight">
                Cripto<span className="text-emerald-400">My</span>
              </div>
              <div className="text-[10px] text-slate-500 leading-tight">
                Web3 · LATAM · Sin custodia
              </div>
            </div>
          </button>

          {/* Nav desktop — botones directos */}
          <nav className="hidden md:flex items-center gap-0.5 flex-1 overflow-x-auto scrollbar-hide">
            {ALL_NAV.map((item) => {
              const Icon = item.icon;
              const active = tab === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => setTab(item.key)}
                  className={`flex items-center gap-1.5 px-2.5 py-2 text-xs font-medium rounded-md transition whitespace-nowrap ${
                    active
                      ? "bg-emerald-600 text-white"
                      : "text-slate-300 hover:text-slate-100 hover:bg-slate-800"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Auth */}
          <div className="flex items-center gap-2">
            {user && <NotificationBell />}
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-800 transition">
                    <Avatar
                      className={`w-8 h-8 bg-gradient-to-br ${avatarGradient(user.avatarSeed)}`}
                    >
                      <AvatarFallback className="bg-transparent text-white text-xs font-semibold">
                        {user.alias.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="hidden sm:block text-left">
                      <div className="text-xs font-medium text-slate-100 leading-tight">
                        {user.alias}
                      </div>
                      {rep && (
                        <div className={`text-[10px] leading-tight ${rep.color}`}>
                          ★ {user.reputationScore.toFixed(0)} · {rep.label}
                        </div>
                      )}
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="bg-slate-900 border-slate-800 text-slate-100 w-56 p-2"
                >
                  <div className="px-2 py-1.5">
                    <div className="text-xs font-medium text-slate-100">{user.alias}</div>
                    <code className="text-[10px] text-slate-500 font-mono break-all">
                      {user.walletAddress.slice(0, 10)}…{user.walletAddress.slice(-6)}
                    </code>
                  </div>
                  <DropdownMenuSeparator className="bg-slate-800" />
                  <DropdownMenuItem
                    className="text-xs cursor-pointer"
                    onClick={() => navigator.clipboard?.writeText(user.walletAddress)}
                  >
                    <Copy className="w-3 h-3 mr-2" /> Copiar dirección
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-xs cursor-pointer"
                    onClick={() => setTab("billetera")}
                  >
                    <Wallet className="w-3 h-3 mr-2" /> Mi billetera
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-xs cursor-pointer"
                    onClick={() => setTab("reputacion")}
                  >
                    <Star className="w-3 h-3 mr-2" /> Mi reputación
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-slate-800" />
                  <DropdownMenuItem
                    className="text-xs text-red-400 cursor-pointer"
                    onClick={() => logout()}
                  >
                    <LogOut className="w-3 h-3 mr-2" /> Cerrar sesión
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Onboarding />
            )}
          </div>
        </div>

        {/* Nav móvil */}
        <nav className="md:hidden flex items-center gap-0.5 pb-2 overflow-x-auto scrollbar-hide">
          {ALL_NAV.map((item) => {
            const Icon = item.icon;
            const active = tab === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setTab(item.key)}
                className={`shrink-0 flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-md transition ${
                  active
                    ? "bg-emerald-600 text-white"
                    : "text-slate-400 hover:bg-slate-800"
                }`}
              >
                <Icon className="w-3 h-3" />
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
