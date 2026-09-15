import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

/**
 * Suscribe al navegador a Web Push (solo fuera de la app nativa Capacitor,
 * y solo si el navegador lo soporta — Safari en iOS únicamente si la PWA
 * está instalada en la pantalla de inicio). Pide permiso, se suscribe con
 * la clave pública VAPID del proyecto, y guarda la suscripción en
 * web_push_subscriptions ligada al usuario logueado.
 */
export function useWebPushNotifications(userId: string | undefined) {
  useEffect(() => {
    if (!userId || Capacitor.isNativePlatform()) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    let cancelado = false;

    const suscribir = async () => {
      let permiso = Notification.permission;
      if (permiso === "default") {
        permiso = await Notification.requestPermission();
      }
      if (permiso !== "granted" || cancelado) return;

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        const { data } = await supabase.functions.invoke("obtener-vapid-public-key");
        const publicKey = data?.publicKey;
        if (!publicKey) return;

        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      }

      if (cancelado) return;
      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return;

      await supabase.from("web_push_subscriptions").upsert(
        {
          user_id: userId,
          endpoint: json.endpoint,
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
        },
        { onConflict: "endpoint" }
      );
    };

    suscribir().catch((err) => console.error("[web-push] Error al suscribir:", err));

    return () => {
      cancelado = true;
    };
  }, [userId]);
}
