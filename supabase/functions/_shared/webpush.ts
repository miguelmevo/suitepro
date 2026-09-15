// Envío de Web Push (Chrome/Edge/Firefox/Safari-PWA-instalada) usando VAPID.
// Usa el paquete npm "web-push" vía especificador npm: (soportado en Deno /
// Supabase Edge Functions), que maneja el cifrado RFC8291 por nosotros.
import webpush from "npm:web-push@3.6.7";

export interface WebPushSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export async function enviarWebPush(
  subs: WebPushSubscription[],
  notification: { title: string; body: string; url?: string }
): Promise<{ configured: boolean; enviados: number; fallidos: number; expirados: string[] }> {
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const subject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:soporte@suitepro.org";

  if (!publicKey || !privateKey || subs.length === 0) {
    return { configured: !!(publicKey && privateKey), enviados: 0, fallidos: 0, expirados: [] };
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);

  let enviados = 0;
  let fallidos = 0;
  const expirados: string[] = [];

  const payload = JSON.stringify({
    title: notification.title,
    body: notification.body,
    url: notification.url ?? "/",
  });

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      );
      enviados++;
    } catch (error: any) {
      fallidos++;
      // 404/410: la suscripción ya no existe (el usuario desinstaló, borró
      // datos del sitio, etc.) — se limpia para no seguir intentando.
      if (error?.statusCode === 404 || error?.statusCode === 410) {
        expirados.push(sub.endpoint);
      } else {
        console.error("[webpush] Error enviando:", error?.message ?? error);
      }
    }
  }

  return { configured: true, enviados, fallidos, expirados };
}
