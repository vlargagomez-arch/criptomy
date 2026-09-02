"use client";

import { useEffect, useState, useCallback } from "react";
import { useApp } from "@/lib/store";

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  url: string | null;
  metadata: string | null;
  read: boolean;
  createdAt: string;
}

// Hook que maneja:
// 1) Registro del service worker
// 2) Suscripción Web Push
// 3) Polling de notificaciones in-app (cada 30s)
// 4) Marcar como leídas
export function useNotifications() {
  const { user } = useApp();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  // 1) Registrar service worker
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    setPushSupported(
      "PushManager" in window && "Notification" in window
    );

    navigator.serviceWorker
      .register("/sw.js")
      .then(() => {
        console.log("[sw] registrado");
      })
      .catch((e) => console.warn("[sw] register failed:", e));
  }, []);

  // 2) Cargar notificaciones cuando hay user
  const load = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/notifications?address=${user.walletAddress}&limit=50`);
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnread(data.unread || 0);
    } catch (e) {
      console.warn("[notifications] load failed:", e);
    }
  }, [user]);

  useEffect(() => {
    load();
    // Polling cada 30s
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  // 3) Suscribir a Web Push
  const subscribePush = useCallback(async () => {
    if (!user || !pushSupported) return false;

    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return false;

      const reg = await navigator.serviceWorker.ready;
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        console.error("[push] VAPID public key no configurada");
        return false;
      }

      // Convertir VAPID key base64 a Uint8Array
      const applicationServerKey = urlBase64ToUint8Array(vapidKey);

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });

      const sub = subscription.toJSON();
      if (!sub.keys?.p256dh || !sub.keys?.auth || !sub.endpoint) {
        return false;
      }

      const res = await fetch("/api/notifications/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: user.walletAddress,
          subscription: {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
          },
        }),
      });

      if (res.ok) {
        setPushSubscribed(true);
        return true;
      }
      return false;
    } catch (e) {
      console.error("[push] subscribe failed:", e);
      return false;
    }
  }, [user, pushSupported]);

  // Verificar si ya está suscrito al cargar
  useEffect(() => {
    if (!user || !pushSupported) return;
    (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setPushSubscribed(!!sub);
      } catch (e) {
        // ignore
      }
    })();
  }, [user, pushSupported]);

  // 4) Marcar como leídas
  const markAllRead = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: user.walletAddress, op: "mark-read", all: true }),
      });
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read: true }))
      );
      setUnread(0);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const markRead = useCallback(async (id: string) => {
    if (!user) return;
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: user.walletAddress, op: "mark-read", ids: [id] }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      setUnread((u) => Math.max(0, u - 1));
    } catch (e) {
      // ignore
    }
  }, [user]);

  return {
    notifications,
    unread,
    pushSupported,
    pushSubscribed,
    loading,
    load,
    subscribePush,
    markAllRead,
    markRead,
  };
}

// Convierte base64url a Uint8Array (para VAPID key)
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}
