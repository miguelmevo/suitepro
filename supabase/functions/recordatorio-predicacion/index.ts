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
// congregación (cualquiera puede sumarse, no solo el capitán). Cuando la
// salida es por grupos (típico sábado/domingo), cada usuario recibe el
// punto de encuentro y territorio de SU grupo de predicación, no uno genérico.
// Cada aviso se manda una sola vez por salida (notificado_16h/1h).
const VENTANA_MINUTOS = 20;

interface AsignacionGrupo {
  grupo_id?: string;
  grupo_ficticio_id?: string;
  territorio_id?: string;
  territorio_ids?: string[];
  punto_encuentro_id?: string;
  disabled?: boolean;
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
        "id, fecha, congregacion_id, territorio_id, territorio_ids, es_por_grupos, asignaciones_grupos, notificado_16h, notificado_1h, horarios_salida(hora), puntos_encuentro(nombre, direccion)"
      )
      .in("fecha", [hoyStr, mananaStr])
      .eq("activo", true)
      .or("notificado_16h.eq.false,notificado_1h.eq.false");

    let avisos16h = 0;
    let avisos1h = 0;

    const cacheTerritorios = new Map<string, string>();
    const cachePuntos = new Map<string, { nombre: string; direccion: string | null }>();

    async function textoTerritorios(idsConVacios: string[]): Promise<string> {
      const ids = idsConVacios.filter(Boolean);
      const faltantes = ids.filter((id) => !cacheTerritorios.has(id));
      if (faltantes.length > 0) {
        const { data } = await serviceClient.from("territorios").select("id, numero, nombre").in("id", faltantes);
        (data ?? []).forEach((t) =>
          cacheTerritorios.set(t.id, t.nombre ? `N° ${t.numero} - ${t.nombre}` : `N° ${t.numero}`)
        );
      }
      return ids.map((id) => cacheTerritorios.get(id)).filter(Boolean).join(", ");
    }

    async function textoPunto(id: string | null | undefined): Promise<string | null> {
      if (!id) return null;
      if (!cachePuntos.has(id)) {
        const { data } = await serviceClient.from("puntos_encuentro").select("nombre, direccion").eq("id", id).maybeSingle();
        if (data) cachePuntos.set(id, data);
      }
      const punto = cachePuntos.get(id);
      if (!punto) return null;
      return punto.direccion ? `${punto.nombre} — ${punto.direccion}` : punto.nombre;
    }

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

      const horaTexto = hora.slice(0, 5);

      // Participantes con cuenta de usuario de esta congregación, con su grupo.
      const { data: participantes } = await serviceClient
        .from("participantes")
        .select("user_id, grupo_predicacion_id")
        .eq("congregacion_id", salida.congregacion_id as string)
        .eq("activo", true)
        .not("user_id", "is", null);

      type Envio = { userIds: string[]; lugarTexto: string | null; territorioTexto: string };

      const envios: Envio[] = [];

      if (salida.es_por_grupos) {
        const asignaciones = (salida.asignaciones_grupos as AsignacionGrupo[] | null) ?? [];
        for (const asignacion of asignaciones) {
          if (asignacion.disabled || !asignacion.grupo_id) continue;

          const userIds = (participantes ?? [])
            .filter((p) => p.grupo_predicacion_id === asignacion.grupo_id)
            .map((p) => p.user_id as string);
          if (userIds.length === 0) continue;

          const idsTerritorio = [
            ...(asignacion.territorio_id ? [asignacion.territorio_id] : []),
            ...(asignacion.territorio_ids ?? []),
          ];
          const territorioTexto = await textoTerritorios(idsTerritorio);
          // Si el grupo no tiene su propio punto de encuentro, hereda el de la salida.
          const lugarTexto =
            (await textoPunto(asignacion.punto_encuentro_id)) ?? textoPuntoDirecto((salida as any).puntos_encuentro);

          envios.push({ userIds, lugarTexto, territorioTexto });
        }
      } else {
        const userIds = (participantes ?? []).map((p) => p.user_id as string);
        if (userIds.length > 0) {
          const idsTerritorio = [
            ...(salida.territorio_id ? [salida.territorio_id as string] : []),
            ...((salida.territorio_ids as string[] | null) ?? []),
          ];
          const territorioTexto = await textoTerritorios(idsTerritorio);
          const lugarTexto = textoPuntoDirecto((salida as any).puntos_encuentro);
          envios.push({ userIds, lugarTexto, territorioTexto });
        }
      }

      for (const envio of envios) {
        const partesDetalle = [
          `Hora: ${horaTexto}`,
          envio.lugarTexto ? `Lugar: ${envio.lugarTexto}` : null,
          envio.territorioTexto ? `Territorio: ${envio.territorioTexto}` : null,
        ].filter(Boolean);

        if (debeAvisar16h) {
          await notificarCategoria(
            "predicacion_recordatorio",
            envio.userIds,
            "Salida de predicación mañana",
            partesDetalle.join(" · ")
          );
        }
        if (debeAvisar1h) {
          await notificarCategoria(
            "predicacion_recordatorio",
            envio.userIds,
            "Salida de predicación en 1 hora",
            partesDetalle.join(" · ")
          );
          if (envio.lugarTexto) {
            await notificarCategoria(
              "predicacion_punto_encuentro",
              envio.userIds,
              "Punto de encuentro de la salida",
              envio.lugarTexto
            );
          }
        }
      }

      if (debeAvisar16h) {
        await serviceClient.from("programa_predicacion").update({ notificado_16h: true }).eq("id", salida.id);
        avisos16h++;
      }
      if (debeAvisar1h) {
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

function textoPuntoDirecto(punto: { nombre: string; direccion: string | null } | null): string | null {
  if (!punto) return null;
  return punto.direccion ? `${punto.nombre} — ${punto.direccion}` : punto.nombre;
}
