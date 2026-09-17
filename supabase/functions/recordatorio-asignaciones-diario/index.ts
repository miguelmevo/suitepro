import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const DIA_A_INDICE: Record<string, number> = {
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
  domingo: 0,
};

function fechaReunionEnSemana(fechaSemanaISO: string, diaReunion: string): string {
  // fechaSemanaISO es siempre un lunes. Se suma el offset del día de reunión.
  const lunes = new Date(fechaSemanaISO + "T00:00:00Z");
  const indiceObjetivo = DIA_A_INDICE[diaReunion] ?? 2; // martes por defecto
  const offset = indiceObjetivo === 0 ? 6 : indiceObjetivo - 1; // domingo cierra la semana
  const resultado = new Date(lunes);
  resultado.setUTCDate(lunes.getUTCDate() + offset);
  return resultado.toISOString().slice(0, 10);
}

/** Recorre un objeto/array de asignaciones y junta todo valor de un campo
 * que termine en "_id" salvo los identificadores propios de la fila
 * (id, congregacion_id, capitan_id ya se procesa aparte donde aplica). */
function extraerParticipanteIds(valor: unknown, excluir: Set<string>, acumulador: Set<string>) {
  if (Array.isArray(valor)) {
    valor.forEach((v) => extraerParticipanteIds(v, excluir, acumulador));
    return;
  }
  if (valor && typeof valor === "object") {
    for (const [clave, val] of Object.entries(valor as Record<string, unknown>)) {
      if (clave.endsWith("_id") && !excluir.has(clave) && typeof val === "string") {
        acumulador.add(val);
      } else if (val && typeof val === "object") {
        extraerParticipanteIds(val, excluir, acumulador);
      }
    }
  }
}

const CAMPOS_EXCLUIDOS = new Set(["id", "congregacion_id", "grupo_predicacion_id", "territorio_id"]);

async function notificarCategoria(
  categoria: string,
  userIds: string[],
  title: string,
  body: string
) {
  if (userIds.length === 0) return;
  await fetch(`${SUPABASE_URL}/functions/v1/notificar-categoria`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-cron-secret": CRON_SECRET ?? "",
    },
    body: JSON.stringify({ userIds: [...new Set(userIds)], categoria, title, body }),
  });
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    // Fecha de hoy en horario de Chile (America/Santiago).
    const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date());

    const { data: congregaciones } = await serviceClient.from("congregaciones").select("id, nombre");

    let totalVidaMinisterio = 0;
    let totalServicio = 0;

    for (const cong of congregaciones ?? []) {
      const [{ data: participantes }, { data: membresiasActivas }] = await Promise.all([
        serviceClient
          .from("participantes")
          .select("id, user_id")
          .eq("congregacion_id", cong.id)
          .eq("activo", true)
          .not("user_id", "is", null),
        serviceClient
          .from("usuarios_congregacion")
          .select("user_id")
          .eq("congregacion_id", cong.id)
          .eq("activo", true),
      ]);

      // "Inactivar usuario" no toca participantes.activo, así que además de
      // filtrar el participante hay que confirmar que su cuenta siga activa.
      const cuentasActivas = new Set((membresiasActivas ?? []).map((m) => m.user_id));
      const userIdPorParticipante = new Map(
        (participantes ?? [])
          .filter((p) => cuentasActivas.has(p.user_id as string))
          .map((p) => [p.id, p.user_id as string])
      );
      const resolver = (ids: Set<string>) =>
        [...ids].map((pid) => userIdPorParticipante.get(pid)).filter((u): u is string => !!u);

      // Predicación ya no se maneja acá: recordatorio-predicacion notifica
      // 16h y 1h antes de la hora exacta de cada salida (cron cada 30 min).

      // --- Vida y Ministerio: la parte se calcula desde fecha_semana + día de reunión configurado ---
      const { data: cfgDias } = await serviceClient
        .from("configuracion_sistema")
        .select("valor")
        .eq("congregacion_id", cong.id)
        .eq("programa_tipo", "predicacion")
        .eq("clave", "dias_reunion")
        .maybeSingle();

      const diaEntreSemana = (cfgDias?.valor as any)?.dia_entre_semana ?? "martes";

      const { data: programasVym } = await serviceClient
        .from("programa_vida_ministerio")
        .select("*")
        .eq("congregacion_id", cong.id)
        .gte("fecha_semana", new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10))
        .lte("fecha_semana", hoy);

      const idsVym = new Set<string>();
      for (const programa of programasVym ?? []) {
        if (fechaReunionEnSemana(programa.fecha_semana as string, diaEntreSemana) === hoy) {
          extraerParticipanteIds(programa, CAMPOS_EXCLUIDOS, idsVym);
        }
      }
      const usuariosVym = resolver(idsVym);
      if (usuariosVym.length > 0) {
        await notificarCategoria(
          "vida_ministerio",
          usuariosVym,
          "Tienes una asignación en Vida y Ministerio hoy",
          "Revisa tu parte del programa de hoy en Vida y Ministerio."
        );
        totalVidaMinisterio += usuariosVym.length;
      }

      // --- Servicio: asignaciones_servicio + roles de Reunión Pública de hoy ---
      const idsServicio = new Set<string>();

      const { data: asigServicio } = await serviceClient
        .from("asignaciones_servicio")
        .select("participante_id")
        .eq("congregacion_id", cong.id)
        .eq("fecha", hoy)
        .not("participante_id", "is", null);
      (asigServicio ?? []).forEach((a) => idsServicio.add(a.participante_id as string));

      const { data: reunionPublica } = await serviceClient
        .from("programa_reunion_publica")
        .select("*")
        .eq("congregacion_id", cong.id)
        .eq("fecha", hoy)
        .maybeSingle();
      if (reunionPublica) {
        extraerParticipanteIds(reunionPublica, CAMPOS_EXCLUIDOS, idsServicio);
      }

      const usuariosServicio = resolver(idsServicio);
      if (usuariosServicio.length > 0) {
        await notificarCategoria(
          "servicio",
          usuariosServicio,
          "Tienes una asignación de servicio hoy",
          "Hoy te corresponde una asignación de servicio en la reunión."
        );
        totalServicio += usuariosServicio.length;
      }
    }

    return new Response(
      JSON.stringify({ fecha: hoy, totalVidaMinisterio, totalServicio }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("[recordatorio-asignaciones-diario] Error:", error);
    return new Response(JSON.stringify({ error: error?.message ?? "unknown_error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
