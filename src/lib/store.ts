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

export type TabKey = "inicio" | "mercado" | "crear" | "trades" | "retos" | "nft" | "drops" | "alertas" | "billetera" | "reputacion";

interface AppState {
  user: CurrentUser | null;
  tab: TabKey;
  privateKey: string | null;
  connecting: boolean;
  chainId: number | null;
  escrowAddress: string | null;
  setTab: (t: TabKey) => void;
  setUser: (u: CurrentUser | null) => void;
  setPrivateKey: (k: string | null) => void;
  setConnecting: (b: boolean) => void;
  setChainId: (c: number | null) => void;
  setEscrowAddress: (a: string | null) => void;
  logout: () => void;
}

const STORAGE_VERSION = 11;

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
      privateKey: null,
      connecting: false,
      chainId: null,
      escrowAddress: null,
      setTab: (t) => set({ tab: t }),
      setUser: (u) => set({ user: u }),
      setPrivateKey: (k) => set({ privateKey: k }),
      setConnecting: (b) => set({ connecting: b }),
      setChainId: (c) => set({ chainId: c }),
      setEscrowAddress: (a) => set({ escrowAddress: a }),
      logout: () => set({ user: null, privateKey: null, tab: "inicio", chainId: null }),
    }),
    {
      name: "nokycswap-v11",
      version: STORAGE_VERSION,
      partialize: (state) => ({
        user: state.user,
        privateKey: state.privateKey,
        tab: state.tab,
        escrowAddress: state.escrowAddress,
      }),
      migrate: (persistedState, version) => {
        if (version < STORAGE_VERSION || !persistedState) return null;
        const state = persistedState as { user?: unknown; tab?: unknown };
        if (state.user && !isValidUser(state.user)) state.user = null;
        const validTabs: TabKey[] = ["inicio", "mercado", "crear", "trades", "retos", "nft", "drops", "alertas", "billetera", "reputacion"];
        if (state.tab && !validTabs.includes(state.tab as TabKey)) state.tab = "inicio";
        return state;
      },
    }
  )
);
