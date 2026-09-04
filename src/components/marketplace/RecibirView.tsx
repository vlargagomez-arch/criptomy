"use client";

import { useState } from "react";
import { useApp } from "@/lib/store";
import { Download, Copy, Check, AlertTriangle, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

const NETWORKS = [
  { id: "ETHEREUM", name: "Ethereum", symbol: "ETH" },
  { id: "POLYGON", name: "Polygon", symbol: "MATIC" },
  { id: "BSC", name: "BNB Chain", symbol: "BNB" },
  { id: "BASE", name: "Base", symbol: "ETH" },
  { id: "ARBITRUM", name: "Arbitrum", symbol: "ETH" },
];

export default function RecibirView() {
  const { user } = useApp();
  const [networkId, setNetworkId] = useState("POLYGON");
  const [copied, setCopied] = useState(false);

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 text-center text-slate-400 text-sm">
        Conecta tu wallet para ver tu dirección de recepción.
      </div>
    );
  }

  const network = NETWORKS.find((n) => n.id === networkId)!;
  const address = user.walletAddress;
  const qrValue = `${address}`;

  const copy = () => {
    navigator.clipboard?.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 pb-6">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        {/* Selector de red */}
        <div className="mb-4">
          <label className="text-[11px] text-slate-400">Red de recepción</label>
          <select
            value={networkId}
            onChange={(e) => setNetworkId(e.target.value)}
            className="mt-1 w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 text-sm"
          >
            {NETWORKS.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name} ({n.symbol})
              </option>
            ))}
          </select>
        </div>

        {/* QR */}
        <div className="flex flex-col items-center mb-6">
          <div className="bg-white p-4 rounded-xl">
            <QRCodeSVG
              value={qrValue}
              size={200}
              level="M"
              includeMargin={false}
            />
          </div>
          <p className="text-xs text-slate-400 mt-3">
            Escanea este QR para recibir en {network.name}
          </p>
        </div>

        {/* Dirección */}
        <div className="bg-slate-800 rounded-lg p-3">
          <div className="text-[11px] text-slate-400 mb-1">Tu dirección</div>
          <div className="flex items-center gap-2">
            <code className="text-xs font-mono text-slate-100 break-all flex-1">
              {address}
            </code>
            <button
              onClick={copy}
              className="shrink-0 p-2 bg-slate-700 hover:bg-slate-600 rounded text-slate-200"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Warning */}
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
    </div>
  );
}
