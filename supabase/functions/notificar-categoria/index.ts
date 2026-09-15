import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.0";
import { enviarPushFcm } from "../_shared/fcm.ts";
import { enviarWebPush } from "../_shared/webpush.ts";
import { enviarNotificacionPorEmail } from "../_shared/notificacion-email.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET");
const BASE_URL = SUPABASE_URL.includes("sfgnveuwitsaiflqjdsc") ? "https://dev.suitepro.org" : "https://suitepro.org";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

type Categoria = "predicacion" | "vida_ministerio" | "servicio" | "eventos";

interface NotificarRequest {
  userIds?: string[];
  congregacionId?: string;
  categoria: Categoria;
  title: string;
  body: string;
  data?: Record<string, string>;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Esta función solo la llaman triggers de base de datos / cron interno,
    // no el cliente directamente: se protege con un secret compartido.
    const secretRecibido = req.headers.get("x-cron-secret");
    if (CRON_SECRET && secretRecibido !== CRON_SECRET) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const body: NotificarRequest = await req.json();
    const { categoria, title, data } = body;
    const notificationBody = body.body;

    if (!categoria || !title || !notificationBody) {
      return new Response(JSON.stringify({ error: "missing_params" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    let userIds = body.userIds ?? [];

    if (userIds.length === 0 && body.congregacionId) {
      const { data: miembros } = await serviceClient
        .from("usuarios_congregacion")
        .select("user_id")
        .eq("congregacion_id", body.congregacionId)
        .eq("activo", true);
      userIds = (miembros ?? []).map((m) => m.user_id);
    }

    if (userIds.length === 0) {
      return new Response(JSON.stringify({ enviados: 0, motivo: "sin_destinatarios" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Excluir a quienes desactivaron esta categoría (por defecto, activa).
    const { data: preferenciasDesactivadas } = await serviceClient
      .from("notificacion_preferencias")
      .select("user_id")
      .eq("categoria", categoria)
      .eq("activo", false)
      .in("user_id", userIds);

    const excluidos = new Set((preferenciasDesactivadas ?? []).map((p) => p.user_id));
    const destinatarios = userIds.filter((id) => !excluidos.has(id));

    if (destinatarios.length === 0) {
      return new Response(JSON.stringify({ enviados: 0, motivo: "todos_desactivaron_categoria" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const [{ data: tokens }, { data: webSubs }] = await Promise.all([
      serviceClient.from("device_tokens").select("user_id, token").in("user_id", destinatarios),
      serviceClient
        .from("web_push_subscriptions")
        .select("user_id, endpoint, p256dh, auth")
        .in("user_id", destinatarios),
    ]);

    const resultadoFcm = await enviarPushFcm(
      (tokens ?? []).map((t) => t.token),
      { title, body: notificationBody },
      data
    );

    const resultadoWebPush = await enviarWebPush(webSubs ?? [], {
      title,
      body: notificationBody,
      url: BASE_URL,
    });

    if (resultadoWebPush.expirados.length > 0) {
      await serviceClient.from("web_push_subscriptions").delete().in("endpoint", resultadoWebPush.expirados);
    }

    // Correo de respaldo solo para quien no tiene ni app nativa ni Web Push.
    const conCanalPush = new Set([
      ...(tokens ?? []).map((t) => t.user_id),
      ...(webSubs ?? []).map((s) => s.user_id),
    ]);
    const sinCanalPush = destinatarios.filter((id) => !conCanalPush.has(id));

    let resultadoEmail = { configured: false, enviados: 0 };
    if (sinCanalPush.length > 0) {
      const { data: perfiles } = await serviceClient
        .from("profiles")
        .select("email")
        .in("id", sinCanalPush)
        .not("email", "is", null);
      resultadoEmail = await enviarNotificacionPorEmail(
        (perfiles ?? []).map((p) => p.email as string),
        { title, body: notificationBody, url: BASE_URL }
      );
    }

    return new Response(
      JSON.stringify({
        destinatarios: destinatarios.length,
        fcm: resultadoFcm,
        webPush: resultadoWebPush,
        email: resultadoEmail,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("[notificar-categoria] Error:", error);
    return new Response(JSON.stringify({ error: error?.message ?? "unknown_error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
