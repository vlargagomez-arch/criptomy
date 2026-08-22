"use client";

import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, Lock, Send, ShieldAlert } from "lucide-react";
import { encryptMessage, decryptMessage } from "@/lib/crypto";
import { avatarGradient, timeAgo } from "@/lib/format";

interface ChatMessage {
  id: string;
  ciphertext: string;
  nonce: string;
  createdAt: string;
  sender: {
    id: string;
    alias: string;
    avatarSeed: string | null;
    publicKey?: string | null;
  };
}

interface Props {
  tradeId: string;
  currentUserId: string;
  counterpartPublicKey: string | null | undefined;
  myPrivateKey: string | null;
}

export default function TradeChat({
  tradeId,
  currentUserId,
  counterpartPublicKey,
  myPrivateKey,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [decrypted, setDecrypted] = useState<Record<string, string>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [tradeId]);

  // Descifrar mensajes nuevos
  useEffect(() => {
    async function decryptAll() {
      if (!myPrivateKey) return;
      const newDecrypted: Record<string, string> = {};
      for (const m of messages) {
        if (decrypted[m.id]) continue;
        if (m.sender.id === currentUserId) continue; // los propios ya están en claro
        if (!m.sender.publicKey) continue;
        try {
          // Soporta dos formatos: {ciphertext, nonce} JSON o campos separados
          let ct = m.ciphertext;
          let nc = m.nonce;
          if (m.ciphertext.startsWith("{")) {
            const parsed = JSON.parse(m.ciphertext);
            ct = parsed.ciphertext;
            nc = parsed.nonce;
          }
          const pt = await decryptMessage(
            ct,
            nc,
            m.sender.publicKey,
            myPrivateKey
          );
          newDecrypted[m.id] = pt;
        } catch (e) {
          newDecrypted[m.id] = "[No se pudo descifrar]";
        }
      }
      if (Object.keys(newDecrypted).length > 0) {
        setDecrypted((prev) => ({ ...prev, ...newDecrypted }));
      }
    }
    decryptAll();
  }, [messages, myPrivateKey, currentUserId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function fetchMessages() {
    try {
      const res = await fetch(`/api/trades/${tradeId}/messages`);
      const data = await res.json();
      setMessages(data.messages || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleSend() {
    if (!input.trim() || !counterpartPublicKey || !myPrivateKey) return;
    setSending(true);
    try {
      const enc = await encryptMessage(
        input,
        counterpartPublicKey,
        myPrivateKey
      );
      const res = await fetch(`/api/trades/${tradeId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderId: currentUserId,
          ciphertext: enc.ciphertext,
          nonce: enc.nonce,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setInput("");
      await fetchMessages();
    } catch (e) {
      alert("Error al enviar: " + (e as Error).message);
    } finally {
      setSending(false);
    }
  }

  const canChat = !!counterpartPublicKey && !!myPrivateKey;

  return (
    <div className="flex flex-col h-[500px] border border-slate-800 rounded-lg overflow-hidden bg-slate-950">
      {/* Header */}
      <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between bg-slate-900">
        <div className="flex items-center gap-2 text-xs text-emerald-400">
          <Lock className="w-3 h-3" />
          Mensajes cifrados E2E (ECDH + AES-GCM-256)
        </div>
        <div className="text-[10px] text-slate-500">
          Auto-refresh 3s
        </div>
      </div>

      {!canChat && (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center max-w-xs">
            <ShieldAlert className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
            <p className="text-sm text-slate-300">
              No se puede cifrar el chat
            </p>
            <p className="text-xs text-slate-500 mt-1">
              La contraparte no publicó su clave pública ECDH, o usted no tiene
              su clave privada en este navegador.
            </p>
          </div>
        </div>
      )}

      {/* Mensajes */}
      {canChat && (
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center text-xs text-slate-500 py-8">
              Aún no hay mensajes. Empiece la conversación.
            </div>
          ) : (
            messages.map((m) => {
              const mine = m.sender.id === currentUserId;
              const text = mine
                ? // Para mis propios mensajes tendríamos que re-cifrar para mostrar;
                  // en MVP simplificado, mostramos como "enviado" si no podemos descifrar
                  decrypted[m.id] || "[mensaje cifrado enviado]"
                : decrypted[m.id] || "[descifrando…]";
              return (
                <div
                  key={m.id}
                  className={`flex gap-2 ${
                    mine ? "flex-row-reverse" : "flex-row"
                  }`}
                >
                  <Avatar
                    className={`w-6 h-6 shrink-0 bg-gradient-to-br ${avatarGradient(m.sender.avatarSeed)}`}
                  >
                    <AvatarFallback className="bg-transparent text-white text-[9px]">
                      {m.sender.alias.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div
                    className={`max-w-[70%] rounded-lg px-3 py-2 ${
                      mine
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-800 text-slate-100"
                    }`}
                  >
                    <div className="text-[10px] opacity-70 mb-0.5">
                      {m.sender.alias} · {timeAgo(m.createdAt)}
                    </div>
                    <div className="text-sm break-words">{text}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Input */}
      {canChat && (
        <div className="border-t border-slate-800 p-2 flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Escriba un mensaje…"
            className="bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-600 text-sm"
          />
          <Button
            onClick={handleSend}
            disabled={sending || !input.trim()}
            size="icon"
            className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
          >
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
