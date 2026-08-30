"use client";

import { useApp, TabKey } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Home,
  Store,
  PlusCircle,
  ArrowLeftRight,
  ArrowDownUp,
  Zap,
  Network,
  Wallet,
  Star,
  ShieldAlert,
  Rocket,
  Shield,
  ChevronDown,
  LogOut,
  Copy,
  MoreHorizontal,
} from "lucide-react";
import { reputationLabel, avatarGradient } from "@/lib/format";
import Onboarding from "./Onboarding";

// Estructura de navegación: agrupada por categoría
type NavItem = { key: TabKey; label: string; icon: React.ElementType; description?: string };
type NavGroup = { label: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Trade",
    items: [
      { key: "mercado", label: "Mercado P2P", icon: Store, description: "Ofertas de compra y venta" },
      { key: "crear", label: "Crear oferta", icon: PlusCircle, description: "Publicar oferta nueva" },
      { key: "trades", label: "Mis trades", icon: ArrowLeftRight, description: "Trades activos y completados" },
    ],
  },
  {
    label: "DeFi",
    items: [
      { key: "swap", label: "Swap cripto", icon: ArrowDownUp, description: "Intercambio vía Uniswap V3" },
      { key: "lightning", label: "Lightning", icon: Zap, description: "Pagos instantáneos de Bitcoin" },
      { key: "p2p", label: "Red P2P", icon: Network, description: "Red descentralizada sin servidor" },
    ],
  },
  {
    label: "Cuenta",
    items: [
      { key: "billetera", label: "Billetera", icon: Wallet, description: "Saldos y direcciones" },
      { key: "reputacion", label: "Reputación", icon: Star, description: "Historial y feedback" },
      { key: "disputas", label: "Disputas", icon: ShieldAlert, description: "Resolución con Kleros" },
    ],
  },
];

const SECONDARY_ITEMS: NavItem[] = [
  { key: "deploy", label: "Desplegar contrato", icon: Rocket },
  { key: "tor", label: "Guía Tor", icon: Shield },
];

export default function Header() {
  const { user, tab, setTab, logout } = useApp();
  const rep = user ? reputationLabel(user.reputationScore) : null;

  // Encontrar el grupo activo para resaltar
  const activeGroup = NAV_GROUPS.find((g) =>
    g.items.some((i) => i.key === tab)
  );

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/95 backdrop-blur supports-[backdrop-filter]:bg-slate-950/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Logo + nav principal */}
          <div className="flex items-center gap-6">
            {/* Logo */}
            <button
              onClick={() => setTab("inicio")}
              className="flex items-center gap-2 shrink-0"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <span className="text-white font-bold text-lg">₿</span>
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-sm font-bold text-slate-100 leading-tight tracking-tight">
                  NoKYC<span className="text-emerald-400">Swap</span>
                </div>
                <div className="text-[10px] text-slate-500 leading-tight">
                  P2P · sin KYC
                </div>
              </div>
            </button>

            {/* Nav principal — desktop */}
            <nav className="hidden md:flex items-center">
              <button
                onClick={() => setTab("inicio")}
                className={`px-3 py-2 text-sm font-medium rounded-md transition ${
                  tab === "inicio"
                    ? "text-emerald-400"
                    : "text-slate-300 hover:text-slate-100"
                }`}
              >
                Inicio
              </button>

              {/* Dropdowns por grupo */}
              {NAV_GROUPS.map((group) => {
                const isActive = group.items.some((i) => i.key === tab);
                return (
                  <DropdownMenu key={group.label}>
                    <DropdownMenuTrigger asChild>
                      <button
                        className={`px-3 py-2 text-sm font-medium rounded-md transition flex items-center gap-1 ${
                          isActive
                            ? "text-emerald-400"
                            : "text-slate-300 hover:text-slate-100"
                        }`}
                      >
                        {group.label}
                        <ChevronDown className="w-3 h-3 opacity-60" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      className="bg-slate-900 border-slate-800 text-slate-100 w-64 p-2"
                    >
                      <DropdownMenuLabel className="text-slate-500 text-[10px] uppercase tracking-wider px-2 py-1">
                        {group.label}
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator className="bg-slate-800 my-1" />
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const active = tab === item.key;
                        return (
                          <DropdownMenuItem
                            key={item.key}
                            onSelect={(e) => {
                              e.preventDefault();
                              setTab(item.key);
                            }}
                            className={`p-2 rounded-md cursor-pointer ${
                              active
                                ? "bg-emerald-950/40 text-emerald-300"
                                : "hover:bg-slate-800"
                            }`}
                          >
                            <Icon className="w-4 h-4 mr-3 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium">{item.label}</div>
                              {item.description && (
                                <div className="text-[10px] text-slate-500 truncate">
                                  {item.description}
                                </div>
                              )}
                            </div>
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                );
              })}

              {/* Más */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="px-3 py-2 text-sm font-medium rounded-md text-slate-300 hover:text-slate-100 transition flex items-center gap-1">
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="bg-slate-900 border-slate-800 text-slate-100 w-56 p-2"
                >
                  {SECONDARY_ITEMS.map((item) => {
                    const Icon = item.icon;
                    const active = tab === item.key;
                    return (
                      <DropdownMenuItem
                        key={item.key}
                        onSelect={(e) => {
                          e.preventDefault();
                          setTab(item.key);
                        }}
                        className={`p-2 rounded-md cursor-pointer ${
                          active
                            ? "bg-emerald-950/40 text-emerald-300"
                            : "hover:bg-slate-800"
                        }`}
                      >
                        <Icon className="w-4 h-4 mr-3" />
                        <span className="text-sm">{item.label}</span>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            </nav>
          </div>

          {/* Lado derecho: auth */}
          <div className="flex items-center gap-3">
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
                    <ChevronDown className="w-3 h-3 text-slate-500" />
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
                    className="text-xs cursor-pointer hover:bg-slate-800 rounded-md p-2"
                    onSelect={(e) => {
                      e.preventDefault();
                      navigator.clipboard?.writeText(user.walletAddress);
                    }}
                  >
                    <Copy className="w-3 h-3 mr-2" />
                    Copiar dirección
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-xs cursor-pointer hover:bg-slate-800 rounded-md p-2"
                    onSelect={() => setTab("billetera")}
                  >
                    <Wallet className="w-3 h-3 mr-2" />
                    Mi billetera
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-xs cursor-pointer hover:bg-slate-800 rounded-md p-2"
                    onSelect={() => setTab("reputacion")}
                  >
                    <Star className="w-3 h-3 mr-2" />
                    Mi reputación
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-slate-800" />
                  <DropdownMenuItem
                    className="text-xs text-red-400 cursor-pointer hover:bg-red-950/30 rounded-md p-2"
                    onSelect={() => logout()}
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
        </div>

        {/* Nav móvil — fila debajo del header */}
        <nav className="md:hidden flex items-center gap-1 pb-2 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setTab("inicio")}
            className={`shrink-0 px-3 py-1.5 text-xs font-medium rounded-md transition ${
              tab === "inicio"
                ? "bg-emerald-600 text-white"
                : "text-slate-400 hover:bg-slate-800"
            }`}
          >
            <Home className="w-3.5 h-3.5 inline mr-1" />
            Inicio
          </button>
          {[...NAV_GROUPS[0].items, ...NAV_GROUPS[1].items, ...NAV_GROUPS[2].items].map((item) => {
            const Icon = item.icon;
            const active = tab === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setTab(item.key)}
                className={`shrink-0 flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md transition ${
                  active
                    ? "bg-emerald-600 text-white"
                    : "text-slate-400 hover:bg-slate-800"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {item.label.split(" ")[0]}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
