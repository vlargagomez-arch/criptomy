"use client";

import { ethers, Contract } from "ethers";

// ============================================================
// ChallengeEscrow - helpers para interactuar con el smart contract
// ============================================================
// Contrato desplegable en Ethereum/Tron. Maneja el escrow de USDT
// para retos 1v1 de gaming.

// Dirección del contrato (se actualiza tras deploy)
export const CHALLENGE_ESCROW_ADDRESS =
  process.env.NEXT_PUBLIC_CHALLENGE_ESCROW_ADDRESS || "";

// ABI mínima
export const CHALLENGE_ESCROW_ABI = [
  // createChallenge(bytes32, address, address, uint256, uint8, bytes32)
  {
    inputs: [
      { name: "challengeId", type: "bytes32" },
      { name: "opponent", type: "address" },
      { name: "token", type: "address" },
      { name: "stakeAmount", type: "uint256" },
      { name: "game", type: "uint8" },
      { name: "gameChallengeId", type: "bytes32" },
    ],
    name: "createChallenge",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // joinChallenge(bytes32)
  {
    inputs: [{ name: "challengeId", type: "bytes32" }],
    name: "joinChallenge",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // startMatch(bytes32) - solo oracle
  {
    inputs: [{ name: "challengeId", type: "bytes32" }],
    name: "startMatch",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // resolveChallenge(bytes32, uint8) - solo oracle
  {
    inputs: [
      { name: "challengeId", type: "bytes32" },
      { name: "winner", type: "uint8" }, // 0=NONE, 1=CREATOR, 2=OPPONENT, 3=DRAW
    ],
    name: "resolveChallenge",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // cancel(bytes32)
  {
    inputs: [{ name: "challengeId", type: "bytes32" }],
    name: "cancel",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // getChallenge(bytes32) returns (tuple)
  {
    inputs: [{ name: "challengeId", type: "bytes32" }],
    name: "getChallenge",
    outputs: [
      {
        components: [
          { name: "creator", type: "address" },
          { name: "opponent", type: "address" },
          { name: "token", type: "address" },
          { name: "stakeAmount", type: "uint256" },
          { name: "createdAt", type: "uint256" },
          { name: "bothDepositedAt", type: "uint256" },
          { name: "status", type: "uint8" },
          { name: "gameChallengeId", type: "bytes32" },
          { name: "game", type: "uint8" },
        ],
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  // isFullyFunded(bytes32) returns (bool)
  {
    inputs: [{ name: "challengeId", type: "bytes32" }],
    name: "isFullyFunded",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// ERC20 ABI para approvals
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
];

// Mapeo GameType (debe coincidir con el contrato)
export const GAME_TYPE_ENUM: Record<string, number> = {
  LEAGUE_OF_LEGENDS: 0,
  VALORANT: 1,
  COUNTER_STRIKE_2: 2,
  DOTA2: 3,
  ROCKET_LEAGUE: 4,
};

// Addresses de USDT
export const USDT_ADDRESSES: Record<number, string> = {
  1: "0xdAC17F958D2ee523a2206206994597C13D831ec7", // Ethereum mainnet
  11155111: "0x7b77F953299e815a81319b4beFd3EA4896c5F6dC", // Sepolia (test USDT)
  137: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", // Polygon
};

// ============================================================
// Helpers
// ============================================================

export function getEscrowContract(signer: ethers.JsonRpcSigner): Contract {
  if (!CHALLENGE_ESCROW_ADDRESS) {
    throw new Error(
      "ChallengeEscrow no desplegado. Configure NEXT_PUBLIC_CHALLENGE_ESCROW_ADDRESS"
    );
  }
  return new Contract(
    CHALLENGE_ESCROW_ADDRESS,
    CHALLENGE_ESCROW_ABI,
    signer
  );
}

// Convertir string ID a bytes32
export function toBytes32(input: string): string {
  if (input.startsWith("0x") && input.length === 66) return input;
  return ethers.id(input);
}

// ============================================================
// Crear reto on-chain + depositar stake del creator
// ============================================================
export async function createChallengeOnChain(params: {
  signer: ethers.JsonRpcSigner;
  challengeId: string; // ID del reto en el backend
  opponentAddress: string; // address(0) si abierto
  tokenAddress: string; // USDT
  stakeAmount: string; // en unidades enteras (ej: "10")
  tokenDecimals: number;
  gameType: string; // "LEAGUE_OF_LEGENDS", etc.
}): Promise<{ txHash: string }> {
  const contract = getEscrowContract(params.signer);
  const challengeIdBytes = toBytes32(params.challengeId);
  const gameChallengeIdBytes = toBytes32(`${params.challengeId}-game`);
  const stakeWei = ethers.parseUnits(params.stakeAmount, params.tokenDecimals);
  const gameEnum = GAME_TYPE_ENUM[params.gameType] ?? 0;

  // 1. Aprobar USDT para el contrato de escrow
  const token = new Contract(params.tokenAddress, ERC20_ABI, params.signer);
  const allowance = await token.allowance(
    await params.signer.getAddress(),
    CHALLENGE_ESCROW_ADDRESS
  );
  if (allowance < stakeWei) {
    const approveTx = await token.approve(CHALLENGE_ESCROW_ADDRESS, stakeWei);
    await approveTx.wait();
  }

  // 2. Crear challenge (esto transfiere el stake del creator)
  const tx = await contract.createChallenge(
    challengeIdBytes,
    params.opponentAddress || ethers.ZeroAddress,
    params.tokenAddress,
    stakeWei,
    gameEnum,
    gameChallengeIdBytes
  );
  await tx.wait();
  return { txHash: tx.hash };
}

// ============================================================
// Opponent se une y deposita
// ============================================================
export async function joinChallengeOnChain(params: {
  signer: ethers.JsonRpcSigner;
  challengeId: string;
  tokenAddress: string;
  stakeAmount: string;
  tokenDecimals: number;
}): Promise<{ txHash: string }> {
  const contract = getEscrowContract(params.signer);
  const challengeIdBytes = toBytes32(params.challengeId);
  const stakeWei = ethers.parseUnits(params.stakeAmount, params.tokenDecimals);

  // Aprobar USDT
  const token = new Contract(params.tokenAddress, ERC20_ABI, params.signer);
  const allowance = await token.allowance(
    await params.signer.getAddress(),
    CHALLENGE_ESCROW_ADDRESS
  );
  if (allowance < stakeWei) {
    const approveTx = await token.approve(CHALLENGE_ESCROW_ADDRESS, stakeWei);
    await approveTx.wait();
  }

  const tx = await contract.joinChallenge(challengeIdBytes);
  await tx.wait();
  return { txHash: tx.hash };
}

// ============================================================
// Cancelar reto (reembolso)
// ============================================================
export async function cancelChallengeOnChain(params: {
  signer: ethers.JsonRpcSigner;
  challengeId: string;
}): Promise<{ txHash: string }> {
  const contract = getEscrowContract(params.signer);
  const challengeIdBytes = toBytes32(params.challengeId);
  const tx = await contract.cancel(challengeIdBytes);
  await tx.wait();
  return { txHash: tx.hash };
}

// ============================================================
// Leer estado on-chain del reto
// ============================================================
export async function getChallengeOnChain(params: {
  rpcUrl: string;
  challengeId: string;
}): Promise<{
  creator: string;
  opponent: string;
  token: string;
  stakeAmount: bigint;
  status: number;
  exists: boolean;
}> {
  if (!CHALLENGE_ESCROW_ADDRESS) {
    return {
      creator: "",
      opponent: "",
      token: "",
      stakeAmount: 0n,
      status: 0,
      exists: false,
    };
  }
  const provider = new ethers.JsonRpcProvider(params.rpcUrl, undefined, {
    staticNetwork: true,
  });
  const contract = new Contract(
    CHALLENGE_ESCROW_ADDRESS,
    CHALLENGE_ESCROW_ABI,
    provider
  );
  try {
    const challengeIdBytes = toBytes32(params.challengeId);
    const result = await contract.getChallenge(challengeIdBytes);
    return {
      creator: result.creator,
      opponent: result.opponent,
      token: result.token,
      stakeAmount: result.stakeAmount,
      status: Number(result.status),
      exists: result.creator !== ethers.ZeroAddress,
    };
  } catch {
    return {
      creator: "",
      opponent: "",
      token: "",
      stakeAmount: 0n,
      status: 0,
      exists: false,
    };
  }
}

// ============================================================
// Verificar si el contrato está configurado
// ============================================================
export function isEscrowConfigured(): boolean {
  return CHALLENGE_ESCROW_ADDRESS.length > 10;
}

// ============================================================
// Obtener USDT address para la chain actual
// ============================================================
export function getUSDTAddress(chainId: number): string {
  return USDT_ADDRESSES[chainId] || USDT_ADDRESSES[1];
}
