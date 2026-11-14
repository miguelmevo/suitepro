import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.0";
import { colorPrimarioHex } from "../_shared/colores-congregacion.ts";
import { ASUNTO_PROTECCION_DATOS, htmlCorreoProteccionDatos } from "../_shared/correo-proteccion-datos.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET");
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const BASE_URL = SUPABASE_URL.includes("sfgnveuwitsaiflqjdsc") ? "https://dev.suitepro.org" : "https://suitepro.org";

const CLAVE = "aviso_proteccion_datos_2026";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

// Envía el aviso de la Ley 21.719 desde noreply@suitepro.org a las personas con
// CUENTA (no a participantes sin cuenta), una vez por usuario (tabla
// comunicaciones_enviadas), con el color de su congregación.
//
// Por defecto NO envía: devuelve la lista de destinatarios (simulación).
// Para enviar hay que pasar { "confirmar": true }. Filtros opcionales:
//   congregacionIds: string[]   solo esas congregaciones
//   emails: string[]            solo esas direcciones (útil para pruebas)
//   limite: number              máximo por ejecución (por defecto 100)
serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", ...corsHeaders } });

  try {
    if (!CRON_SECRET || req.headers.get("x-cron-secret") !== CRON_SECRET) {
      return json({ error: "unauthorized" }, 401);
    }
    const { confirmar = false, congregacionIds, emails, limite = 100 } = await req.json().catch(() => ({}));

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    let q = sb.from("usuarios_congregacion").select("user_id, congregacion_id").eq("activo", true);
    if (Array.isArray(congregacionIds) && congregacionIds.length > 0) q = q.in("congregacion_id", congregacionIds);
    const { data: membresias } = await q;

    // Un correo por persona (su primera membresía activa).
    const congPorUsuario = new Map<string, string>();
    for (const m of membresias ?? []) if (!congPorUsuario.has(m.user_id)) congPorUsuario.set(m.user_id, m.congregacion_id);
    const userIds = Array.from(congPorUsuario.keys());
    if (userIds.length === 0) return json({ confirmar, destinatarios: 0, enviados: 0 });

    const [{ data: perfiles }, { data: supers }, { data: yaEnviados }, { data: congs }] = await Promise.all([
      sb.from("profiles").select("id, email, nombre, apellido").in("id", userIds),
      sb.from("user_roles").select("user_id").eq("role", "super_admin").in("user_id", userIds),
      sb.from("comunicaciones_enviadas").select("user_id").eq("clave", CLAVE).in("user_id", userIds),
      sb.from("congregaciones").select("id, nombre, color_primario").in("id", Array.from(new Set(congPorUsuario.values()))),
    ]);
    const excluidos = new Set([...(supers ?? []).map((r) => r.user_id), ...(yaEnviados ?? []).map((r) => r.user_id)]);
    const congPorId = new Map((congs ?? []).map((c) => [c.id, c]));
    const filtroEmails = Array.isArray(emails) && emails.length > 0 ? new Set(emails.map((e: string) => e.toLowerCase())) : null;

    const destinatarios = (perfiles ?? [])
      .filter((p) => p.email && !excluidos.has(p.id) && (!filtroEmails || filtroEmails.has(String(p.email).toLowerCase())))
      .map((p) => {
        const c = congPorId.get(congPorUsuario.get(p.id) as string);
        return {
          id: p.id as string,
          email: p.email as string,
          nombre: (p.nombre ?? "").trim(),
          congregacion: c?.nombre ?? "su congregación",
          color: colorPrimarioHex(c?.color_primario),
        };
      })
      .slice(0, Math.max(1, Number(limite) || 100));

    if (!confirmar) {
      return json({
        confirmar: false,
        mensaje: "Simulación: no se envió nada. Pasa {\"confirmar\": true} para enviar.",
        asunto: ASUNTO_PROTECCION_DATOS,
        destinatarios: destinatarios.length,
        lista: destinatarios.map((d) => ({ email: d.email, nombre: d.nombre, congregacion: d.congregacion })),
      });
    }
    if (!RESEND_API_KEY) return json({ error: "resend_no_configurado" }, 500);

    let enviados = 0;
    const errores: string[] = [];
    for (const d of destinatarios) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({
          from: "SuitePro <noreply@suitepro.org>",
          to: [d.email],
          subject: ASUNTO_PROTECCION_DATOS,
          html: htmlCorreoProteccionDatos({ nombre: d.nombre, congregacion: d.congregacion, color: d.color, url: BASE_URL }),
        }),
      });
      if (res.ok) {
        enviados++;
        await sb.from("comunicaciones_enviadas").upsert({ user_id: d.id, clave: CLAVE }, { onConflict: "user_id,clave" });
      } else {
        errores.push(`${d.email}: ${(await res.text()).slice(0, 120)}`);
      }
      // Resend limita la tasa de envío: se espacian los correos.
      await new Promise((r) => setTimeout(r, 600));
    }
    return json({ confirmar: true, destinatarios: destinatarios.length, enviados, errores });
  } catch (error: any) {
    console.error("[enviar-aviso-proteccion-datos]", error);
    return json({ error: error?.message ?? "unknown_error" }, 500);
  }
});
