import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EXPORT_SECRET = "EXPORT_SECRET_2024";

const TABLES = [
  "congregaciones","participantes","profiles","user_roles","usuarios_congregacion",
  "permisos_usuario_congregacion","grupos_predicacion","grupos_servicio","miembros_grupo",
  "territorios","manzanas_territorio","ciclos_territorio","manzanas_trabajadas",
  "territorios_grupos_predicacion","programa_predicacion","programa_vida_ministerio",
  "programa_reunion_publica","programa_asignaciones_servicio","programas_publicados",
  "configuracion_sistema","indisponibilidad_participantes","disponibilidad_capitanes",
  "asignaciones_capitan_fijas","historial_participacion_vym","dias_especiales",
  "asignaciones_servicio_dias_especiales","carritos","puntos_encuentro","horarios_salida",
  "tipos_salida","tipos_salida_variantes","grupos_predicacion_ficticios",
  "mensajes_adicionales","direcciones_bloqueadas","conductores_atalaya",
  "lectores_atalaya_elegibles","lectores_ebc_elegibles","plantillas_vida_ministerio_oficial",
  "tipos_programa","historial_sesiones",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const auth = req.headers.get("Authorization") || "";
  if (auth !== `Bearer ${EXPORT_SECRET}`) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  const out: Record<string, unknown> = {};
  const errors: Record<string, string> = {};

  for (const t of TABLES) {
    try {
      const all: unknown[] = [];
      const pageSize = 1000;
      let from = 0;
      while (true) {
        const { data, error } = await supabase.from(t).select("*").range(from, from + pageSize - 1);
        if (error) { errors[t] = error.message; break; }
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
      }
      out[t] = all;
    } catch (e) {
      errors[t] = (e as Error).message;
    }
  }

  return new Response(
    JSON.stringify({ exported_at: new Date().toISOString(), tables: out, errors }, null, 2),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
