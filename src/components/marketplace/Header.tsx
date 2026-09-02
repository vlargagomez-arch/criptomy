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
  LogOut, Copy,
} from "lucide-react";
import { reputationLabel, avatarGradient } from "@/lib/format";
import Onboarding from "./Onboarding";

type NavItem = { key: TabKey; label: string; icon: React.ElementType };

const NAV_ITEMS: NavItem[] = [
  { key: "mercado", label: "Mercado", icon: Store },
  { key: "crear", label: "Crear oferta", icon: PlusCircle },
  { key: "trades", label: "Mis trades", icon: ArrowLeftRight },
  { key: "retos", label: "Retos", icon: Trophy },
  { key: "billetera", label: "Billetera", icon: Wallet },
  { key: "reputacion", label: "Reputación", icon: Star },
];

export default function Header() {
  const { user, tab, setTab, logout } = useApp();
  const rep = user ? reputationLabel(user.reputationScore) : null;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Logo */}
          <button onClick={() => setTab("inicio")} className="flex items-center gap-2 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center">
              <span className="text-white font-bold text-lg">₿</span>
            </div>
            <div className="hidden sm:block">
              <div className="text-sm font-bold text-slate-100 leading-tight">
                NoKYC<span className="text-emerald-400">Swap</span>
              </div>
              <div className="text-[10px] text-slate-500 leading-tight">P2P · sin KYC</div>
            </div>
          </button>

          {/* Nav desktop — botones directos */}
          <nav className="hidden md:flex items-center gap-1 flex-1">
            <button
              onClick={() => setTab("inicio")}
              className={`px-3 py-2 text-sm font-medium rounded-md transition ${
                tab === "inicio" ? "text-emerald-400" : "text-slate-300 hover:text-slate-100"
              }`}
            >
              <Home className="w-4 h-4 inline mr-1" />
              Inicio
            </button>
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = tab === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => setTab(item.key)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md transition ${
                    active ? "bg-emerald-600 text-white" : "text-slate-300 hover:text-slate-100 hover:bg-slate-800"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Auth */}
          <div className="flex items-center gap-3">
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-800 transition">
                    <Avatar className={`w-8 h-8 bg-gradient-to-br ${avatarGradient(user.avatarSeed)}`}>
                      <AvatarFallback className="bg-transparent text-white text-xs font-semibold">
                        {user.alias.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="hidden sm:block text-left">
                      <div className="text-xs font-medium text-slate-100 leading-tight">{user.alias}</div>
                      {rep && (
                        <div className={`text-[10px] leading-tight ${rep.color}`}>
                          ★ {user.reputationScore.toFixed(0)} · {rep.label}
                        </div>
                      )}
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-slate-900 border-slate-800 text-slate-100 w-56 p-2">
                  <div className="px-2 py-1.5">
                    <div className="text-xs font-medium text-slate-100">{user.alias}</div>
                    <code className="text-[10px] text-slate-500 font-mono break-all">
                      {user.walletAddress.slice(0, 10)}…{user.walletAddress.slice(-6)}
                    </code>
                  </div>
                  <DropdownMenuSeparator className="bg-slate-800" />
                  <DropdownMenuItem className="text-xs cursor-pointer" onClick={() => navigator.clipboard?.writeText(user.walletAddress)}>
                    <Copy className="w-3 h-3 mr-2" /> Copiar dirección
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-xs cursor-pointer" onClick={() => setTab("billetera")}>
                    <Wallet className="w-3 h-3 mr-2" /> Mi billetera
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-xs cursor-pointer" onClick={() => setTab("reputacion")}>
                    <Star className="w-3 h-3 mr-2" /> Mi reputación
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-slate-800" />
                  <DropdownMenuItem className="text-xs text-red-400 cursor-pointer" onClick={() => logout()}>
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
        <nav className="md:hidden flex items-center gap-1 pb-2 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setTab("inicio")}
            className={`shrink-0 px-3 py-1.5 text-xs font-medium rounded-md transition ${
              tab === "inicio" ? "bg-emerald-600 text-white" : "text-slate-400 hover:bg-slate-800"
            }`}
          >
            Inicio
          </button>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = tab === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setTab(item.key)}
                className={`shrink-0 flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md transition ${
                  active ? "bg-emerald-600 text-white" : "text-slate-400 hover:bg-slate-800"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
