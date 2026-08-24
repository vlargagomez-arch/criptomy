"use client";

import { ethers, Contract } from "ethers";

// ============================================================
// Kleros — Arbitraje descentralizado on-chain
// ============================================================
// Kleros es una DAO de arbitraje. En lugar de confiar en un árbitro
// centralizado, cualquier disputa se sube a Kleros Court donde jurados
// aleatorios (seleccionados por token PNK) votan la resolución.
//
// Docs: https://docs.kleros.io
// Contratos: https://github.com/kleros/kleros-v2
//
// En MVP usamos Kleros Court en Ethereum mainnet (no testnet por ahora).
// Para usar Kleros en Sepolia: cambiar las direcciones a las de testnet.

// Direcciones de contratos Kleros v2 en Ethereum mainnet
// https://docs.kleros.io/developer/contract-addresses
export const KLEROS_ADDRESSES = {
  // Arbitrator: KlerosLiquid (Kleros v1, más probado en producción)
  ARBITRATOR: "0x988b3A538b618C4A4835C3eAA20D878C1Eb97B59",
  // ArbitrableProxy: contrato que crea disputas genéricas
  ARBITRABLE_PROXY: "0x9b2758bDC8c7Fa128bBA1A4D5fE0eC0c5Bcd09CD",
  // PNK token (Pinakion) - necesario para ser jurado
  PNK: "0x93ED3FBe2120772b95b7A5B6c0FBf4C67D75f0A2",
} as const;

// ABI mínimo del ArbitrableProxy (crear disputa)
const ARBITRABLE_PROXY_ABI = [
  // createDispute(uint256 _numberOfChoices, bytes _extraData, uint256 _numberOfRounds, uint256 _arbitrationFee)
  {
    inputs: [
      { name: "_numberOfChoices", type: "uint256" },
      { name: "_extraData", type: "bytes" },
      { name: "_numberOfRounds", type: "uint256" },
      { name: "_arbitrationFee", type: "uint256" },
    ],
    name: "createDispute",
    outputs: [{ name: "disputeID", type: "uint256" }],
    stateMutability: "payable",
    type: "function",
  },
  // getDispute(uint256) returns (Dispute)
  {
    inputs: [{ name: "_disputeID", type: "uint256" }],
    name: "getDispute",
    outputs: [
      {
        components: [
          { name: "arbitrator", type: "address" },
          { name: " arbitrable", type: "address" },
          { name: "disputeID", type: "uint256" },
          { name: "numberOfChoices", type: "uint256" },
          { name: "extraData", type: "bytes" },
          { name: "numberOfRounds", type: "uint256" },
          { name: "ruled", type: "bool" },
        ],
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
];

// ABI del Arbitrator (KlerosLiquid) para leer estado de disputas
const ARBITRATOR_ABI = [
  // disputeStatus(uint256) returns (uint8)
  {
    inputs: [{ name: "_disputeID", type: "uint256" }],
    name: "disputeStatus",
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  // currentRuling(uint256) returns (uint256)
  {
    inputs: [{ name: "_disputeID", type: "uint256" }],
    name: "currentRuling",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  // arbitrationCost(bytes) returns (uint256)
  {
    inputs: [{ name: "_extraData", type: "bytes" }],
    name: "arbitrationCost",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
];

export interface KlerosDisputeResult {
  disputeID: string;
  txHash: string;
  arbitrationCost: string; // en ETH
  status: "Waitable" | "Appealable" | "Solved";
  choices: number;
  ruling: number | null;
  instructions: string;
}

// ============================================================
// Crear disputa en Kleros Court
// ============================================================
// Pasos:
// 1. Calcular arbitrationCost (fee que pagan las partes)
// 2. Llamar createDispute en ArbitrableProxy con el costo como msg.value
// 3. Subir evidencia a IPFS (ver lib/ipfs.ts)
// 4. Esperar a que los jurados voten (24-72h típico)
// 5. Si alguna parte apela, hay más rondas (con costo mayor)

export async function createKlerosDispute(params: {
  signer: ethers.JsonRpcSigner;
  numberOfChoices: number; // 2 = binario (comprador gana / vendedor gana)
  evidenceCID: string; // IPFS CID con evidencia
  metaEvidenceCID: string; // IPFS CID con metadata del contrato
}): Promise<KlerosDisputeResult> {
  const proxy = new Contract(
    KLEROS_ADDRESSES.ARBITRABLE_PROXY,
    ARBITRABLE_PROXY_ABI,
    params.signer
  );
  const arbitrator = new Contract(
    KLEROS_ADDRESSES.ARBITRATOR,
    ARBITRATOR_ABI,
    params.signer
  );

  // 1. Calcular costo de arbitraje
  const extraData = "0x"; // sin subcourt específico (default)
  const cost = await arbitrator.arbitrationCost(extraData);
  const costEth = ethers.formatEther(cost);

  // 2. Crear disputa
  // numberOfRounds = 1 (sin apelación inicial)
  const tx = await proxy.createDispute(
    params.numberOfChoices,
    extraData,
    1, // 1 ronda inicial
    cost,
    { value: cost }
  );
  const receipt = await tx.wait();

  // Buscar el evento DisputeCreation para obtener el disputeID
  // Evento: DisputeCreation(uint256 indexed _disputeID, address indexed _arbitrable, uint256 _numberOfChoices)
  const event = receipt.logs.find((log) => {
    try {
      const parsed = proxy.interface.parseLog({
        topics: log.topics as string[],
        data: log.data,
      });
      return parsed?.name === "DisputeCreation";
    } catch {
      return false;
    }
  });

  let disputeID = "0";
  if (event) {
    const parsed = proxy.interface.parseLog({
      topics: event.topics as string[],
      data: event.data,
    });
    disputeID = parsed?.args?.[0]?.toString() || "0";
  }

  return {
    disputeID,
    txHash: tx.hash,
    arbitrationCost: costEth,
    status: "Waitable",
    choices: params.numberOfChoices,
    ruling: null,
    instructions: `Disputa #${disputeID} creada en Kleros Court.
Costo de arbitraje: ${costEth} ETH (pagado por las partes).
Próximos pasos:
1. Subir evidencia detallada a IPFS (CID: ${params.evidenceCID})
2. Esperar 24-72h a que los jurados voten
3. Ver estado en: https://court.kleros.io/cases/${disputeID}
4. Si no está de acuerdo con el veredicto, puede apelar (costo mayor)`,
  };
}

// ============================================================
// Leer estado de una disputa existente
// ============================================================

export async function getKlerosDisputeStatus(
  disputeID: string,
  rpcUrl = "https://ethereum.publicnode.com"
): Promise<{
  status: "Waitable" | "Appealable" | "Solved";
  currentRuling: number | null;
  rulingLabel: string | null;
}> {
  const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, {
    staticNetwork: true,
  });
  const arbitrator = new Contract(
    KLEROS_ADDRESSES.ARBITRATOR,
    ARBITRATOR_ABI,
    provider
  );

  const [statusNum, rulingNum] = await Promise.all([
    arbitrator.disputeStatus(disputeID),
    arbitrator.currentRuling(disputeID),
  ]);

  const statusMap = ["Waitable", "Appealable", "Solved"] as const;
  const status = statusMap[Number(statusNum)] || "Waitable";
  const currentRuling = Number(rulingNum);

  return {
    status,
    currentRuling: currentRuling === 0 ? null : currentRuling,
    rulingLabel: currentRuling === 1 ? "Comprador gana" : currentRuling === 2 ? "Vendedor gana" : null,
  };
}

// ============================================================
// Helpers
// ============================================================

export function klerosCaseURL(disputeID: string): string {
  return `https://court.kleros.io/cases/${disputeID}`;
}

export function estimateArbitrationCost(): string {
  // Costo típico de Kleros Court para disputas simples
  // ~0.025 ETH en mainnet (puede variar según subcourt)
  return "~0.025 ETH";
}

// Lista de subcourts (categorías) disponibles en Kleros
export const KLEROS_SUBCOURTS = [
  { id: 0, name: "General", fee: "~0.025 ETH", votes: 3 },
  { id: 1, name: "Blockchain", fee: "~0.05 ETH", votes: 5 },
  { id: 2, name: "Token Listing", fee: "~0.1 ETH", votes: 5 },
  { id: 3, name: "Tech", fee: "~0.05 ETH", votes: 5 },
  { id: 4, name: "Marketing", fee: "~0.05 ETH", votes: 5 },
  { id: 5, name: "Translation", fee: "~0.025 ETH", votes: 3 },
  { id: 6, name: "Curation", fee: "~0.025 ETH", votes: 3 },
  { id: 7, name: "Insurance", fee: "~0.1 ETH", votes: 5 },
  { id: 8, name: "Escrow", fee: "~0.05 ETH", votes: 5 }, // relevante para P2P
] as const;
