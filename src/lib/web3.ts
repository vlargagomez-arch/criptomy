"use client";

import { ethers, Contract, formatEther, formatUnits, BrowserProvider } from "ethers";
import { ESCROW_ABI } from "./blockchain/contracts";

// ============================================================
// Conexión con MetaMask (EIP-1193) y otros wallets EVM
// ============================================================

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, cb: (...args: unknown[]) => void) => void;
      removeListener: (event: string, cb: (...args: unknown[]) => void) => void;
      isMetaMask?: boolean;
      isCoinbaseWallet?: boolean;
    };
  }
}

export function hasWallet(): boolean {
  return typeof window !== "undefined" && !!window.ethereum;
}

export function getProvider(): BrowserProvider | null {
  if (!hasWallet()) return null;
  return new BrowserProvider(window.ethereum!);
}

// Conectar wallet y devolver address + chainId
// NO devolvemos signer (ethers.BrowserProvider.getSigner() puede crashear)
// En su lugar, usamos window.ethereum directamente
export async function connectWallet(): Promise<{
  address: string;
  chainId: number;
}> {
  if (!hasWallet()) {
    throw new Error(
      "No se detectó wallet. Instale MetaMask desde https://metamask.io"
    );
  }

  // 1) Pedir cuentas
  let accounts: string[];
  try {
    accounts = (await window.ethereum!.request({
      method: "eth_requestAccounts",
    })) as string[];
  } catch (e) {
    throw new Error("Wallet rechazó la conexión: " + (e as Error).message);
  }

  if (!accounts || accounts.length === 0) {
    throw new Error("No se autorizó el acceso a la wallet");
  }

  // 2) Obtener chainId (sin ethers, directo del provider)
  let chainId: number;
  try {
    const chainIdHex = (await window.ethereum!.request({
      method: "eth_chainId",
    })) as string;
    chainId = parseInt(chainIdHex, 16);
  } catch {
    chainId = 1; // default Ethereum
  }

  return {
    address: accounts[0],
    chainId,
  };
}

// Escuchar cambios de cuenta o red
export function onWalletChange(cb: (address: string | null, chainId: number | null) => void) {
  if (!hasWallet()) return () => {};
  const handleAccounts = (...args: unknown[]) => {
    const accounts = args[0] as string[];
    cb(accounts[0] || null, null);
  };
  const handleChain = (...args: unknown[]) => {
    const chainId = args[0] as string;
    cb(null, parseInt(chainId, 16));
  };
  window.ethereum!.on("accountsChanged", handleAccounts);
  window.ethereum!.on("chainChanged", handleChain);
  return () => {
    window.ethereum!.removeListener("accountsChanged", handleAccounts);
    window.ethereum!.removeListener("chainChanged", handleChain);
  };
}

// Cambiar de red en MetaMask
export async function switchNetwork(chainIdHex: string): Promise<void> {
  if (!hasWallet()) throw new Error("No hay wallet");
  await window.ethereum!.request({
    method: "wallet_switchEthereumChain",
    params: [{ chainId: chainIdHex }],
  });
}

// Añadir red si no existe
export async function addNetwork(networkParams: {
  chainId: string;
  chainName: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  rpcUrls: string[];
  blockExplorerUrls: string[];
}): Promise<void> {
  if (!hasWallet()) throw new Error("No hay wallet");
  await window.ethereum!.request({
    method: "wallet_addEthereumChain",
    params: [networkParams],
  });
}

// ============================================================
// Lectura de saldos on-chain reales
// ============================================================

export async function getNativeBalance(
  address: string,
  rpcUrl: string
): Promise<string> {
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const balance = await provider.getBalance(address);
  return formatEther(balance);
}

export async function getERC20Balance(
  tokenAddress: string,
  walletAddress: string,
  rpcUrl: string
): Promise<{ balance: string; decimals: number; symbol: string }> {
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const erc20Abi = [
    "function balanceOf(address) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
  ];
  const contract = new Contract(tokenAddress, erc20Abi, provider);
  const [balance, decimals, symbol] = await Promise.all([
    contract.balanceOf(walletAddress),
    contract.decimals(),
    contract.symbol(),
  ]);
  return {
    balance: formatUnits(balance, decimals),
    decimals: Number(decimals),
    symbol,
  };
}

// ============================================================
// Smart contract de escrow: helpers para interactuar
// ============================================================

export function getEscrowContract(
  escrowAddress: string,
  signer: ethers.JsonRpcSigner
): Contract {
  return new Contract(escrowAddress, ESCROW_ABI, signer);
}

// Crea un trade on-chain (llama a createTrade del smart contract)
export async function createTradeOnChain(params: {
  escrowAddress: string;
  signer: ethers.JsonRpcSigner;
  tradeId: string; // bytes32 hex
  buyer: string;
  arbitrator: string; // address(0) si no hay
  token: string; // address(0) si es ETH nativo
  amount: string; // en unidades enteras (ej: "0.5")
  decimals: number;
  paymentWindowSec: number;
  tradeHash: string; // bytes32 hex
}): Promise<string> {
  const contract = getEscrowContract(params.escrowAddress, params.signer);
  const amountWei = ethers.parseUnits(params.amount, params.decimals);
  const tx = await contract.createTrade(
    params.tradeId,
    params.buyer,
    params.arbitrator,
    params.token,
    amountWei,
    params.paymentWindowSec,
    params.tradeHash
  );
  await tx.wait();
  return tx.hash;
}

// Fondea el trade (llama a fundTrade con ETH o ERC20)
export async function fundTradeOnChain(params: {
  escrowAddress: string;
  signer: ethers.JsonRpcSigner;
  tradeId: string;
  token: string; // address(0) si es ETH
  amount: string;
  decimals: number;
}): Promise<string> {
  const contract = getEscrowContract(params.escrowAddress, params.signer);
  const amountWei = ethers.parseUnits(params.amount, params.decimals);

  if (params.token === ethers.ZeroAddress) {
    // ETH nativo: enviar value
    const tx = await contract.fundTrade(params.tradeId, { value: amountWei });
    await tx.wait();
    return tx.hash;
  } else {
    // ERC20: primero aprobar, luego fundear
    const erc20Abi = [
      "function approve(address spender, uint256 amount) returns (bool)",
    ];
    const tokenContract = new Contract(
      params.token,
      erc20Abi,
      params.signer
    );
    const approveTx = await tokenContract.approve(params.escrowAddress, amountWei);
    await approveTx.wait();
    const tx = await contract.fundTrade(params.tradeId);
    await tx.wait();
    return tx.hash;
  }
}

// Libera los fondos al comprador
export async function releaseToBuyerOnChain(params: {
  escrowAddress: string;
  signer: ethers.JsonRpcSigner;
  tradeId: string;
}): Promise<string> {
  const contract = getEscrowContract(params.escrowAddress, params.signer);
  const tx = await contract.releaseToBuyer(params.tradeId);
  await tx.wait();
  return tx.hash;
}

// Cancela el trade
export async function cancelTradeOnChain(params: {
  escrowAddress: string;
  signer: ethers.JsonRpcSigner;
  tradeId: string;
}): Promise<string> {
  const contract = getEscrowContract(params.escrowAddress, params.signer);
  const tx = await contract.cancel(params.tradeId);
  await tx.wait();
  return tx.hash;
}

// Abre disputa on-chain
export async function raiseDisputeOnChain(params: {
  escrowAddress: string;
  signer: ethers.JsonRpcSigner;
  tradeId: string;
}): Promise<string> {
  const contract = getEscrowContract(params.escrowAddress, params.signer);
  const tx = await contract.raiseDispute(params.tradeId);
  await tx.wait();
  return tx.hash;
}

// Resolver disputa (árbitro)
export async function resolveDisputeOnChain(params: {
  escrowAddress: string;
  signer: ethers.JsonRpcSigner;
  tradeId: string;
  winner: string;
  reason: string;
}): Promise<string> {
  const contract = getEscrowContract(params.escrowAddress, params.signer);
  const tx = await contract.resolveDispute(
    params.tradeId,
    params.winner,
    params.reason
  );
  await tx.wait();
  return tx.hash;
}

// Lee el estado on-chain del trade
export async function getTradeOnChain(params: {
  escrowAddress: string;
  rpcUrl: string;
  tradeId: string;
}): Promise<{
  seller: string;
  buyer: string;
  arbitrator: string;
  token: string;
  amount: string;
  status: number;
  fundedAt: number;
}> {
  const provider = new ethers.JsonRpcProvider(params.rpcUrl);
  const contract = new Contract(params.escrowAddress, ESCROW_ABI, provider);
  const trade = await contract.getTrade(params.tradeId);
  return {
    seller: trade.seller,
    buyer: trade.buyer,
    arbitrator: trade.arbitrator,
    token: trade.token,
    amount: trade.amount.toString(),
    status: Number(trade.status),
    fundedAt: Number(trade.fundedAt),
  };
}

// ============================================================
// Despliegue del contrato desde el frontend (con wallet del usuario)
// ============================================================

const ESCROW_DEPLOY_ABI = [
  "constructor(address _feeCollector)",
];

const ESCROW_BYTECODE =
  // Bytecode placeholder; en producción: compilar con hardhat y pegar acá.
  // El usuario debe compilar el .sol y obtener el bytecode real.
  "0x";

export async function deployEscrowContract(params: {
  signer: ethers.JsonRpcSigner;
  feeCollector: string;
}): Promise<{ address: string; txHash: string }> {
  if (!ESCROW_BYTECODE || ESCROW_BYTECODE === "0x") {
    throw new Error(
      "Bytecode no cargado. Compile el contrato con hardhat y pegue el bytecode en src/lib/web3.ts"
    );
  }
  const factory = new ethers.ContractFactory(
    ESCROW_DEPLOY_ABI,
    ESCROW_BYTECODE,
    params.signer
  );
  const contract = await factory.deploy(params.feeCollector);
  await contract.waitForDeployment();
  return {
    address: await contract.getAddress(),
    txHash: contract.deploymentTransaction()?.hash || "",
  };
}

// ============================================================
// Helpers de formato y conversión
// ============================================================

export function toBytes32(input: string): string {
  // Convierte string a bytes32 (hash si > 32 bytes)
  if (input.startsWith("0x") && input.length === 66) return input;
  return ethers.id(input);
}

export function shortAddr(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function hexChainId(chainId: number): string {
  return "0x" + chainId.toString(16);
}

// Chain IDs estándar
export const CHAIN_IDS = {
  ETHEREUM_MAINNET: 1,
  ETHEREUM_SEPOLIA: 11155111,
  TRON_MAINNET: 728126428,
  TRON_NILE: 2494104990,
};

export const NETWORK_PARAMS: Record<number, {
  chainId: string;
  chainName: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  rpcUrls: string[];
  blockExplorerUrls: string[];
}> = {
  [CHAIN_IDS.ETHEREUM_MAINNET]: {
    chainId: hexChainId(1),
    chainName: "Ethereum Mainnet",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://eth.llamarpc.com"],
    blockExplorerUrls: ["https://etherscan.io"],
  },
  [CHAIN_IDS.ETHEREUM_SEPOLIA]: {
    chainId: hexChainId(11155111),
    chainName: "Sepolia Testnet",
    nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://rpc.sepolia.org"],
    blockExplorerUrls: ["https://sepolia.etherscan.io"],
  },
};
