import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notifyDipAlert } from "@/lib/notify";

// Cron job que se ejecuta cada 5 min (configurado en vercel.json)
// Verifica alertas activas comparando el precio actual de Chainlink.

// Security: requiere CRON_SECRET en header Authorization para evitar llamadas externas
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }

  try {
    // Verificar que la DB esté disponible antes de hacer queries
    let percentAlerts: Awaited<ReturnType<typeof db.priceAlert.findMany>> = [];
    let thresholdAlerts: Awaited<ReturnType<typeof db.priceAlert.findMany>> = [];

    try {
      [percentAlerts, thresholdAlerts] = await Promise.all([
        db.priceAlert.findMany({ where: { triggered: false, alertType: "PERCENT_DROP" } }),
        db.priceAlert.findMany({ where: { triggered: false, alertType: { in: ["DIP_BELOW", "TARGET_PRICE"] } } }),
      ]);
    } catch (dbErr) {
      console.warn("[cron:price-alerts] DB no disponible, skip:", (dbErr as Error).message);
      return NextResponse.json({
        checked: 0,
        triggered: 0,
        skipped: true,
        reason: "DB no disponible. Verifica DATABASE_URL y que las tablas estén migradas (scripts/migrate-supabase.sql)",
      });
    }

    if (percentAlerts.length === 0 && thresholdAlerts.length === 0) {
      return NextResponse.json({ checked: 0, triggered: 0 });
    }

    // Agrupar por asset
    const allAlerts = [...percentAlerts, ...thresholdAlerts];
    const assets = [...new Set(allAlerts.map((a) => a.asset))];
    const prices: Record<string, number | null> = {};
    for (const asset of assets) {
      prices[asset] = await fetchChainlinkPriceFor(asset);
    }

    let triggered = 0;
    let checked = 0;

    // Procesar PERCENT_DROP
    for (const alert of percentAlerts) {
      checked++;
      const currentPrice = prices[alert.asset];
      if (currentPrice === null) continue;

      const baseline = alert.triggeredPrice; // usado como baseline
      if (!baseline) {
        // Primer check: guardar baseline
        await db.priceAlert.update({
          where: { id: alert.id },
          data: { triggeredPrice: currentPrice },
        });
        continue;
      }

      const dropPct = ((baseline - currentPrice) / baseline) * 100;
      if (dropPct >= (alert.thresholdPercent || 0)) {
        await notifyDipAlert({
          userId: alert.userId,
          alertId: alert.id,
          asset: alert.asset,
          dropPercent: dropPct,
          currentPrice,
          timeframeHours: alert.timeframeHours,
        });
        await db.priceAlert.update({
          where: { id: alert.id },
          data: { triggered: true, triggeredAt: new Date() },
        });
        triggered++;
      }
    }

    // Procesar DIP_BELOW y TARGET_PRICE
    for (const alert of thresholdAlerts) {
      checked++;
      const currentPrice = prices[alert.asset];
      if (currentPrice === null || !alert.thresholdPrice) continue;

      const fired =
        (alert.alertType === "DIP_BELOW" && currentPrice <= alert.thresholdPrice) ||
        (alert.alertType === "TARGET_PRICE" && currentPrice >= alert.thresholdPrice);

      if (fired) {
        await notifyDipAlert({
          userId: alert.userId,
          alertId: alert.id,
          asset: alert.asset,
          dropPercent: 0,
          currentPrice,
          timeframeHours: 0,
        });
        await db.priceAlert.update({
          where: { id: alert.id },
          data: { triggered: true, triggeredAt: new Date(), triggeredPrice: currentPrice },
        });
        triggered++;
      }
    }

    return NextResponse.json({ checked, triggered });
  } catch (err) {
    console.error("[/api/cron/price-alerts-check]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// ============================================================
// Fetch precio Chainlink directo (sin HTTP, sin ethers)
// ============================================================

const RPCS = [
  "https://ethereum.publicnode.com",
  "https://1rpc.io/eth",
  "https://cloudflare-eth.com",
];

const CHAINLINK_FEEDS: Record<string, { address: string; decimals: number }> = {
  BTC: { address: "0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c", decimals: 8 },
  ETH: { address: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419", decimals: 8 },
  USDT: { address: "0x3E7d1eAB13ad0104d2750B8863b489D65364e32D", decimals: 8 },
  USDC: { address: "0x8fFfFfd4AfB6115b954BdFe269564D41C93557de", decimals: 8 },
  LINK: { address: "0x2c1d072e956AFFC0dd475A114C86C86C8B2C8456", decimals: 8 },
};

const LATEST_ROUND_SELECTOR = "0xfeaf968c";

async function fetchChainlinkPriceFor(asset: string): Promise<number | null> {
  const feed = CHAINLINK_FEEDS[asset.toUpperCase()];
  if (!feed) return null;

  for (const rpc of RPCS) {
    try {
      const res = await fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_call",
          params: [{ to: feed.address, data: LATEST_ROUND_SELECTOR }, "latest"],
        }),
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) continue;
      const json = (await res.json()) as { result?: string; error?: unknown };
      if (json.error || !json.result) continue;
      const hex = json.result.replace("0x", "");
      if (hex.length < 128) continue;
      // answer está en offset 1 (32 bytes cada slot)
      const answerHex = hex.slice(64, 128);
      const answer = BigInt("0x" + answerHex);
      return Number(answer) / 10 ** feed.decimals;
    } catch (err) {
      console.warn(`[price-alerts-check] RPC ${rpc} failed:`, (err as Error).message);
      continue;
    }
  }
  return null;
}
