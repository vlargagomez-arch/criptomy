import { NextRequest, NextResponse } from "next/server";

// GET /api/kleros?op=status&disputeID=123
// GET /api/kleros?op=cost
//
// Interactúa con Kleros Court en Ethereum mainnet usando fetch directo.
// Evita ethers.JsonRpcProvider que causa OOM por reintentos.

const KLEROS_ARBITRATOR = "0x988b3A538b618C4A4835C3eAA20D878C1Eb97B59";

const RPCS = [
  "https://ethereum.publicnode.com",
  "https://1rpc.io/eth",
  "https://cloudflare-eth.com",
];

// Selectores de funciones (keccak256 de la signature, primeros 4 bytes)
const DISPUTE_STATUS_SELECTOR = "0xe5d7b03c"; // disputeStatus(uint256)
const CURRENT_RULING_SELECTOR = "0xa2c8112f"; // currentRuling(uint256)
const ARBITRATION_COST_SELECTOR = "0x6d082aba"; // arbitrationCost(bytes)

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

function decodeUint(hex: string, offset = 0): bigint {
  const cleanHex = hex.replace("0x", "");
  if (cleanHex.length === 0) return 0n;
  const slice = cleanHex.slice(offset * 64, (offset + 1) * 64);
  if (slice.length === 0) return 0n;
  return BigInt("0x" + slice);
}

function padUint(value: string | bigint): string {
  const bigVal = typeof value === "string" ? BigInt(value) : value;
  return bigVal.toString(16).padStart(64, "0");
}

async function fetchArbitrationCost(): Promise<{
  costWei: bigint;
  rpc: string;
} | null> {
  // arbitrationCost(bytes) con extraData vacío (0x000...000 = 32 bytes)
  const data = ARBITRATION_COST_SELECTOR + "0".repeat(64);
  for (const rpc of RPCS) {
    try {
      const resultHex = await rpcCall(rpc, KLEROS_ARBITRATOR, data);
      const costWei = decodeUint(resultHex);
      return { costWei, rpc };
    } catch (e) {
      console.warn(`[kleros] RPC ${rpc} failed:`, (e as Error).message);
      continue;
    }
  }
  return null;
}

async function fetchDisputeStatus(disputeID: string): Promise<{
  status: number;
  ruling: number;
  rpc: string;
} | null> {
  const statusData = DISPUTE_STATUS_SELECTOR + padUint(disputeID);
  const rulingData = CURRENT_RULING_SELECTOR + padUint(disputeID);
  for (const rpc of RPCS) {
    try {
      const [statusHex, rulingHex] = await Promise.all([
        rpcCall(rpc, KLEROS_ARBITRATOR, statusData),
        rpcCall(rpc, KLEROS_ARBITRATOR, rulingData),
      ]);
      return {
        status: Number(decodeUint(statusHex)),
        ruling: Number(decodeUint(rulingHex)),
        rpc,
      };
    } catch (e) {
      console.warn(`[kleros] RPC ${rpc} failed:`, (e as Error).message);
      continue;
    }
  }
  return null;
}

function formatEther(wei: bigint): string {
  const divisor = 10n ** 18n;
  const integerPart = wei / divisor;
  const fractionalPart = wei % divisor;
  const fractionalStr = fractionalPart.toString().padStart(18, "0").slice(0, 18);
  return `${integerPart.toString()}.${fractionalStr}`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const op = searchParams.get("op") || "cost";

  try {
    if (op === "cost") {
      const result = await fetchArbitrationCost();
      if (result) {
        return NextResponse.json({
          costWei: result.costWei.toString(),
          costEth: formatEther(result.costWei),
          costUSD: null,
          rpc: result.rpc.split("//")[1].split("/")[0],
          note: "Costo de arbitraje en Kleros Court (subcourt General)",
        });
      }
      // Fallback
      return NextResponse.json({
        costWei: "25000000000000000",
        costEth: "0.025",
        costUSD: null,
        rpc: "fallback",
        note: "Costo aproximado (RPC no disponible). Valor real puede variar.",
      });
    }

    if (op === "status") {
      const disputeID = searchParams.get("disputeID");
      if (!disputeID) {
        return NextResponse.json(
          { error: "disputeID requerido para op=status" },
          { status: 400 }
        );
      }
      const result = await fetchDisputeStatus(disputeID);
      if (result) {
        const statusMap = ["Waitable", "Appealable", "Solved"] as const;
        const status = statusMap[result.status] || "Unknown";
        return NextResponse.json({
          disputeID,
          status,
          statusNum: result.status,
          currentRuling: result.ruling,
          rulingLabel:
            result.ruling === 0
              ? "Pendiente"
              : result.ruling === 1
              ? "Opción 1"
              : result.ruling === 2
              ? "Opción 2"
              : `Opción ${result.ruling}`,
          caseURL: `https://court.kleros.io/cases/${disputeID}`,
          rpc: result.rpc.split("//")[1].split("/")[0],
        });
      }
      return NextResponse.json(
        { error: "No se pudo conectar a ningún RPC" },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: `Operación no soportada: ${op}` },
      { status: 400 }
    );
  } catch (err) {
    console.error("[kleros API]", err);
    return NextResponse.json(
      { error: "Error interno: " + (err as Error).message },
      { status: 500 }
    );
  }
}
