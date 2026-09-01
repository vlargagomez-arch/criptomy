// Script de seed — NO crea datos falsos
// El mercado empieza vacío. Los usuarios crean sus propias ofertas reales.
// Ejecutar con: bun run scripts/seed.ts

import { db } from "../src/lib/db";

async function main() {
  console.log("🌱 Verificando si hay datos...");

  const existingOffers = await db.offer.count();
  if (existingOffers > 0) {
    console.log(`✓ Ya hay ${existingOffers} ofertas. No se borra nada.`);
    return;
  }

  console.log("✓ Mercado vacío. Los usuarios crearán sus propias ofertas.");
  console.log("✓ No se crean datos de demostración (todo es real).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
