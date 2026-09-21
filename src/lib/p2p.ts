"use client";

// ============================================================
// Red P2P tipo Bisq — sin servidor central
// ============================================================
// Inspirado en Bisq (https://bisq.network) que opera sin servidor
// central. Usa libp2p para descubrimiento de pares y GossipSub
// para propagación de ofertas.
//
// Modelo:
// - Cada usuario es un nodo P2P
// - Las ofertas se propagan vía GossipSub (pub/sub)
// - Los trades se negocian directamente entre pares
// - El chat es directo P2P (sin pasar por el servidor)
//
// En MVP usamos libp2p con:
// - transport: WebSockets (conexión a relay nodes públicos)
// - crypto: Noise (encriptación por defecto)
// - muxer: mplex (multiplexación de streams)
// - discovery: Bootstrap (lista de pares semilla)
// - pubsub: GossipSub (propagación de mensajes)

import { createLibp2p } from "libp2p";
import { webSockets } from "@libp2p/websockets";
import { mplex } from "@libp2p/mplex";
import { noise } from "@libp2p/noise";
import { bootstrap } from "@libp2p/bootstrap";
import { gossipsub } from "@libp2p/gossipsub";
import { identify } from "@libp2p/identify";
import { peerIdFromPrivateKey } from "@libp2p/peer-id";
import { generateKeyPair } from "@libp2p/crypto/keys";

// ============================================================
// Tipo de mensaje P2P
// ============================================================
export interface P2PMessage {
  type: "offer" | "trade-request" | "trade-accept" | "chat" | "presence";
  id: string;
  peerId: string;
  alias: string;
  payload: unknown;
  timestamp: number;
  signature?: string; // firma del peerId sobre el payload
}

export interface P2POffer {
  id: string;
  type: "BUY" | "SELL";
  chain: string;
  asset: string;
  amount: number;
  currency: string;
  pricePerUnit: number;
  paymentMethods: string[];
  terms: string;
  peerAlias: string;
  peerId: string;
  createdAt: number;
  expiresAt: number;
}

// ============================================================
// Tópicos de GossipSub
// ============================================================
export const P2P_TOPICS = {
  OFFERS: "nokycswap/offers/v1",
  PRESENCE: "nokycswap/presence/v1",
  TRADE_NEGOTIATION: "nokycswap/trades/v1",
} as const;

// Bootstrap nodes (en producción: nodos propios o públicos de libp2p)
const BOOTSTRAP_PEERS = [
  "/dnsaddr/bootstrap.libp2p.io/p2p/QmNnooDuVkcruPhcoXDia1Zc1tksTjzFqEaR7XWvK2mDWe",
  "/dnsaddr/bootstrap.libp2p.io/p2p/QmQCU2EcMqAqQPR2i9bChDtGNJchTbq5TbXNr16eE85Hyg",
  "/dnsaddr/bootstrap.libp2p.io/p2p/QmbLHAnMoJPWSCR5Zhtx6BHJX9KiKNN6tpvbUcqanj75Nb",
  "/dnsaddr/bootstrap.libp2p.io/p2p/QmcZf59bWwK5XFi76CZX8cbJ4BhTzzA3gU1ZjYZcYW3dwt",
];

// ============================================================
// Clase P2PNode — wrapper sobre libp2p
// ============================================================
export class P2PNode {
  private libp2p: Awaited<ReturnType<typeof createLibp2p>> | null = null;
  private peerId: string | null = null;
  private alias: string;
  private listeners: ((msg: P2PMessage) => void)[] = [];
  private knownPeers: Map<string, { alias: string; lastSeen: number }> = new Map();
  private offers: Map<string, P2POffer> = new Map();

  constructor(alias: string) {
    this.alias = alias;
  }

  // Iniciar nodo P2P
  async start(): Promise<{ peerId: string; multiaddrs: string[] }> {
    if (this.libp2p) {
      throw new Error("Nodo ya iniciado");
    }

    // Generar clave privada del nodo
    const privateKey = await generateKeyPair("Ed25519");
    const peerId = await peerIdFromPrivateKey(privateKey);
    this.peerId = peerId.toString();

    // Crear nodo libp2p
    this.libp2p = await createLibp2p({
      peerId,
      transports: [webSockets()],
      connectionEncryption: [noise()],
      streamMuxers: [mplex()],
      peerDiscovery: [
        bootstrap({
          list: BOOTSTRAP_PEERS,
        }),
      ],
      services: {
        identify: identify(),
        pubsub: gossipsub({
          allowPublishToZeroPeers: true,
          emitSelf: false,
        }) as never,
      },
    });

    // Suscribirse a tópicos
    await this.libp2p.services.pubsub.subscribe(P2P_TOPICS.OFFERS);
    await this.libp2p.services.pubsub.subscribe(P2P_TOPICS.PRESENCE);

    // Escuchar mensajes
    this.libp2p.services.pubsub.addEventListener("message", (event) => {
      this.handleIncomingMessage(event);
    });

    // Anunciar presencia
    await this.broadcastPresence();

    return {
      peerId: this.peerId,
      multiaddrs: this.libp2p.getMultiaddrs().map((m) => m.toString()),
    };
  }

  // Detener nodo
  async stop() {
    if (this.libp2p) {
      await this.libp2p.stop();
      this.libp2p = null;
    }
  }

  // Escuchar mensajes
  onMessage(callback: (msg: P2PMessage) => void) {
    this.listeners.push(callback);
  }

  // Publicar oferta en la red P2P
  async publishOffer(offer: Omit<P2POffer, "peerId" | "peerAlias" | "createdAt" | "expiresAt">): Promise<string> {
    if (!this.libp2p) throw new Error("Nodo no iniciado");

    const fullOffer: P2POffer = {
      ...offer,
      peerId: this.peerId!,
      peerAlias: this.alias,
      createdAt: Date.now(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24h
    };

    const msg: P2PMessage = {
      type: "offer",
      id: fullOffer.id,
      peerId: this.peerId!,
      alias: this.alias,
      payload: fullOffer,
      timestamp: Date.now(),
    };

    await this.libp2p.services.pubsub.publish(
      P2P_TOPICS.OFFERS,
      new TextEncoder().encode(JSON.stringify(msg))
    );

    // Guardar localmente
    this.offers.set(fullOffer.id, fullOffer);

    return fullOffer.id;
  }

  // Anunciar presencia
  async broadcastPresence() {
    if (!this.libp2p) return;
    const msg: P2PMessage = {
      type: "presence",
      id: `presence-${Date.now()}`,
      peerId: this.peerId!,
      alias: this.alias,
      payload: { online: true },
      timestamp: Date.now(),
    };
    await this.libp2p.services.pubsub.publish(
      P2P_TOPICS.PRESENCE,
      new TextEncoder().encode(JSON.stringify(msg))
    );
  }

  // Enviar mensaje directo a un peer (chat P2P)
  async sendDirectMessage(peerId: string, content: string) {
    if (!this.libp2p) throw new Error("Nodo no iniciado");
    // En MVP usamos pubsub con tópico específico por par
    const topic = `nokycswap/dm/${[this.peerId, peerId].sort().join("-")}`;
    await this.libp2p.services.pubsub.subscribe(topic);
    await this.libp2p.services.pubsub.publish(
      topic,
      new TextEncoder().encode(
        JSON.stringify({
          type: "chat",
          id: `msg-${Date.now()}`,
          peerId: this.peerId,
          alias: this.alias,
          payload: { content },
          timestamp: Date.now(),
        } as P2PMessage)
      )
    );
  }

  // Obtener todas las ofertas conocidas
  getKnownOffers(): P2POffer[] {
    return Array.from(this.offers.values()).filter(
      (o) => o.expiresAt > Date.now()
    );
  }

  // Obtener pares conocidos
  getKnownPeers(): Array<{ peerId: string; alias: string; lastSeen: number }> {
    return Array.from(this.knownPeers.entries()).map(([peerId, info]) => ({
      peerId,
      ...info,
    }));
  }

  // Manejar mensaje entrante
  private handleIncomingMessage(event: { topic: string; data: Uint8Array }) {
    try {
      const text = new TextDecoder().decode(event.data);
      const msg = JSON.parse(text) as P2PMessage;

      // Actualizar pares conocidos
      this.knownPeers.set(msg.peerId, {
        alias: msg.alias,
        lastSeen: Date.now(),
      });

      // Si es oferta, guardarla
      if (msg.type === "offer") {
        const offer = msg.payload as P2POffer;
        if (offer.expiresAt > Date.now()) {
          this.offers.set(offer.id, offer);
        }
      }

      // Notificar a listeners
      this.listeners.forEach((cb) => cb(msg));
    } catch (e) {
      console.error("[p2p] message parse error:", e);
    }
  }
}

// ============================================================
// Singleton
// ============================================================
let activeNode: P2PNode | null = null;

export async function getP2PNode(alias: string): Promise<P2PNode> {
  if (activeNode) return activeNode;
  activeNode = new P2PNode(alias);
  await activeNode.start();
  return activeNode;
}

export function getActiveP2PNode(): P2PNode | null {
  return activeNode;
}

// ============================================================
// Helpers
// ============================================================

export function shortPeerId(peerId: string): string {
  if (peerId.length < 16) return peerId;
  return `${peerId.slice(0, 8)}…${peerId.slice(-4)}`;
}

export function timeSinceLastSeen(timestamp: number): string {
  const sec = Math.floor((Date.now() - timestamp) / 1000);
  if (sec < 60) return `hace ${sec}s`;
  if (sec < 3600) return `hace ${Math.floor(sec / 60)} min`;
  return `hace ${Math.floor(sec / 3600)} h`;
}

// Estado del nodo P2P
export interface P2PNodeStatus {
  started: boolean;
  peerId: string | null;
  connectedPeers: number;
  knownOffers: number;
  subscriptions: string[];
}

export function getP2PStatus(): P2PNodeStatus {
  if (!activeNode || !activeNode["libp2p"]) {
    return {
      started: false,
      peerId: null,
      connectedPeers: 0,
      knownOffers: 0,
      subscriptions: [],
    };
  }
  return {
    started: true,
    peerId: activeNode.peerId,
    connectedPeers: activeNode.getKnownPeers().length,
    knownOffers: activeNode.getKnownOffers().length,
    subscriptions: [P2P_TOPICS.OFFERS, P2P_TOPICS.PRESENCE],
  };
}
