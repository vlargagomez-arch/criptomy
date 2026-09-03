import { NextResponse } from "next/server";
import { scanProvidersHealth } from "@/lib/scanner/engine";

// GET /api/scanner/providers — status de todos los providers
export async function GET() {
  const health = await scanProvidersHealth();
  return NextResponse.json({
    providers: health,
    timestamp: Date.now(),
    total: health.length,
    online: health.filter((h) => h.status === "ONLINE").length,
  });
}
