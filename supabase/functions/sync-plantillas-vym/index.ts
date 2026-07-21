// Edge function: sync-plantillas-vym
// Cron autónomo: detecta qué semanas de Vida y Ministerio faltan (o cambiaron) en
// plantillas_vida_ministerio_oficial desde el mes actual en adelante, resuelve la
// URL real de cada semana en wol.jw.org (sin depender de adivinar el ID numérico
// de la guía), y delega el scrapeo/guardado a la función importar-vym-wol existente.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function toIsoDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function mondayOf(date: Date): Date {
  const day = date.getUTCDay(); // 0=dom
  const diff = (day === 0 ? -6 : 1) - day;
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

// Semana ISO-8601 (año puede diferir del año calendario en los bordes de diciembre/enero).
function isoWeekOf(date: Date): { isoYear: number; isoWeek: number } {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = (d.getUTCDay() + 6) % 7; // lunes=0 ... domingo=6
  d.setUTCDate(d.getUTCDate() - dayNum + 3); // jueves de esa semana
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const isoWeek = 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
  return { isoYear: d.getUTCFullYear(), isoWeek };
}

// Resuelve, para una semana dada, la URL del documento real de "Vida y Ministerio"
// consultando la página-índice estable de wol.jw.org (no requiere adivinar IDs).
async function resolverUrlSemana(monday: Date): Promise<string | null> {
  const { isoYear, isoWeek } = isoWeekOf(monday);
  const indexUrl = `https://wol.jw.org/es/wol/meetings/r4/lp-s/${isoYear}/${isoWeek}`;
  const resp = await fetch(indexUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; SuiteProBot/1.0; +https://suitepro.org)",
      "Accept-Language": "es",
    },
  });
  if (!resp.ok) return null;
  const html = await resp.text();
  // El bloque de "Vida y Ministerio" trae la clase "pub-mwb" en el <li> que envuelve el enlace.
  const bloque = html.match(/<li[^>]*class="[^"]*\bpub-mwb\b[^"]*"[\s\S]*?<\/li>/i);
  const fuente = bloque ? bloque[0] : html;
  const m = fuente.match(/href="(\/es\/wol\/d\/r4\/lp-s\/\d+)"/);
  if (!m) return null;
  return `https://wol.jw.org${m[1]}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const CRON_SYNC_SECRET = Deno.env.get("CRON_SYNC_SECRET") ?? "";

    // Dos formas de autenticarse: (1) el secreto del cron autónomo, o (2) un usuario
    // super_admin vía JWT (botón manual "Ejecutar ahora" en el admin).
    const secretRecibido = req.headers.get("x-cron-secret") ?? "";
    const autenticadoPorSecret = !!CRON_SYNC_SECRET && secretRecibido === CRON_SYNC_SECRET;

    if (!autenticadoPorSecret) {
      const authHeader = req.headers.get("Authorization") ?? "";
      const token = authHeader.replace("Bearer ", "").trim();
      if (!token) {
        return new Response(JSON.stringify({ error: "No autenticado" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: userData, error: userErr } = await userClient.auth.getUser();
      if (userErr || !userData?.user) {
        return new Response(JSON.stringify({ error: "Sesión inválida" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const serviceClientAuth = createClient(SUPABASE_URL, SERVICE_KEY);
      const { data: isSA, error: rpcErr } = await serviceClientAuth.rpc("is_super_admin", { _user_id: userData.user.id });
      if (rpcErr || !isSA) {
        return new Response(JSON.stringify({ error: "Solo super_admin puede ejecutar la sincronización" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
    const serviceClient = createClient(SUPABASE_URL, SERVICE_KEY);
    const origen: "cron" | "manual" = autenticadoPorSecret ? "cron" : "manual";
    const ejecucionId = crypto.randomUUID();

    // Ventana: desde el 1er día del mes actual (alineado al lunes) en adelante.
    const hoy = new Date();
    const inicioMes = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1));
    let cursor = mondayOf(inicioMes);
    if (cursor < inicioMes) cursor = new Date(cursor.getTime() + 7 * 86400000);

    const { data: existentes } = await serviceClient
      .from("plantillas_vida_ministerio_oficial")
      .select("fecha_semana")
      .eq("idioma", "es")
      .gte("fecha_semana", toIsoDate(cursor));

    const fechasExistentes = new Set((existentes ?? []).map((r: any) => r.fecha_semana as string));

    // Buscar la primera semana con hueco (no simplemente la última guardada), para no
    // saltarnos huecos que hayan quedado atrás por una carga manual fuera de secuencia.
    let resumeFrom = cursor;
    for (let i = 0; i < 80; i++) {
      const fechaStr = toIsoDate(resumeFrom);
      if (!fechasExistentes.has(fechaStr)) break;
      resumeFrom = new Date(resumeFrom.getTime() + 7 * 86400000);
    }

    // Desde ahí en adelante, resolver la URL real de cada semana hasta que WOL no
    // tenga más contenido publicado. Se limita la cantidad de semanas por corrida
    // (no todo lo disponible de una vez) para no agotar los recursos de la función;
    // si queda un remanente grande, las próximas corridas del cron lo van completando.
    const MAX_SEMANAS_POR_CORRIDA = 8;
    const items: Array<{ url: string; fecha_semana: string }> = [];
    let semana = resumeFrom;
    let detenidoEn: string | null = null;
    let masPendiente = false;
    for (let i = 0; i < MAX_SEMANAS_POR_CORRIDA; i++) {
      const fechaStr = toIsoDate(semana);
      const url = await resolverUrlSemana(semana);
      if (!url) {
        detenidoEn = fechaStr;
        break;
      }
      items.push({ url, fecha_semana: fechaStr });
      semana = new Date(semana.getTime() + 7 * 86400000);
      // Si llegamos al tope sin haber chocado con el límite real de WOL, es que
      // probablemente queden más semanas pendientes para la próxima corrida.
      if (i === MAX_SEMANAS_POR_CORRIDA - 1) masPendiente = true;
    }

    if (items.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, mensaje: "No hay semanas nuevas para procesar", detenido_en: detenidoEn }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Se crea la fila de la ejecución ANTES de procesar las semanas: el log de
    // cada semana referencia esta fila por FK, así que si se creara después los
    // inserts del log fallarían silenciosamente por violar la llave foránea.
    await serviceClient.from("ejecucion_sync_plantillas_vym").insert({
      id: ejecucionId,
      origen,
      semanas_procesadas: items.length,
      detenido_en: detenidoEn,
    });

    // Delegar el scrapeo/guardado real a la función existente, en lotes chicos
    // (el parseo de cada página con deno_dom consume bastante memoria).
    const resultadosTotales: Array<{ estado?: string }> = [];
    for (let i = 0; i < items.length; i += 4) {
      const lote = items.slice(i, i + 4);
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/importar-vym-wol`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-cron-secret": CRON_SYNC_SECRET,
        },
        body: JSON.stringify({
          items: lote.map((it) => ({ url: it.url, fecha_semana: it.fecha_semana })),
          ejecucion_id: ejecucionId,
        }),
      });
      const data = await resp.json().catch(() => ({ error: "Respuesta inválida de importar-vym-wol" }));
      if (Array.isArray(data?.resultados)) resultadosTotales.push(...data.resultados);
      else resultadosTotales.push({ estado: "error" });
    }

    const contar = (estado: string) => resultadosTotales.filter((r) => r.estado === estado).length;
    const semanasCreadas = contar("creada");
    const semanasActualizadas = contar("actualizada");
    const semanasSinCambio = contar("sin_cambios");
    const semanasError = resultadosTotales.length - semanasCreadas - semanasActualizadas - semanasSinCambio;

    await serviceClient
      .from("ejecucion_sync_plantillas_vym")
      .update({
        semanas_creadas: semanasCreadas,
        semanas_actualizadas: semanasActualizadas,
        semanas_sin_cambio: semanasSinCambio,
        semanas_error: semanasError,
      })
      .eq("id", ejecucionId);

    return new Response(
      JSON.stringify({
        ok: true,
        ejecucion_id: ejecucionId,
        semanas_procesadas: items.length,
        semanas_creadas: semanasCreadas,
        semanas_actualizadas: semanasActualizadas,
        semanas_sin_cambio: semanasSinCambio,
        semanas_error: semanasError,
        detenido_en: detenidoEn,
        mas_pendiente: masPendiente,
        resultados: resultadosTotales,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
