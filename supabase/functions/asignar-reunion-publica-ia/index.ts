// Edge function: asignar-reunion-publica-ia
// Genera y guarda automáticamente el programa mensual de Reunión Pública
// (SOLO presidente y lector de la Atalaya) usando la API de Anthropic (Claude)
// con tool-calling. Conductor de la Atalaya, orador, orador suplente y orador
// saliente quedan fuera de alcance — se configuran a mano.
//
// El bloqueo por rotación/descanso se calcula EN EL SERVIDOR antes de llamar a
// la IA: un candidato bloqueado ni siquiera aparece en la lista de elegibles
// que ve el modelo, así que es imposible que lo proponga por error.
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

const CATEGORIAS_RP = ["presidencia", "lector_atalaya"] as const;
type CategoriaRP = (typeof CATEGORIAS_RP)[number];

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

/**
 * Filtra `poolIds` dejando solo los candidatos NO bloqueados por rotación de
 * categoría ni por descanso global para `fecha`. Si quedan menos disponibles
 * que `umbralRelajacion`, se relaja la regla y se usa el pool completo (igual
 * criterio que el resto de la app). Devuelve la lista ya ordenada por
 * prioridad: nunca asignado primero, luego el de fecha más antigua.
 */
function candidatosDisponibles(
  poolIds: string[],
  categoria: CategoriaRP,
  fecha: string,
  ultimasPorCategoria: Map<string, Record<string, string>>,
  ventanaRotacion: number,
  ventanaDescansoGlobal: number,
  umbralRelajacion: number
): string[] {
  const estaBloqueado = (id: string) => {
    const cats = ultimasPorCategoria.get(id) ?? {};
    if (ventanaRotacion > 0) {
      const f = cats[categoria];
      if (f && semanasEntre(fecha, f) < ventanaRotacion) return true;
    }
    if (ventanaDescansoGlobal > 0) {
      let mejorSem: number | null = null;
      for (const c of CATEGORIAS_RP) {
        const f = cats[c];
        if (!f) continue;
        const sem = semanasEntre(fecha, f);
        if (mejorSem === null || sem < mejorSem) mejorSem = sem;
      }
      if (mejorSem !== null && mejorSem < ventanaDescansoGlobal) return true;
    }
    return false;
  };

  let disponibles = poolIds.filter((id) => !estaBloqueado(id));
  if (disponibles.length < umbralRelajacion) disponibles = [...poolIds];

  const fechaCategoria = (id: string) => ultimasPorCategoria.get(id)?.[categoria] ?? "";
  return disponibles.sort((a, b) => fechaCategoria(a).localeCompare(fechaCategoria(b)));
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

    // Historial: últimas fechas por categoría (presidencia, lector_atalaya) de los
    // últimos meses, para calcular la rotación.
    const ventanaMaxSemanas = Math.max(ventanaRotacion, ventanaDescansoGlobal, 8) + 4;
    const fechaLimite = new Date(fechaInicioMes + "T00:00:00Z");
    fechaLimite.setUTCDate(fechaLimite.getUTCDate() - ventanaMaxSemanas * 7);
    const fechaLimiteISO = toISODate(fechaLimite);

    const { data: historial } = await supabase
      .from("programa_reunion_publica")
      .select("fecha, presidente_id, lector_atalaya_id")
      .eq("congregacion_id", body.congregacion_id)
      .eq("activo", true)
      .gte("fecha", fechaLimiteISO)
      .lt("fecha", fechaInicioMes)
      .order("fecha", { ascending: true });

    // Mapa MUTABLE: se va actualizando a medida que resolvemos cada fecha del
    // mes en orden, para que la elegibilidad de una fecha posterior SIEMPRE
    // considere lo recién asignado a fechas anteriores dentro de esta misma
    // corrida (si no, la misma persona podría "verse disponible" para dos
    // fechas seguidas del mismo mes porque ninguna de las dos existía todavía
    // cuando se calculó el historial).
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
    }

    // Filas ya guardadas del mes (para no reasignar lo que el usuario ya puso a mano,
    // y también para que esas fechas ya fijas cuenten como "ocupadas" al calcular
    // el bloqueo de las demás fechas del mismo mes).
    const { data: filasMes } = await supabase
      .from("programa_reunion_publica")
      .select("fecha, presidente_id, lector_atalaya_id")
      .eq("congregacion_id", body.congregacion_id)
      .in("fecha", fechas);
    const filasPorFecha = new Map((filasMes ?? []).map((f) => [f.fecha as string, f]));
    for (const f of filasMes ?? []) {
      setUlt(f.presidente_id, "presidencia", f.fecha as string);
      setUlt(f.lector_atalaya_id, "lector_atalaya", f.fecha as string);
    }

    // Slots a llenar: uno por (fecha, rol), solo presidente y lector_atalaya, y
    // solo si no tienen ya un valor guardado. "elegibles" ya viene filtrada por
    // bloqueo de rotación/descanso — un candidato bloqueado nunca aparece acá.
    type Slot = { key: string; fecha: string; rol: string; categoria: CategoriaRP; elegibles: string[] };
    const slots: Slot[] = [];
    const idsAoSM = [...new Set((participantes ?? []).filter((p) => esAoSM(p.responsabilidad as string[])).map((p) => p.id))];
    const idsLector = [...new Set([...lectoresIds].filter((id) => (participantes ?? []).some((p) => p.id === id)))];

    for (const fecha of fechas) {
      const fila = filasPorFecha.get(fecha) as any;
      if (!fila?.presidente_id) {
        const elegibles = candidatosDisponibles(
          idsAoSM.filter((id) => !indisponibleEnFecha(id, fecha)),
          "presidencia",
          fecha,
          ultimasPorCategoria,
          ventanaRotacion,
          ventanaDescansoGlobal,
          umbralRelajacion
        );
        slots.push({ key: `${fecha}__presidente`, fecha, rol: "presidente", categoria: "presidencia", elegibles });
      }
      if (!fila?.lector_atalaya_id) {
        const elegibles = candidatosDisponibles(
          idsLector.filter((id) => !indisponibleEnFecha(id, fecha)),
          "lector_atalaya",
          fecha,
          ultimasPorCategoria,
          ventanaRotacion,
          ventanaDescansoGlobal,
          umbralRelajacion
        );
        slots.push({ key: `${fecha}__lector_atalaya`, fecha, rol: "lector_atalaya", categoria: "lector_atalaya", elegibles });
      }
    }

    if (slots.length === 0) {
      return new Response(JSON.stringify({ asignaciones: {}, fechas }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resumenParticipantes = (participantes ?? []).map((p) => ({
      id: p.id,
      nombre: `${p.nombre} ${p.apellido}`,
      ultimas_por_categoria: ultimasPorCategoria.get(p.id) ?? {},
    }));

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "missing_api_key" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Eres un asistente que ayuda a asignar Presidente y Lector de la Atalaya al programa de Reunión Pública de una congregación de Testigos de Jehová, para varias fechas de un mes a la vez.

REGLAS:
- Cada slot tiene una lista "elegibles" (ids uuid), YA FILTRADA para excluir a quien esté bloqueado por rotación o descanso, y YA ORDENADA por prioridad (el primero de la lista es quien nunca ha tenido esa categoría o lleva más tiempo sin tenerla). SOLO puedes asignar un id que esté en esa lista. No inventes ids.
- Por defecto, elige el PRIMER candidato de la lista "elegibles" de cada slot (ya viene en el orden correcto de prioridad). Solo elige otro si el primero ya quedó usado ese mismo día en otro rol.
- NUNCA asignes al mismo participante a Presidente y Lector de la Atalaya en la MISMA fecha.
- Si "elegibles" está vacío, devuelve participante_id = null.

OBLIGATORIO: el array "asignaciones" debe tener EXACTAMENTE una entrada por cada elemento de "slots" (mismo "key"), sin omitir ninguno.`;

    const userPrompt = JSON.stringify({
      slots: slots.map((s) => ({ key: s.key, fecha: s.fecha, rol: s.rol, elegibles: s.elegibles })),
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

    // Resolución final SECUENCIAL (fecha por fecha, en orden cronológico): la
    // lista "elegibles" de cada slot se recalcula en este momento con el mapa
    // MUTABLE de últimas participaciones, que se va actualizando a medida que
    // se resuelve cada fecha — así una fecha posterior siempre ve lo recién
    // asignado a una fecha anterior de este mismo mes (evita que la misma
    // persona quede "disponible" para dos semanas seguidas dentro de la misma
    // corrida). La sugerencia de la IA se usa solo si sigue siendo válida en
    // el momento de resolverla; si no, se reemplaza por el primero de la lista
    // ya filtrada y ordenada por prioridad.
    const propuestaIAPorKey = new Map(asignacionesIA.map((a) => [a.key, a.participante_id]));
    const usadosPorFecha = new Map<string, Set<string>>();
    const resultado: Record<string, string | null> = {};

    for (const fecha of fechas) {
      const fila = filasPorFecha.get(fecha) as any;
      const usadosHoy = usadosPorFecha.get(fecha) ?? new Set<string>();

      const resolverRol = (rol: "presidente" | "lector_atalaya", categoria: CategoriaRP, pool: string[]) => {
        const key = `${fecha}__${rol}`;
        if ((fila as any)?.[`${rol}_id`]) return; // ya tenía dato guardado, no se toca
        const elegibles = candidatosDisponibles(
          pool.filter((id) => !indisponibleEnFecha(id, fecha)),
          categoria,
          fecha,
          ultimasPorCategoria,
          ventanaRotacion,
          ventanaDescansoGlobal,
          umbralRelajacion
        );
        const propuesta = propuestaIAPorKey.get(key);
        let elegido: string | null = null;
        if (propuesta && elegibles.includes(propuesta) && !usadosHoy.has(propuesta)) {
          elegido = propuesta;
        } else {
          elegido = elegibles.find((id) => !usadosHoy.has(id)) ?? null;
        }
        resultado[key] = elegido;
        if (elegido) {
          usadosHoy.add(elegido);
          setUlt(elegido, categoria, fecha);
        }
      };

      resolverRol("presidente", "presidencia", idsAoSM);
      resolverRol("lector_atalaya", "lector_atalaya", idsLector);
      usadosPorFecha.set(fecha, usadosHoy);
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
      for (const rol of ["presidente", "lector_atalaya"]) {
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
