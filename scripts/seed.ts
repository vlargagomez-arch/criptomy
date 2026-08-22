// Script de seed: inserta ofertas de demostración para que el marketplace
// no esté vacío al primer arranque.
// Ejecutar con: bun run scripts/seed.ts

import { db } from "../src/lib/db";

async function main() {
  console.log("🌱 Seeding database...");

  await db.message.deleteMany();
  await db.feedback.deleteMany();
  await db.dispute.deleteMany();
  await db.trade.deleteMany();
  await db.offer.deleteMany();
  await db.user.deleteMany();

  const users = await Promise.all([
    db.user.create({
      data: {
        alias: "satoshi_medellin_42",
        walletAddress: "0x" + "a1b2".repeat(10),
        publicKey: null,
        torOnly: false,
        reputationScore: 94,
        totalTrades: 87,
        completedTrades: 85,
        avatarSeed: "satoshi42",
        bio: "Trader P2P desde 2017. Nequi, Daviplata, PSE. Respuesta < 15 min.",
      },
    }),
    db.user.create({
      data: {
        alias: "cyber_luna_99",
        walletAddress: "bc1q" + "xyz".repeat(10),
        publicKey: null,
        torOnly: true,
        reputationScore: 88,
        totalTrades: 56,
        completedTrades: 54,
        avatarSeed: "luna99",
        bio: "Solo Bitcoin y Monero. Opero exclusivamente vía Tor.",
      },
    }),
    db.user.create({
      data: {
        alias: "neon_phoenix_7",
        walletAddress: "T" + "abcdef".repeat(8),
        publicKey: null,
        torOnly: false,
        reputationScore: 76,
        totalTrades: 23,
        completedTrades: 21,
        avatarSeed: "phoenix7",
        bio: "USDT TRC20. Acepto PIX, Mercado Pago, PayPal.",
      },
    }),
    db.user.create({
      data: {
        alias: "atlas_btc_broker",
        walletAddress: "0x" + "f0e1".repeat(10),
        publicKey: null,
        torOnly: false,
        reputationScore: 91,
        totalTrades: 142,
        completedTrades: 140,
        avatarSeed: "atlas1",
        bio: "Broker profesional. Grandes volúmenes. Bancolombia, BBVA.",
      },
    }),
    db.user.create({
      data: {
        alias: "quantic_fox_18",
        walletAddress: "0x" + "9876".repeat(10),
        publicKey: null,
        torOnly: false,
        reputationScore: 62,
        totalTrades: 8,
        completedTrades: 7,
        avatarSeed: "fox18",
        bio: "Nuevo trader. Aprendiendo. Comunicación rápida.",
      },
    }),
  ]);

  console.log(`✓ ${users.length} usuarios creados`);

  const offers = [
    {
      creatorId: users[0].id,
      type: "SELL" as const,
      chain: "ETHEREUM" as const,
      asset: "ETH",
      amount: 2.5,
      minAmount: 0.05,
      maxAmount: 1.0,
      currency: "COP",
      pricePerUnit: 14500000,
      priceType: "MARKET" as const,
      marketMargin: 1.5,
      paymentMethods: "NEQUI,DAVIPLATA,PSE",
      terms:
        "Pago Nequi/Daviplata en máximo 30 min. Libero ETH tras confirmar recepción. Trades < 0.5 ETH primero.",
      paymentWindowMin: 30,
    },
    {
      creatorId: users[1].id,
      type: "SELL" as const,
      chain: "BITCOIN" as const,
      asset: "BTC",
      amount: 0.8,
      minAmount: 0.01,
      maxAmount: 0.3,
      currency: "USD",
      pricePerUnit: 68500,
      priceType: "MARKET" as const,
      marketMargin: 2.0,
      paymentMethods: "WISE,PAYPAL,SEPA",
      terms:
        "Solo Tor. Comunicación por chat cifrado. No comparto datos hasta confirmar trade.",
      paymentWindowMin: 60,
    },
    {
      creatorId: users[2].id,
      type: "SELL" as const,
      chain: "TRON" as const,
      asset: "USDT",
      amount: 5000,
      minAmount: 100,
      maxAmount: 2000,
      currency: "BRL",
      pricePerUnit: 5.05,
      priceType: "FIXED" as const,
      marketMargin: null,
      paymentMethods: "PIX,MERCADO_PAGO",
      terms: "USDT TRC20. Solo PIX. Confirmo pago en 5 min.",
      paymentWindowMin: 20,
    },
    {
      creatorId: users[3].id,
      type: "BUY" as const,
      chain: "BITCOIN" as const,
      asset: "BTC",
      amount: 1.2,
      minAmount: 0.1,
      maxAmount: 1.0,
      currency: "COP",
      pricePerUnit: 425000000,
      priceType: "MARKET" as const,
      marketMargin: -1.0,
      paymentMethods: "BANCOLOMBIA,BBVA_CO,DAVIVIENDA",
      terms:
        "Compro BTC. Pago Bancolombia/BBVA inmediato. Grandes volúmenes bienvenidos.",
      paymentWindowMin: 90,
    },
    {
      creatorId: users[0].id,
      type: "SELL" as const,
      chain: "MONERO" as const,
      asset: "XMR",
      amount: 15,
      minAmount: 0.5,
      maxAmount: 5,
      currency: "EUR",
      pricePerUnit: 165,
      priceType: "MARKET" as const,
      marketMargin: 3.0,
      paymentMethods: "SEPA,WISE,PAYONEER",
      terms:
        "Monero para máxima privacidad. SEPA preferred. Confirmo recepción y libero en 1 bloque.",
      paymentWindowMin: 120,
    },
    {
      creatorId: users[2].id,
      type: "BUY" as const,
      chain: "ETHEREUM" as const,
      asset: "USDT",
      amount: 3000,
      minAmount: 100,
      maxAmount: 1500,
      currency: "USD",
      pricePerUnit: 1.0,
      priceType: "FIXED" as const,
      marketMargin: null,
      paymentMethods: "PAYPAL,WISE",
      terms: "Compro USDT ERC20. Pago PayPal F&F o Wise. Rápido.",
      paymentWindowMin: 30,
    },
    {
      creatorId: users[3].id,
      type: "SELL" as const,
      chain: "ETHEREUM" as const,
      asset: "USDC",
      amount: 8000,
      minAmount: 200,
      maxAmount: 3000,
      currency: "COP",
      pricePerUnit: 4150,
      priceType: "MARKET" as const,
      marketMargin: 0.5,
      paymentMethods: "PSE,BANCOLOMBIA,NEQUI",
      terms: "USDC ERC20. PSE en máximo 1h hábil. Libero tras confirmar.",
      paymentWindowMin: 60,
    },
    {
      creatorId: users[1].id,
      type: "BUY" as const,
      chain: "MONERO" as const,
      asset: "XMR",
      amount: 20,
      minAmount: 1,
      maxAmount: 10,
      currency: "USD",
      pricePerUnit: 172,
      priceType: "MARKET" as const,
      marketMargin: 1.0,
      paymentMethods: "WISE,CASH_IN_PERSON",
      terms: "Compro XMR. Pago Wise o efectivo en persona (Bogotá).",
      paymentWindowMin: 180,
    },
    {
      creatorId: users[4].id,
      type: "SELL" as const,
      chain: "ETHEREUM" as const,
      asset: "ETH",
      amount: 0.5,
      minAmount: 0.01,
      maxAmount: 0.2,
      currency: "MXN",
      pricePerUnit: 68000,
      priceType: "MARKET" as const,
      marketMargin: 2.5,
      paymentMethods: "MERCADO_PAGO",
      terms: "Soy nuevo pero honesto. Mercado Pago México. Comunicación rápida.",
      paymentWindowMin: 45,
    },
    {
      creatorId: users[0].id,
      type: "BUY" as const,
      chain: "BITCOIN" as const,
      asset: "BTC",
      amount: 0.25,
      minAmount: 0.01,
      maxAmount: 0.1,
      currency: "COP",
      pricePerUnit: 418000000,
      priceType: "MARKET" as const,
      marketMargin: -2.0,
      paymentMethods: "NEQUI,DAVIPLATA",
      terms: "Compro BTC pequeño monto. Pago Nequi inmediato.",
      paymentWindowMin: 30,
    },
  ];

  for (const o of offers) {
    await db.offer.create({
      data: {
        ...o,
        escrowType: "SMART_CONTRACT" as const,
        status: "ACTIVE" as const,
      },
    });
  }
  console.log(`✓ ${offers.length} ofertas creadas`);

  console.log("\n🎉 Seed completado!");
  console.log("Usuarios:");
  for (const u of users) {
    console.log(
      `  - ${u.alias} (${u.walletAddress.slice(0, 10)}…) rep=${u.reputationScore}`
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
