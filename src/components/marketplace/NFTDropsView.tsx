"use client";

import { useState, useEffect } from "react";
import { CalendarClock, ExternalLink, Loader2 } from "lucide-react";

interface NFTDrop {
  id: string;
  name: string;
  description: string | null;
  collectionImage: string | null;
  projectWebsite: string | null;
  chain: string;
  contractAddress: string | null;
  dropDate: string;
  mintPrice: number | null;
  priceCurrency: string | null;
  totalSupply: number | null;
  maxPerWallet: number | null;
  status: string;
  verified: boolean;
}

const CHAIN_COLOR: Record<string, string> = {
  polygon: "bg-purple-600",
  base: "bg-blue-600",
  ethereum: "bg-slate-500",
};

function formatDropDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function timeUntil(dateStr: string): string {
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff < 0) return "Ya disponible";
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (days > 0) return `en ${days}d ${hours}h`;
  if (hours > 0) return `en ${hours}h ${mins}m`;
  return `en ${mins}m`;
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  UPCOMING: { label: "Próximamente", color: "bg-amber-600" },
  LIVE: { label: "EN VIVO", color: "bg-emerald-600 animate-pulse" },
  ENDED: { label: "Finalizado", color: "bg-slate-600" },
};

export default function NFTDropsView() {
  const [drops, setDrops] = useState<NFTDrop[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/nft-drops?status=${statusFilter}`);
        if (!res.ok) return;
        const data = await res.json();
        setDrops(data.drops || []);
      } finally {
        setLoading(false);
      }
    })();
  }, [statusFilter]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <CalendarClock className="w-6 h-6 text-emerald-400" />
          Calendario de NFT Drops
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Lanzamientos verificados de colecciones NFT. Sé el primero en mintear.
        </p>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-6">
        {[
          { id: "all", label: "Todos" },
          { id: "UPCOMING", label: "Próximos" },
          { id: "LIVE", label: "En vivo" },
          { id: "ENDED", label: "Finalizados" },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setStatusFilter(f.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
              statusFilter === f.id
                ? "bg-emerald-600 text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
        </div>
      ) : drops.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          <CalendarClock className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No hay drops programados.</p>
          <p className="text-xs mt-1">Vuelve pronto para ver los próximos lanzamientos.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {drops.map((drop) => {
            const status = STATUS_LABEL[drop.status] || STATUS_LABEL.UPCOMING;
            return (
              <div
                key={drop.id}
                className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden hover:border-emerald-600/30 transition"
              >
                {/* Imagen */}
                <div className="aspect-video bg-slate-800 relative">
                  {drop.collectionImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={drop.collectionImage}
                      alt={drop.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <CalendarClock className="w-12 h-12 text-slate-700" />
                    </div>
                  )}
                  <div className="absolute top-2 left-2 px-2 py-1 text-[10px] font-bold rounded bg-black/60 text-white uppercase">
                    {drop.chain}
                  </div>
                  <div className={`absolute top-2 right-2 px-2 py-1 text-[10px] font-bold rounded ${status.color} text-white`}>
                    {status.label}
                  </div>
                </div>

                {/* Datos */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-slate-100">{drop.name}</h3>
                    {drop.verified && (
                      <span className="text-[10px] text-emerald-400 shrink-0">✓ verificado</span>
                    )}
                  </div>
                  {drop.description && (
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">{drop.description}</p>
                  )}

                  {/* Detalles */}
                  <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                    <div>
                      <div className="text-slate-500 text-[10px]">Fecha</div>
                      <div className="text-slate-200">{formatDropDate(drop.dropDate)}</div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-[10px]">Cuenta regresiva</div>
                      <div className="text-emerald-400 font-medium">{timeUntil(drop.dropDate)}</div>
                    </div>
                    {drop.mintPrice !== null && (
                      <div>
                        <div className="text-slate-500 text-[10px]">Mint price</div>
                        <div className="text-slate-200">{drop.mintPrice} {drop.priceCurrency}</div>
                      </div>
                    )}
                    {drop.totalSupply !== null && (
                      <div>
                        <div className="text-slate-500 text-[10px]">Supply</div>
                        <div className="text-slate-200">{drop.totalSupply.toLocaleString()}</div>
                      </div>
                    )}
                    {drop.maxPerWallet !== null && (
                      <div>
                        <div className="text-slate-500 text-[10px]">Max/wallet</div>
                        <div className="text-slate-200">{drop.maxPerWallet}</div>
                      </div>
                    )}
                    {drop.contractAddress && (
                      <div className="col-span-2">
                        <div className="text-slate-500 text-[10px]">Contrato</div>
                        <div className="text-slate-400 font-mono text-[10px] truncate">
                          {drop.contractAddress}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Enlace */}
                  {drop.projectWebsite && (
                    <a
                      href={drop.projectWebsite}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 w-full inline-flex items-center justify-center gap-1 px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded transition"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Visitar proyecto
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
