"use client";

import { useState } from "react";
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
  Home, Store, ArrowLeftRight, Trophy, Wallet, Star,
  Image as ImageIcon, CalendarClock, Bell, LogOut, Copy,
  ShoppingBag, Sparkles, Grid3x3,
  Globe2, CreditCard, ShieldAlert, Settings, Menu, X, ChevronRight, Search, Activity,
  Heart, BookOpen, TrendingUp, Shield,
} from "lucide-react";
import { reputationLabel, avatarGradient } from "@/lib/format";
import Onboarding from "./Onboarding";
import NotificationBell from "./NotificationBell";

type NavItem = { key: TabKey; label: string; icon: React.ElementType; desc: string };

// Agrupación profesional: 5 categorías claras (sin menú "Más")
const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "Inicio",
    items: [
      { key: "inicio", label: "Inicio", icon: Home, desc: "Dashboard + buscador Web3 integrado" },
    ],
  },
  {
    title: "Cripto",
    items: [
      { key: "earn", label: "Earn", icon: TrendingUp, desc: "Pon tu cripto a trabajar: DeFi, funding, basis" },
      { key: "enviar-recibir", label: "Enviar / Recibir", icon: ArrowLeftRight, desc: "Transfiere o recibe cripto anónimo, sin KYC" },
    ],
  },
  {
    title: "Mercado",
    items: [
      { key: "mercado-p2p", label: "Mercado P2P", icon: Store, desc: "Compra/venta persona a persona de cripto" },
      { key: "escrow", label: "Escrow Digital", icon: Shield, desc: "Custodia neutral para productos digitales con MetaMask" },
    ],
  },
];

// Nav principal: 5 botones directos, sin dropdown "Más"
const COMPACT_NAV: TabKey[] = [
  "inicio",
  "earn",
  "enviar-recibir",
  "mercado-p2p",
  "escrow",
];

export default function Header() {
  const { user, tab, setTab, logout } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const rep = user ? reputationLabel(user.reputationScore) : null;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex h-16 items-center justify-between gap-3">
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
                Web3 · LATAM
              </div>
            </div>
          </button>

          {/* Nav desktop — 5 botones directos, sin dropdown */}
          <nav className="hidden lg:flex items-center gap-0.5 flex-1 justify-center">
            {COMPACT_NAV.map((key) => {
              const item = NAV_GROUPS.flatMap((g) => g.items).find((i) => i.key === key)!;
              if (!item) return null;
              const Icon = item.icon;
              const active = tab === key;
              return (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md transition ${
                    active
                      ? "bg-emerald-600 text-white"
                      : "text-slate-300 hover:text-slate-100 hover:bg-slate-800"
                  }`}
                  title={item.desc}
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
                    onClick={() => setTab("inicio")}
                  >
                    <Wallet className="w-3 h-3 mr-2" /> Mi portafolio
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

            {/* Mobile menu trigger */}
            <button
              onClick={() => setMobileMenuOpen((o) => !o)}
              className="lg:hidden p-2 rounded-lg hover:bg-slate-800 transition text-slate-300"
              aria-label="Menú"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-800 py-4 max-h-[70vh] overflow-y-auto">
            {NAV_GROUPS.map((group) => (
              <div key={group.title} className="mb-4">
                <div className="px-2 mb-1 text-[10px] uppercase text-slate-500 font-semibold">
                  {group.title}
                </div>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = tab === item.key;
                  return (
                    <button
                      key={item.key}
                      onClick={() => {
                        setTab(item.key);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition ${
                        active
                          ? "bg-emerald-600 text-white"
                          : "text-slate-300 hover:bg-slate-800"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <div className="text-left flex-1">
                        <div className="font-medium">{item.label}</div>
                        <div className="text-[10px] text-slate-500">{item.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
