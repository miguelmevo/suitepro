import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { supabase } from "@/integrations/supabase/client";

/**
 * Registra el dispositivo para notificaciones push (solo dentro de la app
 * nativa Capacitor; en navegador no hace nada). Pide permiso, obtiene el
 * token FCM/APNs y lo guarda en device_tokens ligado al usuario logueado.
 */
export function usePushNotifications(userId: string | undefined) {
  useEffect(() => {
    if (!userId || !Capacitor.isNativePlatform()) return;

    let cancelado = false;

    const registrar = async () => {
      const permiso = await PushNotifications.checkPermissions();
      let estado = permiso.receive;
      if (estado === "prompt") {
        const solicitado = await PushNotifications.requestPermissions();
        estado = solicitado.receive;
      }
      if (estado !== "granted" || cancelado) return;
      await PushNotifications.register();
    };

    const onRegistration = PushNotifications.addListener("registration", async (token) => {
      if (cancelado) return;
      await supabase.from("device_tokens").upsert(
        {
          user_id: userId,
          token: token.value,
          plataforma: Capacitor.getPlatform() as "ios" | "android",
        },
        { onConflict: "token" }
      );
    });

    const onError = PushNotifications.addListener("registrationError", (err) => {
      console.error("[push] Error de registro:", err);
    });

    registrar();

    return () => {
      cancelado = true;
      onRegistration.then((h) => h.remove());
      onError.then((h) => h.remove());
    };
  }, [userId]);
}
