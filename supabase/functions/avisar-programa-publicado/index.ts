// Avisa que un programa publicado ya es visible y, a cada persona, cuáles son sus
// asignaciones en él. Un programa publicado del mes siguiente no es visible hasta el día
// de "publicación anticipada" configurado, así que el aviso se envía recién ese día
// (la tarea diaria revisa los pendientes). Cada programa se avisa una sola vez
// (programas_publicados.aviso_enviado_at).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const CATEGORIA_POR_TIPO: Record<string, string> = {
  predicacion: "predicacion_programa",
  vida_ministerio: "vida_ministerio",
  asignaciones_servicio: "servicio",
  reunion_publica: "servicio",
};
// programa_tipo con que se guarda "publicacion_anticipada" en configuracion_sistema
const CONFIG_POR_TIPO: Record<string, string> = {
  predicacion: "predicacion",
  vida_ministerio: "vida_ministerio",
  asignaciones_servicio: "asignaciones",
  reunion_publica: "reunion_publica",
};

const DIA_A_INDICE: Record<string, number> = {
  lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6, domingo: 0,
};

const TIPOS_SERVICIO: Record<string, string> = {
  audio: "Audio", video: "Video", zoom: "Zoom", plataforma: "Plataforma",
  pasillo_1: "Mic. Pasillo #1", pasillo_2: "Mic. Pasillo #2", acomodador_auditorio: "Auditorio",
  acomodador_entrada_1: "Entrada #1", acomodador_entrada_2: "Entrada #2",
  aseo_1: "Aseo #1", aseo_2: "Aseo #2", aseo_3: "Aseo #3", aseo_4: "Aseo #4", aseo_5: "Aseo #5",
  hospitalidad: "Hospitalidad",
  hospitalidad_2: "Hospitalidad #2", hospitalidad_3: "Hospitalidad #3", hospitalidad_4: "Hospitalidad #4", hospitalidad_5: "Hospitalidad #5",
};

type Item = { fecha: string; tipo: string };

function diaTexto(fechaISO: string): string {
  const t = new Intl.DateTimeFormat("es-CL", { weekday: "long", day: "numeric", timeZone: "UTC" }).format(
    new Date(fechaISO + "T12:00:00Z"),
  );
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function fechaReunionEnSemana(fechaSemanaISO: string, diaReunion: string): string {
  const lunes = new Date(fechaSemanaISO + "T00:00:00Z");
  const indice = DIA_A_INDICE[diaReunion] ?? 2;
  const offset = indice === 0 ? 6 : indice - 1;
  lunes.setUTCDate(lunes.getUTCDate() + offset);
  return lunes.toISOString().slice(0, 10);
}

async function notificar(payload: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/notificar-categoria`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-cron-secret": CRON_SECRET ?? "" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) console.error("[avisar-programa-publicado] notificar-categoria:", await res.text());
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (CRON_SECRET && req.headers.get("x-cron-secret") !== CRON_SECRET) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const body = await req.json().catch(() => ({}));
    const programaId: string | undefined = body?.programaId;
    // Prueba: calcula qué se avisaría y a quién, sin enviar nada ni marcar el programa.
    const dryRun: boolean = body?.dryRun === true;
    const plan: unknown[] = [];

    // Fecha de hoy en horario de Chile.
    const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date());

    let consulta = sb
      .from("programas_publicados")
      .select("id, congregacion_id, tipo_programa, periodo, fecha_inicio, fecha_fin")
      .eq("activo", true)
      .is("aviso_enviado_at", null);
    if (programaId) consulta = consulta.eq("id", programaId);
    if (dryRun && programaId) consulta = sb
      .from("programas_publicados")
      .select("id, congregacion_id, tipo_programa, periodo, fecha_inicio, fecha_fin")
      .eq("id", programaId);
    const { data: pendientes, error } = await consulta;
    if (error) throw error;

    let avisados = 0;
    for (const prog of pendientes ?? []) {
      const categoria = CATEGORIA_POR_TIPO[prog.tipo_programa as string];
      if (!categoria) continue;

      // ¿Ya es visible? El mes en curso (o anterior) sí; el siguiente, desde el día configurado.
      let visible = (prog.fecha_inicio as string).slice(0, 7) <= hoy.slice(0, 7);
      if (!visible) {
        const { data: cfg } = await sb
          .from("configuracion_sistema")
          .select("valor")
          .eq("congregacion_id", prog.congregacion_id)
          .eq("programa_tipo", CONFIG_POR_TIPO[prog.tipo_programa as string])
          .eq("clave", "publicacion_anticipada")
          .maybeSingle();
        const v = cfg?.valor as { activo?: boolean; dia?: number } | undefined;
        visible = !!v?.activo && Number(hoy.slice(8, 10)) >= (v.dia ?? 99);
      }
      if (!visible) continue;

      // Se reserva el aviso antes de enviar, para que dos ejecuciones simultáneas no lo dupliquen.
      const { data: reservado } = dryRun ? { data: [{ id: prog.id }] } : await sb
        .from("programas_publicados")
        .update({ aviso_enviado_at: new Date().toISOString() })
        .eq("id", prog.id)
        .is("aviso_enviado_at", null)
        .select("id");
      if (!reservado || reservado.length === 0) continue;

      const itemsPorParticipante = await asignacionesDelPrograma(sb, prog);

      // participante -> usuario con cuenta activa
      const [{ data: participantes }, { data: membresias }] = await Promise.all([
        sb.from("participantes").select("id, user_id").eq("congregacion_id", prog.congregacion_id).not("user_id", "is", null),
        sb.from("usuarios_congregacion").select("user_id").eq("congregacion_id", prog.congregacion_id).eq("activo", true),
      ]);
      const cuentasActivas = new Set((membresias ?? []).map((m) => m.user_id));
      const userDe = new Map(
        (participantes ?? []).filter((p) => cuentasActivas.has(p.user_id as string)).map((p) => [p.id as string, p.user_id as string]),
      );

      if (dryRun) {
        plan.push({
          tipo: prog.tipo_programa,
          participantesConAsignaciones: itemsPorParticipante.size,
          conCuentaActiva: [...itemsPorParticipante.keys()].filter((id) => userDe.has(id)).length,
          ejemplo: [...itemsPorParticipante.entries()].slice(0, 2).map(([id, it]) => ({ id, items: it.slice(0, 3) })),
        });
      }

      const conAviso = new Set<string>();
      for (const [pid, items] of itemsPorParticipante) {
        const uid = userDe.get(pid);
        if (!uid || items.length === 0) continue;
        conAviso.add(uid);
        const ordenados = [...items].sort((a, b) => a.fecha.localeCompare(b.fecha));
        const lista = ordenados.slice(0, 6).map((i) => `${diaTexto(i.fecha)}: ${i.tipo}`);
        const resto = ordenados.length - lista.length;
        const personal = {
          userIds: [uid],
          categoria,
          title: `Tus asignaciones de ${prog.periodo}`,
          body: lista.join(" · ") + (resto > 0 ? ` · y ${resto} más` : ""),
        };
        if (dryRun) plan.push({ ...personal, userIds: undefined, participante: pid });
        else await notificar(personal);
      }

      // Aviso general para quienes no tienen asignaciones en este programa.
      const general = {
        congregacionId: prog.congregacion_id,
        categoria,
        title: "Nuevo programa publicado",
        body: "Se publicó el programa: " + prog.periodo,
        excluirUserIds: [...conAviso],
      };
      if (dryRun) plan.push({ general: true, categoria, title: general.title, body: general.body, excluidos: conAviso.size });
      else await notificar(general);
      avisados++;
    }

    return new Response(JSON.stringify({ hoy, pendientes: pendientes?.length ?? 0, avisados, ...(dryRun ? { plan } : {}) }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (e: any) {
    console.error("[avisar-programa-publicado] Error:", e);
    return new Response(JSON.stringify({ error: e?.message ?? "unknown_error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});

// Asignaciones de cada participante dentro del periodo del programa publicado.
// Mismas reglas que "Mis asignaciones" en la aplicación.
async function asignacionesDelPrograma(sb: any, prog: any): Promise<Map<string, Item[]>> {
  const out = new Map<string, Item[]>();
  const add = (pid: string | null | undefined, fecha: string, tipo: string) => {
    if (!pid) return;
    const lista = out.get(pid) ?? [];
    lista.push({ fecha, tipo });
    out.set(pid, lista);
  };
  const cong = prog.congregacion_id as string;
  const ini = prog.fecha_inicio as string;
  const fin = prog.fecha_fin as string;

  if (prog.tipo_programa === "predicacion") {
    const { data } = await sb
      .from("programa_predicacion")
      .select("id, fecha, capitan_id, asignaciones_grupos, horarios_salida(hora)")
      .eq("congregacion_id", cong)
      .eq("activo", true)
      .gte("fecha", ini)
      .lte("fecha", fin);
    for (const p of data ?? []) {
      const hora = (p.horarios_salida?.hora as string | undefined)?.slice(0, 5);
      const tipo = hora ? `Capitán Predi. ${hora}` : "Capitán Predi.";
      const ids = new Set<string>();
      if (p.capitan_id) ids.add(p.capitan_id);
      if (Array.isArray(p.asignaciones_grupos)) {
        for (const g of p.asignaciones_grupos) if (g?.capitan_id && !g.disabled) ids.add(g.capitan_id);
      }
      ids.forEach((id) => add(id, p.fecha, tipo));
    }
  } else if (prog.tipo_programa === "reunion_publica") {
    const roles: [string, string][] = [
      ["presidente_id", "Presidente"],
      ["orador_id", "Orador"],
      ["orador_suplente_id", "Orador Suplente"],
      ["orador_saliente_id", "Orador Saliente"],
      ["conductor_atalaya_id", "Conductor Atalaya"],
      ["lector_atalaya_id", "Lector Atalaya"],
    ];
    const { data } = await sb.from("programa_reunion_publica").select("*").eq("congregacion_id", cong).gte("fecha", ini).lte("fecha", fin);
    for (const e of data ?? []) for (const [campo, label] of roles) add(e[campo], e.fecha, label);
  } else if (prog.tipo_programa === "vida_ministerio") {
    const { data: cfg } = await sb
      .from("configuracion_sistema")
      .select("valor")
      .eq("congregacion_id", cong)
      .eq("programa_tipo", "general")
      .eq("clave", "dias_reunion")
      .maybeSingle();
    const dia = (cfg?.valor as any)?.dia_entre_semana ?? "martes";
    const desde = new Date(ini + "T00:00:00Z");
    desde.setUTCDate(desde.getUTCDate() - 7);
    const { data } = await sb
      .from("programa_vida_ministerio")
      .select("*")
      .eq("congregacion_id", cong)
      .eq("activo", true)
      .gte("fecha_semana", desde.toISOString().slice(0, 10))
      .lte("fecha_semana", fin);
    for (const p of data ?? []) {
      if (!p.fecha_semana) continue;
      const f = fechaReunionEnSemana(p.fecha_semana, dia);
      if (f < ini || f > fin) continue;
      add(p.presidente_id, f, "Presidente");
      add(p.oracion_inicial_id, f, "Oración Inicial");
      add(p.oracion_final_id, f, "Oración Final");
      add(p.perlas_id, f, "Perlas");
      add(p.tesoros?.participante_id, f, "Tesoros");
      add(p.lectura_biblica?.participante_id, f, "Lectura");
      add(p.encargado_sala_b_id, f, "Sala B");
      add(p.encargado_sala_c_id, f, "Sala C");
      add(p.estudio_biblico?.conductor_id, f, "Estudio BC");
      add(p.estudio_biblico?.lector_id, f, "Lectura EBC");
      for (const m of p.maestros ?? []) {
        add(m.titular_id, f, "Maestros");
        add(m.ayudante_id, f, "Maestros");
        add(m.titular_sala_b_id, f, "Maestros (Sala B)");
        add(m.ayudante_sala_b_id, f, "Maestros (Sala B)");
        add(m.titular_sala_c_id, f, "Maestros (Sala C)");
        add(m.ayudante_sala_c_id, f, "Maestros (Sala C)");
      }
      for (const v of p.vida_cristiana ?? []) add(v.participante_id, f, v.titulo || "Vida Cristiana");
    }
  } else if (prog.tipo_programa === "asignaciones_servicio") {
    const [{ data }, { data: miembros }] = await Promise.all([
      sb.from("programa_asignaciones_servicio").select("*").eq("congregacion_id", cong).eq("activo", true).gte("fecha", ini).lte("fecha", fin),
      sb.from("participantes").select("id, grupo_predicacion_id").eq("congregacion_id", cong).eq("activo", true).not("grupo_predicacion_id", "is", null),
    ]);
    const porGrupo = new Map<string, string[]>();
    for (const m of miembros ?? []) {
      const l = porGrupo.get(m.grupo_predicacion_id) ?? [];
      l.push(m.id);
      porGrupo.set(m.grupo_predicacion_id, l);
    }
    for (const a of data ?? []) {
      let label = TIPOS_SERVICIO[a.tipo_asignacion] ?? a.tipo_asignacion;
      if (String(a.tipo_asignacion).startsWith("aseo_")) label = "Aseo Salón";
      if (String(a.tipo_asignacion).startsWith("hospitalidad")) label = "Hospitalidad";
      if (String(a.tipo_asignacion).startsWith("acomodador_entrada_")) label = "A. Entrada";
      if (a.participante_id) add(a.participante_id, a.fecha, label);
      else if (a.grupo_predicacion_id) for (const pid of porGrupo.get(a.grupo_predicacion_id) ?? []) add(pid, a.fecha, label);
    }
  }
  return out;
}
