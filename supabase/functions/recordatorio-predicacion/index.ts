import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

// Corre cada 30 min: por cada salida de predicación programada, calcula la
// hora exacta (fecha + horario) y avisa 16h y 1h antes a TODA la
// congregación (no solo al capitán) — cualquiera puede sumarse a la salida.
// Cada aviso se manda una sola vez por salida (notificado_16h/1h).
const VENTANA_MINUTOS = 20;

interface AsignacionGrupo {
  territorio_id?: string;
  territorio_ids?: string[];
}

async function notificarCategoria(categoria: string, userIds: string[], title: string, body: string) {
  if (userIds.length === 0) return;
  await fetch(`${SUPABASE_URL}/functions/v1/notificar-categoria`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-cron-secret": CRON_SECRET ?? "" },
    body: JSON.stringify({ userIds, categoria, title, body }),
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

    const ahora = new Date();
    const fmtChile = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" });
    const hoyStr = fmtChile.format(ahora);
    const mananaStr = fmtChile.format(new Date(ahora.getTime() + 86400000));

    const { data: salidas } = await serviceClient
      .from("programa_predicacion")
      .select(
        "id, fecha, congregacion_id, territorio_id, territorio_ids, asignaciones_grupos, notificado_16h, notificado_1h, horarios_salida(hora), puntos_encuentro(nombre, direccion)"
      )
      .in("fecha", [hoyStr, mananaStr])
      .eq("activo", true)
      .or("notificado_16h.eq.false,notificado_1h.eq.false");

    let avisos16h = 0;
    let avisos1h = 0;

    for (const salida of salidas ?? []) {
      const hora = (salida as any).horarios_salida?.hora as string | null;
      if (!hora) continue;

      // Chile continental es UTC-4; se asume ese offset fijo (mismo criterio
      // que el resto de los cron de este proyecto, sin ajuste de horario de verano).
      const fechaHoraSalida = new Date(`${salida.fecha}T${hora}-04:00`);
      const minutosParaSalida = (fechaHoraSalida.getTime() - ahora.getTime()) / 60000;
      const debeAvisar16h = !salida.notificado_16h && Math.abs(minutosParaSalida - 16 * 60) <= VENTANA_MINUTOS;
      const debeAvisar1h = !salida.notificado_1h && Math.abs(minutosParaSalida - 60) <= VENTANA_MINUTOS;
      if (!debeAvisar16h && !debeAvisar1h) continue;

      // Toda la congregación puede sumarse a la salida, no solo el capitán.
      const { data: miembros } = await serviceClient
        .from("usuarios_congregacion")
        .select("user_id")
        .eq("congregacion_id", salida.congregacion_id as string)
        .eq("activo", true);
      const userIds = (miembros ?? []).map((m) => m.user_id);
      if (userIds.length === 0) continue;

      // Junta los territorios de la salida (directos y/o por grupo).
      const idsTerritorio = new Set<string>();
      if (salida.territorio_id) idsTerritorio.add(salida.territorio_id as string);
      ((salida.territorio_ids as string[] | null) ?? []).forEach((id) => idsTerritorio.add(id));
      ((salida.asignaciones_grupos as AsignacionGrupo[] | null) ?? []).forEach((a) => {
        if (a.territorio_id) idsTerritorio.add(a.territorio_id);
        (a.territorio_ids ?? []).forEach((id) => idsTerritorio.add(id));
      });

      let territorioTexto = "";
      if (idsTerritorio.size > 0) {
        const { data: territorios } = await serviceClient
          .from("territorios")
          .select("id, numero, nombre")
          .in("id", [...idsTerritorio]);
        territorioTexto = (territorios ?? [])
          .map((t) => (t.nombre ? `N° ${t.numero} - ${t.nombre}` : `N° ${t.numero}`))
          .join(", ");
      }

      const horaTexto = hora.slice(0, 5);
      const puntoEncuentro = (salida as any).puntos_encuentro;
      const lugarTexto = puntoEncuentro
        ? puntoEncuentro.direccion
          ? `${puntoEncuentro.nombre} — ${puntoEncuentro.direccion}`
          : puntoEncuentro.nombre
        : null;

      const partesDetalle = [
        `Hora: ${horaTexto}`,
        lugarTexto ? `Lugar: ${lugarTexto}` : null,
        territorioTexto ? `Territorio: ${territorioTexto}` : null,
      ].filter(Boolean);

      if (debeAvisar16h) {
        await notificarCategoria(
          "predicacion_recordatorio",
          userIds,
          "Salida de predicación mañana",
          partesDetalle.join(" · ")
        );
        await serviceClient.from("programa_predicacion").update({ notificado_16h: true }).eq("id", salida.id);
        avisos16h++;
      }

      if (debeAvisar1h) {
        await notificarCategoria(
          "predicacion_recordatorio",
          userIds,
          "Salida de predicación en 1 hora",
          partesDetalle.join(" · ")
        );
        if (lugarTexto) {
          await notificarCategoria("predicacion_punto_encuentro", userIds, "Punto de encuentro de la salida", lugarTexto);
        }
        await serviceClient.from("programa_predicacion").update({ notificado_1h: true }).eq("id", salida.id);
        avisos1h++;
      }
    }

    return new Response(JSON.stringify({ avisos16h, avisos1h }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("[recordatorio-predicacion] Error:", error);
    return new Response(JSON.stringify({ error: error?.message ?? "unknown_error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
