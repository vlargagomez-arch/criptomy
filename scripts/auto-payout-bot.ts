// ============================================================
// Bot de Pago Automático — NoKYCSwap Retos P2P
// ============================================================
// Este bot corre en background y procesa retos completados:
//   1. Busca challenges con status=COMPLETED y payoutStatus=PENDING
//   2. Transfiere USDT desde la wallet de escrow al ganador
//   3. Marca payoutStatus=COMPLETED con la tx hash
//
// Ejecutar:
//   bun run scripts/auto-payout-bot.ts
//
// O con PM2 (producción):
//   pm2 start "bun run scripts/auto-payout-bot.ts" --name payout-bot
//
// Requiere en .env:
//   ESCROW_PRIVATE_KEY=0x... (clave privada de la wallet de escrow)
//   ESCROW_RPC_URL=https://ethereum.publicnode.com (o tu RPC)
//   ESCROW_CHAIN_ID=1 (1=mainnet, 11155111=sepolia, 137=polygon, 56=bsc)
//   PLATFORM_FEE_BPS=500 (5% comisión, opcional)

import { PrismaClient } from "@prisma/client";
import { ethers, Contract, Wallet, JsonRpcProvider } from "ethers";

const db = new PrismaClient();

// Configuración
const ESCROW_PRIVATE_KEY = process.env.ESCROW_PRIVATE_KEY || "";
const RPC_URL = process.env.ESCROW_RPC_URL || "https://ethereum.publicnode.com";
const CHAIN_ID = parseInt(process.env.ESCROW_CHAIN_ID || "1");
const FEE_BPS = parseInt(process.env.PLATFORM_FEE_BPS || "500"); // 5% default
const POLL_INTERVAL_MS = 15000; // 15 segundos

// USDT addresses por chain
const USDT_ADDRESSES: Record<number, { address: string; decimals: number }> = {
  1: { address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6 },         // Ethereum
  11155111: { address: "0x7b77F953299e815a81319b4beFd3EA4896c5F6dC", decimals: 6 },  // Sepolia
  137: { address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", decimals: 6 },       // Polygon
  56: { address: "0x55d398326f99059fF775485246999027B3197955", decimals: 18 },       // BSC (18 decimales!)
};

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
];

async function main() {
  console.log("🤖 Bot de pago automático iniciado");
  console.log(`   RPC: ${RPC_URL}`);
  console.log(`   Chain ID: ${CHAIN_ID}`);
  console.log(`   Fee: ${FEE_BPS / 100}%`);
  console.log(`   Interval: ${POLL_INTERVAL_MS / 1000}s`);
  console.log("");

  if (!ESCROW_PRIVATE_KEY) {
    console.error("❌ ESCROW_PRIVATE_KEY no configurada en .env");
    console.error("   Genera una wallet nueva para el escrow:");
    console.error("   node -e \"const {ethers}=require('ethers'); const w=ethers.Wallet.createRandom(); console.log('Address:', w.address); console.log('Private Key:', w.privateKey);\"");
    process.exit(1);
  }

  const provider = new JsonRpcProvider(RPC_URL, undefined, { staticNetwork: true });
  const escrowWallet = new Wallet(ESCROW_PRIVATE_KEY, provider);
  console.log(`   Escrow wallet: ${escrowWallet.address}`);

  const usdtConfig = USDT_ADDRESSES[CHAIN_ID];
  if (!usdtConfig) {
    console.error(`❌ Chain ID ${CHAIN_ID} no soportada`);
    process.exit(1);
  }

  const usdtContract = new Contract(usdtConfig.address, ERC20_ABI, escrowWallet);

  // Verificar balance del escrow
  const escrowBalance = await usdtContract.balanceOf(escrowWallet.address);
  console.log(`   Balance USDT del escrow: ${ethers.formatUnits(escrowBalance, usdtConfig.decimals)}`);
  console.log("");

  // Loop principal
  async function processPendingPayouts() {
    try {
      // Buscar retos completados con pago pendiente
      const pendingChallenges = await db.challenge.findMany({
        where: {
          status: "COMPLETED",
          payoutStatus: "PENDING",
          winnerId: { not: null },
          escrowTxHash: { not: null }, // debe tener depósito
        },
        include: {
          winner: { select: { id: true, alias: true, walletAddress: true } },
        },
        take: 10,
      });

      if (pendingChallenges.length === 0) return;

      console.log(`[${new Date().toISOString()}] Procesando ${pendingChallenges.length} pago(s) pendiente(s)...`);

      for (const challenge of pendingChallenges) {
        try {
          if (!challenge.winner) {
            console.log(`  ⚠️ Reto ${challenge.id}: sin ganador, saltando`);
            continue;
          }

          // Calcular payout (total - fee)
          const totalPool = challenge.stakeAmount * 2;
          const fee = (totalPool * FEE_BPS) / 10000;
          const payoutAmount = totalPool - fee;

          console.log(`  → Reto ${challenge.id.slice(-8)}: ${challenge.winner.alias} recibe ${payoutAmount.toFixed(2)} USDT`);

          // Marcar como PROCESSING
          await db.challenge.update({
            where: { id: challenge.id },
            data: { payoutStatus: "PROCESSING" },
          });

          // Transferir USDT al ganador
          const payoutWei = ethers.parseUnits(payoutAmount.toString(), usdtConfig.decimals);
          const winnerAddress = challenge.winner.walletAddress;

          // Verificar que el escrow tiene suficiente balance
          const currentBalance = await usdtContract.balanceOf(escrowWallet.address);
          if (currentBalance < payoutWei) {
            throw new Error(`Balance insuficiente en escrow: ${ethers.formatUnits(currentBalance, usdtConfig.decimals)} < ${payoutAmount}`);
          }

          // Enviar transacción
          const tx = await usdtContract.transfer(winnerAddress, payoutWei);
          console.log(`    Tx enviada: ${tx.hash}`);
          await tx.wait();
          console.log(`    ✓ Confirmada`);

          // Marcar como COMPLETED
          await db.challenge.update({
            where: { id: challenge.id },
            data: {
              payoutStatus: "COMPLETED",
              payoutTxHash: tx.hash,
              payoutAmount,
              payoutProcessedAt: new Date(),
            },
          });

          console.log(`    ✓ Pago completado: ${payoutAmount} USDT → ${winnerAddress}`);
        } catch (e) {
          console.error(`    ❌ Error: ${(e as Error).message}`);
          await db.challenge.update({
            where: { id: challenge.id },
            data: {
              payoutStatus: "FAILED",
              payoutError: (e as Error).message.slice(0, 500),
            },
          });
        }
      }
    } catch (e) {
      console.error(`Error en loop:`, e);
    }
  }

  // Ejecutar inmediatamente
  await processPendingPayouts();

  // Luego cada 15 segundos
  setInterval(processPendingPayouts, POLL_INTERVAL_MS);

  console.log(`\nBot activo. Revisando cada ${POLL_INTERVAL_MS / 1000}s...\n`);
}

main()
  .catch((e) => {
    console.error("Fatal error:", e);
    process.exit(1);
  })
  .finally(async () => {
    // Mantener el proceso vivo
  });
