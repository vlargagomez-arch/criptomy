// Genera VAPID keys para Web Push notifications.
// Ejecutar: npx tsx scripts/generate-vapid-keys.ts
// Copiar las claves a .env:
//   VAPID_PUBLIC_KEY=...
//   VAPID_PRIVATE_KEY=...
//   NEXT_PUBLIC_VAPID_PUBLIC_KEY=...

import webPush from "web-push";

const vapidKeys = webPush.generateVAPIDKeys();

console.log("\n=== VAPID Keys generadas ===\n");
console.log("Agrega estas variables a tu .env (local) y en Vercel:\n");
console.log(`VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
console.log(`VAPID_SUBJECT=mailto:admin@criptomy.app`);
console.log("\nLa clave pública (NEXT_PUBLIC_VAPID_PUBLIC_KEY) se expone al navegador.");
console.log("La clave privada (VAPID_PRIVATE_KEY) NUNCA debe ir al cliente.\n");
