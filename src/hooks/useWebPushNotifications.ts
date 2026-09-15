import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export type EstadoWebPush = "no-soportado" | "nativo" | "denegado" | "inactivo" | "activo";

/**
 * Suscripción a Web Push del navegador (Chrome/Edge/Firefox/Safari-PWA-
 * instalada). No pide permiso solo — Safari en iOS y Chrome modernos
 * ignoran o bloquean el permiso si no viene de un clic real del usuario,
 * así que `activar()` debe llamarse desde el handler de un botón.
 */
export function useWebPushNotifications(userId: string | undefined) {
  const [estado, setEstado] = useState<EstadoWebPush>("inactivo");
  const [activando, setActivando] = useState(false);

  const soportado = "serviceWorker" in navigator && "PushManager" in window;

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      setEstado("nativo");
      return;
    }
    if (!soportado) {
      setEstado("no-soportado");
      return;
    }
    if (Notification.permission === "denied") {
      setEstado("denegado");
      return;
    }

    navigator.serviceWorker.ready.then(async (registration) => {
      const subscription = await registration.pushManager.getSubscription();
      setEstado(subscription ? "activo" : "inactivo");
    });
  }, [soportado]);

  const activar = async (): Promise<{ ok: boolean; error?: string }> => {
    if (!userId) return { ok: false, error: "Debes iniciar sesión" };
    if (!soportado) return { ok: false, error: "Este navegador no soporta notificaciones" };

    setActivando(true);
    try {
      let permiso = Notification.permission;
      if (permiso === "default") {
        permiso = await Notification.requestPermission();
      }
      if (permiso !== "granted") {
        setEstado("denegado");
        return { ok: false, error: "No diste permiso de notificaciones" };
      }

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        const { data, error } = await supabase.functions.invoke("obtener-vapid-public-key");
        if (error || !data?.publicKey) {
          return { ok: false, error: "No se pudo obtener la clave del servidor" };
        }

        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(data.publicKey),
        });
      }

      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        return { ok: false, error: "La suscripción del navegador vino incompleta" };
      }

      const { error: dbError } = await supabase.from("web_push_subscriptions").upsert(
        {
          user_id: userId,
          endpoint: json.endpoint,
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
        },
        { onConflict: "endpoint" }
      );
      if (dbError) return { ok: false, error: dbError.message };

      setEstado("activo");
      return { ok: true };
    } catch (err: any) {
      console.error("[web-push] Error al activar:", err);
      return { ok: false, error: err?.message ?? "Error desconocido" };
    } finally {
      setActivando(false);
    }
  };

  return { estado, activando, activar };
}
