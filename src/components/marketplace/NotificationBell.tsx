"use client";

import { useState, useRef, useEffect } from "react";
import { Bell } from "lucide-react";
import { useNotifications } from "@/lib/use-notifications";
import { useApp } from "@/lib/store";

function timeAgo(dateStr: string): string {
  const sec = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (sec < 60) return "ahora";
  if (sec < 3600) return `hace ${Math.floor(sec / 60)} min`;
  if (sec < 86400) return `hace ${Math.floor(sec / 3600)} h`;
  return `hace ${Math.floor(sec / 86400)} días`;
}

const TYPE_ICON: Record<string, string> = {
  PRICE_ALERT: "🎯",
  NEW_OFFER: "🆕",
  TRADE_UPDATE: "🔄",
  CHALLENGE_NEW: "🎮",
  NFT_SOLD: "🎉",
  NFT_BOUGHT: "🎨",
  DIP_ALERT: "📉",
  NFT_DROP: "🚀",
};

export default function NotificationBell() {
  const { user, setTab } = useApp();
  const { notifications, unread, pushSupported, pushSubscribed, markAllRead, markRead, subscribePush } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!user) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-lg hover:bg-slate-800 transition"
        aria-label="Notificaciones"
      >
        <Bell className="w-4 h-4 text-slate-300" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
            <div className="text-sm font-semibold text-slate-100">
              Notificaciones
              {unread > 0 && (
                <span className="ml-2 text-xs text-emerald-400">{unread} sin leer</span>
              )}
            </div>
            <div className="flex gap-2">
              {pushSupported && !pushSubscribed && (
                <button
                  onClick={() => subscribePush()}
                  className="text-[11px] px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  Activar push
                </button>
              )}
              {pushSupported && pushSubscribed && (
                <span className="text-[11px] text-emerald-400">Push ON</span>
              )}
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-[11px] text-slate-400 hover:text-slate-100"
                >
                  Marcar todo leído
                </button>
              )}
            </div>
          </div>

          {/* Lista */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-xs">
                <Bell className="w-6 h-6 mx-auto mb-2 opacity-40" />
                No tienes notificaciones todavía.
                <br />
                Te avisaremos cuando:
                <ul className="mt-2 text-left text-[11px] space-y-1 mx-auto max-w-[260px]">
                  <li>• Alguien publique una oferta a tu precio objetivo</li>
                  <li>• Alguien acepte tu trade o te envíe un mensaje</li>
                  <li>• Se cree un nuevo reto en tu juego favorito</li>
                  <li>• BTC/ETH caiga más de X% (alerta dip)</li>
                  <li>• Se venda o compre un NFT tuyo</li>
                </ul>
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => {
                    markRead(n.id);
                    if (n.url) {
                      const tab = new URLSearchParams(n.url.split("?")[1] || "").get("tab");
                      if (tab) setTab(tab as never);
                    }
                    setOpen(false);
                  }}
                  className={`w-full text-left px-4 py-3 border-b border-slate-800 hover:bg-slate-800 transition flex gap-3 ${
                    !n.read ? "bg-emerald-950/30" : ""
                  }`}
                >
                  <div className="text-xl shrink-0">{TYPE_ICON[n.type] || "🔔"}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-slate-100 truncate">
                      {n.title}
                    </div>
                    <div className="text-[11px] text-slate-400 line-clamp-2">
                      {n.body}
                    </div>
                    <div className="text-[10px] text-slate-600 mt-1">
                      {timeAgo(n.createdAt)}
                      {!n.read && <span className="ml-2 text-emerald-400">• Nuevo</span>}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-slate-800 text-center">
            <button
              onClick={() => {
                setTab("alertas");
                setOpen(false);
              }}
              className="text-[11px] text-emerald-400 hover:text-emerald-300"
            >
              Configurar alertas de precio →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
