import { getBinanceFunding } from "../src/lib/earn/providers/binance-funding";
import { getBybitFunding } from "../src/lib/earn/providers/bybit-funding";
import { getOKXFunding } from "../src/lib/earn/providers/okx-funding";
import { getGateFunding } from "../src/lib/earn/providers/gate-funding";
import { getBinanceBasis } from "../src/lib/earn/providers/binance-basis";
import { getBybitBasis } from "../src/lib/earn/providers/bybit-basis";
import { getDefiLlamaPools } from "../src/lib/earn/providers/defillama";

(async () => {
  console.log("=== FUNDING BTCUSDT ===");
  try { const r = await getBinanceFunding("BTCUSDT"); console.log("Binance:", r.fundingRate.toFixed(4), "%", "int", r.fundingIntervalHours, "h", "next", new Date(r.nextFundingTime).toISOString()); } catch(e:any){console.log("Binance FAIL:", e.message);}
  try { const r = await getBybitFunding("BTCUSDT"); console.log("Bybit:", r.fundingRate.toFixed(4), "%", "int", r.fundingIntervalHours, "h", "next", new Date(r.nextFundingTime).toISOString()); } catch(e:any){console.log("Bybit FAIL:", e.message);}
  try { const r = await getOKXFunding("BTCUSDT"); console.log("OKX:", r.fundingRate.toFixed(4), "%", "int", r.fundingIntervalHours, "h", "next", new Date(r.nextFundingTime).toISOString()); } catch(e:any){console.log("OKX FAIL:", e.message);}
  try { const r = await getGateFunding("BTCUSDT"); console.log("Gate:", r.fundingRate.toFixed(4), "%", "int", r.fundingIntervalHours, "h", "next", new Date(r.nextFundingTime).toISOString()); } catch(e:any){console.log("Gate FAIL:", e.message);}

  console.log("\n=== BASIS BTC ===");
  try { const r = await getBinanceBasis("BTCUSD"); console.log("Binance basis:", r.basis.toFixed(3), "% anual", r.annualizedBasisRate.toFixed(2), "%"); } catch(e:any){console.log("Binance basis FAIL:", e.message);}
  try { const r = await getBybitBasis("BTCUSDT"); console.log("Bybit basis:", r.basis.toFixed(3), "% anual", r.annualizedBasisRate.toFixed(2), "%"); } catch(e:any){console.log("Bybit basis FAIL:", e.message);}

  console.log("\n=== DeFiLlama ===");
  try { const r = await getDefiLlamaPools(); console.log(`Total pools: ${r.length}`); console.log("Top 5:"); r.slice(0,5).forEach(p => console.log(`  ${p.asset} @ ${p.project} (${p.chain}) APY ${p.apy.toFixed(2)}% TVL $${(p.tvlUsd/1e6).toFixed(1)}M type=${p.productType}`)); } catch(e:any){console.log("DeFiLlama FAIL:", e.message);}
})();
