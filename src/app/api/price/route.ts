import { NextRequest, NextResponse } from "next/server";
import { ethers, Contract, formatUnits } from "ethers";

// GET /api/price?pair=ETH/USD
// Lee precios en tiempo real desde contratos Chainlink en Ethereum mainnet.
// Se hace desde el backend para evitar problemas de CORS en el navegador.

const RPC_ETH_MAINNET = "https://eth.llamarpc.com";
const FALLBACK_RPCS = [
  "https://rpc.ankr.com/eth",
  "https://ethereum.publicnode.com",
  "https://1rpc.io/eth",
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

const AGGREGATOR_V3_ABI = [
  "function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
  "function decimals() external view returns (uint8)",
];

async function fetchPrice(pair: string): Promise<{
  pair: string;
  price: number;
  updatedAt: number;
  source: string;
} | null> {
  const feed = CHAINLINK_FEEDS[pair];
  if (!feed) return null;

  const allRpcs = [RPC_ETH_MAINNET, ...FALLBACK_RPCS];

  for (const rpc of allRpcs) {
    try {
      const provider = new ethers.JsonRpcProvider(rpc, undefined, {
        staticNetwork: true,
      });
      const contract = new Contract(
        feed.address,
        AGGREGATOR_V3_ABI,
        provider
      );
      const roundData = await contract.latestRoundData();
      const answer = roundData[1];
      const updatedAt = Number(roundData[3]);
      const price = Number(formatUnits(answer, feed.decimals));
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
  const pairs = searchParams.get("pairs"); // comma-separated

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

    // Sin parámetros: devolver todos los precios
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
