// Direcciones de contratos desplegados y ABIs.
// En MVP: usar dirección de ejemplo en Sepolia.
// Para mainnet: desplegar con `smart-contracts/README.md`.

export const ESCROW_CONTRACT_ADDRESS_SEPOLIA =
  "0x0000000000000000000000000000000000000000"; // reemplazar tras despliegue

export const ESCROW_CONTRACT_ADDRESS_MAINNET =
  "0x0000000000000000000000000000000000000000"; // reemplazar tras despliegue

// ABI mínima del contrato P2PEscrow (solo los métodos que usamos desde el frontend)
export const ESCROW_ABI = [
  // createTrade(bytes32,address,address,address,uint256,uint256,bytes32)
  {
    inputs: [
      { name: "tradeId", type: "bytes32" },
      { name: "buyer", type: "address" },
      { name: "arbitrator", type: "address" },
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "paymentWindow", type: "uint256" },
      { name: "tradeHash", type: "bytes32" },
    ],
    name: "createTrade",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // fundTrade(bytes32)
  {
    inputs: [{ name: "tradeId", type: "bytes32" }],
    name: "fundTrade",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  // releaseToBuyer(bytes32)
  {
    inputs: [{ name: "tradeId", type: "bytes32" }],
    name: "releaseToBuyer",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // cancel(bytes32)
  {
    inputs: [{ name: "tradeId", type: "bytes32" }],
    name: "cancel",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // raiseDispute(bytes32)
  {
    inputs: [{ name: "tradeId", type: "bytes32" }],
    name: "raiseDispute",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // resolveDispute(bytes32,address,string)
  {
    inputs: [
      { name: "tradeId", type: "bytes32" },
      { name: "winner", type: "address" },
      { name: "reason", type: "string" },
    ],
    name: "resolveDispute",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // getTrade(bytes32) returns (Trade)
  {
    inputs: [{ name: "tradeId", type: "bytes32" }],
    name: "getTrade",
    outputs: [
      {
        components: [
          { name: "seller", type: "address" },
          { name: "buyer", type: "address" },
          { name: "arbitrator", type: "address" },
          { name: "token", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "createdAt", type: "uint256" },
          { name: "fundedAt", type: "uint256" },
          { name: "paymentWindow", type: "uint256" },
          { name: "status", type: "uint8" },
          { name: "tradeHash", type: "bytes32" },
        ],
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

// Genera un tradeId determinista a partir de los datos del trade
export function computeTradeId(
  seller: string,
  buyer: string,
  amount: string,
  nonce: string
): string {
  // En producción: usar keccak256(seller, buyer, amount, nonce)
  // Aquí usamos un hash simple para demo
  const data = `${seller}-${buyer}-${amount}-${nonce}`;
  let hash = 0n;
  for (let i = 0; i < data.length; i++) {
    const c = BigInt(data.charCodeAt(i));
    hash = ((hash << 5n) - hash) + c;
    hash = hash & 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffn;
  }
  return "0x" + hash.toString(16).padStart(64, "0");
}
