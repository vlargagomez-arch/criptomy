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
  | "billetera"
  | "reputacion"
  | "disputas"
  | "tor";

interface AppState {
  user: CurrentUser | null;
  tab: TabKey;
  privateKey: string | null; // clave ECDH privada en localStorage (no servidor)
  connecting: boolean;
  setTab: (t: TabKey) => void;
  setUser: (u: CurrentUser | null) => void;
  setPrivateKey: (k: string | null) => void;
  setConnecting: (b: boolean) => void;
  logout: () => void;
}

export const useApp = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      tab: "inicio",
      privateKey: null,
      connecting: false,
      setTab: (t) => set({ tab: t }),
      setUser: (u) => set({ user: u }),
      setPrivateKey: (k) => set({ privateKey: k }),
      setConnecting: (b) => set({ connecting: b }),
      logout: () => set({ user: null, privateKey: null, tab: "inicio" }),
    }),
    { name: "p2p-crypto-no-kyc" }
  )
);
