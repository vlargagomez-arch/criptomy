async function binance(symbol: string) {
  try {
    const r = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
    if (!r.ok) return null;
    const d = await r.json();
    return parseFloat(d.price);
  } catch { return null; }
}
async function yadio(currency: string) {
  try {
    const r = await fetch(`https://api.yadio.io/rate/${currency}/USD`);
    if (!r.ok) return null;
    const d = await r.json();
    return d.rate;
  } catch { return null; }
}

(async () => {
  console.log("=== BINANCE FIAT DIRECT ===");
  const pairs = [
    { asset: "BTC", currency: "USD", sym: "BTCUSDT" },
    { asset: "BTC", currency: "EUR", sym: "BTCEUR" },
    { asset: "BTC", currency: "BRL", sym: "BTCBRL" },
    { asset: "BTC", currency: "ARS", sym: "BTCARS" },
    { asset: "BTC", currency: "MXN", sym: "BTCMXN" },
    { asset: "ETH", currency: "USD", sym: "ETHUSDT" },
  ];
  for (const p of pairs) {
    const price = await binance(p.sym);
    console.log(`  ${p.asset}/${p.currency}: ${price ? price.toLocaleString() : "FAIL"}`);
  }

  console.log("\n=== BINANCE + YADIO FX (COP, CLP, PEN, VES) ===");
  const btcUsdt = await binance("BTCUSDT");
  console.log(`  BTC/USDT: ${btcUsdt?.toLocaleString()}`);
  for (const cur of ["COP", "ARS", "VES", "CLP", "PEN"]) {
    const fx = await yadio(cur);
    if (fx && btcUsdt) {
      console.log(`  ${cur}/USD FX: ${fx.toLocaleString()} → BTC/${cur}: ${(btcUsdt * fx).toLocaleString()}`);
    }
  }
})();
