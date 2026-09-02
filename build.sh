#!/usr/bin/env node
// ============================================================
// build.sh — Build script para Vercel
// ============================================================
// Asegura que prisma generate funcione incluso si DATABASE_URL
// no está configurada (caso común en previews o PRs).
// En runtime, la app usa DATABASE_URL de las env vars de Vercel.
// ============================================================

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const DATABASE_URL = process.env.DATABASE_URL;

function log(msg) {
  console.log(`[build] ${msg}`);
}

try {
  log("Step 1/3: prisma generate");
  // Si no hay DATABASE_URL, prisma generate todavía funciona
  // (solo genera el cliente TypeScript, no se conecta a la DB).
  execSync("npx prisma generate", { stdio: "inherit" });

  log("Step 2/3: prisma db push (skip si no hay DATABASE_URL válida)");
  if (DATABASE_URL && DATABASE_URL.startsWith("postgresql")) {
    try {
      execSync("npx prisma db push --accept-data-loss", {
        stdio: "inherit",
        env: { ...process.env },
        timeout: 60000,
      });
      log("DB migrada OK");
    } catch (e) {
      log("WARN: prisma db push falló (continuando con build). Las tablas deben crearse manualmente via scripts/migrate-supabase.sql");
      log("Detalle: " + (e.message || e).toString().split("\n")[0]);
    }
  } else {
    log("SKIP: DATABASE_URL no es postgresql válida. Las tablas deben crearse manualmente via scripts/migrate-supabase.sql");
  }

  log("Step 3/3: next build");
  execSync("npx next build", { stdio: "inherit" });

  log("✓ Build completo");
} catch (e) {
  console.error("[build] ERROR:", e.message);
  process.exit(1);
}
