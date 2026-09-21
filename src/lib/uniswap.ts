"use client";

import { ethers } from "ethers";

// ============================================================
// Uniswap V3 — intercambio cripto-a-cripto automático
// ============================================================
// Permite a los usuarios intercambiar tokens ERC20 directamente
// a través de Uniswap V3 sin necesidad de encontrar contraparte.
// Útil para trades cripto-a-cripto (ej: ETH → USDT, WBTC → ETH).
//
// Docs: https://docs.uniswap.org/sdk/v3/guides/swaps/quoting
// Contratos en Ethereum mainnet:
// - Quoter V2: 0x61fFE014bA17989E743c5F6cB21bF9697530B21e
// - Router V1: 0xE592427A0AEce92De3Edee1F18E0157C05861564
// - Universal Router: 0x3fC91A3afd70395Cd496C647d5a6CC9D4B2B7FAD

const UNISWAP_V3_QUOTER = "0x61fFE014bA17989E743c5F6cB21bF9697530B21e";
const UNISWAP_V3_ROUTER = "0xE592427A0AEce92De3Edee1F18E0157C05861564";

const RPCS = [
  "https://ethereum.publicnode.com",
  "https://1rpc.io/eth",
  "https://cloudflare-eth.com",
];

const QUOTER_ABI = [
  // quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96))
  {
    inputs: [
      {
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "fee", type: "uint24" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
        name: "params",
        type: "tuple",
      },
    ],
    name: "quoteExactInputSingle",
    outputs: [
      { name: "amountOut", type: "uint256" },
      { name: "sqrtPriceX96After", type: "uint160" },
      { name: "initializedTicksCrossed", type: "int32[]" },
      { name: "gasEstimate", type: "uint256" },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
];

const ROUTER_ABI = [
  // exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96))
  {
    inputs: [
      {
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "recipient", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "amountOutMinimum", type: "uint256" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
        name: "params",
        type: "tuple",
      },
    ],
    name: "exactInputSingle",
    outputs: [{ name: "amountOut", type: "uint256" }],
    stateMutability: "payable",
    type: "function",
  },
];

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

// Tokens soportados (Ethereum mainnet)
export const SUPPORTED_SWAP_TOKENS = [
  { symbol: "ETH", address: "0x0000000000000000000000000000000000000000", decimals: 18, name: "Ether" },
  { symbol: "WETH", address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", decimals: 18, name: "Wrapped Ether" },
  { symbol: "USDT", address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6, name: "Tether USD" },
  { symbol: "USDC", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6, name: "USD Coin" },
  { symbol: "DAI", address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", decimals: 18, name: "Dai Stablecoin" },
  { symbol: "WBTC", address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", decimals: 8, name: "Wrapped BTC" },
  { symbol: "LINK", address: "0x514910771AF9Ca656af840dff83E8264EcF986CA", decimals: 18, name: "Chainlink" },
  { symbol: "UNI", address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", decimals: 18, name: "Uniswap" },
  { symbol: "MATIC", address: "0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0", decimals: 18, name: "Polygon" },
  { symbol: "SHIB", address: "0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE", decimals: 18, name: "Shiba Inu" },
] as const;

export interface SwapQuote {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  amountOutMin: string; // con slippage
  priceImpact: number; // %
  fee: number; // bps
  gasEstimate: string;
  route: string;
  minimumReceived: string;
}

// ============================================================
// Obtener quote de swap (sin ejecutar)
// ============================================================
// Llama al Quoter V2 de Uniswap para saber cuánto recibirás.
export async function getSwapQuote(params: {
  tokenIn: string; // address
  tokenOut: string; // address
  amountIn: string; // en unidades enteras (ej: "0.5")
  feeTier?: number; // default 3000 (0.3%)
}): Promise<SwapQuote | null> {
  const tokenInData = SUPPORTED_SWAP_TOKENS.find(
    (t) => t.address.toLowerCase() === params.tokenIn.toLowerCase()
  );
  const tokenOutData = SUPPORTED_SWAP_TOKENS.find(
    (t) => t.address.toLowerCase() === params.tokenOut.toLowerCase()
  );
  if (!tokenInData || !tokenOutData) return null;

  // Para MVP usamos la API REST de Uniswap (en lugar de llamar al Quoter on-chain)
  // que es más simple y no requiere ethers
  try {
    // Usar la API pública de Uniswap para quotes
    const url = new URL("https://api.uniswap.org/v1/quote");
    url.searchParams.set("tokenInAddress", params.tokenIn);
    url.searchParams.set("tokenInChainId", "1");
    url.searchParams.set("tokenOutAddress", params.tokenOut);
    url.searchParams.set("tokenOutChainId", "1");
    url.searchParams.set("amount", ethers.parseUnits(params.amountIn, tokenInData.decimals).toString());
    url.searchParams.set("type", "exactIn");

    const res = await fetch(url.toString(), {
      headers: {
        // La API pública requiere un origin header
        Origin: "https://app.uniswap.org",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      // Fallback: llamar al Quoter V2 directamente via RPC
      return await quoteViaRPC(params, tokenInData, tokenOutData);
    }

    const data = await res.json();
    const amountOutWei = data.quote || data.amountOut || "0";
    const amountOut = ethers.formatUnits(amountOutWei, tokenOutData.decimals);

    // Slippage 0.5%
    const amountOutNum = parseFloat(amountOut);
    const amountOutMin = amountOutNum * 0.995;

    return {
      tokenIn: tokenInData.symbol,
      tokenOut: tokenOutData.symbol,
      amountIn: params.amountIn,
      amountOut,
      amountOutMin: amountOutMin.toFixed(6),
      priceImpact: parseFloat(data.priceImpact || "0.1"),
      fee: params.feeTier || 3000,
      gasEstimate: data.gasUseEstimate || "180000",
      route: data.route || `${tokenInData.symbol} → ${tokenOutData.symbol}`,
      minimumReceived: `${amountOutMin.toFixed(6)} ${tokenOutData.symbol}`,
    };
  } catch (e) {
    console.error("[uniswap] quote error:", e);
    // Fallback: llamar al Quoter V2 directamente via RPC
    return await quoteViaRPC(params, tokenInData, tokenOutData);
  }
}

// Fallback: llamar al Quoter V2 on-chain
async function quoteViaRPC(
  params: { tokenIn: string; tokenOut: string; amountIn: string; feeTier?: number },
  tokenInData: (typeof SUPPORTED_SWAP_TOKENS)[number],
  tokenOutData: (typeof SUPPORTED_SWAP_TOKENS)[number]
): Promise<SwapQuote | null> {
  for (const rpc of RPCS) {
    try {
      const res = await fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_call",
          params: [
            {
              to: UNISWAP_V3_QUOTER,
              // Calldata: quoteExactInputSingle((tokenIn, tokenOut, amountIn, fee, sqrtPriceLimitX96))
              data: encodeQuoteCall(
                params.tokenIn,
                params.tokenOut,
                ethers.parseUnits(params.amountIn, tokenInData.decimals),
                params.feeTier || 3000
              ),
            },
            "latest",
          ],
        }),
        signal: AbortSignal.timeout(8000),
      });
      const json = await res.json();
      if (json.error || !json.result) continue;
      // Decodificar: amountOut es el primer uint256
      const amountOutWei = BigInt("0x" + json.result.slice(2, 66));
      const amountOut = ethers.formatUnits(amountOutWei, tokenOutData.decimals);
      const amountOutNum = parseFloat(amountOut);
      const amountOutMin = amountOutNum * 0.995;

      return {
        tokenIn: tokenInData.symbol,
        tokenOut: tokenOutData.symbol,
        amountIn: params.amountIn,
        amountOut,
        amountOutMin: amountOutMin.toFixed(6),
        priceImpact: 0.3, // estimado
        fee: params.feeTier || 3000,
        gasEstimate: "180000",
        route: `${tokenInData.symbol} → ${tokenOutData.symbol}`,
        minimumReceived: `${amountOutMin.toFixed(6)} ${tokenOutData.symbol}`,
      };
    } catch (e) {
      console.warn(`[uniswap] RPC ${rpc} failed:`, e);
      continue;
    }
  }
  return null;
}

// Codificar la llamada a quoteExactInputSingle
function encodeQuoteCall(
  tokenIn: string,
  tokenOut: string,
  amountIn: bigint,
  fee: number
): string {
  // Selector de quoteExactInputSingle((address,address,uint256,uint24,uint160))
  // keccak256("quoteExactInputSingle((address,address,uint256,uint24,uint160))").slice(0,4)
  const selector = "0xcdca1753";
  // Codificar struct como tuple
  const tokenInPadded = tokenIn.toLowerCase().replace("0x", "").padStart(64, "0");
  const tokenOutPadded = tokenOut.toLowerCase().replace("0x", "").padStart(64, "0");
  const amountInPadded = amountIn.toString(16).padStart(64, "0");
  const feePadded = fee.toString(16).padStart(64, "0");
  const sqrtPriceLimitPadded = "0".repeat(64); // 0 = sin límite
  return selector + tokenInPadded + tokenOutPadded + amountInPadded + feePadded + sqrtPriceLimitPadded;
}

// ============================================================
// Ejecutar swap on-chain (requiere firma de MetaMask)
// ============================================================
export async function executeSwap(params: {
  signer: ethers.JsonRpcSigner;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOutMin: string;
  feeTier?: number;
  recipient: string;
}): Promise<{ txHash: string; amountOut: string }> {
  const tokenInData = SUPPORTED_SWAP_TOKENS.find(
    (t) => t.address.toLowerCase() === params.tokenIn.toLowerCase()
  );
  const tokenOutData = SUPPORTED_SWAP_TOKENS.find(
    (t) => t.address.toLowerCase() === params.tokenOut.toLowerCase()
  );
  if (!tokenInData || !tokenOutData) throw new Error("Token no soportado");

  const router = new ethers.Contract(UNISWAP_V3_ROUTER, ROUTER_ABI, params.signer);
  const amountInWei = ethers.parseUnits(params.amountIn, tokenInData.decimals);
  const amountOutMinWei = ethers.parseUnits(params.amountOutMin, tokenOutData.decimals);

  // Si tokenIn es ETH nativo, enviar como msg.value
  const isNativeIn = params.tokenIn === "0x0000000000000000000000000000000000000000";
  const value = isNativeIn ? amountInWei : 0n;

  // Si tokenIn es ERC20, aprobar primero
  if (!isNativeIn) {
    const tokenContract = new ethers.Contract(params.tokenIn, ERC20_ABI, params.signer);
    const allowance = await tokenContract.allowance(params.recipient, UNISWAP_V3_ROUTER);
    if (allowance < amountInWei) {
      const approveTx = await tokenContract.approve(UNISWAP_V3_ROUTER, amountInWei);
      await approveTx.wait();
    }
  }

  // Ejecutar swap
  const tx = await router.exactInputSingle(
    {
      tokenIn: params.tokenIn,
      tokenOut: params.tokenOut,
      fee: params.feeTier || 3000,
      recipient: params.recipient,
      amountIn: amountInWei,
      amountOutMinimum: amountOutMinWei,
      sqrtPriceLimitX96: 0,
    },
    { value }
  );
  const receipt = await tx.wait();
  return {
    txHash: tx.hash,
    amountOut: params.amountOutMin, // simplificado
  };
}

// ============================================================
// Helpers
// ============================================================

export function getTokenBySymbol(symbol: string) {
  return SUPPORTED_SWAP_TOKENS.find((t) => t.symbol === symbol);
}

export function getUniswapURL(tokenIn: string, tokenOut: string): string {
  return `https://app.uniswap.org/#/swap?inputCurrency=${tokenIn}&outputCurrency=${tokenOut}`;
}

// Fee tiers disponibles en Uniswap V3
export const UNISWAP_FEE_TIERS = [
  { fee: 100, label: "0.01%", description: "Pools más estables (USDT/USDC)" },
  { fee: 500, label: "0.05%", description: "Stablecoin pairs" },
  { fee: 3000, label: "0.30%", description: "Default (ETH/USDC, etc.)" },
  { fee: 10000, label: "1.00%", description: "Pools exóticos" },
] as const;
