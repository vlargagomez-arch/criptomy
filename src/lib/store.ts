"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ethers } from "ethers";

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
  // Signer de ethers (no se persiste, se re-obtiene al reconectar)
  signer: ethers.JsonRpcSigner | null;
  chainId: number | null;
  // Dirección del contrato de escrow desplegado (persistida en localStorage)
  escrowAddress: string | null;
  setTab: (t: TabKey) => void;
  setUser: (u: CurrentUser | null) => void;
  setPrivateKey: (k: string | null) => void;
  setConnecting: (b: boolean) => void;
  setSigner: (s: ethers.JsonRpcSigner | null) => void;
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
      signer: null,
      chainId: null,
      escrowAddress: null,
      setTab: (t) => set({ tab: t }),
      setUser: (u) => set({ user: u }),
      setPrivateKey: (k) => set({ privateKey: k }),
      setConnecting: (b) => set({ connecting: b }),
      setSigner: (s) => set({ signer: s }),
      setChainId: (c) => set({ chainId: c }),
      setEscrowAddress: (a) => set({ escrowAddress: a }),
      logout: () =>
        set({
          user: null,
          privateKey: null,
          tab: "inicio",
          signer: null,
          chainId: null,
        }),
    }),
    {
      name: "p2p-crypto-no-kyc",
      // No persistir el signer (no es serializable)
      partialize: (state) => ({
        user: state.user,
        privateKey: state.privateKey,
        tab: state.tab,
        escrowAddress: state.escrowAddress,
      }),
    }
  )
);
