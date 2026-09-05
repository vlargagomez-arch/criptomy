"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CurrentUser {
  id: string;
  alias: string;
  walletAddress: string;
  publicKey: string | null;
  torOnly: boolean;
  reputationScore: number;
  totalTrades: number;
  completedTrades: number;
  avatarSeed: string | null;
  bio: string | null;
}

// Tabs del header (top level). Mercado P2P tiene sub-tabs internos.
export type TabKey =
  | "inicio"
  | "buscador"
  | "dashboard"
  | "earn"
  | "enviar-recibir"
  | "mercado-p2p"
  | "retos"
  | "escrow"
  | "educacion"
  | "alertas"
  | "oportunidades"
  | "proveedores"
  | "comparador"
  | "scanner-admin"
  | "compliance"
  | "admin"
  | "billetera"
  | "reputacion";

// Sub-tabs dentro de mercado-p2p
export type P2PSubTab = "explorar" | "crear" | "mis-trades" | "disputas";

interface AppState {
  user: CurrentUser | null;
  tab: TabKey;
  p2pSubTab: P2PSubTab;
  privateKey: string | null;
  connecting: boolean;
  chainId: number | null;
  escrowAddress: string | null;
  setTab: (t: TabKey) => void;
  setP2PSubTab: (s: P2PSubTab) => void;
  setUser: (u: CurrentUser | null) => void;
  setPrivateKey: (k: string | null) => void;
  setConnecting: (b: boolean) => void;
  setChainId: (c: number | null) => void;
  setEscrowAddress: (a: string | null) => void;
  logout: () => void;
}

const STORAGE_VERSION = 22;

function isValidUser(user: unknown): user is CurrentUser {
  if (!user || typeof user !== "object") return false;
  const u = user as Record<string, unknown>;
  return (
    typeof u.id === "string" &&
    typeof u.alias === "string" &&
    typeof u.walletAddress === "string" &&
    typeof u.torOnly === "boolean" &&
    typeof u.reputationScore === "number" &&
    typeof u.totalTrades === "number" &&
    typeof u.completedTrades === "number"
  );
}

export const useApp = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      tab: "inicio",
      p2pSubTab: "explorar",
      privateKey: null,
      connecting: false,
      chainId: null,
      escrowAddress: null,
      setTab: (t) => {
        set({ tab: t });
        // Sincronizar URL con history API (sin recargar)
        if (typeof window !== "undefined") {
          const url = new URL(window.location.href);
          if (t === "inicio" || t === "dashboard") {
            url.searchParams.delete("tab");
          } else {
            url.searchParams.set("tab", t);
          }
          window.history.replaceState({}, "", url.toString());
        }
      },
      setP2PSubTab: (s) => set({ p2pSubTab: s }),
      setUser: (u) => set({ user: u }),
      setPrivateKey: (k) => set({ privateKey: k }),
      setConnecting: (b) => set({ connecting: b }),
      setChainId: (c) => set({ chainId: c }),
      setEscrowAddress: (a) => set({ escrowAddress: a }),
      logout: () =>
        set({ user: null, privateKey: null, tab: "inicio", chainId: null, p2pSubTab: "explorar" }),
    }),
    {
      name: "criptomy-v22",
      version: STORAGE_VERSION,
      partialize: (state) => ({
        user: state.user,
        privateKey: state.privateKey,
        tab: state.tab,
        p2pSubTab: state.p2pSubTab,
        escrowAddress: state.escrowAddress,
      }),
      migrate: (persistedState, version) => {
        if (version < STORAGE_VERSION || !persistedState) return null;
        const state = persistedState as { user?: unknown; tab?: unknown };
        if (state.user && !isValidUser(state.user)) state.user = null;
        const validTabs: TabKey[] = [
          "inicio",
          "buscador",
          "dashboard",
          "earn",
          "enviar-recibir",
          "mercado-p2p",
          "retos",
          "escrow",
          "educacion",
          "alertas",
          "oportunidades",
          "proveedores",
          "comparador",
          "scanner-admin",
          "compliance",
          "admin",
          "billetera",
          "reputacion",
        ];
        // Migrar tabs viejos a los nuevos
        const tabAliases: Record<string, TabKey> = {
          enviar: "enviar-recibir",
          recibir: "enviar-recibir",
        };
        if (state.tab) {
          const t = state.tab as string;
          if (tabAliases[t]) state.tab = tabAliases[t];
          if (!validTabs.includes(state.tab as TabKey)) state.tab = "inicio";
        }
        return state;
      },
    }
  )
);
