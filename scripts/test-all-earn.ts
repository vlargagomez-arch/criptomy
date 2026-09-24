import { getFundingMulti } from "../src/lib/earn/services/funding.service";
import { getBasisMulti } from "../src/lib/earn/services/basis.service";
import { getEarnOpportunities } from "../src/lib/earn/services/earn.service";

(async () => {
  console.log("=== FUNDING BTCUSDT (multi-exchange) ===");
  const f = await getFundingMulti("BTCUSDT");
  console.log("Primary:", f.primary?.exchange, "rate", f.primary?.fundingRate.toFixed(4), "% ann", f.primary?.annualizedFunding.toFixed(2), "%");
  console.log("Fallbacks:", f.fallbacks.map(x => `${x.exchange} ${x.fundingRate.toFixed(4)}%`).join(", "));
  console.log("Failed:", f.failed.length === 0 ? "(none)" : f.failed.map(x => `${x.exchange}: ${x.reason.slice(0, 40)}`).join(", "));

  console.log("\n=== FUNDING ETHUSDT (multi-exchange) ===");
  const f2 = await getFundingMulti("ETHUSDT");
  console.log("Primary:", f2.primary?.exchange, "rate", f2.primary?.fundingRate.toFixed(4), "%");
  console.log("Fallbacks:", f2.fallbacks.map(x => `${x.exchange} ${x.fundingRate.toFixed(4)}%`).join(", "));

  console.log("\n=== BASIS BTCUSDT (multi-exchange) ===");
  const b = await getBasisMulti("BTCUSDT");
  console.log("Primary:", b.primary?.exchange, "basis", b.primary?.basis.toFixed(3), "% ann", b.primary?.annualizedBasisRate.toFixed(2), "%");
  console.log("Fallbacks:", b.fallbacks.map(x => `${x.exchange} ${x.basis.toFixed(3)}%`).join(", "));

  console.log("\n=== EARN USDC ===");
  const e = await getEarnOpportunities({ asset: "USDC" });
  console.log(`Total: ${e.total} pools reales`);
  e.opportunities.slice(0, 3).forEach(p => console.log(`  ${p.asset} @ ${p.project} (${p.chain}) APY ${p.apy.toFixed(2)}% TVL $${(p.tvlUsd/1e6).toFixed(1)}M type=${p.productType}`));

  console.log("\n=== EARN BTC ===");
  const eb = await getEarnOpportunities({ asset: "BTC" });
  console.log(`Total: ${eb.total} pools reales`);
  eb.opportunities.slice(0, 3).forEach(p => console.log(`  ${p.asset} @ ${p.project} (${p.chain}) APY ${p.apy.toFixed(2)}% TVL $${(p.tvlUsd/1e6).toFixed(1)}M type=${p.productType}`));

  console.log("\n=== EARN ETH ===");
  const ee = await getEarnOpportunities({ asset: "ETH" });
  console.log(`Total: ${ee.total} pools reales`);
  ee.opportunities.slice(0, 3).forEach(p => console.log(`  ${p.asset} @ ${p.project} (${p.chain}) APY ${p.apy.toFixed(2)}% TVL $${(p.tvlUsd/1e6).toFixed(1)}M type=${p.productType}`));
})();
