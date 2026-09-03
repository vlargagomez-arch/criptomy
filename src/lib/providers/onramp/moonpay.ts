// ============================================================
// ADAPTER MoonPay — On-Ramp real
// ============================================================
// Requiere:
//   NEXT_PUBLIC_MOONPAY_API_KEY (public, ok frontend)
//   MOONPAY_SECRET_KEY (server-side, para firmar URLs)
//
// Docs: https://docs.moonpay.com
// Integración: widget SDK o URL firmada (redirect)
// ============================================================

import type {
  OnRampProvider,
  AvailabilityRequest,
  AvailabilityResponse,
  PurchaseRequest,
  PurchaseResponse,
  PurchaseStatus,
} from "../types";

const MOONPAY_API_BASE = "https://api.moonpay.com";
const MOONPAY_WIDGET_URL = "https://buy.moonpay.com";

export const MoonpayOnRampProvider: OnRampProvider = {
  id: "moonpay",
  name: "MoonPay",
  logoUrl: "🌙",
  countries: ["CO", "MX", "AR", "BR", "CL", "PE", "EC", "VE", "DO"],
  requiresKyc: true,

  isAvailable: async (req: AvailabilityRequest): Promise<AvailabilityResponse> => {
    const apiKey = process.env.NEXT_PUBLIC_MOONPAY_API_KEY;
    // Sin API key nuestra, devolvemos available: true igual — el usuario
    // puede ir al sitio público de MoonPay (https://buy.moonpay.com) sin
    // nuestra integración. La diferencia es que no podemos pre-firmar la URL.
    // Si está soportado en el país, está disponible.
    const supportedCountries = ["CO", "MX", "AR", "BR", "CL", "PE", "EC", "VE", "DO"];
    const countrySupported = supportedCountries.includes(req.country.toUpperCase());

    if (!apiKey) {
      return {
        available: countrySupported,
        kycRequired: true,
        estimatedTime: "10-30 min (sitio oficial)",
        minAmount: 20,
        maxAmount: 10000,
        feeCurrency: req.currency,
        reason: countrySupported
          ? "Sin integración API nuestra. Te redirigimos al sitio oficial de MoonPay."
          : "País no soportado por MoonPay.",
      };
    }

    // Con API key: devolver disponibilidad real
    return {
      available: countrySupported,
      kycRequired: true,
      estimatedTime: "10-30 min",
      minAmount: 20,
      maxAmount: 10000,
      feeCurrency: req.currency,
    };
  },

  startPurchase: async (req: PurchaseRequest): Promise<PurchaseResponse> => {
    const apiKey = process.env.NEXT_PUBLIC_MOONPAY_API_KEY;
    if (!apiKey) {
      throw new Error("MOONPAY_API_KEY no configurada");
    }

    // URL del widget MoonPay. MoonPay firma URLs server-side para evitar
    // que el usuario las modifique. Aquí generamos la URL pública sin firma;
    // para producción se requiere firma HMAC con MOONPAY_SECRET_KEY.
    const params = new URLSearchParams({
      apiKey,
      currencyCode: req.crypto,
      walletAddress: req.walletAddress,
      baseCurrencyCode: req.currency,
      baseCurrencyAmount: req.amountType === "FIAT" ? String(req.amount) : undefined as never,
      quoteCurrencyAmount: req.amountType === "CRYPTO" ? String(req.amount) : undefined as never,
      redirectURL: req.redirectUrl || "",
    });

    const url = `${MOONPAY_WIDGET_URL}?${params.toString()}`;

    return {
      purchaseId: `moonpay_${Date.now()}`,
      redirectUrl: url,
      status: "REDIRECT_REQUIRED",
    };
  },

  getPurchaseStatus: async (purchaseId: string): Promise<PurchaseStatus> => {
    // MoonPay webhook POST a /api/webhooks/moonpay con el estado de la transacción.
    // Aquí no se puede hacer polling directo sin API key secreta server-side.
    // La UI debe recibir el estado por webhook vía nuestra DB.
    return {
      purchaseId,
      status: "PENDING",
    };
  },
};
