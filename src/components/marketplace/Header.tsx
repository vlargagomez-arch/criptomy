"use client";

import { useApp, TabKey } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { reputationLabel, avatarGradient } from "@/lib/format";
import {
  Home,
  Store,
  PlusCircle,
  ArrowLeftRight,
  Wallet,
  Star,
  AlertTriangle,
  Shield,
  Rocket,
  Zap,
  Network,
  ChevronDown,
  LogOut,
  Copy,
} from "lucide-react";
import Onboarding from "./Onboarding";

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "inicio", label: "Inicio", icon: Home },
  { key: "mercado", label: "Mercado", icon: Store },
  { key: "crear", label: "Crear oferta", icon: PlusCircle },
  { key: "trades", label: "Mis trades", icon: ArrowLeftRight },
  { key: "swap", label: "Swap", icon: ArrowLeftRight },
  { key: "lightning", label: "Lightning", icon: Zap },
  { key: "p2p", label: "Red P2P", icon: Network },
  { key: "billetera", label: "Billetera", icon: Wallet },
  { key: "reputacion", label: "Reputación", icon: Star },
  { key: "disputas", label: "Disputas", icon: AlertTriangle },
  { key: "deploy", label: "Desplegar", icon: Rocket },
  { key: "tor", label: "Guía Tor", icon: Shield },
];

export default function Header() {
  const { user, tab, setTab, logout } = useApp();
  const rep = user ? reputationLabel(user.reputationScore) : null;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">₿</span>
          </div>
          <div className="hidden sm:block">
            <div className="text-sm font-bold text-slate-100 leading-tight">
              NoKYC<span className="text-emerald-400">Swap</span>
            </div>
            <div className="text-[10px] text-slate-500 leading-tight">
              P2P · sin KYC · sin custodia
            </div>
          </div>
        </div>

        {/* Tabs (desktop) */}
        <nav className="hidden lg:flex items-center gap-1 flex-1">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
                  active
                    ? "bg-emerald-600 text-white"
                    : "text-slate-400 hover:text-slate-100 hover:bg-slate-800"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </nav>

        <div className="flex-1 lg:hidden" />

        {/* Auth */}
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-800 transition">
                <Avatar className={`w-7 h-7 bg-gradient-to-br ${avatarGradient(user.avatarSeed)}`}>
                  <AvatarFallback className="bg-transparent text-white text-xs">
                    {user.alias.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden md:block text-left">
                  <div className="text-xs font-medium text-slate-100">
                    {user.alias}
                  </div>
                  {rep && (
                    <div className={`text-[10px] ${rep.color}`}>
                      {user.reputationScore.toFixed(0)} · {rep.label}
                    </div>
                  )}
                </div>
                <ChevronDown className="w-3 h-3 text-slate-500" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="bg-slate-900 border-slate-700 text-slate-100 w-56"
            >
              <DropdownMenuLabel className="text-slate-400 text-xs">
                Sesión pseudónima
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-slate-800" />
              <DropdownMenuItem
                className="text-xs font-mono text-slate-400 cursor-default"
                onSelect={(e) => {
                  e.preventDefault();
                  navigator.clipboard?.writeText(user.walletAddress);
                }}
              >
                <Copy className="w-3 h-3 mr-2" />
                <span className="truncate">
                  {user.walletAddress.slice(0, 10)}…{user.walletAddress.slice(-6)}
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-xs cursor-pointer"
                onClick={() => setTab("billetera")}
              >
                <Wallet className="w-3 h-3 mr-2" />
                Ver billetera
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-slate-800" />
              <DropdownMenuItem
                className="text-xs text-red-400 cursor-pointer"
                onClick={() => logout()}
              >
                <LogOut className="w-3 h-3 mr-2" />
                Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Onboarding />
        )}
      </div>

      {/* Tabs móvil */}
      <nav className="lg:hidden flex items-center gap-1 px-2 pb-2 overflow-x-auto">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition shrink-0 ${
                active
                  ? "bg-emerald-600 text-white"
                  : "text-slate-400 hover:bg-slate-800"
              }`}
            >
              <Icon className="w-3 h-3" />
              {t.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
