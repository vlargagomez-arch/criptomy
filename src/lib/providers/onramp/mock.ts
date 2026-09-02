// ============================================================
// ADAPTER MOCK — Solo para desarrollo
// ============================================================
// ⚠️ ESTE ADAPTER NO HACE TRANSACCIONES REALES.
// Solo simula la experiencia para que la UI sea testeable
// mientras se configuran los API keys de los providers reales.
// NUNCA usar en producción.
// ============================================================

import type {
  OnRampProvider,
  OffRampProvider,
  AvailabilityRequest,
  AvailabilityResponse,
  PurchaseRequest,
  PurchaseResponse,
  PurchaseStatus,
  SellRequest,
  SellResponse,
  SellStatus,
} from "../types";

const MOCK_FIAT_RATE: Record<string, number> = {
  // 1 USDT = X fiat (mock)
  COP: 4100,
  MXN: 18.5,
  ARS: 950,
  BRL: 5.05,
  CLP: 950,
  PEN: 3.75,
  USD: 1,
  EUR: 0.92,
};

export const MockOnRampProvider: OnRampProvider = {
  id: "mock-onramp",
  name: "MOCK On-Ramp (DEV)",
  logoUrl: "🧪",
  countries: ["CO", "MX", "AR", "BR", "CL", "PE"],
  requiresKyc: false,

  isAvailable: async (req: AvailabilityRequest): Promise<AvailabilityResponse> => {
    const rate = MOCK_FIAT_RATE[req.currency] || 1;
    return {
      available: true,
      fee: req.amount * 0.02, // 2% mock
      feeCurrency: req.currency,
      rate: 1 / rate,
      estimatedTime: "5-15 min",
      minAmount: 10,
      maxAmount: 5000,
      kycRequired: false,
    };
  },

  startPurchase: async (req: PurchaseRequest): Promise<PurchaseResponse> => {
    if (process.env.NODE_ENV === "production") {
      throw new Error("MOCK provider no debe usarse en producción");
    }
    const purchaseId = `mock_purchase_${Date.now()}`;
    console.warn("[MOCK OnRamp] Simulando compra:", req, "→", purchaseId);
    return {
      purchaseId,
      status: "COMPLETED" as never, // hack: simulamos instantáneo
      redirectUrl: undefined,
    };
  },

  getPurchaseStatus: async (purchaseId: string): Promise<PurchaseStatus> => {
    console.warn("[MOCK OnRamp] Status de:", purchaseId);
    return {
      purchaseId,
      status: "COMPLETED",
      cryptoAmount: 100,
      receivedAt: Math.floor(Date.now() / 1000),
    };
  },
};

export const MockOffRampProvider: OffRampProvider = {
  id: "mock-offramp",
  name: "MOCK Off-Ramp (DEV)",
  logoUrl: "🧪",
  countries: ["CO", "MX", "AR", "BR"],
  requiresKyc: false,

  isAvailable: async (req: AvailabilityRequest): Promise<AvailabilityResponse> => {
    const rate = MOCK_FIAT_RATE[req.currency] || 1;
    return {
      available: true,
      fee: req.amount * 0.03,
      feeCurrency: req.currency,
      rate,
      estimatedTime: "1-2 días hábiles",
      minAmount: 50,
      maxAmount: 10000,
      kycRequired: false,
    };
  },

  startSell: async (req: SellRequest): Promise<SellResponse> => {
    if (process.env.NODE_ENV === "production") {
      throw new Error("MOCK provider no debe usarse en producción");
    }
    const sellId = `mock_sell_${Date.now()}`;
    console.warn("[MOCK OffRamp] Simulando venta:", req, "→", sellId);
    return {
      sellId,
      status: "AWAITING_DEPOSIT",
      depositAddress: "0xMOCK_DEPOSIT_ADDRESS",
      depositAmount: req.cryptoAmount,
    };
  },

  getSellStatus: async (sellId: string): Promise<SellStatus> => {
    console.warn("[MOCK OffRamp] Status de:", sellId);
    return {
      sellId,
      status: "COMPLETED",
      fiatAmount: 410000,
      completedAt: Math.floor(Date.now() / 1000),
    };
  },
};
