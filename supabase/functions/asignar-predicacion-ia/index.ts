// Edge function: asignar-predicacion-ia
// Genera y guarda automáticamente el programa mensual de Predicación (capitán +
// territorio + punto de encuentro) usando la API de Anthropic (Claude) con
// tool-calling. Solo cubre entradas "simples" (un territorio + un punto por
// horario) — las entradas "por grupos"/"por grupo individual" quedan fuera de
// alcance y se configuran a mano.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const RESTRICCIONES_DIAS: Record<string, number[]> = {
  sin_restriccion: [0, 1, 2, 3, 4, 5, 6],
  solo_fines_semana: [0, 6],
  solo_entre_semana: [1, 2, 3, 4, 5],
  solo_sabados: [6],
  solo_domingos: [0],
};

interface RequestBody {
  congregacion_id: string;
  anio: number;
  mes: number; // 0-11
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
      (!membership || !["admin", "editor", "super_admin", "sservicio"].includes(membership.rol as string))
    ) {
      return new Response(JSON.stringify({ error: "not_authorized" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    const fechaInicioMes = toISODate(new Date(Date.UTC(body.anio, body.mes, 1)));
    const fechaFinMes = toISODate(new Date(Date.UTC(body.anio, body.mes + 1, 0)));

    // Horarios de salida
    const { data: horarios } = await supabase
      .from("horarios_salida")
      .select("id, nombre, hora, orden")
      .eq("congregacion_id", body.congregacion_id)
      .eq("activo", true)
      .order("orden");

    if (!horarios || horarios.length === 0) {
      return new Response(JSON.stringify({ asignaciones: {}, fechas: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Días especiales que bloquean el mes (colspan_completo o por horario específico)
    const { data: diasEspeciales } = await supabase
      .from("dias_especiales")
      .select("id, nombre, bloqueo_tipo, fecha, fecha_fin, programas")
      .eq("congregacion_id", body.congregacion_id)
      .eq("activo", true)
      .lte("fecha", fechaFinMes)
      .or(`fecha_fin.gte.${fechaInicioMes},fecha_fin.is.null`);
    const diasEspecialesPredicacion = (diasEspeciales ?? []).filter(
      (d) => Array.isArray(d.programas) && (d.programas as string[]).includes("predicacion")
    );

    // Fechas del mes que NO son día de reunión (entre semana o fin de semana) y no
    // están cubiertas por un día especial "completo".
    const fechasBloqueadasCompleto = new Set<string>();
    for (const d of diasEspecialesPredicacion) {
      if (d.bloqueo_tipo !== "completo") continue;
      const desde = d.fecha as string;
      const hasta = (d.fecha_fin as string) || desde;
      const cur = new Date(desde + "T00:00:00Z");
      const finD = new Date(hasta + "T00:00:00Z");
      while (cur <= finD) {
        fechasBloqueadasCompleto.add(toISODate(cur));
        cur.setUTCDate(cur.getUTCDate() + 1);
      }
    }

    // Solo días de semana (lunes a viernes): sábado y domingo quedan siempre
    // fuera, se configuran a mano. El día de reunión entre semana SÍ se incluye
    // (solo el bloque específico que ocupa la reunión queda bloqueado más abajo,
    // por ejemplo la tarde de un martes con Vida y Ministerio a las 19:30 —
    // la mañana de ese mismo martes sigue disponible para predicación).
    const fechas: string[] = [];
    {
      const cur = new Date(fechaInicioMes + "T00:00:00Z");
      const fin = new Date(fechaFinMes + "T00:00:00Z");
      while (cur <= fin) {
        const dow = cur.getUTCDay();
        const iso = toISODate(cur);
        const esFinDeSemana = dow === 0 || dow === 6;
        if (!esFinDeSemana && !fechasBloqueadasCompleto.has(iso)) {
          fechas.push(iso);
        }
        cur.setUTCDate(cur.getUTCDate() + 1);
      }
    }

    if (fechas.length === 0) {
      return new Response(JSON.stringify({ asignaciones: {}, fechas: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Capitanes elegibles (RPC segura ya usada por el frontend)
    const { data: participantesSeguros } = await supabase.rpc("get_participantes_seguros", {
      _congregacion_id: body.congregacion_id,
    });
    const capitanes = (participantesSeguros ?? []).filter((p: any) => p.activo && p.es_capitan_grupo);

    // Asignaciones fijas (día + horario -> capitán) y disponibilidad recurrente
    const { data: fijas } = await supabase
      .from("asignaciones_capitan_fijas")
      .select("dia_semana, horario_id, capitan_id")
      .eq("congregacion_id", body.congregacion_id)
      .eq("activo", true);

    const { data: disponibilidad } = await supabase
      .from("disponibilidad_capitanes")
      .select("capitan_id, dia_semana, bloque_horario")
      .eq("congregacion_id", body.congregacion_id)
      .eq("activo", true);

    // Indisponibilidad puntual (rangos de fecha)
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

    const estaDisponiblePorHorario = (capitanId: string, diaSemana: number, esManana: boolean) => {
      const filas = (disponibilidad ?? []).filter((d) => d.capitan_id === capitanId && d.dia_semana === diaSemana);
      if (filas.length === 0) return true; // sin registro = disponible (igual que hoy en el frontend)
      return filas.some((f) => f.bloque_horario === "ambos" || f.bloque_horario === (esManana ? "manana" : "tarde"));
    };

    // Territorios candidatos: numero numérico, activos, y sin restricción de grupo
    // (para no invadir territorios reservados a un grupo específico en modo "por grupos").
    const { data: territoriosRaw } = await supabase
      .from("territorios")
      .select("id, numero, nombre, activo, grupo_predicacion_id")
      .eq("congregacion_id", body.congregacion_id)
      .eq("activo", true);
    const { data: territoriosGrupos } = await supabase
      .from("territorios_grupos_predicacion")
      .select("territorio_id")
      .eq("congregacion_id", body.congregacion_id);
    const territoriosConGrupo = new Set((territoriosGrupos ?? []).map((t) => t.territorio_id));

    const territoriosCandidatos = (territoriosRaw ?? []).filter(
      (t) => /^\d+$/.test((t.numero || "").trim()) && !territoriosConGrupo.has(t.id) && !t.grupo_predicacion_id
    );

    // Estado de ciclo por territorio (prioriza los que no tienen ciclo activo completado recientemente)
    const { data: ciclos } = await supabase
      .from("ciclos_territorio")
      .select("territorio_id, ciclo_numero, completado, fecha_inicio")
      .eq("congregacion_id", body.congregacion_id)
      .in("territorio_id", territoriosCandidatos.map((t) => t.id));
    const ultimoCicloPorTerritorio = new Map<string, { completado: boolean }>();
    for (const c of ciclos ?? []) {
      const cur = ultimoCicloPorTerritorio.get(c.territorio_id);
      if (!cur) ultimoCicloPorTerritorio.set(c.territorio_id, { completado: !!c.completado });
      // (no necesitamos el más reciente exacto; con que sepamos si el último visto está completado alcanza para priorizar)
    }
    const prioridadTerritorio = (territorioId: string) => {
      const ultimo = ultimoCicloPorTerritorio.get(territorioId);
      if (!ultimo) return 0; // sin ciclo = máxima prioridad (territorio "fresco")
      return ultimo.completado ? 2 : 1; // completado = menor prioridad; activo no completado = prioridad media
    };

    // Puntos de encuentro
    const { data: puntos } = await supabase
      .from("puntos_encuentro")
      .select("id, nombre")
      .eq("congregacion_id", body.congregacion_id)
      .eq("activo", true);

    // Entradas ya guardadas del mes (para no reasignar lo existente)
    const { data: entradasExistentes } = await supabase
      .from("programa_predicacion")
      .select("id, fecha, horario_id, capitan_id, punto_encuentro_id, territorio_ids, es_mensaje_especial, es_por_grupos")
      .eq("congregacion_id", body.congregacion_id)
      .eq("activo", true)
      .gte("fecha", fechaInicioMes)
      .lte("fecha", fechaFinMes);
    const entradasPorFecha = new Map<string, typeof entradasExistentes>();
    for (const e of entradasExistentes ?? []) {
      const arr = entradasPorFecha.get(e.fecha as string) ?? [];
      arr.push(e);
      entradasPorFecha.set(e.fecha as string, arr);
    }

    // Una salida general en la mañana y otra en la tarde por cada día de semana
    // (el primer horario configurado de cada bloque). Si un bloque de un día ya
    // está ocupado (por una entrada real, un mensaje especial como la reunión de
    // entre semana, o "por grupos"), ese bloque se salta y no se toca.
    const horariosOrdenados = [...horarios].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
    const horaNum = (h: string) => parseInt(h.split(":")[0], 10);
    const primerHorarioManana = horariosOrdenados.find((h) => horaNum(h.hora) < 12) ?? null;
    const primerHorarioTarde = horariosOrdenados.find((h) => horaNum(h.hora) >= 12) ?? null;
    const horaPorHorarioId = new Map(horarios.map((h) => [h.id, h.hora as string]));

    type Slot = { key: string; fecha: string; horario_id: string; horario_hora: string; entrada_id: string | null; ya_capitan: string | null; ya_punto: string | null; ya_territorio: string | null };
    const slots: Slot[] = [];
    for (const fecha of fechas) {
      const entradasDelDia = entradasPorFecha.get(fecha) ?? [];
      // Un bloque (mañana/tarde) está ocupado si hay alguna entrada de ese día
      // cuyo horario cae en ese bloque, o si es un mensaje especial que bloquea
      // el día completo (colspan_completo, sin horario específico).
      let mananaOcupada = false;
      let tardeOcupada = false;
      for (const e of entradasDelDia) {
        const hora = e.horario_id ? horaPorHorarioId.get(e.horario_id) : undefined;
        if (!hora) {
          // Sin horario específico (ej. mensaje especial de todo el día): bloquea ambos.
          mananaOcupada = true;
          tardeOcupada = true;
          continue;
        }
        if (horaNum(hora) < 12) mananaOcupada = true;
        else tardeOcupada = true;
      }

      if (primerHorarioManana && !mananaOcupada) {
        slots.push({
          key: `${fecha}__${primerHorarioManana.id}`,
          fecha,
          horario_id: primerHorarioManana.id,
          horario_hora: primerHorarioManana.hora,
          entrada_id: null,
          ya_capitan: null,
          ya_punto: null,
          ya_territorio: null,
        });
      }
      if (primerHorarioTarde && !tardeOcupada) {
        slots.push({
          key: `${fecha}__${primerHorarioTarde.id}`,
          fecha,
          horario_id: primerHorarioTarde.id,
          horario_hora: primerHorarioTarde.hora,
          entrada_id: null,
          ya_capitan: null,
          ya_punto: null,
          ya_territorio: null,
        });
      }
    }
    const slotsPendientes = slots;

    if (slotsPendientes.length === 0) {
      return new Response(JSON.stringify({ asignaciones: {}, fechas }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Candidatos de capitán por slot (respetando fija > disponibilidad > indisponibilidad)
    const capitanesPorSlot = new Map<string, string[]>();
    for (const slot of slotsPendientes) {
      if (slot.ya_capitan) {
        capitanesPorSlot.set(slot.key, []);
        continue;
      }
      const diaSemana = new Date(slot.fecha + "T12:00:00Z").getUTCDay();
      const esManana = parseInt(slot.horario_hora.split(":")[0], 10) < 12;
      const fija = (fijas ?? []).find((f) => f.dia_semana === diaSemana && f.horario_id === slot.horario_id);
      if (fija) {
        capitanesPorSlot.set(slot.key, [fija.capitan_id]);
        continue;
      }
      const elegibles = capitanes
        .filter((c: any) => {
          const diasPermitidos = RESTRICCIONES_DIAS[c.restriccion_disponibilidad || "sin_restriccion"] || RESTRICCIONES_DIAS.sin_restriccion;
          if (!diasPermitidos.includes(diaSemana)) return false;
          if (!estaDisponiblePorHorario(c.id, diaSemana, esManana)) return false;
          if (indisponibleEnFecha(c.id, slot.fecha)) return false;
          return true;
        })
        .map((c: any) => c.id);
      capitanesPorSlot.set(slot.key, elegibles);
    }

    const territoriosOrdenados = [...territoriosCandidatos].sort(
      (a, b) => prioridadTerritorio(a.id) - prioridadTerritorio(b.id)
    );

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "missing_api_key" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Eres un asistente que arma el programa mensual de predicación (salidas de servicio del ministerio) de una congregación de Testigos de Jehová, para varios horarios/fechas de un mes a la vez.

Para cada slot debes decidir hasta 3 cosas (solo las que falten, indicadas en "falta"): "capitan_id" (debe estar en la lista "capitanes_elegibles" del slot, o null si esa lista está vacía porque ya tiene capitán o no hay candidatos), "territorio_id" (de la lista global "territorios", ordenada ya de mayor a menor prioridad — prefiere los primeros de la lista) y "punto_encuentro_id" (de la lista global "puntos").

REGLAS:
- NUNCA repitas el mismo capitán en dos horarios de la MISMA fecha.
- Reparte los territorios: evita usar el mismo territorio más de 2 veces en todo el mes; prioriza los que aparecen antes en la lista "territorios" (ya vienen ordenados por prioridad — los que no tienen ciclo o tienen un ciclo activo van primero).
- Para punto de encuentro, evita repetir el mismo punto en dos horarios de la MISMA fecha si hay más de un punto disponible; en general repártelos de forma pareja durante el mes.
- Si un slot no tiene "falta" territorio o punto, no los incluyas en tu respuesta para ese campo (usa null).
- Si "capitanes_elegibles" de un slot es un array vacío, deja "capitan_id" en null (no hay nadie disponible o ya está asignado).

OBLIGATORIO: el array "asignaciones" debe tener EXACTAMENTE una entrada por cada elemento de "slots" (mismo "key"), con los 3 campos (usa null en los que no correspondan).`;

    const userPrompt = JSON.stringify({
      territorios: territoriosOrdenados.map((t) => ({ id: t.id, numero: t.numero })),
      puntos: (puntos ?? []).map((p) => ({ id: p.id, nombre: p.nombre })),
      slots: slotsPendientes.map((s) => ({
        key: s.key,
        fecha: s.fecha,
        hora: s.horario_hora,
        falta: {
          capitan: !s.ya_capitan,
          territorio: !s.ya_territorio,
          punto: !s.ya_punto,
        },
        capitanes_elegibles: capitanesPorSlot.get(s.key) ?? [],
      })),
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
            name: "asignar_predicacion",
            description: "Devuelve capitán/territorio/punto de encuentro sugeridos para cada slot.",
            input_schema: {
              type: "object",
              properties: {
                asignaciones: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      key: { type: "string" },
                      capitan_id: { type: ["string", "null"] },
                      territorio_id: { type: ["string", "null"] },
                      punto_encuentro_id: { type: ["string", "null"] },
                    },
                    required: ["key", "capitan_id", "territorio_id", "punto_encuentro_id"],
                  },
                },
              },
              required: ["asignaciones"],
            },
          },
        ],
        tool_choice: { type: "tool", name: "asignar_predicacion" },
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
    let asignacionesIA: { key: string; capitan_id: string | null; territorio_id: string | null; punto_encuentro_id: string | null }[] = [];
    try {
      const args = toolUse?.input ?? {};
      asignacionesIA = Array.isArray(args.asignaciones) ? args.asignaciones : [];
    } catch (e) {
      console.error("Parse tool args error", e);
    }

    // Post-validación + red de seguridad + guardado
    const slotPorKey = new Map(slotsPendientes.map((s) => [s.key, s]));
    const capitanesUsadosPorFecha = new Map<string, Set<string>>();
    const contadorTerritorio = new Map<string, number>();
    const puntosUsadosPorFecha = new Map<string, Set<string>>();
    const territorioIds = new Set(territoriosOrdenados.map((t) => t.id));
    const puntoIds = new Set((puntos ?? []).map((p) => p.id));

    const resultado: Record<string, { capitan_id: string | null; territorio_id: string | null; punto_encuentro_id: string | null }> = {};

    for (const slot of slotsPendientes) {
      const propuesta = asignacionesIA.find((a) => a.key === slot.key);
      const usadosCap = capitanesUsadosPorFecha.get(slot.fecha) ?? new Set<string>();
      const usadosPunto = puntosUsadosPorFecha.get(slot.fecha) ?? new Set<string>();

      let capitanId: string | null = null;
      if (slot.ya_capitan) {
        capitanId = null; // no tocar
      } else {
        const cand = propuesta?.capitan_id;
        const elegibles = capitanesPorSlot.get(slot.key) ?? [];
        if (cand && elegibles.includes(cand) && !usadosCap.has(cand)) {
          capitanId = cand;
        } else {
          capitanId = elegibles.find((id) => !usadosCap.has(id)) ?? null;
        }
        if (capitanId) usadosCap.add(capitanId);
      }

      let territorioId: string | null = null;
      if (!slot.ya_territorio) {
        const cand = propuesta?.territorio_id;
        if (cand && territorioIds.has(cand) && (contadorTerritorio.get(cand) ?? 0) < 2) {
          territorioId = cand;
        } else {
          territorioId = territoriosOrdenados.find((t) => (contadorTerritorio.get(t.id) ?? 0) < 2)?.id
            ?? territoriosOrdenados[0]?.id
            ?? null;
        }
        if (territorioId) contadorTerritorio.set(territorioId, (contadorTerritorio.get(territorioId) ?? 0) + 1);
      }

      let puntoId: string | null = null;
      if (!slot.ya_punto) {
        const cand = propuesta?.punto_encuentro_id;
        if (cand && puntoIds.has(cand) && !usadosPunto.has(cand)) {
          puntoId = cand;
        } else {
          puntoId = (puntos ?? []).find((p) => !usadosPunto.has(p.id))?.id ?? (puntos ?? [])[0]?.id ?? null;
        }
        if (puntoId) usadosPunto.add(puntoId);
      }

      capitanesUsadosPorFecha.set(slot.fecha, usadosCap);
      puntosUsadosPorFecha.set(slot.fecha, usadosPunto);
      resultado[slot.key] = { capitan_id: capitanId, territorio_id: territorioId, punto_encuentro_id: puntoId };
    }

    if (!usuarioSinLimite) {
      await supabase.rpc("incrementar_ia_uso_mensual", {
        _congregacion_id: body.congregacion_id,
        _periodo: periodo,
        _limite: LIMITE_IA_MENSUAL,
      });
    }

    // Guardar: insertar entradas nuevas o actualizar las existentes con lo que faltaba.
    for (const slot of slotsPendientes) {
      const r = resultado[slot.key];
      if (!r.capitan_id && !r.territorio_id && !r.punto_encuentro_id) continue;
      if (slot.entrada_id) {
        const update: Record<string, unknown> = {};
        if (r.capitan_id) update.capitan_id = r.capitan_id;
        if (r.punto_encuentro_id) update.punto_encuentro_id = r.punto_encuentro_id;
        if (r.territorio_id) update.territorio_ids = [r.territorio_id];
        if (Object.keys(update).length > 0) {
          const { error } = await supabase.from("programa_predicacion").update(update).eq("id", slot.entrada_id);
          if (error) console.error("Error actualizando", slot.key, error);
        }
      } else {
        const { error } = await supabase.from("programa_predicacion").insert({
          congregacion_id: body.congregacion_id,
          fecha: slot.fecha,
          horario_id: slot.horario_id,
          capitan_id: r.capitan_id,
          punto_encuentro_id: r.punto_encuentro_id,
          territorio_ids: r.territorio_id ? [r.territorio_id] : [],
        });
        if (error) console.error("Error creando", slot.key, error);
      }
    }

    return new Response(
      JSON.stringify({ asignaciones: resultado, fechas }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("asignar-predicacion-ia error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "unknown_error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
