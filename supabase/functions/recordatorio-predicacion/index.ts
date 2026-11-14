import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

// Corre cada 30 min y envía dos avisos a TODA la congregación (cualquiera
// puede sumarse, no solo el capitán):
//  1) Resumen del día siguiente: a las 19:00 (hora de Chile) del día anterior,
//     con todas las salidas de mañana (hora, lugar de encuentro, territorio y
//     capitán). Se marca con `notificado_16h` (nombre histórico de la columna).
//  2) Aviso 1 hora antes de cada salida (`notificado_1h`), con los mismos datos.
// Cuando la salida es por grupos (típico sábado/domingo), cada usuario recibe
// los datos de SU grupo de predicación.
//
// No se avisa de salidas que el programa no muestra: filas de mensaje especial,
// ni salidas guardadas en un día/franja cubierto por un día especial (p. ej.
// una Asamblea que ocupa todo el día).
const HORA_RESUMEN = 19; // 19:00 hora de Chile
const MINUTOS_ANTES = 60;
// Tolerancia: el cron corre cada 30 min, así que se avisa en el primer ciclo
// en que falten 60 min o menos (y la salida aún no haya ocurrido).
const TOLERANCIA_MINUTOS = 5;
const ZONA = "America/Santiago";

interface AsignacionGrupo {
  grupo_id?: string;
  grupo_ficticio_id?: string;
  territorio_id?: string;
  territorio_ids?: string[];
  punto_encuentro_id?: string;
  capitan_id?: string;
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

/** Diferencia (en minutos) entre la hora local de Chile y UTC en un instante dado (respeta horario de verano). */
function offsetChileMinutos(instante: Date): number {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: ZONA,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instante);
  const g = (tipo: string) => Number(partes.find((p) => p.type === tipo)!.value);
  const comoUtc = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second"));
  return Math.round((comoUtc - Math.floor(instante.getTime() / 1000) * 1000) / 60000);
}

/** Instante real (UTC) de una fecha y hora "de pared" en Chile. */
function instanteChile(fecha: string, hora: string): Date {
  const [y, m, d] = fecha.split("-").map(Number);
  const [hh, mm] = hora.split(":").map(Number);
  const ingenuo = Date.UTC(y, m - 1, d, hh, mm);
  let t = ingenuo - offsetChileMinutos(new Date(ingenuo)) * 60000;
  t = ingenuo - offsetChileMinutos(new Date(t)) * 60000;
  return new Date(t);
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
    const fmtFecha = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA });
    const hoyStr = fmtFecha.format(ahora);
    const mananaStr = fmtFecha.format(new Date(ahora.getTime() + 86400000));
    const minutosDelDiaChile = (() => {
      const p = new Intl.DateTimeFormat("en-US", {
        timeZone: ZONA,
        hourCycle: "h23",
        hour: "2-digit",
        minute: "2-digit",
      }).formatToParts(ahora);
      return Number(p.find((x) => x.type === "hour")!.value) * 60 + Number(p.find((x) => x.type === "minute")!.value);
    })();
    // Resumen del día siguiente: desde las 19:00 (ventana de 1 hora; se envía una sola vez).
    const tocaResumen = minutosDelDiaChile >= HORA_RESUMEN * 60 && minutosDelDiaChile < (HORA_RESUMEN + 1) * 60;

    const { data: filas } = await serviceClient
      .from("programa_predicacion")
      .select(
        "id, fecha, congregacion_id, horario_id, territorio_id, territorio_ids, capitan_id, es_por_grupos, es_mensaje_especial, colspan_completo, asignaciones_grupos, notificado_16h, notificado_1h, horarios_salida(hora, nombre, franja), puntos_encuentro(nombre, direccion)"
      )
      .in("fecha", [hoyStr, mananaStr])
      .eq("activo", true);

    const clasificarFranja = (h: any): "manana" | "tarde" => {
      if (h?.franja === "manana" || h?.franja === "tarde") return h.franja;
      const nombre = String(h?.nombre ?? "").toLowerCase();
      if (nombre.includes("mañana") || nombre.includes("manana")) return "manana";
      if (nombre.includes("tarde")) return "tarde";
      return parseInt(String(h?.hora ?? "0").split(":")[0], 10) < 12 ? "manana" : "tarde";
    };

    // Días/franjas cubiertos por un mensaje especial (el programa los muestra en lugar de las salidas).
    const cubiertos = new Set<string>(); // `${cong}|${fecha}|completo` o `${cong}|${fecha}|manana|tarde`
    for (const f of filas ?? []) {
      if (!f.es_mensaje_especial) continue;
      if (f.colspan_completo) cubiertos.add(`${f.congregacion_id}|${f.fecha}|completo`);
      else if ((f as any).horarios_salida) {
        cubiertos.add(`${f.congregacion_id}|${f.fecha}|${clasificarFranja((f as any).horarios_salida)}`);
      }
    }

    const salidas = (filas ?? []).filter((f: any) => {
      if (f.es_mensaje_especial || !f.horarios_salida?.hora) return false;
      if (cubiertos.has(`${f.congregacion_id}|${f.fecha}|completo`)) return false;
      if (cubiertos.has(`${f.congregacion_id}|${f.fecha}|${clasificarFranja(f.horarios_salida)}`)) return false;
      return true;
    });

    const cacheTerritorios = new Map<string, string>();
    const cachePuntos = new Map<string, { nombre: string; direccion: string | null }>();
    const cacheCapitanes = new Map<string, string>();

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
      return textoPuntoDirecto(cachePuntos.get(id) ?? null);
    }

    async function textoCapitan(id: string | null | undefined): Promise<string | null> {
      if (!id) return null;
      if (!cacheCapitanes.has(id)) {
        const { data } = await serviceClient.from("participantes").select("nombre, apellido").eq("id", id).maybeSingle();
        if (data) cacheCapitanes.set(id, `${data.nombre} ${data.apellido}`.trim());
      }
      return cacheCapitanes.get(id) ?? null;
    }

    type Dato = { hora: string; lugar: string | null; territorio: string; capitan: string | null };
    type Envio = { userIds: string[]; dato: Dato };

    const cacheParticipantes = new Map<string, { user_id: string; grupo_predicacion_id: string | null }[]>();
    async function participantesConCuenta(congregacionId: string) {
      if (cacheParticipantes.has(congregacionId)) return cacheParticipantes.get(congregacionId)!;
      // "Inactivar usuario" no toca participantes.activo, así que además de
      // filtrar el participante hay que confirmar que su cuenta siga activa.
      const [{ data: participantesRaw }, { data: membresiasActivas }] = await Promise.all([
        serviceClient
          .from("participantes")
          .select("user_id, grupo_predicacion_id")
          .eq("congregacion_id", congregacionId)
          .eq("activo", true)
          .not("user_id", "is", null),
        serviceClient.from("usuarios_congregacion").select("user_id").eq("congregacion_id", congregacionId).eq("activo", true),
      ]);
      const cuentasActivas = new Set((membresiasActivas ?? []).map((m) => m.user_id));
      const lista = (participantesRaw ?? []).filter((p) => cuentasActivas.has(p.user_id as string)) as {
        user_id: string;
        grupo_predicacion_id: string | null;
      }[];
      cacheParticipantes.set(congregacionId, lista);
      return lista;
    }

    /** Destinatarios y datos de una salida: uno por grupo si es por grupos, o uno general. */
    async function enviosDeSalida(salida: any): Promise<Envio[]> {
      const hora = String(salida.horarios_salida.hora).slice(0, 5);
      const participantes = await participantesConCuenta(salida.congregacion_id);
      const envios: Envio[] = [];

      if (salida.es_por_grupos) {
        const asignaciones = (salida.asignaciones_grupos as AsignacionGrupo[] | null) ?? [];
        for (const asignacion of asignaciones) {
          if (asignacion.disabled || !asignacion.grupo_id) continue;
          const userIds = participantes.filter((p) => p.grupo_predicacion_id === asignacion.grupo_id).map((p) => p.user_id);
          if (userIds.length === 0) continue;
          const territorio = await textoTerritorios([
            ...(asignacion.territorio_id ? [asignacion.territorio_id] : []),
            ...(asignacion.territorio_ids ?? []),
          ]);
          // Si el grupo no tiene su propio punto de encuentro, hereda el de la salida.
          const lugar = (await textoPunto(asignacion.punto_encuentro_id)) ?? textoPuntoDirecto(salida.puntos_encuentro);
          const capitan = await textoCapitan(asignacion.capitan_id ?? salida.capitan_id);
          envios.push({ userIds, dato: { hora, lugar, territorio, capitan } });
        }
      } else {
        const userIds = participantes.map((p) => p.user_id);
        if (userIds.length > 0) {
          const territorio = await textoTerritorios([
            ...(salida.territorio_id ? [salida.territorio_id as string] : []),
            ...((salida.territorio_ids as string[] | null) ?? []),
          ]);
          const capitan = await textoCapitan(salida.capitan_id);
          envios.push({ userIds, dato: { hora, lugar: textoPuntoDirecto(salida.puntos_encuentro), territorio, capitan } });
        }
      }
      return envios;
    }

    const lineaDato = (d: Dato) =>
      [
        `Hora: ${d.hora}`,
        d.lugar ? `Lugar de encuentro: ${d.lugar}` : null,
        d.territorio ? `Territorio: ${d.territorio}` : null,
        d.capitan ? `Capitán: ${d.capitan}` : null,
      ]
        .filter(Boolean)
        .join(" · ");

    let resumenes = 0;
    let avisos1h = 0;

    // 1) Resumen de las salidas de mañana (una sola vez por salida).
    if (tocaResumen) {
      const deManana = salidas.filter((s: any) => s.fecha === mananaStr && !s.notificado_16h);
      // Por usuario, las líneas de todas sus salidas de mañana ordenadas por hora.
      const lineasPorUsuario = new Map<string, { hora: string; texto: string }[]>();
      for (const salida of deManana) {
        for (const envio of await enviosDeSalida(salida)) {
          for (const uid of envio.userIds) {
            const arr = lineasPorUsuario.get(uid) ?? [];
            arr.push({ hora: envio.dato.hora, texto: lineaDato(envio.dato) });
            lineasPorUsuario.set(uid, arr);
          }
        }
      }
      // Usuarios con el mismo texto se agrupan en un solo envío.
      const usuariosPorCuerpo = new Map<string, string[]>();
      for (const [uid, items] of lineasPorUsuario) {
        const cuerpo = items
          .sort((a, b) => a.hora.localeCompare(b.hora))
          .map((i) => i.texto)
          .join("\n");
        usuariosPorCuerpo.set(cuerpo, [...(usuariosPorCuerpo.get(cuerpo) ?? []), uid]);
      }
      for (const [cuerpo, userIds] of usuariosPorCuerpo) {
        await notificarCategoria("predicacion_recordatorio", userIds, "Salidas de predicación de mañana", cuerpo);
        resumenes++;
      }
      for (const salida of deManana) {
        await serviceClient.from("programa_predicacion").update({ notificado_16h: true }).eq("id", salida.id);
      }
    }

    // 2) Aviso 1 hora antes de cada salida.
    for (const salida of salidas as any[]) {
      if (salida.notificado_1h) continue;
      const fechaHoraSalida = instanteChile(salida.fecha, salida.horarios_salida.hora);
      const minutosParaSalida = (fechaHoraSalida.getTime() - ahora.getTime()) / 60000;
      if (minutosParaSalida <= 0 || minutosParaSalida > MINUTOS_ANTES + TOLERANCIA_MINUTOS) continue;

      for (const envio of await enviosDeSalida(salida)) {
        await notificarCategoria("predicacion_recordatorio", envio.userIds, "Salida de predicación en 1 hora", lineaDato(envio.dato));
        if (envio.dato.lugar) {
          await notificarCategoria("predicacion_punto_encuentro", envio.userIds, "Punto de encuentro de la salida", envio.dato.lugar);
        }
      }
      await serviceClient.from("programa_predicacion").update({ notificado_1h: true }).eq("id", salida.id);
      avisos1h++;
    }

    return new Response(JSON.stringify({ resumenes, avisos1h }), {
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
