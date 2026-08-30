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

export type TabKey =
  | "inicio"
  | "mercado"
  | "crear"
  | "trades"
  | "swap"
  | "lightning"
  | "p2p"
  | "billetera"
  | "reputacion"
  | "disputas"
  | "tor"
  | "deploy";

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
      logout: () =>
        set({
          user: null,
          privateKey: null,
          tab: "inicio",
          chainId: null,
        }),
    }),
    {
      name: "nokycswap-v8",
      version: 8,
      // Solo persistir datos serializables simples
      partialize: (state) => ({
        user: state.user,
        privateKey: state.privateKey,
        tab: state.tab,
        escrowAddress: state.escrowAddress,
      }),
      // Migración: si la versión del storage es vieja, empezar limpio
      migrate: (_persistedState, version) => {
        if (version < 8) {
          // Schema cambió — descartar datos viejos
          return null;
        }
        return _persistedState;
      },
    }
  )
);
