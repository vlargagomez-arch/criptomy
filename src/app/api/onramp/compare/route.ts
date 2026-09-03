import { NextRequest, NextResponse } from "next/server";
import { PROVIDER_REGISTRY } from "@/lib/providers/registry";
import type { OnRampProvider, AvailabilityRequest } from "@/lib/providers/types";

// GET /api/onramp/compare?country=CO&crypto=USDT&network=POLYGON&amount=500&currency=COP
// Devuelve todos los providers on-ramp disponibles con su fee estimado
//
// POST /api/onramp/start
// Body: PurchaseRequest → inicia compra con el provider elegido

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const country = (searchParams.get("country") || "CO").toUpperCase();
  const crypto = (searchParams.get("crypto") || "USDT").toUpperCase();
  const network = (searchParams.get("network") || "POLYGON").toUpperCase();
  const amount = parseFloat(searchParams.get("amount") || "100");
  const currency = (searchParams.get("currency") || "COP").toUpperCase();

  const availabilityReq: AvailabilityRequest = {
    country,
    currency,
    crypto,
    network,
    amount,
  };

  const onRampProviders = PROVIDER_REGISTRY.filter(
    (p) => p.category === "ON_RAMP" && (p.countries.includes("ALL") || p.countries.includes(country))
  );

  // Para cada provider en catálogo, consultar su adapter si existe
  // Si no existe adapter real (no tenemos API key), devolver available: true
  // porque el usuario puede ir DIRECTO al sitio oficial del on-ramp.
  // La integración en nuestra app no existe, pero el proveedor sí es funcional
  // desde su sitio público.
  const results = await Promise.all(
    onRampProviders.map(async (p) => {
      try {
        const adapter = await getOnRampAdapter(p.id);
        if (!adapter) {
          // Sin adapter en nuestra app, pero el provider es real y su sitio público
          // está disponible. Devolvemos available: true con metadata del provider.
          return {
            providerId: p.id,
            name: p.name,
            logo: p.logoUrl,
            isReal: p.isReal,
            isLive: false, // false = no tenemos integración con API nuestra
            available: p.isReal, // true = el provider SÍ está disponible vía sitio público
            reason: p.isReal
              ? "Sin integración API en nuestra app. Te redirigimos al sitio oficial del on-ramp para completar la compra."
              : "MOCK provider",
            kycRequired: p.kycRequired,
            countries: p.countries,
            documentationUrl: p.documentationUrl,
            integrationType: "REDIRECT_DIRECT",
            estimatedTime: "10-30 min (sitio oficial)",
            minAmount: 20,
            maxAmount: 10000,
          };
        }

        const availability = await adapter.isAvailable(availabilityReq);
        return {
          providerId: p.id,
          name: p.name,
          logo: p.logoUrl,
          isReal: p.isReal,
          isLive: p.isLive,
          ...availability,
          kycRequired: p.requiresKyc || availability.kycRequired,
          countries: p.countries,
          documentationUrl: p.documentationUrl,
          integrationType: p.integrationType,
        };
      } catch (err) {
        return {
          providerId: p.id,
          name: p.name,
          logo: p.logoUrl,
          isReal: p.isReal,
          isLive: p.isLive,
          available: false,
          reason: `Error: ${(err as Error).message}`,
          kycRequired: p.requiresKyc,
          countries: p.countries,
        };
      }
    })
  );

  // Ordenar: primero los disponibles, luego por fee ascendente
  results.sort((a, b) => {
    if ((a.available ? 1 : 0) !== (b.available ? 1 : 0)) {
      return (a.available ? 1 : 0) > (b.available ? 1 : 0) ? -1 : 1;
    }
    return (a.fee || 0) - (b.fee || 0);
  });

  return NextResponse.json({
    request: availabilityReq,
    results,
  });
}

// Resolver adapter según providerId
async function getOnRampAdapter(providerId: string): Promise<OnRampProvider | null> {
  if (providerId.startsWith("mock")) {
    const { MockOnRampProvider } = await import("@/lib/providers/onramp/mock");
    return MockOnRampProvider;
  }
  if (providerId === "moonpay") {
    const { MoonpayOnRampProvider } = await import("@/lib/providers/onramp/moonpay");
    return MoonpayOnRampProvider;
  }
  return null;
}
