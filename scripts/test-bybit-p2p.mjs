// Test Bybit P2P form-urlencoded fetch
const url = "https://api2.bybit.com/fiat/otc/item/online/";
const body = "userId=&tokenId=USDT&currencyId=COP&side=1&size=20&page=1&amountType=&amount=&searchType=0&authFlag=false&isAdvanced=false&canTrade=false&userType=all";

fetch(url, {
  method: "POST",
  headers: {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
    "Origin": "https://www.bybit.com",
    "Referer": "https://www.bybit.com/",
  },
  body,
})
  .then(async (res) => {
    console.log("Status:", res.status);
    const text = await res.text();
    const data = JSON.parse(text);
    console.log("ret_code:", data.ret_code);
    console.log("ret_msg:", data.ret_msg);
    console.log("count:", data.result?.count);
    console.log("First item:", data.result?.items?.[0]
      ? {
          nickName: data.result.items[0].nickName,
          price: data.result.items[0].price,
          minAmount: data.result.items[0].minAmount,
          maxAmount: data.result.items[0].maxAmount,
          currencyId: data.result.items[0].currencyId,
          tokenId: data.result.items[0].tokenId,
        }
      : "no items"
    );
    console.log("Total items:", data.result?.items?.length || 0);
  })
  .catch((err) => console.error("Error:", err.message));
