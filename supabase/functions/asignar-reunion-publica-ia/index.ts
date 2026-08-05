// Edge function: asignar-reunion-publica-ia
// Genera y guarda automáticamente el programa mensual de Reunión Pública
// (presidente, lector de la Atalaya, conductor de la Atalaya, orador suplente
// y orador saliente) usando la API de Anthropic (Claude) con tool-calling.
// No toca orador_id/orador_nombre/tema_discurso (orador suele ser visitante externo).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DIA_SEMANA_MAP: Record<string, number> = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
};

interface RequestBody {
  congregacion_id: string;
  anio: number;
  mes: number; // 0-11, igual que Date de JS
}

function buildClient(authHeader: string | null) {
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, serviceKey, {
    global: { headers: authHeader ? { Authorization: authHeader } : {} },
  });
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Fechas del día de reunión de fin de semana configurado, dentro del mes indicado. */
function fechasDelMes(anio: number, mes: number, diaFinSemana: number): string[] {
  const inicio = new Date(Date.UTC(anio, mes, 1));
  const fin = new Date(Date.UTC(anio, mes + 1, 0));
  const fechas: string[] = [];
  const cursor = new Date(inicio);
  while (cursor <= fin) {
    if (cursor.getUTCDay() === diaFinSemana) fechas.push(toISODate(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return fechas;
}

function semanasEntre(fechaA: string, fechaB: string): number {
  try {
    const a = new Date(fechaA + "T00:00:00Z").getTime();
    const b = new Date(fechaB + "T00:00:00Z").getTime();
    const dias = Math.abs(Math.round((a - b) / 86400000));
    return Math.floor(dias / 7);
  } catch {
    return 999;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "no_auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as RequestBody;
    if (!body.congregacion_id || body.anio == null || body.mes == null) {
      return new Response(JSON.stringify({ error: "invalid_body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = buildClient(authHeader);

    const { data: userData, error: userErr } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "invalid_user" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const USUARIOS_SIN_LIMITE_IA = new Set(["miguelmevo@gmail.com", "miguelmevo@live.com"]);
    const usuarioSinLimite = USUARIOS_SIN_LIMITE_IA.has((userData.user.email ?? "").toLowerCase());

    const { data: rolesGlobales } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "super_admin")
      .maybeSingle();
    const esSuperAdminGlobal = !!rolesGlobales;

    const { data: membership } = await supabase
      .from("usuarios_congregacion")
      .select("rol")
      .eq("user_id", userId)
      .eq("congregacion_id", body.congregacion_id)
      .eq("activo", true)
      .maybeSingle();

    if (
      !esSuperAdminGlobal &&
      (!membership || !["admin", "editor", "super_admin", "srpublica"].includes(membership.rol as string))
    ) {
      return new Response(JSON.stringify({ error: "not_authorized" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Límite de uso mensual de IA, compartido entre los programas que usan IA
    // (Vida y Ministerio, Reunión Pública, Predicación).
    const LIMITE_IA_MENSUAL = 10;
    const periodo = new Date().toISOString().slice(0, 7);
    if (!usuarioSinLimite) {
      const { data: usoActual } = await supabase
        .from("ia_uso_mensual")
        .select("usos")
        .eq("congregacion_id", body.congregacion_id)
        .eq("periodo", periodo)
        .maybeSingle();
      if ((usoActual?.usos ?? 0) >= LIMITE_IA_MENSUAL) {
        return new Response(
          JSON.stringify({
            error: "ia_limit_reached",
            message: `Se agotaron los ${LIMITE_IA_MENSUAL} usos de IA de este mes para esta congregación. Vuelve el próximo mes.`,
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Config general (día de reunión de fin de semana) y de Reunión Pública (ventanas de rotación).
    const { data: configsGeneral } = await supabase
      .from("configuracion_sistema")
      .select("clave, valor")
      .eq("congregacion_id", body.congregacion_id)
      .eq("programa_tipo", "general");
    const diasReunionCfg = configsGeneral?.find((c) => c.clave === "dias_reunion")?.valor as
      | { dia_fin_semana?: string }
      | undefined;
    const diaFinSemana = DIA_SEMANA_MAP[diasReunionCfg?.dia_fin_semana ?? "domingo"] ?? 0;

    const { data: configsRp } = await supabase
      .from("configuracion_sistema")
      .select("clave, valor")
      .eq("congregacion_id", body.congregacion_id)
      .eq("programa_tipo", "reunion_publica");
    const cfgRp = (k: string) => configsRp?.find((c) => c.clave === k)?.valor as Record<string, unknown> | undefined;
    const num = (v: unknown, def: number) => {
      const n = typeof v === "number" ? v : parseInt(String(v), 10);
      return isNaN(n) || n < 0 ? def : n;
    };
    const ventanaRotacion = num(cfgRp("ventana_rotacion_semanas")?.semanas, 8);
    const ventanaDescansoGlobal = num(cfgRp("ventana_descanso_global_semanas")?.semanas, 0);
    const umbralRelajacion = num(cfgRp("umbral_relajacion_seleccion")?.cantidad, 5);

    // Fechas de reunión del mes, excluyendo días especiales (asamblea, conmemoración, etc.)
    const todasFechas = fechasDelMes(body.anio, body.mes, diaFinSemana);
    const fechaInicioMes = todasFechas[0] ?? toISODate(new Date(Date.UTC(body.anio, body.mes, 1)));
    const fechaFinMes = todasFechas[todasFechas.length - 1] ?? fechaInicioMes;

    const { data: diasEspeciales } = await supabase
      .from("reunion_publica_dias_especiales")
      .select("fecha")
      .eq("congregacion_id", body.congregacion_id)
      .gte("fecha", fechaInicioMes)
      .lte("fecha", fechaFinMes);
    const fechasBloqueadas = new Set((diasEspeciales ?? []).map((d) => d.fecha as string));
    const fechas = todasFechas.filter((f) => !fechasBloqueadas.has(f));

    if (fechas.length === 0) {
      return new Response(JSON.stringify({ asignaciones: {}, fechas: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Participantes y pools elegibles
    const { data: participantes } = await supabase
      .from("participantes")
      .select("id,nombre,apellido,genero,responsabilidad,estado_aprobado,es_publicador_inactivo,activo")
      .eq("congregacion_id", body.congregacion_id)
      .eq("activo", true)
      .eq("es_publicador_inactivo", false);

    const { data: conductoresRows } = await supabase
      .from("conductores_atalaya")
      .select("participante_id")
      .eq("congregacion_id", body.congregacion_id)
      .eq("activo", true);
    const conductoresIds = new Set((conductoresRows ?? []).map((c) => c.participante_id));

    const { data: lectoresRows } = await supabase
      .from("lectores_atalaya_elegibles")
      .select("participante_id")
      .eq("congregacion_id", body.congregacion_id)
      .eq("activo", true);
    const lectoresIds = new Set((lectoresRows ?? []).map((l) => l.participante_id));

    const esAoSM = (resp: string[] | null) =>
      (resp ?? []).includes("anciano") || (resp ?? []).includes("siervo_ministerial");

    // Indisponibilidad puntual (rangos de fecha) — igual patrón que VyM/Predicación.
    const { data: indisp } = await supabase
      .from("indisponibilidad_participantes")
      .select("participante_id, fecha_inicio, fecha_fin, tipo_responsabilidad")
      .eq("congregacion_id", body.congregacion_id)
      .eq("activo", true)
      .lte("fecha_inicio", fechaFinMes);
    const indisponibleEnFecha = (participanteId: string, fecha: string) =>
      (indisp ?? []).some(
        (i) =>
          i.participante_id === participanteId &&
          i.fecha_inicio <= fecha &&
          (!i.fecha_fin || i.fecha_fin >= fecha)
      );

    // Historial: últimas 2 fechas por categoría (presidencia, lector_atalaya) de los
    // últimos meses, para que la IA pueda calcular la rotación.
    const ventanaMaxSemanas = Math.max(ventanaRotacion, ventanaDescansoGlobal, 8) + 4;
    const fechaLimite = new Date(fechaInicioMes + "T00:00:00Z");
    fechaLimite.setUTCDate(fechaLimite.getUTCDate() - ventanaMaxSemanas * 7);
    const fechaLimiteISO = toISODate(fechaLimite);

    const { data: historial } = await supabase
      .from("programa_reunion_publica")
      .select("fecha, presidente_id, lector_atalaya_id, conductor_atalaya_id, orador_suplente_id, orador_saliente_id")
      .eq("congregacion_id", body.congregacion_id)
      .eq("activo", true)
      .gte("fecha", fechaLimiteISO)
      .lt("fecha", fechaInicioMes)
      .order("fecha", { ascending: true });

    const ultimasPorCategoria = new Map<string, Record<string, string>>();
    const setUlt = (id: string | null | undefined, cat: string, fecha: string) => {
      if (!id) return;
      const cur = ultimasPorCategoria.get(id) ?? {};
      if (!cur[cat] || cur[cat] <= fecha) cur[cat] = fecha;
      ultimasPorCategoria.set(id, cur);
    };
    for (const h of historial ?? []) {
      setUlt(h.presidente_id, "presidencia", h.fecha as string);
      setUlt(h.lector_atalaya_id, "lector_atalaya", h.fecha as string);
      setUlt(h.conductor_atalaya_id, "conductor_atalaya", h.fecha as string);
      setUlt(h.orador_suplente_id, "orador_suplente", h.fecha as string);
      setUlt(h.orador_saliente_id, "orador_saliente", h.fecha as string);
    }

    // Filas ya guardadas del mes (para no reasignar lo que el usuario ya puso a mano)
    const { data: filasMes } = await supabase
      .from("programa_reunion_publica")
      .select("fecha, presidente_id, lector_atalaya_id, conductor_atalaya_id, orador_suplente_id, orador_saliente_id")
      .eq("congregacion_id", body.congregacion_id)
      .in("fecha", fechas);
    const filasPorFecha = new Map((filasMes ?? []).map((f) => [f.fecha as string, f]));

    // Slots a llenar: uno por (fecha, rol), solo si no tiene ya un valor guardado.
    type Slot = { key: string; fecha: string; rol: string; categoria: string; elegibles: string[] };
    const slots: Slot[] = [];
    for (const fecha of fechas) {
      const fila = filasPorFecha.get(fecha);
      const push = (rol: string, categoria: string, elegibles: Set<string>) => {
        const key = `${fecha}__${rol}`;
        const yaTiene = (fila as any)?.[`${rol}_id`];
        if (yaTiene) return;
        slots.push({ key, fecha, rol, categoria, elegibles: [...elegibles] });
      };
      const idsAoSM = new Set((participantes ?? []).filter((p) => esAoSM(p.responsabilidad as string[])).map((p) => p.id));
      push("presidente", "presidencia", idsAoSM);
      push(
        "lector_atalaya",
        "lector_atalaya",
        new Set([...lectoresIds].filter((id) => (participantes ?? []).some((p) => p.id === id)))
      );
      push(
        "conductor_atalaya",
        "conductor_atalaya",
        new Set([...conductoresIds].filter((id) => (participantes ?? []).some((p) => p.id === id)))
      );
      push("orador_suplente", "orador_suplente", idsAoSM);
      push("orador_saliente", "orador_saliente", idsAoSM);
    }

    if (slots.length === 0) {
      return new Response(JSON.stringify({ asignaciones: {}, fechas }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resumenParticipantes = (participantes ?? []).map((p) => ({
      id: p.id,
      nombre: `${p.nombre} ${p.apellido}`,
      es_anciano_o_sm: esAoSM(p.responsabilidad as string[]),
      es_lector_atalaya_elegible: lectoresIds.has(p.id),
      es_conductor_atalaya: conductoresIds.has(p.id),
      ultimas_por_categoria: ultimasPorCategoria.get(p.id) ?? {},
    }));

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "missing_api_key" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Eres un asistente que ayuda a asignar participantes al programa de Reunión Pública de una congregación de Testigos de Jehová, para varias fechas de un mes a la vez.

REGLAS GENERALES:
- Cada slot tiene una lista "elegibles" (ids uuid) — SOLO puedes asignar un id que esté en esa lista para ese slot. No inventes ids.
- NUNCA asignes al mismo participante a dos roles distintos en la MISMA fecha.
- Distribuye lo más posible entre distintos participantes a lo largo del mes (no repitas siempre a los mismos si hay más candidatos elegibles).

REGLAS DE ROTACIÓN (categorías "presidencia" y "lector_atalaya"):
- Para cada candidato, revisa "ultimas_por_categoria[categoria del slot]" (si el slot es presidencia o lector_atalaya). Si esa fecha dista MENOS de ${ventanaRotacion} semanas de la fecha del slot → está BLOQUEADO por rotación para esa categoría.
- Si "ventana_descanso_global_semanas" (${ventanaDescansoGlobal}) > 0: además, si CUALQUIER participación en presidencia o lector_atalaya combinada dista menos de esas semanas → BLOQUEADO por descanso.
- Prefiere SIEMPRE un candidato no bloqueado. Solo usa uno bloqueado si hay menos de ${umbralRelajacion} candidatos disponibles (no bloqueados) para ese slot.
- Prioriza, entre los disponibles, al que tenga la fecha más antigua (o ninguna) en "ultimas_por_categoria" para esa categoría.

Para "conductor_atalaya", "orador_suplente" y "orador_saliente" no hay regla de bloqueo estricta, pero igual prioriza rotar (el que tenga la fecha más antigua en su categoría).

Si no encuentras candidato razonable para un slot, devuelve participante_id = null (no inventes).

OBLIGATORIO: el array "asignaciones" debe tener EXACTAMENTE una entrada por cada elemento de "slots" (mismo "key"), sin omitir ninguno.`;

    const userPrompt = JSON.stringify({
      ventana_rotacion_semanas: ventanaRotacion,
      ventana_descanso_global_semanas: ventanaDescansoGlobal,
      umbral_relajacion: umbralRelajacion,
      slots: slots.map((s) => ({ key: s.key, fecha: s.fecha, rol: s.rol, categoria: s.categoria, elegibles: s.elegibles })),
      participantes: resumenParticipantes,
    });

    const aiResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 8192,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
        tools: [
          {
            name: "asignar_reunion_publica",
            description: "Devuelve el participante asignado a cada slot (fecha+rol) del mes.",
            input_schema: {
              type: "object",
              properties: {
                asignaciones: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      key: { type: "string" },
                      participante_id: { type: ["string", "null"] },
                    },
                    required: ["key", "participante_id"],
                  },
                },
              },
              required: ["asignaciones"],
            },
          },
        ],
        tool_choice: { type: "tool", name: "asignar_reunion_publica" },
      }),
    });

    if (!aiResp.ok) {
      const txt = await aiResp.text();
      console.error("Anthropic API error:", aiResp.status, txt);
      if (aiResp.status === 402) {
        return new Response(
          JSON.stringify({ error: "Se han agotado los créditos de IA. Revisa el saldo de tu cuenta de Anthropic." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiResp.json();
    const toolUse = (aiJson?.content ?? []).find((c: any) => c.type === "tool_use");
    let asignacionesIA: { key: string; participante_id: string | null }[] = [];
    try {
      const args = toolUse?.input ?? {};
      asignacionesIA = Array.isArray(args.asignaciones) ? args.asignaciones : [];
    } catch (e) {
      console.error("Parse tool args error", e);
    }

    // Post-validación: solo aceptar ids elegibles para ese slot, no indisponibles ese
    // día, y no repetir al mismo participante dos veces en la misma fecha.
    const slotPorKey = new Map(slots.map((s) => [s.key, s]));
    const usadosPorFecha = new Map<string, Set<string>>();
    const resultado: Record<string, string | null> = {};
    for (const a of asignacionesIA) {
      const slot = slotPorKey.get(a.key);
      if (!slot) continue;
      const usados = usadosPorFecha.get(slot.fecha) ?? new Set<string>();
      const id = a.participante_id;
      if (
        id &&
        slot.elegibles.includes(id) &&
        !usados.has(id) &&
        !indisponibleEnFecha(id, slot.fecha)
      ) {
        resultado[a.key] = id;
        usados.add(id);
        usadosPorFecha.set(slot.fecha, usados);
      } else {
        resultado[a.key] = null;
      }
    }

    // Red de seguridad: slots que quedaron sin sugerencia pese a tener candidatos
    // elegibles disponibles.
    for (const slot of slots) {
      if (resultado[slot.key]) continue;
      const usados = usadosPorFecha.get(slot.fecha) ?? new Set<string>();
      const candidato = slot.elegibles
        .filter((id) => !usados.has(id) && !indisponibleEnFecha(id, slot.fecha))
        .sort((a, b) => {
          const fa = ultimasPorCategoria.get(a)?.[slot.categoria] ?? "";
          const fb = ultimasPorCategoria.get(b)?.[slot.categoria] ?? "";
          return fa.localeCompare(fb);
        })[0];
      if (candidato) {
        resultado[slot.key] = candidato;
        usados.add(candidato);
        usadosPorFecha.set(slot.fecha, usados);
      } else {
        resultado[slot.key] = null;
      }
    }

    if (!usuarioSinLimite) {
      await supabase.rpc("incrementar_ia_uso_mensual", {
        _congregacion_id: body.congregacion_id,
        _periodo: periodo,
        _limite: LIMITE_IA_MENSUAL,
      });
    }

    // Guardar directamente (upsert por fecha), fusionando con lo que ya existía.
    for (const fecha of fechas) {
      const fila = filasPorFecha.get(fecha) as any;
      const payload: Record<string, unknown> = { congregacion_id: body.congregacion_id, fecha };
      let huboCambio = false;
      for (const rol of ["presidente", "lector_atalaya", "conductor_atalaya", "orador_suplente", "orador_saliente"]) {
        const key = `${fecha}__${rol}`;
        const nuevo = resultado[key];
        const actual = fila?.[`${rol}_id`] ?? null;
        const valor = actual ?? nuevo ?? null;
        if (valor) {
          payload[`${rol}_id`] = valor;
          if (!actual && nuevo) huboCambio = true;
        }
      }
      if (huboCambio) {
        const { error: upsertErr } = await supabase
          .from("programa_reunion_publica")
          .upsert(payload, { onConflict: "congregacion_id,fecha" });
        if (upsertErr) console.error("Error guardando", fecha, upsertErr);
      }
    }

    return new Response(
      JSON.stringify({ asignaciones: resultado, fechas }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("asignar-reunion-publica-ia error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "unknown_error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
