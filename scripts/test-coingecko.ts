(async () => {
  const url = "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,tether&vs_currencies=usd,cop,eur,mxn,ars,brl,pen,clp,ves";
  const r = await fetch(url);
  console.log("Status:", r.status);
  const text = await r.text();
  console.log("Body:", text.slice(0, 800));
})();
