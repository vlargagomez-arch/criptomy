const tests = [
  { asset: "BTC", currency: "USD" },
  { asset: "BTC", currency: "COP" },
  { asset: "BTC", currency: "EUR" },
  { asset: "BTC", currency: "MXN" },
  { asset: "ETH", currency: "COP" },
  { asset: "USDT", currency: "ARS" },
];

(async () => {
  for (const t of tests) {
    try {
      const r = await fetch(`http://localhost:3000/api/market-price?asset=${t.asset}&currency=${t.currency}`);
      const d = await r.json();
      console.log(`${t.asset}/${t.currency}: ${d.price?.toLocaleString()} (${d.source})${d.warning ? " ⚠️ " + d.warning : ""}`);
    } catch (e: any) {
      console.log(`${t.asset}/${t.currency}: FAIL - ${e.message}`);
    }
  }
})();
