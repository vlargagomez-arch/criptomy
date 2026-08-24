import { NextRequest, NextResponse } from "next/server";

// GET /api/balance?address=0x...&chain=ETHEREUM
// GET /api/balance?address=0x...&chain=ETHEREUM&token=0x... (ERC20)
//
// Lee saldos reales on-chain usando fetch directo al RPC JSON-RPC.
// Esto evita el problema de OOM del JsonRpcProvider de ethers que
// reintentaba infinitamente en background.

const RPCS: Record<string, string[]> = {
  ETHEREUM: [
    "https://ethereum.publicnode.com",
    "https://1rpc.io/eth",
    "https://cloudflare-eth.com",
  ],
};

// ABI mínimo en formato humano para eth_call
const BALANCE_OF_SELECTOR = "0x70a08231"; // balanceOf(address)
const DECIMALS_SELECTOR = "0x313ce567"; // decimals()
const SYMBOL_SELECTOR = "0x95d89b41"; // symbol()

interface RpcResult {
  result?: string;
  error?: { code: number; message: string };
}

async function rpcCall(rpc: string, method: string, params: unknown[]): Promise<string> {
  const res = await fetch(rpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params,
    }),
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`RPC HTTP ${res.status}`);
  const data = (await res.json()) as RpcResult;
  if (data.error) throw new Error(data.error.message);
  if (!data.result) throw new Error("Sin resultado");
  return data.result;
}

// Decodifica un string (símbolo ERC20) de hex
function decodeString(hex: string): string {
  // El resultado de symbol() es un string dinámico codificado en hex
  // Formato: 32 bytes offset + 32 bytes length + data padded
  const cleanHex = hex.replace("0x", "");
  if (cleanHex.length < 128) {
    // Puede ser string corto directamente en los primeros 32 bytes
    const bytes = Buffer.from(cleanHex, "hex");
    return bytes.toString("utf8").replace(/\0/g, "").trim();
  }
  const lengthHex = cleanHex.slice(64, 128);
  const length = parseInt(lengthHex, 16);
  const dataHex = cleanHex.slice(128, 128 + length * 2);
  return Buffer.from(dataHex, "hex").toString("utf8");
}

// Decodifica un uint256 de hex
function decodeUint(hex: string): bigint {
  const cleanHex = hex.replace("0x", "");
  if (cleanHex.length === 0) return 0n;
  return BigInt("0x" + cleanHex.slice(0, 64));
}

function formatUnits(value: bigint, decimals: number): string {
  const divisor = 10n ** BigInt(decimals);
  const integerPart = value / divisor;
  const fractionalPart = value % divisor;
  const fractionalStr = fractionalPart.toString().padStart(decimals, "0").slice(0, decimals);
  return `${integerPart.toString()}.${fractionalStr}`;
}

function formatEther(wei: bigint): string {
  return formatUnits(wei, 18);
}

function padAddress(addr: string): string {
  // Pads address to 32 bytes
  return "0x000000000000000000000000" + addr.replace("0x", "").toLowerCase();
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address");
  const chain = (searchParams.get("chain") || "ETHEREUM").toUpperCase();
  const tokenAddress = searchParams.get("token");

  if (!address) {
    return NextResponse.json({ error: "address requerido" }, { status: 400 });
  }

  if (chain !== "ETHEREUM") {
    return NextResponse.json({
      address,
      chain,
      balance: "0",
      symbol: chain === "BITCOIN" ? "BTC" : chain === "TRON" ? "TRX" : "XMR",
      note: "Lectura de saldo no implementada para esta chain. Use un explorador.",
    });
  }

  const rpcs = RPCS[chain] || RPCS.ETHEREUM;

  for (const rpc of rpcs) {
    try {
      if (tokenAddress) {
        // ERC20: balanceOf + decimals + symbol
        const data = padAddress(address);
        const [balanceHex, decimalsHex, symbolHex] = await Promise.all([
          rpcCall(rpc, "eth_call", [
            { to: tokenAddress, data: BALANCE_OF_SELECTOR + data.slice(2) },
            "latest",
          ]),
          rpcCall(rpc, "eth_call", [{ to: tokenAddress, data: DECIMALS_SELECTOR }, "latest"]),
          rpcCall(rpc, "eth_call", [{ to: tokenAddress, data: SYMBOL_SELECTOR }, "latest"]),
        ]);

        const balance = decodeUint(balanceHex);
        const decimals = Number(decodeUint(decimalsHex));
        const symbol = decodeString(symbolHex);

        return NextResponse.json({
          address,
          chain,
          token: tokenAddress,
          balance: formatUnits(balance, decimals),
          decimals,
          symbol,
          rpc: rpc.split("//")[1].split("/")[0],
        });
      } else {
        // ETH nativo: eth_getBalance
        const balanceHex = await rpcCall(rpc, "eth_getBalance", [address, "latest"]);
        const balance = BigInt(balanceHex);
        return NextResponse.json({
          address,
          chain,
          balance: formatEther(balance),
          symbol: "ETH",
          rpc: rpc.split("//")[1].split("/")[0],
        });
      }
    } catch (e) {
      console.warn(`[balance] RPC ${rpc} failed:`, (e as Error).message);
      continue;
    }
  }

  return NextResponse.json(
    { error: "No se pudo leer el saldo desde ningún RPC" },
    { status: 503 }
  );
}
