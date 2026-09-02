import { NextRequest, NextResponse } from "next/server";
import { PROVIDER_REGISTRY, getProvidersByCategory, getProvidersByCountry } from "@/lib/providers/registry";

// GET /api/providers?category=ON_RAMP&country=CO&live=true
// Devuelve el catálogo de providers (de PROVIDER_REGISTRY en código, no DB)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category") as ReturnType<typeof getProvidersByCategory> extends never ? never : string;
  const country = searchParams.get("country");
  const onlyLive = searchParams.get("live") === "true";

  let list = PROVIDER_REGISTRY;

  if (category) {
    list = list.filter((p) => p.category === category);
  }

  if (country) {
    const c = country.toUpperCase();
    list = list.filter((p) => p.countries.includes("ALL") || p.countries.includes(c));
  }

  if (onlyLive) {
    list = list.filter((p) => p.isLive && p.isReal);
  }

  return NextResponse.json({ providers: list, total: list.length });
}
