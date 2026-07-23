// Edge function: asignar-vida-ministerio-ia
// Genera sugerencias de asignación de participantes para el programa Vida y Ministerio
// usando la API de Anthropic (Claude) con tool-calling para output estructurado.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PALABRAS_FAMILIA_DEFAULT =
  "esposo, esposa, hijo, hija, hermano, hermana, padre, madre, familia, matrimonio, pareja";

interface Slot {
  key: string;
  titulo: string;
  filtro:
    | "anciano"
    | "anciano_o_sm"
    | "anciano_o_sm_varon"
    | "varon_publicador"
    | "varon_emc"
    | "publicador"
    | "lector_atalaya"
    | "lector_ebc"
    | "superintendente_circuito"
    | "aprobado"
    | "cualquiera";
  seccion?: "tesoros" | "maestros" | "vida_cristiana" | "estudio_biblico" | "cabecera";
  es_familiar?: boolean; // sólo se usa para pares titular/ayudante
}

interface RequestBody {
  congregacion_id: string;
  fecha_semana: string;
  modo: "auto" | "reasignar";
  slots: Slot[];
  // Slots ya asignados (para no reasignar en modo auto y evitar duplicados)
  ya_asignados?: Record<string, string | null>;
}

function buildClient(authHeader: string | null) {
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, serviceKey, {
    global: { headers: authHeader ? { Authorization: authHeader } : {} },
  });
}

function detectaFamilia(titulo: string, palabrasCSV: string): boolean {
  const palabras = palabrasCSV
    .split(",")
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
  const t = titulo.toLowerCase();
  return palabras.some((p) => t.includes(p));
}

/**
 * Replica server-side la elegibilidad de src/components/vida-ministerio/ParticipanteSelector.tsx
 * (cumpleFiltro), para poder usarla como red de seguridad cuando la IA deja un slot sin
 * sugerencia pese a existir candidatos válidos.
 */
function cumpleFiltroServer(
  p: { activo: boolean; es_publicador_inactivo: boolean; inscrito_emc: boolean | null; genero: string | null; responsabilidad: string[] | null; estado_aprobado: boolean | null },
  filtro: string,
  lectorEbcElegible: boolean
): boolean {
  if (!p.activo || p.es_publicador_inactivo) return false;
  const exentoEmc = filtro === "aprobado" || filtro === "lector_atalaya" || filtro === "lector_ebc";
  if (!exentoEmc && p.inscrito_emc !== true) return false;

  const resp = p.responsabilidad ?? [];
  switch (filtro) {
    case "anciano":
      return resp.includes("anciano");
    case "anciano_o_sm":
      return resp.includes("anciano") || resp.includes("siervo_ministerial");
    case "anciano_o_sm_varon":
      return p.genero === "M" && (resp.includes("anciano") || resp.includes("siervo_ministerial"));
    case "varon_publicador":
    case "varon_emc":
      return p.genero === "M";
    case "publicador":
    case "cualquiera":
      return true;
    case "lector_ebc":
      return lectorEbcElegible;
    case "superintendente_circuito":
      return resp.includes("super_circuito");
    case "aprobado":
      return (
        p.estado_aprobado === true &&
        p.genero === "M" &&
        (resp.includes("publicador") ||
          resp.includes("anciano") ||
          resp.includes("siervo_ministerial") ||
          resp.includes("super_circuito"))
      );
    default:
      return true;
  }
}

function deriveCategoria(key: string, seccion?: string): string {
  if (key === "presidente") return "presidente";
  if (key === "oracion_inicial" || key === "oracion_final") return "oracion";
  if (key === "tesoros") return "tesoros";
  if (key === "perlas") return "perlas";
  if (key === "lectura_biblica") return "lectura_biblica";
  if (key.startsWith("maestros.") || key === "encargado_sala_b" || key === "encargado_sala_c")
    return "maestros";
  if (key.startsWith("vida_cristiana.")) return "vida_cristiana";
  if (key === "estudio_biblico.conductor") return "estudio_bc";
  if (key === "estudio_biblico.lector") return "lector_ebc";
  return seccion ?? "otra";
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
    if (!body.congregacion_id || !body.fecha_semana || !Array.isArray(body.slots)) {
      return new Response(JSON.stringify({ error: "invalid_body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = buildClient(authHeader);

    // Verificar usuario y acceso a la congregación
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

    // Cuentas de prueba/soporte exentas del límite mensual de IA (no consumen ni
    // afectan el contador compartido de la congregación — el resto de usuarios
    // de la congregación sigue limitado a los usos normales por mes).
    const USUARIOS_SIN_LIMITE_IA = new Set([
      "miguelmevo@gmail.com",
      "miguelmevo@live.com",
    ]);
    const usuarioSinLimite = USUARIOS_SIN_LIMITE_IA.has((userData.user.email ?? "").toLowerCase());

    // super_admin es un rol global (tabla user_roles), independiente de la
    // membresía por congregación en usuarios_congregacion.
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
      (!membership || !["admin", "editor", "super_admin", "svministerio"].includes(membership.rol as string))
    ) {
      return new Response(JSON.stringify({ error: "not_authorized" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Límite de uso mensual de IA por congregación (control de gasto).
    const LIMITE_IA_MENSUAL = 5;
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

    // Cargar configuración VyM
    const { data: configs } = await supabase
      .from("configuracion_sistema")
      .select("clave, valor")
      .eq("congregacion_id", body.congregacion_id)
      .eq("programa_tipo", "vida_ministerio");

    const cfg = (k: string) => configs?.find((c) => c.clave === k)?.valor as Record<string, unknown> | undefined;
    const smHabilitadoMaestros = (cfg("sm_habilitado_maestros")?.habilitado as boolean) ?? true;
    const ventanaRotacion = (cfg("ventana_rotacion_semanas")?.semanas as number) ?? 8;
    const ventanaDescansoGlobal = (cfg("ventana_descanso_global_semanas")?.semanas as number) ?? 0;
    const umbralRelajacion = (cfg("umbral_relajacion_seleccion")?.cantidad as number) ?? 5;
    const palabrasFamilia =
      (cfg("palabras_clave_familia")?.palabras as string) || PALABRAS_FAMILIA_DEFAULT;

    // Participantes
    const { data: participantes } = await supabase
      .from("participantes")
      .select(
        "id,nombre,apellido,genero,responsabilidad,responsabilidad_adicional,estado_aprobado,es_publicador_inactivo,inscrito_emc,es_casado,tiene_hijos,conyuge_id,activo"
      )
      .eq("congregacion_id", body.congregacion_id)
      .eq("activo", true)
      .eq("es_publicador_inactivo", false);

    // Historial (ventana de rotación)
    const fechaLimite = new Date(body.fecha_semana);
    fechaLimite.setDate(fechaLimite.getDate() - ventanaRotacion * 7);
    const fechaLimiteISO = fechaLimite.toISOString().slice(0, 10);

    const { data: historial } = await supabase
      .from("historial_participacion_vym")
      .select("participante_id, fecha_semana, parte")
      .eq("congregacion_id", body.congregacion_id)
      .gte("fecha_semana", fechaLimiteISO)
      .order("fecha_semana", { ascending: false });

    // Indisponibilidad activa que cubra la fecha
    const { data: indisp } = await supabase
      .from("indisponibilidad_participantes")
      .select("participante_id, fecha_inicio, fecha_fin, tipo_responsabilidad")
      .eq("congregacion_id", body.congregacion_id)
      .eq("activo", true)
      .lte("fecha_inicio", body.fecha_semana);

    const indisponiblesIds = new Set(
      (indisp ?? [])
        .filter((i) => !i.fecha_fin || i.fecha_fin >= body.fecha_semana)
        .map((i) => i.participante_id)
    );

    // Lista curada de Lectores EBC elegibles (igual que lectores_atalaya_elegibles
    // en Reunión Pública) — sin esto la IA no tiene forma de saber quién puede ser
    // Lector del Estudio Bíblico de la Congregación.
    const { data: lectoresEbc } = await supabase
      .from("lectores_ebc_elegibles")
      .select("participante_id")
      .eq("congregacion_id", body.congregacion_id)
      .eq("activo", true);
    const lectoresEbcIds = new Set((lectoresEbc ?? []).map((l) => l.participante_id));

    // Anotar slots con detección de familia y aplicar override SM→Maestros
    const slotsEnriquecidos = body.slots.map((s) => ({
      ...s,
      es_familiar: detectaFamilia(s.titulo || "", palabrasFamilia),
      filtro:
        // Si SM no puede recibir partes de Nuestra Vida Cristiana, forzamos solo ancianos
        s.seccion === "vida_cristiana" && !smHabilitadoMaestros && s.filtro === "anciano_o_sm"
          ? ("anciano" as const)
          : s.filtro,
      categoria: deriveCategoria(s.key, s.seccion),
    }));

    // Construir prompt
    const ultimasParticipaciones = new Map<string, string>();
    for (const h of historial ?? []) {
      if (!ultimasParticipaciones.has(h.participante_id)) {
        ultimasParticipaciones.set(h.participante_id, h.fecha_semana);
      }
    }
    const conteoPorPersona = new Map<string, number>();
    for (const h of historial ?? []) {
      conteoPorPersona.set(h.participante_id, (conteoPorPersona.get(h.participante_id) ?? 0) + 1);
    }

    // === Última participación POR CATEGORÍA (a partir de programa_vida_ministerio) ===
    const { data: programasVym } = await supabase
      .from("programa_vida_ministerio")
      .select(
        "fecha_semana,presidente_id,oracion_inicial_id,oracion_final_id,tesoros,perlas_id,lectura_biblica,maestros,vida_cristiana,estudio_biblico"
      )
      .eq("congregacion_id", body.congregacion_id)
      .eq("activo", true)
      .gte("fecha_semana", fechaLimiteISO)
      .order("fecha_semana", { ascending: true });

    const ultimasPorCategoria = new Map<string, Record<string, string>>();
    const setUlt = (id: string | null | undefined, cat: string, fecha: string) => {
      if (!id) return;
      const cur = ultimasPorCategoria.get(id) ?? {};
      if (!cur[cat] || cur[cat] <= fecha) cur[cat] = fecha;
      ultimasPorCategoria.set(id, cur);
    };
    for (const p of programasVym ?? []) {
      const f = p.fecha_semana as string;
      setUlt(p.presidente_id, "presidente", f);
      setUlt(p.oracion_inicial_id, "oracion", f);
      setUlt(p.oracion_final_id, "oracion", f);
      const tesoros = (p.tesoros ?? {}) as any;
      setUlt(tesoros.participante_id, "tesoros", f);
      setUlt(p.perlas_id, "perlas", f);
      const lb = (p.lectura_biblica ?? {}) as any;
      setUlt(lb.participante_id, "lectura_biblica", f);
      const maestrosArr = Array.isArray(p.maestros) ? p.maestros : [];
      for (const m of maestrosArr as any[]) {
        setUlt(m?.titular_id, "maestros", f);
        setUlt(m?.titular_sala_b_id, "maestros", f);
        setUlt(m?.titular_sala_c_id, "maestros", f);
        setUlt(m?.ayudante_id, "maestros", f);
        setUlt(m?.ayudante_sala_b_id, "maestros", f);
        setUlt(m?.ayudante_sala_c_id, "maestros", f);
      }
      const vcArr = Array.isArray(p.vida_cristiana) ? p.vida_cristiana : [];
      for (const v of vcArr as any[]) setUlt(v?.participante_id, "vida_cristiana", f);
      const eb = (p.estudio_biblico ?? {}) as any;
      setUlt(eb.conductor_id, "estudio_bc", f);
      setUlt(eb.lector_id, "estudio_bc", f);
      setUlt(eb.lector_id, "lector_ebc", f);
    }

    const resumenParticipantes = (participantes ?? []).map((p) => {
      const resp = (p.responsabilidad as string[]) ?? [];
      const adicional = p.responsabilidad_adicional as string | null;
      const cats = ultimasPorCategoria.get(p.id) ?? {};
      // Última participación EXCLUYENDO oraciones (para descanso global)
      let ultimaNoOracion: string | null = null;
      for (const [cat, fecha] of Object.entries(cats)) {
        if (cat === "oracion") continue;
        if (!ultimaNoOracion || fecha > ultimaNoOracion) ultimaNoOracion = fecha;
      }
      return {
        id: p.id,
        nombre: `${p.nombre} ${p.apellido}`,
        genero: p.genero,
        rol: [...resp, ...(adicional ? [adicional] : [])].join("/"),
        aprobado: p.estado_aprobado,
        smm: p.inscrito_emc,
        casado: p.es_casado,
        con_hijos: p.tiene_hijos,
        conyuge_id: p.conyuge_id ?? null,
        lector_ebc_elegible: lectoresEbcIds.has(p.id),
        indisponible: indisponiblesIds.has(p.id),
        ultima_participacion: ultimasParticipaciones.get(p.id) ?? null,
        ultima_participacion_no_oracion: ultimaNoOracion,
        veces_recientes: conteoPorPersona.get(p.id) ?? 0,
        ultimas_por_categoria: cats,
      };
    });

    const yaAsignadosArr = Object.entries(body.ya_asignados ?? {})
      .filter(([, v]) => !!v)
      .map(([k, v]) => ({ slot: k, participante_id: v }));

    const systemPrompt = `Eres un asistente que ayuda a asignar participantes a las partes del programa "Vida y Ministerio Cristiano" de una congregación de Testigos de Jehová.

REGLAS GENERALES:
- Respeta SIEMPRE el filtro de elegibilidad de cada parte (campo "filtro" del slot).
  - "anciano": solo ancianos.
  - "anciano_o_sm": ancianos o siervos ministeriales (varones).
  - "varon_publicador": varones publicadores aprobados (incluye ancianos/SM).
  - "varon_emc": varones inscritos en Seamos Mejores Maestros (SMM). Úsalo SIEMPRE en slots de Discurso de Seamos Mejores Maestros.
  - "lector_atalaya": solo lectores aprobados para Atalaya.
  - "lector_ebc": SOLO candidatos con "lector_ebc_elegible: true" (lista curada específica para Lector del Estudio Bíblico de la Congregación; no asumas elegibilidad por ningún otro campo).
  - "aprobado": cualquier publicador aprobado (varón o mujer).
- NUNCA asignes participantes marcados como "indisponible".
- NUNCA repitas al MISMO participante en dos slots distintos en este mismo programa.

REGLAS DE ROTACIÓN (BLOQUEO):
- Para cada candidato calcula:
  1. **Bloqueo por rotación de categoría**: si "ultimas_por_categoria[categoria del slot]" existe y dista MENOS de "ventana_rotacion_semanas" semanas respecto a "fecha_semana" → BLOQUEADO por rotación.
  2. **Bloqueo por descanso global**: si "ventana_descanso_global_semanas" > 0 y "ultima_participacion_no_oracion" dista MENOS de ese número de semanas respecto a "fecha_semana" → BLOQUEADO por descanso. Las categorías "oracion_inicial" y "oracion_final" están EXENTAS de ambas reglas y NO cuentan para el descanso global de otras asignaciones.
- Un candidato está "disponible" si NO está bloqueado por ninguna regla.
- **Umbral de relajación**: si para un slot hay al menos "umbral_relajacion" candidatos disponibles, prefiere ESOS y NO asignes a un bloqueado. Si hay menos disponibles que el umbral, puedes elegir entre los bloqueados (priorizando los bloqueados solo por descanso antes que los bloqueados por rotación, y los que llevan más tiempo bloqueados).

PRIORIZACIÓN:
- Para cada slot, identifica su "categoria" y prioriza al candidato cuya fecha en "ultimas_por_categoria[categoria]" sea la MÁS ANTIGUA (o que NO TENGA registro). Usa "ultima_participacion" global y "veces_recientes" como desempate.
- Para partes "es_familiar: true" en Seamos Mejores Maestros, intenta emparejar familiares reales: dos candidatos son cónyuges SOLO SI el "conyuge_id" de uno es EXACTAMENTE el "id" del otro (no asumas matrimonio solo porque ambos tengan "casado: true" — eso NO basta, deben apuntarse mutuamente por conyuge_id). Padre/madre con hijo/hija no se puede verificar con los datos disponibles, así que en la práctica el único emparejamiento familiar válido es por "conyuge_id" exacto.
- Para demostraciones (titular y ayudante del mismo índice maestros): titular y ayudante deben ser del MISMO GÉNERO, salvo que sean cónyuges reales (conyuge_id cruzado, ver regla anterior). NUNCA una pareja de géneros distintos que no sean cónyuges verificados por conyuge_id.
- Matrimonios (cónyuges) como pareja titular/ayudante SOLO se permiten en Seamos Mejores Maestros, como máximo 1 pareja de cónyuges por semana en TODA la asignación, y solo si esa semana hay 3 o más partes de tipo demostración (si hay menos de 3 demostraciones, NUNCA propongas un matrimonio, aunque además haya un discurso). Incluso cumpliéndose eso, usa un matrimonio solo si no encuentras un candidato del mismo género disponible — nunca lo prefieras sobre una opción no-cónyuge.
- Para lectura bíblica (varon_publicador) prioriza inscritos en SMM (campo "smm").
- Si no encuentras candidato válido para un slot, devuelve participante_id = null (no inventes IDs).

DEVUELVE SOLO IDs (uuid) presentes en la lista de participantes proporcionada.

OBLIGATORIO: el array "asignaciones" debe tener EXACTAMENTE una entrada por cada
elemento de "slots_a_asignar" (mismo "slot" que su "key"), sin omitir ninguno. Si
no encuentras un candidato válido para un slot, igual agrega su entrada con
participante_id = null — NUNCA omitas un slot del array por no encontrarle
candidato. Antes de responder, verifica que el número de entradas en
"asignaciones" sea igual al número de elementos en "slots_a_asignar".`;

    const userPrompt = JSON.stringify({
      fecha_semana: body.fecha_semana,
      modo: body.modo,
      ventana_rotacion_semanas: ventanaRotacion,
      ventana_descanso_global_semanas: ventanaDescansoGlobal,
      umbral_relajacion: umbralRelajacion,
      sm_habilitado_en_vida_cristiana: smHabilitadoMaestros,
      ya_asignados: yaAsignadosArr,
      slots_a_asignar: slotsEnriquecidos,
      participantes: resumenParticipantes,
    });

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "missing_api_key" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
            name: "asignar_participantes",
            description: "Devuelve el participante asignado a cada slot del programa.",
            input_schema: {
              type: "object",
              properties: {
                asignaciones: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      slot: { type: "string" },
                      participante_id: { type: ["string", "null"] },
                    },
                    required: ["slot", "participante_id"],
                  },
                },
              },
              required: ["asignaciones"],
            },
          },
        ],
        tool_choice: { type: "tool", name: "asignar_participantes" },
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(
          JSON.stringify({ error: "Límite de uso de IA alcanzado. Intenta de nuevo más tarde." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResp.status === 402 || aiResp.status === 400) {
        const txtErr = await aiResp.text();
        console.error("Anthropic API error:", aiResp.status, txtErr);
        if (aiResp.status === 402) {
          return new Response(
            JSON.stringify({
              error: "Se han agotado los créditos de IA. Revisa el saldo de tu cuenta de Anthropic.",
            }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
      const txt = await aiResp.text();
      console.error("Anthropic API error:", aiResp.status, txt);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiResp.json();
    const toolUse = (aiJson?.content ?? []).find((c: any) => c.type === "tool_use");
    let asignaciones: { slot: string; participante_id: string | null }[] = [];
    try {
      const args = toolUse?.input ?? {};
      asignaciones = Array.isArray(args.asignaciones) ? args.asignaciones : [];
    } catch (e) {
      console.error("Parse tool args error", e);
    }

    // Post-validación: descartar IDs que no existen, indisponibles, y duplicados
    const validIds = new Set((participantes ?? []).map((p) => p.id));
    const usados = new Set<string>(
      Object.values(body.ya_asignados ?? {}).filter((v): v is string => !!v)
    );
    const resultado: Record<string, string | null> = {};
    for (const a of asignaciones) {
      if (!a.participante_id) {
        resultado[a.slot] = null;
        continue;
      }
      if (!validIds.has(a.participante_id) || indisponiblesIds.has(a.participante_id)) {
        resultado[a.slot] = null;
        continue;
      }
      if (usados.has(a.participante_id)) {
        resultado[a.slot] = null;
        continue;
      }
      usados.add(a.participante_id);
      resultado[a.slot] = a.participante_id;
    }
    // Red de seguridad: si el modelo omitió por completo algún slot del array
    // "asignaciones" (a pesar de la instrucción de incluirlos todos), lo dejamos
    // en null explícito en vez de dejarlo "undefined" — así el frontend lo
    // muestra como "sin sugerencia" de forma consistente en vez de ocultarlo.
    for (const slot of body.slots) {
      if (!(slot.key in resultado)) resultado[slot.key] = null;
    }

    // Validación dura (no depende del prompt): en Maestros, titular y ayudante deben
    // ser del mismo género salvo que sean cónyuges reales (conyuge_id cruzado). Si la
    // IA propuso una pareja mixta no verificada, se descarta el ayudante y se intenta
    // reemplazarlo con un candidato de respaldo (mismo género, disponible, no usado)
    // en vez de dejar el slot vacío sin más — la IA no debe "fallar" un slot solo
    // porque su primera propuesta violó esta regla.
    //
    // Matrimonios (cónyuges como titular+ayudante) solo se permiten dentro de SMM,
    // como máximo 1 por semana, y solo si esa semana hay 3 o más Demostraciones
    // (nunca con solo 1-2 demostraciones aunque venga un Discurso adicional). Incluso
    // cumpliéndose eso, un matrimonio solo se usa si NO hay candidato del mismo género
    // disponible — nunca se prefiere sobre una opción no-cónyuge.
    const generoPorId = new Map((participantes ?? []).map((p) => [p.id, p.genero as string | null]));
    const conyugePorId = new Map((participantes ?? []).map((p) => [p.id, p.conyuge_id as string | null]));
    const sonConyuges = (idA: string, idB: string) =>
      conyugePorId.get(idA) === idB || conyugePorId.get(idB) === idA;

    const cantidadDemostraciones = body.slots.filter(
      (s) => /^maestros\.\d+\.titular$/.test(s.key) && s.filtro === "publicador"
    ).length;
    let matrimoniosUsados = 0;
    const permiteMatrimonio = () => cantidadDemostraciones >= 3 && matrimoniosUsados < 1;

    const buscarCandidato = (
      excluirId: string,
      generoRequerido: string | null | undefined,
      permitirConyuge: boolean
    ) =>
      (participantes ?? [])
        .filter(
          (p) =>
            p.id !== excluirId &&
            !usados.has(p.id) &&
            !indisponiblesIds.has(p.id) &&
            // Maestros/Demostraciones solo requiere estar inscrito en EMC, no "aprobado"
            // (esa condición es exclusiva del filtro "aprobado" usado en oraciones).
            p.inscrito_emc === true &&
            (p.genero === generoRequerido || (permitirConyuge && sonConyuges(excluirId, p.id)))
        )
        .sort((a, b) => {
          const fa = ultimasPorCategoria.get(a.id)?.maestros ?? "";
          const fb = ultimasPorCategoria.get(b.id)?.maestros ?? "";
          return fa.localeCompare(fb); // sin registro o más antigua primero
        })[0];

    // Primero sin cónyuge; si no hay nadie y el matrimonio está permitido esta semana,
    // se reintenta incluyéndolo como último recurso.
    const mejorCandidato = (excluirId: string, generoRequerido: string | null | undefined) => {
      const sinConyuge = buscarCandidato(excluirId, generoRequerido, false);
      if (sinConyuge) return sinConyuge;
      if (!permiteMatrimonio()) return undefined;
      const conConyuge = buscarCandidato(excluirId, generoRequerido, true);
      if (conConyuge && sonConyuges(excluirId, conConyuge.id)) matrimoniosUsados++;
      return conConyuge;
    };

    for (const slot of body.slots) {
      const m = slot.key.match(/^maestros\.(\d+)\.titular$/);
      if (!m) continue;
      const ayudanteKey = `maestros.${m[1]}.ayudante`;
      const slotAyudanteExiste = body.slots.some((s) => s.key === ayudanteKey);
      if (!slotAyudanteExiste) continue;
      let titularId = resultado[slot.key];
      let ayudanteId = resultado[ayudanteKey];

      if (titularId && ayudanteId) {
        const mismoGenero = generoPorId.get(titularId) === generoPorId.get(ayudanteId);
        const esConyuge = !mismoGenero && sonConyuges(titularId, ayudanteId);
        if (!mismoGenero && (!esConyuge || !permiteMatrimonio())) {
          // Pareja mixta no verificada como cónyuge real, o matrimonio no permitido
          // esta semana (menos de 3 demostraciones, o ya se usó el único cupo):
          // se descarta el ayudante.
          resultado[ayudanteKey] = null;
          usados.delete(ayudanteId);
          ayudanteId = null;
        } else if (esConyuge) {
          matrimoniosUsados++;
        }
      }

      if (titularId && !ayudanteId) {
        const candidato = mejorCandidato(titularId, generoPorId.get(titularId));
        if (candidato) {
          resultado[ayudanteKey] = candidato.id;
          usados.add(candidato.id);
        }
      } else if (!titularId && ayudanteId) {
        // Mismo respaldo, en sentido inverso: la IA sugirió ayudante pero omitió
        // el titular — no debe dejarse el slot vacío solo por eso.
        const requiereVaron = slot.filtro === "varon_emc";
        const candidato = mejorCandidato(ayudanteId, requiereVaron ? "M" : generoPorId.get(ayudanteId));
        if (candidato) {
          resultado[slot.key] = candidato.id;
          usados.add(candidato.id);
          titularId = candidato.id;
        }
      }
    }

    // Red de seguridad para "lector_ebc": si la IA omitió el slot pese a haber
    // candidatos elegibles (lista curada lectores_ebc_elegibles) disponibles ese día.
    for (const slot of body.slots) {
      if (slot.filtro !== "lector_ebc") continue;
      if (resultado[slot.key]) continue;
      const candidato = (participantes ?? [])
        .filter((p) => lectoresEbcIds.has(p.id) && !usados.has(p.id) && !indisponiblesIds.has(p.id))
        .sort((a, b) => {
          const fa = ultimasPorCategoria.get(a.id)?.lector_ebc ?? "";
          const fb = ultimasPorCategoria.get(b.id)?.lector_ebc ?? "";
          return fa.localeCompare(fb);
        })[0];
      if (candidato) {
        resultado[slot.key] = candidato.id;
        usados.add(candidato.id);
      }
    }

    // Red de seguridad general: para CUALQUIER slot que siga sin sugerencia después de
    // todo lo anterior, se busca un candidato válido según su filtro de elegibilidad
    // real (misma lógica que el selector del frontend) en vez de dejarlo vacío — la IA
    // no siempre respeta la instrucción de cubrir todos los slots.
    const categoriaPorSlotKey = new Map(slotsEnriquecidos.map((s) => [s.key, s.categoria]));
    const filtroPorSlotKey = new Map(slotsEnriquecidos.map((s) => [s.key, s.filtro]));
    for (const slot of body.slots) {
      if (resultado[slot.key]) continue;
      const filtroEfectivo = filtroPorSlotKey.get(slot.key) ?? slot.filtro;
      const categoria = categoriaPorSlotKey.get(slot.key) ?? deriveCategoria(slot.key, slot.seccion);
      const candidato = (participantes ?? [])
        .filter(
          (p) =>
            !usados.has(p.id) &&
            !indisponiblesIds.has(p.id) &&
            cumpleFiltroServer(p, filtroEfectivo, lectoresEbcIds.has(p.id))
        )
        .sort((a, b) => {
          const fa = ultimasPorCategoria.get(a.id)?.[categoria] ?? "";
          const fb = ultimasPorCategoria.get(b.id)?.[categoria] ?? "";
          return fa.localeCompare(fb); // sin registro o más antigua primero
        })[0];
      if (candidato) {
        resultado[slot.key] = candidato.id;
        usados.add(candidato.id);
      }
    }

    // Registrar el uso de IA del mes (solo si la llamada a Anthropic fue exitosa).
    // Las cuentas exentas no consumen el contador compartido de la congregación.
    if (!usuarioSinLimite) await supabase.rpc("incrementar_ia_uso_mensual", {
      _congregacion_id: body.congregacion_id,
      _periodo: periodo,
      _limite: LIMITE_IA_MENSUAL,
    });

    return new Response(
      JSON.stringify({
        asignaciones: resultado,
        modo: body.modo,
        usados_total: usados.size,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("asignar-vida-ministerio-ia error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "unknown_error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
