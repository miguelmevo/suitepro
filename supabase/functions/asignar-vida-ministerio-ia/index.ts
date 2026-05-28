// Edge function: asignar-vida-ministerio-ia
// Genera sugerencias de asignación de participantes para el programa Vida y Ministerio
// usando Lovable AI Gateway con tool-calling para output estructurado.
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

    const { data: membership } = await supabase
      .from("usuarios_congregacion")
      .select("rol")
      .eq("user_id", userId)
      .eq("congregacion_id", body.congregacion_id)
      .eq("activo", true)
      .maybeSingle();

    if (
      !membership ||
      !["admin", "editor", "super_admin", "svministerio"].includes(membership.rol as string)
    ) {
      return new Response(JSON.stringify({ error: "not_authorized" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
    const palabrasFamilia =
      (cfg("palabras_clave_familia")?.palabras as string) || PALABRAS_FAMILIA_DEFAULT;

    // Participantes
    const { data: participantes } = await supabase
      .from("participantes")
      .select(
        "id,nombre,apellido,genero,responsabilidad,responsabilidad_adicional,estado_aprobado,es_publicador_inactivo,inscrito_emc,es_casado,tiene_hijos,activo"
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
      return {
        id: p.id,
        nombre: `${p.nombre} ${p.apellido}`,
        genero: p.genero,
        rol: [...resp, ...(adicional ? [adicional] : [])].join("/"),
        aprobado: p.estado_aprobado,
        emc: p.inscrito_emc,
        casado: p.es_casado,
        con_hijos: p.tiene_hijos,
        indisponible: indisponiblesIds.has(p.id),
        ultima_participacion: ultimasParticipaciones.get(p.id) ?? null,
        veces_recientes: conteoPorPersona.get(p.id) ?? 0,
        ultimas_por_categoria: ultimasPorCategoria.get(p.id) ?? {},
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
  - "varon_emc": varones inscritos en la Escuela del Ministerio (EMC). Úsalo SIEMPRE en slots de Discurso de Seamos Mejores Maestros.
  - "lector_atalaya": solo lectores aprobados para Atalaya.
  - "aprobado": cualquier publicador aprobado (varón o mujer).
- NUNCA asignes participantes marcados como "indisponible".
- NUNCA repitas al MISMO participante en dos slots distintos en este mismo programa.
- Distribuye lo más equitativamente posible: prioriza a quienes participaron menos recientemente y con menor "veces_recientes" en la ventana de rotación.
- Para partes "es_familiar: true" en Seamos Mejores Maestros (demostraciones con titular+ayudante), intenta emparejar familiares: cónyuges (es_casado), padre/madre con hijo/hija (con_hijos), o mismo género.
- Para demostraciones (slots con sufijo .titular y .ayudante del mismo índice de maestros): titular y ayudante deben ser del MISMO GÉNERO salvo que sean familia (cónyuges, padres con hijos). NUNCA pareja mixta no familiar.
- Para lectura bíblica (varon_publicador) prioriza inscritos EMC.
- Si no encuentras candidato válido para un slot, devuelve participante_id = null para ese slot (no inventes IDs).

DEVUELVE SOLO IDs (uuid) presentes en la lista de participantes proporcionada.`;

    const userPrompt = JSON.stringify({
      fecha_semana: body.fecha_semana,
      modo: body.modo,
      ventana_rotacion_semanas: ventanaRotacion,
      sm_habilitado_en_vida_cristiana: smHabilitadoMaestros,
      ya_asignados: yaAsignadosArr,
      slots_a_asignar: slotsEnriquecidos,
      participantes: resumenParticipantes,
    });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "missing_api_key" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "asignar_participantes",
              description: "Devuelve el participante asignado a cada slot del programa.",
              parameters: {
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
                      additionalProperties: false,
                    },
                  },
                },
                required: ["asignaciones"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "asignar_participantes" } },
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(
          JSON.stringify({ error: "Límite de uso de IA alcanzado. Intenta de nuevo más tarde." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResp.status === 402) {
        return new Response(
          JSON.stringify({
            error:
              "Se han agotado los créditos de IA. Añade créditos a tu workspace en Settings → Usage.",
          }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const txt = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, txt);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiResp.json();
    const toolCall = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
    let asignaciones: { slot: string; participante_id: string | null }[] = [];
    try {
      const args = JSON.parse(toolCall?.function?.arguments ?? "{}");
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
