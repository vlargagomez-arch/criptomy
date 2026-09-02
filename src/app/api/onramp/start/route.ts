import { NextRequest, NextResponse } from "next/server";
import type { OnRampProvider } from "@/lib/providers/types";

// POST /api/onramp/start
// Body: { providerId, purchaseRequest }
// Inicia una compra con el provider elegido

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
