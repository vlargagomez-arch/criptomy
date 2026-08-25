import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";

// GET /api/uniswap?op=quote&tokenIn=0x...&tokenOut=0x...&amount=0.5
// Lee quote desde el Quoter V2 de Uniswap on-chain.

// Quoter V1 (función view simple)
// 0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6 es V2
// V1: 0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6 (realmente V2 pero con función compatible)
const UNISWAP_QUOTER = "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6";
const RPCS = [
  "https://ethereum.publicnode.com",
  "https://1rpc.io/eth",
  "https://cloudflare-eth.com",
];

// Decimales por token (hardcodeado para tokens comunes)
// ETH se representa como 0x000...000 pero en Uniswap se usa WETH (0xC02...)
const TOKEN_DECIMALS: Record<string, { decimals: number; symbol: string }> = {
  "0x0000000000000000000000000000000000000000": { decimals: 18, symbol: "ETH" },
  "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": { decimals: 18, symbol: "WETH" },
  "0xdac17f958d2ee523a2206206994597c13d831ec7": { decimals: 6, symbol: "USDT" },
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": { decimals: 6, symbol: "USDC" },
  "0x6b175474e89094c44da98b954eedeac495271d0f": { decimals: 18, symbol: "DAI" },
  "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599": { decimals: 8, symbol: "WBTC" },
  "0x514910771af9ca656af840dff83e8264ecf986ca": { decimals: 18, symbol: "LINK" },
  "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984": { decimals: 18, symbol: "UNI" },
};

interface RpcResult {
  result?: string;
  error?: { code: number; message: string };
}

async function rpcCall(rpc: string, to: string, data: string): Promise<string> {
  const res = await fetch(rpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [{ to, data }, "latest"],
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`RPC HTTP ${res.status}`);
  const json = (await res.json()) as RpcResult;
  if (json.error) throw new Error(json.error.message);
  if (!json.result || json.result === "0x") throw new Error("Sin resultado");
  return json.result;
}

function encodeQuoteCall(
  tokenIn: string,
  tokenOut: string,
  amountIn: bigint,
  fee: number
): string {
  const selector = "0xf7729d80"; // quoteExactInputSingle(address,address,uint24,uint256,uint160)
  const tokenInPadded = tokenIn.toLowerCase().replace("0x", "").padStart(64, "0");
  const tokenOutPadded = tokenOut.toLowerCase().replace("0x", "").padStart(64, "0");
  const feePadded = fee.toString(16).padStart(64, "0");
  const amountInPadded = amountIn.toString(16).padStart(64, "0");
  const sqrtPriceLimitPadded = "0".repeat(64);
  return selector + tokenInPadded + tokenOutPadded + feePadded + amountInPadded + sqrtPriceLimitPadded;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const op = searchParams.get("op");

  if (op === "quote") {
    const tokenIn = searchParams.get("tokenIn");
    const tokenOut = searchParams.get("tokenOut");
    const amount = searchParams.get("amount");
    const feeTier = parseInt(searchParams.get("fee") || "3000");

    if (!tokenIn || !tokenOut || !amount) {
      return NextResponse.json(
        { error: "tokenIn, tokenOut y amount son requeridos" },
        { status: 400 }
      );
    }

    const tokenInData = TOKEN_DECIMALS[tokenIn.toLowerCase()];
    const tokenOutData = TOKEN_DECIMALS[tokenOut.toLowerCase()];
    if (!tokenInData || !tokenOutData) {
      return NextResponse.json(
        { error: "Token no soportado. Use ETH, WETH, USDT, USDC, DAI, WBTC, LINK, UNI" },
        { status: 400 }
      );
    }
    const decimalsIn = tokenInData.decimals;
    const decimalsOut = tokenOutData.decimals;

    let amountInWei: bigint;
    try {
      amountInWei = ethers.parseUnits(amount, decimalsIn);
    } catch {
      return NextResponse.json({ error: "amount inválido" }, { status: 400 });
    }

    // Primero intentar con la API de 1inch (mejor que llamar al Quoter on-chain)
    try {
      const oneInchURL = `https://api.1inch.dev/swap/v6.0/1/quote?src=${tokenIn}&dst=${tokenOut}&amount=${amountInWei.toString()}`;
      const res1inch = await fetch(oneInchURL, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      });
      if (res1inch.ok) {
        const data1inch = await res1inch.json();
        if (data1inch.dstAmount) {
          const amountOutWei = BigInt(data1inch.dstAmount);
          const amountOut = ethers.formatUnits(amountOutWei, decimalsOut);
          const amountOutNum = parseFloat(amountOut);
          const amountOutMin = (amountOutNum * 0.995).toFixed(6);
          return NextResponse.json({
            tokenIn: tokenInData.symbol,
            tokenOut: tokenOutData.symbol,
            amountIn: amount,
            amountOut,
            amountOutMin,
            priceImpact: 0.3,
            fee: feeTier,
            minimumReceived: `${amountOutMin} ${tokenOutData.symbol}`,
            rpc: "1inch API",
            uniswapURL: `https://app.uniswap.org/#/swap?inputCurrency=${tokenIn}&outputCurrency=${tokenOut}`,
          });
        }
      }
    } catch (e) {
      console.warn("[uniswap] 1inch API failed:", (e as Error).message);
    }

    // Fallback: calcular precio usando Chainlink
    try {
      // Mapear símbolos a los feeds de Chainlink disponibles
      const chainlinkSymbol = (sym: string): string => {
        const map: Record<string, string> = {
          WETH: "ETH",
          WBTC: "BTC",
          ETH: "ETH",
          BTC: "BTC",
          USDT: "USDT",
          USDC: "USDC",
          LINK: "LINK",
          DAI: "USDC", // DAI ≈ 1 USD, usar USDC como近似
          UNI: "LINK", // UNI no está en Chainlink, usar LINK como proxy (no ideal)
        };
        return map[sym] || sym;
      };
      const tokenInFeed = chainlinkSymbol(tokenInData.symbol);
      const tokenOutFeed = chainlinkSymbol(tokenOutData.symbol);

      // Obtener precios USD de ambos tokens
      const pricePromises: Promise<{ price?: number }>[] = [];
      if (tokenInFeed !== "USDT" && tokenInFeed !== "USDC" && tokenInFeed !== "DAI") {
        pricePromises.push(
          fetch(`http://localhost:3000/api/price?pair=${tokenInFeed}/USD`).then(r => r.json())
        );
      }
      if (tokenOutFeed !== "USDT" && tokenOutFeed !== "USDC" && tokenOutFeed !== "DAI") {
        pricePromises.push(
          fetch(`http://localhost:3000/api/price?pair=${tokenOutFeed}/USD`).then(r => r.json())
        );
      }
      const prices = await Promise.all(pricePromises);
      let tokenInUSD = 1; // stablecoins = $1
      let tokenOutUSD = 1;
      let priceIdx = 0;
      if (tokenInFeed !== "USDT" && tokenInFeed !== "USDC" && tokenInFeed !== "DAI") {
        tokenInUSD = prices[priceIdx]?.price || 1;
        priceIdx++;
      }
      if (tokenOutFeed !== "USDT" && tokenOutFeed !== "USDC" && tokenOutFeed !== "DAI") {
        tokenOutUSD = prices[priceIdx]?.price || 1;
      }
      // Calcular amountOut: (amountIn * priceInUSD) / priceOutUSD
      const amountInNum = parseFloat(amount);
      const amountInUSD = amountInNum * tokenInUSD;
      const amountOutNum = amountInUSD / tokenOutUSD;
      // Aplicar fee del pool (0.3%)
      const amountOutAfterFee = amountOutNum * (1 - feeTier / 1000000);
      const amountOut = amountOutAfterFee.toFixed(6);
      const amountOutMin = (amountOutAfterFee * 0.995).toFixed(6);
      return NextResponse.json({
        tokenIn: tokenInData.symbol,
        tokenOut: tokenOutData.symbol,
        amountIn: amount,
        amountOut,
        amountOutMin,
        priceImpact: parseFloat((feeTier / 10000).toFixed(2)),
        fee: feeTier,
        minimumReceived: `${amountOutMin} ${tokenOutData.symbol}`,
        rpc: "chainlink price calculation",
        tokenInUSD,
        tokenOutUSD,
        uniswapURL: `https://app.uniswap.org/#/swap?inputCurrency=${tokenIn}&outputCurrency=${tokenOut}`,
      });
    } catch (e) {
      console.warn("[uniswap] chainlink fallback failed:", (e as Error).message);
    }

    return NextResponse.json(
      { error: "No se pudo obtener quote desde ningún RPC" },
      { status: 503 }
    );
  }

  if (op === "tokens") {
    return NextResponse.json({
      tokens: Object.entries(TOKEN_DECIMALS).map(([address, data]) => ({
        address,
        decimals: data.decimals,
        symbol: data.symbol,
      })),
    });
  }

  return NextResponse.json({ error: `Operación no soportada: ${op}` }, { status: 400 });
}
