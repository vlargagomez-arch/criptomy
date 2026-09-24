"use client";

import { useState } from "react";
import { useApp } from "@/lib/store";
import {
  Download, Copy, Check, AlertTriangle, QrCode, Eye, EyeOff,
  Shield, Lock, Zap,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

const NETWORKS = [
  { id: "ETHEREUM", name: "Ethereum", symbol: "ETH", color: "#627EEA" },
  { id: "POLYGON", name: "Polygon", symbol: "MATIC", color: "#8247E5" },
  { id: "BSC", name: "BNB Chain", symbol: "BNB", color: "#F0B90B" },
  { id: "BASE", name: "Base", symbol: "ETH", color: "#0052FF" },
  { id: "ARBITRUM", name: "Arbitrum", symbol: "ETH", color: "#28A0F0" },
];

// ============================================================
// RecibirView — Anónimo, sin KYC, sin pedir datos.
// ============================================================
// Solo: tu dirección + QR. Un enlace copiable tipo "URL"
// que puedes compartir sin exponer información personal.
//
// Opcional: nota pública para que el remitente sepa quién eres,
// pero jamás se almacena ni se pide email/nombre/teléfono.
// ============================================================
export default function RecibirView() {
  const { user } = useApp();
  const [networkId, setNetworkId] = useState("POLYGON");
  const [copied, setCopied] = useState(false);
  const [showFull, setShowFull] = useState(false);
  const [note, setNote] = useState("");

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 text-center">
        <Lock className="w-10 h-10 mx-auto text-slate-600 mb-3" />
        <p className="text-sm text-slate-300 font-medium">Conecta tu wallet para recibir</p>
        <p className="text-xs text-slate-500 mt-1">
          No pedimos email, nombre ni teléfono. Tu wallet es tu identidad.
        </p>
      </div>
    );
  }

  const network = NETWORKS.find((n) => n.id === networkId)!;
  const address = user.walletAddress;
  // Formato EIP-681 simplificado (sólo la dirección, sin pedir amount)
  const qrValue = `ethereum:${address}@${networkId.toLowerCase()}`;
  // "URL pública" para compartir en chats / redes
  const shortAddr = `${address.slice(0, 8)}…${address.slice(-6)}`;
  const shareUrl = `https://criptomy.vercel.app/pay/${address}`;

  const copy = (text: string, what?: string) => {
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 pb-6 space-y-4">
      {/* Banner anónimo */}
      <div className="bg-emerald-950/20 border border-emerald-700/30 rounded-lg p-3 text-[11px] text-emerald-300 flex items-center gap-2">
        <Shield className="w-3.5 h-3.5 shrink-0" />
        <span>
          <b>Recepción anónima.</b> No pedimos datos personales. Tu dirección on-chain es tu identidad pública.
        </span>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        {/* Selector de red */}
        <div className="mb-4">
          <label className="text-[11px] text-slate-400 uppercase font-semibold">Red de recepción</label>
          <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {NETWORKS.map((n) => (
              <button
                key={n.id}
                onClick={() => setNetworkId(n.id)}
                className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-[11px] transition border ${
                  networkId === n.id
                    ? "bg-slate-800 border-slate-600 text-slate-100"
                    : "bg-slate-950/50 border-slate-800 text-slate-400 hover:border-slate-700"
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: n.color }}
                />
                <span className="font-medium">{n.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* QR */}
        <div className="flex flex-col items-center mb-6">
          <div className="bg-white p-4 rounded-xl">
            <QRCodeSVG value={qrValue} size={200} level="M" includeMargin={false} />
          </div>
          <p className="text-xs text-slate-400 mt-3 text-center">
            Escanea este QR para recibir en <b className="text-slate-200">{network.name}</b>
          </p>
        </div>

        {/* Dirección + toggle para ver completo */}
        <div className="bg-slate-950/60 rounded-lg p-3 mb-3">
          <div className="flex items-center justify-between mb-1">
            <div className="text-[10px] text-slate-500 uppercase font-semibold">Tu dirección</div>
            <button
              onClick={() => setShowFull(!showFull)}
              className="text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-1"
            >
              {showFull ? <><EyeOff className="w-3 h-3" /> Acortar</> : <><Eye className="w-3 h-3" /> Ver completa</>}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <code className={`text-xs font-mono text-slate-100 break-all flex-1 ${showFull ? "" : "truncate"}`}>
              {showFull ? address : shortAddr}
            </code>
            <button
              onClick={() => copy(address)}
              className="shrink-0 p-2 bg-slate-700 hover:bg-slate-600 rounded text-slate-200 transition"
              title="Copiar dirección"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* URL pública compartible */}
        <div className="bg-slate-950/40 rounded-lg p-3 mb-3">
          <div className="text-[10px] text-slate-500 uppercase font-semibold mb-1">Enlace público (URL)</div>
          <div className="flex items-center gap-2">
            <code className="text-xs font-mono text-blue-300 truncate flex-1">{shareUrl}</code>
            <button
              onClick={() => copy(shareUrl)}
              className="shrink-0 p-2 bg-slate-700 hover:bg-slate-600 rounded text-slate-200 transition"
              title="Copiar enlace"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[10px] text-slate-500 mt-1.5">
            Pega este enlace en cualquier chat o red social. No revela datos personales, solo tu dirección on-chain.
          </p>
        </div>

        {/* Nota opcional (NO se guarda, solo se incluye en el enlace si se quiere) */}
        <div className="bg-slate-950/40 rounded-lg p-3">
          <label className="text-[10px] text-slate-500 uppercase font-semibold">
            Alias público (opcional, no se almacena)
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 30))}
            placeholder="Ej: @satoshi_col"
            maxLength={30}
            className="mt-1 w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 text-sm focus:outline-none focus:border-emerald-500"
          />
          <p className="text-[10px] text-slate-500 mt-1">
            Solo se muestra en tu QR si lo activas. No se guarda en nuestros servidores.
          </p>
        </div>

        {/* Warning mínimo */}
        <div className="mt-4 bg-amber-950/30 border border-amber-800/50 rounded p-3 text-xs text-amber-300 flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <b>Importante:</b>
            <ul className="list-disc ml-4 mt-1 space-y-0.5">
              <li>Envía únicamente activos compatibles con <b>{network.name}</b>.</li>
              <li>Enviar tokens de otra red a esta dirección puede causar pérdida permanente.</li>
              <li>Verifica la red con el remitente antes de cada transferencia.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Quick info: privacidad */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100">Privacidad por diseño</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              No solicitamos email, nombre, teléfono ni país para recibir cripto. Tu dirección on-chain
              funciona como identidad pública. Para mayor privacidad usa wallets nuevas para cada operación
              y considera Monero (XMR) para transacciones sensibles.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
