import { NextRequest, NextResponse } from "next/server";

// GET /api/price?pair=ETH/USD
// Lee precios en tiempo real desde contratos Chainlink usando fetch directo al RPC.
// Evita ethers.JsonRpcProvider que causa OOM por reintentos infinitos.

const RPCS = [
  "https://ethereum.publicnode.com",
  "https://1rpc.io/eth",
  "https://cloudflare-eth.com",
];

const CHAINLINK_FEEDS: Record<string, { address: string; decimals: number }> = {
  "ETH/USD": {
    address: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
    decimals: 8,
  },
  "BTC/USD": {
    address: "0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c",
    decimals: 8,
  },
  "USDT/USD": {
    address: "0x3E7d1eAB13ad0104d2750B8863b489D65364e32D",
    decimals: 8,
  },
  "USDC/USD": {
    address: "0x8fFfFfd4AfB6115b954BdFe269564D41C93557de",
    decimals: 8,
  },
  "LINK/USD": {
    address: "0x2c1d072e956AFFC0dd475A114C86C86C8B2C8456",
    decimals: 8,
  },
  "EUR/USD": {
    address: "0xb49f67794311103eA3a47C3025c0CC8b8B41256B",
    decimals: 8,
  },
};

// Selector de latestRoundData() = 0xfeaf968c
const LATEST_ROUND_SELECTOR = "0xfeaf968c";

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
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`RPC HTTP ${res.status}`);
  const json = (await res.json()) as RpcResult;
  if (json.error) throw new Error(json.error.message);
  if (!json.result) throw new Error("Sin resultado");
  return json.result;
}

function decodeBigInt(hex: string, offset: number): bigint {
  const cleanHex = hex.replace("0x", "");
  if (cleanHex.length === 0) return 0n;
  const slice = cleanHex.slice(offset * 64, (offset + 1) * 64);
  if (slice.length === 0) return 0n;
  return BigInt("0x" + slice);
}

async function fetchPrice(pair: string): Promise<{
  pair: string;
  price: number;
  updatedAt: number;
  source: string;
} | null> {
  const feed = CHAINLINK_FEEDS[pair];
  if (!feed) return null;

  for (const rpc of RPCS) {
    try {
      const resultHex = await rpcCall(rpc, feed.address, LATEST_ROUND_SELECTOR);
      // latestRoundData() returns 5 values: roundId, answer, startedAt, updatedAt, answeredInRound
      // Cada value ocupa 32 bytes (64 chars hex)
      const answer = decodeBigInt(resultHex, 1);
      const updatedAt = Number(decodeBigInt(resultHex, 3));
      const price = Number(answer) / 10 ** feed.decimals;
      return {
        pair,
        price,
        updatedAt,
        source: `Chainlink ${pair} (via ${rpc.split("//")[1].split("/")[0]})`,
      };
    } catch (e) {
      console.warn(`[price] RPC ${rpc} failed:`, (e as Error).message);
      continue;
    }
  }
  return null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const pair = searchParams.get("pair");
  const pairs = searchParams.get("pairs");

  try {
    if (pairs) {
      const pairList = pairs.split(",").map((p) => p.trim());
      const results = await Promise.all(
        pairList.map(async (p) => [p, await fetchPrice(p)] as const)
      );
      return NextResponse.json({
        prices: Object.fromEntries(results),
        timestamp: Date.now(),
      });
    }

    if (pair) {
      const price = await fetchPrice(pair);
      if (!price) {
        return NextResponse.json(
          { error: `No se pudo obtener precio para ${pair}` },
          { status: 404 }
        );
      }
      return NextResponse.json(price);
    }

    const allPairs = Object.keys(CHAINLINK_FEEDS);
    const results = await Promise.all(
      allPairs.map(async (p) => [p, await fetchPrice(p)] as const)
    );
    return NextResponse.json({
      prices: Object.fromEntries(results),
      timestamp: Date.now(),
    });
  } catch (err) {
    console.error("[price] error", err);
    return NextResponse.json(
      { error: "Error interno obteniendo precio" },
      { status: 500 }
    );
  }
}
