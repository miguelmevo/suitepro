import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

// Corre cada 30 min: por cada salida de predicación con capitán asignado,
// calcula la hora exacta (fecha + horario) y avisa 16h y 1h antes. Cada
// aviso se manda una sola vez por salida (columnas notificado_16h/1h).
const VENTANA_MINUTOS = 20;

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
        "id, fecha, capitan_id, notificado_16h, notificado_1h, horarios_salida(hora), puntos_encuentro(nombre, direccion)"
      )
      .in("fecha", [hoyStr, mananaStr])
      .not("capitan_id", "is", null)
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

      const { data: participante } = await serviceClient
        .from("participantes")
        .select("user_id")
        .eq("id", salida.capitan_id as string)
        .maybeSingle();

      const userId = participante?.user_id;
      if (!userId) continue;

      const horaTexto = hora.slice(0, 5);

      if (!salida.notificado_16h && Math.abs(minutosParaSalida - 16 * 60) <= VENTANA_MINUTOS) {
        await notificarCategoria(
          "predicacion_recordatorio",
          [userId],
          "Mañana tienes una salida de predicación",
          `Te toca dirigir la salida de predicación de las ${horaTexto}.`
        );
        await serviceClient.from("programa_predicacion").update({ notificado_16h: true }).eq("id", salida.id);
        avisos16h++;
      }

      if (!salida.notificado_1h && Math.abs(minutosParaSalida - 60) <= VENTANA_MINUTOS) {
        await notificarCategoria(
          "predicacion_recordatorio",
          [userId],
          "Tu salida de predicación es en 1 hora",
          `Te toca dirigir la salida de predicación de las ${horaTexto}.`
        );

        const puntoEncuentro = (salida as any).puntos_encuentro;
        if (puntoEncuentro) {
          const detalle = puntoEncuentro.direccion
            ? `${puntoEncuentro.nombre} — ${puntoEncuentro.direccion}`
            : puntoEncuentro.nombre;
          await notificarCategoria(
            "predicacion_punto_encuentro",
            [userId],
            "Punto de encuentro de tu salida",
            detalle
          );
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
