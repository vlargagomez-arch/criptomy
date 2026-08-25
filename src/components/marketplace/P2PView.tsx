"use client";

import { useState, useEffect, useRef } from "react";
import { useApp } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Network,
  Wifi,
  WifiOff,
  Users,
  Radio,
  Loader2,
  Play,
  Square,
  Copy,
  CheckCircle2,
  Zap,
} from "lucide-react";
import {
  P2PNode,
  P2PMessage,
  P2POffer,
  P2P_TOPICS,
  shortPeerId,
  timeSinceLastSeen,
  getP2PStatus,
} from "@/lib/p2p";
import { avatarGradient, timeAgo } from "@/lib/format";

interface Peer {
  peerId: string;
  alias: string;
  lastSeen: number;
}

type Offer = P2POffer;

export default function P2PView() {
  const { user } = useApp();
  const [node, setNode] = useState<P2PNode | null>(null);
  const [starting, setStarting] = useState(false);
  const [myPeerId, setMyPeerId] = useState<string | null>(null);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [messages, setMessages] = useState<P2PMessage[]>([]);
  const [error, setError] = useState("");
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (node) node.stop();
    };
  }, [node]);

  async function startNode() {
    if (!user) return;
    setStarting(true);
    setError("");
    try {
      const { getP2PNode } = await import("@/lib/p2p");
      const p2pNode = await getP2PNode(user.alias);
      setNode(p2pNode);
      setMyPeerId(p2pNode["peerId"]);

      // Escuchar mensajes
      p2pNode.onMessage((msg) => {
        setMessages((prev) => [...prev.slice(-99), msg]);
        // Actualizar peers y offers
        setPeers(p2pNode.getKnownPeers());
        setOffers(p2pNode.getKnownOffers());
      });

      // Polling cada 3s para refrescar UI
      intervalRef.current = setInterval(() => {
        setPeers(p2pNode.getKnownPeers());
        setOffers(p2pNode.getKnownOffers());
      }, 3000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStarting(false);
    }
  }

  async function stopNode() {
    if (node) {
      await node.stop();
      setNode(null);
      setMyPeerId(null);
      setPeers([]);
      setOffers([]);
      setMessages([]);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }

  async function publishTestOffer() {
    if (!node) return;
    try {
      await node.publishOffer({
        id: `offer-${Date.now()}`,
        type: "SELL",
        chain: "ETHEREUM",
        asset: "ETH",
        amount: 0.1,
        currency: "USD",
        pricePerUnit: 2500,
        paymentMethods: ["PAYPAL", "WISE"],
        terms: "Oferta publicada vía red P2P",
      });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const status = getP2PStatus();

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <Network className="w-5 h-5 text-emerald-400" />
          Red P2P descentralizada
        </h1>
        <p className="text-sm text-slate-400">
          Sin servidor central · estilo Bisq · ofertas viajan por GossipSub
        </p>
      </div>

      {/* Estado del nodo */}
      <Card className="bg-slate-900/60 border-slate-800 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-400" />
            Estado del nodo
          </h3>
          {node ? (
            <Badge className="bg-emerald-950/50 border-emerald-700 text-emerald-400">
              <Wifi className="w-3 h-3 mr-1" /> Conectado
            </Badge>
          ) : (
            <Badge className="bg-slate-950/50 border-slate-700 text-slate-400">
              <WifiOff className="w-3 h-3 mr-1" /> Desconectado
            </Badge>
          )}
        </div>

        {!node ? (
          <div className="text-center py-4">
            <p className="text-sm text-slate-400 mb-3">
              Inicie su nodo P2P para descubrir ofertas de otros usuarios sin
              pasar por un servidor central.
            </p>
            <Button
              onClick={startNode}
              disabled={starting || !user}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {starting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              {starting ? "Iniciando nodo…" : "Iniciar nodo P2P"}
            </Button>
            {!user && (
              <p className="text-xs text-slate-500 mt-2">
                Conecte su wallet primero
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="p-2 rounded bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-500 uppercase">Mi Peer ID</div>
                <code className="text-emerald-400 font-mono break-all text-[10px]">
                  {myPeerId ? shortPeerId(myPeerId) : "—"}
                </code>
              </div>
              <div className="p-2 rounded bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-500 uppercase">Pares</div>
                <div className="text-slate-200 font-mono">{peers.length}</div>
              </div>
              <div className="p-2 rounded bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-500 uppercase">Ofertas</div>
                <div className="text-slate-200 font-mono">{offers.length}</div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[10px] text-slate-500">
              <span>Suscrito a:</span>
              {status.subscriptions.map((t) => (
                <Badge
                  key={t}
                  variant="outline"
                  className="text-[10px] bg-slate-950 border-slate-700 text-slate-400"
                >
                  {t}
                </Badge>
              ))}
            </div>

            <Button
              onClick={stopNode}
              variant="outline"
              size="sm"
              className="w-full border-red-900/50 text-red-400 hover:bg-red-950/30"
            >
              <Square className="w-3 h-3 mr-2" />
              Detener nodo
            </Button>

            <Button
              onClick={publishTestOffer}
              variant="outline"
              size="sm"
              className="w-full border-emerald-700/50 text-emerald-300 hover:bg-emerald-950/30"
            >
              <Zap className="w-3 h-3 mr-2" />
              Publicar oferta de prueba
            </Button>
          </div>
        )}

        {error && (
          <div className="mt-3 p-2 rounded-md bg-red-950/50 border border-red-900/50 text-xs text-red-300">
            {error}
          </div>
        )}
      </Card>

      {/* Pares conocidos */}
      <Card className="bg-slate-900/60 border-slate-800 p-5">
        <h3 className="text-sm font-semibold text-slate-100 mb-3 flex items-center gap-2">
          <Users className="w-4 h-4 text-emerald-400" />
          Pares conectados ({peers.length})
        </h3>
        {peers.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-4">
            {node ? "Esperando descubrir pares…" : "Inicie el nodo para ver pares"}
          </p>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {peers.map((p) => (
              <div
                key={p.peerId}
                className="flex items-center gap-2 p-2 rounded bg-slate-950 border border-slate-800"
              >
                <Avatar className={`w-6 h-6 bg-gradient-to-br ${avatarGradient(p.alias)}`}>
                  <AvatarFallback className="bg-transparent text-white text-[10px]">
                    {p.alias.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-slate-200">{p.alias}</div>
                  <code className="text-[10px] text-slate-500 font-mono">
                    {shortPeerId(p.peerId)}
                  </code>
                </div>
                <span className="text-[10px] text-slate-500">
                  {timeSinceLastSeen(p.lastSeen)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Ofertas P2P */}
      <Card className="bg-slate-900/60 border-slate-800 p-5">
        <h3 className="text-sm font-semibold text-slate-100 mb-3 flex items-center gap-2">
          <Radio className="w-4 h-4 text-emerald-400" />
          Ofertas en la red P2P ({offers.length})
        </h3>
        {offers.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-4">
            {node ? "Sin ofertas. Publique una para empezar." : "Inicie el nodo"}
          </p>
        ) : (
          <div className="space-y-2">
            {offers.map((o) => (
              <div
                key={o.id}
                className="p-3 rounded bg-slate-950 border border-slate-800"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        o.type === "SELL"
                          ? "bg-red-950/30 border-red-700 text-red-400"
                          : "bg-emerald-950/30 border-emerald-700 text-emerald-400"
                      }`}
                    >
                      {o.type === "SELL" ? "Vende" : "Compra"}
                    </Badge>
                    <span className="text-sm font-medium text-slate-200">
                      {o.amount} {o.asset}
                    </span>
                    <span className="text-[10px] text-slate-500">@ {o.pricePerUnit} {o.currency}</span>
                  </div>
                  <span className="text-[10px] text-slate-500">
                    {timeAgo(new Date(o.createdAt))}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-slate-500">
                  <span>Por: {o.peerAlias}</span>
                  <code className="font-mono">{shortPeerId(o.peerId)}</code>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Log de mensajes (debug) */}
      <Card className="bg-slate-900/60 border-slate-800 p-5">
        <h3 className="text-sm font-semibold text-slate-100 mb-3 flex items-center gap-2">
          <Radio className="w-4 h-4 text-emerald-400" />
          Actividad de la red ({messages.length})
        </h3>
        <div className="space-y-1 max-h-64 overflow-y-auto font-mono text-[10px]">
          {messages.length === 0 ? (
            <p className="text-slate-500 text-center py-4">
              {node ? "Esperando mensajes…" : "Inicie el nodo"}
            </p>
          ) : (
            messages.slice(-20).reverse().map((m, i) => (
              <div key={i} className="flex items-start gap-2 p-1.5 rounded hover:bg-slate-950">
                <Badge
                  variant="outline"
                  className="text-[9px] py-0 px-1 bg-slate-900 border-slate-700 text-slate-400 shrink-0"
                >
                  {m.type}
                </Badge>
                <span className="text-slate-400">
                  <span className="text-emerald-400">{m.alias}</span>{" "}
                  {m.type === "offer" ? "publicó oferta" : "anunció presencia"}
                </span>
                <span className="text-slate-600 ml-auto">
                  {timeAgo(new Date(m.timestamp))}
                </span>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Info */}
      <Card className="bg-slate-900/60 border-slate-800 p-5">
        <h3 className="text-sm font-semibold text-slate-100 mb-2">
          ¿Por qué red P2P sin servidor?
        </h3>
        <div className="grid md:grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded bg-slate-950 border border-slate-800">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 mb-1" />
            <div className="text-slate-200 font-medium mb-1">Censura-resistente</div>
            <p className="text-slate-500">
              Sin servidor central que pueda ser cerrado o censurado. Como Bisq,
              la red sigue funcionando mientras haya pares.
            </p>
          </div>
          <div className="p-3 rounded bg-slate-950 border border-slate-800">
            <Network className="w-4 h-4 text-cyan-400 mb-1" />
            <div className="text-slate-200 font-medium mb-1">Descubrimiento real</div>
            <p className="text-slate-500">
              Las ofertas viajan por GossipSub (libp2p). Cada nodo las propaga
              a sus pares, alcanzando toda la red.
            </p>
          </div>
        </div>
        <div className="mt-3 p-3 rounded bg-amber-950/20 border border-amber-900/40 text-xs text-amber-200/90">
          <strong>Stack técnico:</strong> libp2p + WebSockets + Noise (encryption)
          + mplex (muxing) + GossipSub (pubsub) + Bootstrap (discovery).
          Cada nodo tiene un PeerID único derivado de su clave Ed25519.
        </div>
      </Card>
    </div>
  );
}
