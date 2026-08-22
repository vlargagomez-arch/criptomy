import { NextRequest, NextResponse } from "next/server";
import { ethers, Contract, formatUnits, formatEther } from "ethers";

// GET /api/balance?address=0x...&chain=ETHEREUM
// GET /api/balance?address=0x...&chain=ETHEREUM&token=0x... (ERC20)
//
// Lee saldos reales on-chain desde el backend (sin CORS).

const RPCS: Record<string, string[]> = {
  ETHEREUM: [
    "https://eth.llamarpc.com",
    "https://rpc.ankr.com/eth",
    "https://ethereum.publicnode.com",
  ],
  BITCOIN: ["https://blockstream.info/api"],
  TRON: ["https://api.trongrid.io"],
  MONERO: ["https://xmr-node.cakewallet.com:18089"],
};

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address");
  const chain = (searchParams.get("chain") || "ETHEREUM").toUpperCase();
  const tokenAddress = searchParams.get("token"); // ERC20 opcional

  if (!address) {
    return NextResponse.json({ error: "address requerido" }, { status: 400 });
  }

  if (chain !== "ETHEREUM") {
    // Para BTC, TRX, XMR: en MVP solo devolvemos un placeholder
    return NextResponse.json({
      address,
      chain,
      balance: "0",
      symbol: chain === "BITCOIN" ? "BTC" : chain === "TRON" ? "TRX" : "XMR",
      note: "Lectura de saldo no implementada para esta chain en MVP. Use un explorador.",
    });
  }

  const rpcs = RPCS[chain] || RPCS.ETHEREUM;

  for (const rpc of rpcs) {
    try {
      const provider = new ethers.JsonRpcProvider(rpc, undefined, {
        staticNetwork: true,
      });

      if (tokenAddress) {
        const contract = new Contract(tokenAddress, ERC20_ABI, provider);
        const [balance, decimals, symbol] = await Promise.all([
          contract.balanceOf(address),
          contract.decimals(),
          contract.symbol(),
        ]);
        return NextResponse.json({
          address,
          chain,
          token: tokenAddress,
          balance: formatUnits(balance, decimals),
          decimals: Number(decimals),
          symbol,
          rpc: rpc.split("//")[1].split("/")[0],
        });
      } else {
        const balance = await provider.getBalance(address);
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
