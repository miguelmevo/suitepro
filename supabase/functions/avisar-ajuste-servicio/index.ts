// Avisa a quien ENTRA a cubrir una asignación de servicio por un "Ajuste para hoy".
// Lo llama el cliente tras guardar el ajuste; se valida la sesión y el permiso, y que
// cada persona avisada figure realmente en los ajustes guardados de esa fecha.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ETIQUETAS: Record<string, string> = {
  audio: "Audio", video: "Video", zoom: "Zoom", plataforma: "Plataforma",
  pasillo_1: "Micrófono de pasillo", pasillo_2: "Micrófono de pasillo",
  acomodador_auditorio: "Acomodador de Auditorio", acomodador_entrada_1: "Acomodador de Entrada", acomodador_entrada_2: "Acomodador de Entrada",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...corsHeaders } });

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "not_authenticated" }, 401);

    const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    const { data: claims, error: claimsError } = await anon.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsError || !claims?.claims) return json({ error: "invalid_token" }, 401);
    const callerId = claims.claims.sub as string;

    const { congregacionId, fecha, entran } = await req.json() as {
      congregacionId: string;
      fecha: string;
      entran: { participanteId: string; tipo: string }[];
    };
    if (!congregacionId || !fecha || !Array.isArray(entran) || entran.length === 0) return json({ enviados: 0 });

    const { data: permitido } = await sb.rpc("has_permission", {
      _user_id: callerId, _congregacion_id: congregacionId, _modulo: "asignaciones_servicio_ajustes", _accion: "ver",
    });
    if (!permitido) return json({ error: "not_authorized" }, 403);

    // Solo se avisa a quien figura en los ajustes guardados de esa fecha
    const { data: guardados } = await sb
      .from("asignaciones_servicio_ajustes")
      .select("tipo_asignacion, participante_id")
      .eq("congregacion_id", congregacionId)
      .eq("fecha", fecha);
    const validos = new Set((guardados ?? []).map((g) => `${g.participante_id}|${g.tipo_asignacion}`));

    const textoFecha = new Intl.DateTimeFormat("es-CL", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })
      .format(new Date(fecha + "T12:00:00Z"));

    let enviados = 0;
    for (const e of entran) {
      if (!validos.has(`${e.participanteId}|${e.tipo}`)) continue;
      const { data: p } = await sb.from("participantes").select("user_id").eq("id", e.participanteId).eq("congregacion_id", congregacionId).maybeSingle();
      if (!p?.user_id) continue;
      const etiqueta = ETIQUETAS[e.tipo] ?? "una asignación de servicio";
      const res = await fetch(`${SUPABASE_URL}/functions/v1/notificar-categoria`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-cron-secret": CRON_SECRET ?? "" },
        body: JSON.stringify({
          userIds: [p.user_id],
          categoria: "servicio",
          title: "Se te asignó un servicio",
          body: `${textoFecha}: ${etiqueta}.`,
          data: { url: "/" },
        }),
      });
      if (res.ok) enviados++;
      else console.error("[avisar-ajuste-servicio] notificar-categoria:", await res.text());
    }
    return json({ enviados });
  } catch (error: any) {
    console.error("[avisar-ajuste-servicio] Error:", error);
    return json({ error: error?.message ?? "unknown_error" }, 500);
  }
});
