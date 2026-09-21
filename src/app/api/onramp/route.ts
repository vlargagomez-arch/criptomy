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
  // Si no existe adapter real, devolver status "no activo"
  const results = await Promise.all(
    onRampProviders.map(async (p) => {
      try {
        const adapter = await getOnRampAdapter(p.id);
        if (!adapter) {
          return {
            providerId: p.id,
            name: p.name,
            logo: p.logoUrl,
            isReal: p.isReal,
            isLive: p.isLive,
            available: false,
            reason: p.isLive ? "Adapter no implementado" : "Requiere API key",
            kycRequired: p.requiresKyc,
            countries: p.countries,
            documentationUrl: p.documentationUrl,
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

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { providerId, purchaseRequest } = body as {
    providerId: string;
    purchaseRequest: Parameters<OnRampProvider["startPurchase"]>[0];
  };

  if (!providerId) {
    return NextResponse.json({ error: "providerId requerido" }, { status: 400 });
  }

  try {
    const adapter = await getOnRampAdapter(providerId);
    if (!adapter) {
      return NextResponse.json({ error: `Provider ${providerId} no disponible` }, { status: 400 });
    }

    const result = await adapter.startPurchase(purchaseRequest);
    return NextResponse.json({ result });
  } catch (err) {
    console.error("[onramp/start]", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
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
  // Otros providers reales: importar dinámicamente cuando se implementen
  // if (providerId === "transak") { ... }
  // if (providerId === "ramp") { ... }
  return null;
}
