-- ============================================================
-- Migración: Crear tablas nuevas para Notificaciones + Alertas + NFT
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================
-- Este script agrega las 5 tablas nuevas a tu DB PostgreSQL.
-- Las tablas existentes (User, Offer, Trade, etc.) no se modifican.

-- 1) Tabla: Notification
CREATE TABLE IF NOT EXISTS "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "url" TEXT,
    "metadata" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Notification_userId_read_idx" ON "Notification"("userId", "read");
CREATE INDEX IF NOT EXISTS "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- FK: Notification.userId -> User.id (ON DELETE CASCADE)
ALTER TABLE "Notification" DROP CONSTRAINT IF EXISTS "Notification_userId_fkey";
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;

-- 2) Tabla: PushSubscription
CREATE TABLE IF NOT EXISTS "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");
CREATE INDEX IF NOT EXISTS "PushSubscription_userId_idx" ON "PushSubscription"("userId");

ALTER TABLE "PushSubscription" DROP CONSTRAINT IF EXISTS "PushSubscription_userId_fkey";
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;

-- 3) Tabla: PriceAlert
CREATE TABLE IF NOT EXISTS "PriceAlert" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "alertType" TEXT NOT NULL DEFAULT 'DIP_BELOW',
    "thresholdPrice" DOUBLE PRECISION,
    "thresholdPercent" DOUBLE PRECISION,
    "timeframeHours" INTEGER NOT NULL DEFAULT 24,
    "triggered" BOOLEAN NOT NULL DEFAULT false,
    "triggeredAt" TIMESTAMP(3),
    "triggeredPrice" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceAlert_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PriceAlert_userId_triggered_idx" ON "PriceAlert"("userId", "triggered");
CREATE INDEX IF NOT EXISTS "PriceAlert_asset_triggered_idx" ON "PriceAlert"("asset", "triggered");

ALTER TABLE "PriceAlert" DROP CONSTRAINT IF EXISTS "PriceAlert_userId_fkey";
ALTER TABLE "PriceAlert" ADD CONSTRAINT "PriceAlert_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;

-- 4) Tabla: NFTListing
CREATE TABLE IF NOT EXISTS "NFTListing" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "contractAddress" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageCID" TEXT,
    "imageGateway" TEXT,
    "metadataCID" TEXT,
    "priceAmount" DOUBLE PRECISION NOT NULL,
    "priceCurrency" TEXT NOT NULL,
    "priceChain" TEXT NOT NULL,
    "buyerId" TEXT,
    "soldAt" TIMESTAMP(3),
    "saleTxHash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'LISTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NFTListing_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "NFTListing_chain_status_idx" ON "NFTListing"("chain", "status");
CREATE INDEX IF NOT EXISTS "NFTListing_sellerId_idx" ON "NFTListing"("sellerId");
CREATE INDEX IF NOT EXISTS "NFTListing_status_idx" ON "NFTListing"("status");

ALTER TABLE "NFTListing" DROP CONSTRAINT IF EXISTS "NFTListing_sellerId_fkey";
ALTER TABLE "NFTListing" ADD CONSTRAINT "NFTListing_sellerId_fkey"
    FOREIGN KEY ("sellerId") REFERENCES "User"("id");

ALTER TABLE "NFTListing" DROP CONSTRAINT IF EXISTS "NFTListing_buyerId_fkey";
ALTER TABLE "NFTListing" ADD CONSTRAINT "NFTListing_buyerId_fkey"
    FOREIGN KEY ("buyerId") REFERENCES "User"("id");

-- 5) Tabla: NFTDrop
CREATE TABLE IF NOT EXISTS "NFTDrop" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "collectionImage" TEXT,
    "projectWebsite" TEXT,
    "chain" TEXT NOT NULL,
    "contractAddress" TEXT,
    "dropDate" TIMESTAMP(3) NOT NULL,
    "mintPrice" DOUBLE PRECISION,
    "priceCurrency" TEXT,
    "totalSupply" INTEGER,
    "maxPerWallet" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'UPCOMING',
    "verified" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NFTDrop_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "NFTDrop_dropDate_idx" ON "NFTDrop"("dropDate");
CREATE INDEX IF NOT EXISTS "NFTDrop_status_verified_idx" ON "NFTDrop"("status", "verified");

-- ============================================================
-- Listo. Verifica ejecutando:
--   SELECT COUNT(*) FROM "Notification";
--   SELECT COUNT(*) FROM "PriceAlert";
--   SELECT COUNT(*) FROM "NFTListing";
--   SELECT COUNT(*) FROM "NFTDrop";
-- ============================================================
