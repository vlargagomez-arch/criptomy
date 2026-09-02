import webPush from "web-push";
import { db } from "./db";

// Configurar web-push con VAPID keys del entorno
let configured = false;
function ensureConfigured() {
  if (configured) return;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@criptomy.app";

  if (!publicKey || !privateKey) {
    throw new Error(
      "VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY son requeridas. Ejecuta: npx tsx scripts/generate-vapid-keys.ts"
    );
  }

  webPush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

// ============================================================
// Crear notificación in-app + disparar browser push si hay suscripción
// ============================================================
export async function notifyUser(opts: {
  userId: string;
  type: string;
  title: string;
  body: string;
  url?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    // 1) Crear en DB (in-app)
    await db.notification.create({
      data: {
        userId: opts.userId,
        type: opts.type,
        title: opts.title,
        body: opts.body,
        url: opts.url,
        metadata: opts.metadata ? JSON.stringify(opts.metadata) : null,
      },
    });

    // 2) Disparar browser push si hay suscripciones
    const subscriptions = await db.pushSubscription.findMany({
      where: { userId: opts.userId },
    });

    if (subscriptions.length === 0) return;

    try {
      ensureConfigured();
    } catch (e) {
      console.warn("[notifyUser] VAPID no configurado, saltando push:", (e as Error).message);
      return;
    }

    const payload = JSON.stringify({
      title: opts.title,
      body: opts.body,
      url: opts.url || "/",
      type: opts.type,
    });

    for (const sub of subscriptions) {
      try {
        await webPush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload,
          {
            TTL: 60 * 60 * 24, // 24 horas
            urgency: "normal",
          }
        );
      } catch (err) {
        console.warn("[notifyUser] push failed for", sub.endpoint.slice(0, 40), ":", (err as Error).message);
        // Si el endpoint ya no es válido (410 Gone), eliminar la suscripción
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 410 || status === 404) {
          await db.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        }
      }
    }
  } catch (err) {
    console.error("[notifyUser] error:", err);
  }
}

// ============================================================
// Helpers específicos para cada tipo de notificación
// ============================================================

// Notifica a usuarios que tienen alerta de precio objetivo (DIP_BELOW o TARGET_PRICE)
// Llamado cuando se crea una nueva oferta P2P
export async function notifyPriceTargetMatches(opts: {
  asset: string;
  offerPricePerUnit: number;
  offerType: string; // BUY o SELL
  offerId: string;
  currency: string;
}): Promise<void> {
  // Buscar usuarios con alertas activas para este asset
  const alerts = await db.priceAlert.findMany({
    where: {
      asset: { equals: opts.asset.toUpperCase() },
      triggered: false,
      alertType: { in: ["DIP_BELOW", "TARGET_PRICE"] },
    },
    include: { user: true },
  });

  for (const alert of alerts) {
    let shouldNotify = false;
    let title = "";
    let body = "";

    if (alert.alertType === "DIP_BELOW" && alert.thresholdPrice) {
      // Si la oferta está por debajo o igual al threshold, avisar
      if (opts.offerPricePerUnit <= alert.thresholdPrice) {
        shouldNotify = true;
        title = `🎯 ${opts.asset} a tu precio objetivo`;
        body = `Hay oferta de ${opts.offerType === "SELL" ? "venta" : "compra"} de ${opts.asset} a ${opts.offerPricePerUnit} ${opts.currency} (tu alerta: <= ${alert.thresholdPrice})`;
      }
    } else if (alert.alertType === "TARGET_PRICE" && alert.thresholdPrice) {
      // Para SELL offers que alcancen tu target de venta
      if (opts.offerType === "SELL" && opts.offerPricePerUnit >= alert.thresholdPrice) {
        shouldNotify = true;
        title = `📈 ${opts.asset} alcanzó tu target`;
        body = `Oferta de VENTA a ${opts.offerPricePerUnit} ${opts.currency} (tu target: >= ${alert.thresholdPrice})`;
      }
    }

    if (shouldNotify) {
      await notifyUser({
        userId: alert.userId,
        type: "PRICE_ALERT",
        title,
        body,
        url: "/?tab=mercado",
        metadata: { offerId: opts.offerId, alertId: alert.id, asset: opts.asset },
      });
    }
  }
}

// Notifica a usuarios cuando hay nueva oferta con método de pago específico
export async function notifyNewOfferPaymentMethod(opts: {
  offerId: string;
  asset: string;
  currency: string;
  paymentMethods: string; // CSV
  offerType: string;
}): Promise<void> {
  // Por ahora: notificar a todos los usuarios (simple). En el futuro
  // podemos agregar una tabla SavedPaymentMethodWatch con userId + method.
  const users = await db.user.findMany({
    where: { id: { not: undefined } },
    select: { id: true },
  });

  // Aviso simple a todos (mejorable con watchlist personal)
  const methods = opts.paymentMethods.split(",").slice(0, 3).join(", ");
  for (const user of users) {
    await notifyUser({
      userId: user.id,
      type: "NEW_OFFER",
      title: `🆕 Nueva oferta ${opts.offerType === "SELL" ? "de venta" : "de compra"} ${opts.asset}`,
      body: `Pago vía ${methods} · ${opts.currency}`,
      url: "/?tab=mercado",
      metadata: { offerId: opts.offerId },
    });
  }
}

// Notifica al creador de un trade cuando hay update (aceptado, mensaje, disputa)
export async function notifyTradeUpdate(opts: {
  userId: string;
  tradeId: string;
  event: "ACCEPTED" | "MESSAGE" | "ESCROW_FUNDED" | "PAYMENT_SENT" | "RELEASED" | "DISPUTE";
}): Promise<void> {
  const messages: Record<typeof event, { title: string; body: string }> = {
    ACCEPTED: { title: "✅ Oferta aceptada", body: "Alguien aceptó tu oferta. Revisa los detalles." },
    MESSAGE: { title: "💬 Nuevo mensaje", body: "Tienes un nuevo mensaje en tu trade." },
    ESCROW_FUNDED: { title: "🔒 Escrow depositado", body: "El vendedor ya depositó en escrow." },
    PAYMENT_SENT: { title: "💸 Pago enviado", body: "El comprador marcó el pago como enviado." },
    RELEASED: { title: "🎉 Fondos liberados", body: "El vendedor liberó los fondos. Trade completado." },
    DISPUTE: { title: "⚠️ Disputa abierta", body: "Se abrió una disputa en tu trade." },
  };
  const m = messages[opts.event];
  await notifyUser({
    userId: opts.userId,
    type: "TRADE_UPDATE",
    title: m.title,
    body: m.body,
    url: "/?tab=trades",
    metadata: { tradeId: opts.tradeId, event: opts.event },
  });
}

// Notifica cuando se crea un nuevo reto en un juego específico
export async function notifyNewChallenge(opts: {
  challengeId: string;
  game: string;
  stakeAmount: number;
  creatorAlias: string;
}): Promise<void> {
  // Notificar a todos los usuarios (mejorable con watchlist de juegos favoritos)
  const users = await db.user.findMany({
    select: { id: true },
  });

  for (const user of users) {
    await notifyUser({
      userId: user.id,
      type: "CHALLENGE_NEW",
      title: `🎮 Nuevo reto de ${opts.game}`,
      body: `${opts.creatorAlias} reta a 1v1 · ${opts.stakeAmount} USDT`,
      url: "/?tab=retos",
      metadata: { challengeId: opts.challengeId, game: opts.game },
    });
  }
}

// Notifica alarma de "dip" (caída de precio X% en timeframe)
export async function notifyDipAlert(opts: {
  userId: string;
  alertId: string;
  asset: string;
  dropPercent: number;
  currentPrice: number;
  timeframeHours: number;
}): Promise<void> {
  await notifyUser({
    userId: opts.userId,
    type: "DIP_ALERT",
    title: `📉 ${opts.asset} cae ${opts.dropPercent.toFixed(1)}% en ${opts.timeframeHours}h`,
    body: `Precio actual: $${opts.currentPrice.toFixed(2)}. Es buen momento para comprar en el mercado P2P.`,
    url: "/?tab=mercado",
    metadata: { alertId: opts.alertId, asset: opts.asset },
  });
}

// Notifica que un NFT se vendió (al vendedor)
export async function notifyNFTSold(opts: {
  sellerId: string;
  listingId: string;
  nftName: string;
  price: number;
  currency: string;
}): Promise<void> {
  await notifyUser({
    userId: opts.sellerId,
    type: "NFT_SOLD",
    title: `🎉 NFT vendido: ${opts.nftName}`,
    body: `Tu NFT se vendió por ${opts.price} ${opts.currency}.`,
    url: "/?tab=nft",
    metadata: { listingId: opts.listingId },
  });
}

// Notifica al comprador que su NFT fue transferido
export async function notifyNFTBought(opts: {
  buyerId: string;
  listingId: string;
  nftName: string;
  price: number;
  currency: string;
}): Promise<void> {
  await notifyUser({
    userId: opts.buyerId,
    type: "NFT_BOUGHT",
    title: `🎨 NFT comprado: ${opts.nftName}`,
    body: `Compraste ${opts.nftName} por ${opts.price} ${opts.currency}. Verifica la transferencia en tu wallet.`,
    url: "/?tab=nft",
    metadata: { listingId: opts.listingId },
  });
}
