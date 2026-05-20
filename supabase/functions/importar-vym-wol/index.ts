// Edge function: importar-vym-wol
// Descarga y parsea programas semanales oficiales de wol.jw.org
// y los guarda en plantillas_vida_ministerio_oficial.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { DOMParser, Element } from "https://deno.land/x/deno_dom@v0.1.45/deno-dom-wasm.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MESES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
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

// Parsea encabezado tipo "1-7 de junio de 2026" o "29 de junio a 5 de julio de 2026"
function parseFechaSemana(headerText: string): string | null {
  const t = headerText.toLowerCase().replace(/\s+/g, " ").trim();
  // patrón 1: "29 de junio a 5 de julio de 2026" o "29 de junio - 5 de julio de 2026"
  let m = t.match(/(\d{1,2})\s+de\s+([a-záéíóú]+)\s*(?:a|-|–|—|al)\s*(\d{1,2})\s+de\s+([a-záéíóú]+)\s+de\s+(\d{4})/);
  if (m) {
    const day1 = parseInt(m[1], 10);
    const mes1 = MESES[m[2].normalize("NFD").replace(/[\u0300-\u036f]/g, "")];
    const year = parseInt(m[5], 10);
    if (mes1) {
      const d = new Date(Date.UTC(year, mes1 - 1, day1));
      return toIsoDate(mondayOf(d));
    }
  }
  // patrón 2: "1-7 de junio de 2026" o "1 a 7 de junio de 2026"
  m = t.match(/(\d{1,2})\s*(?:-|–|—|a|al)\s*\d{1,2}\s+de\s+([a-záéíóú]+)\s+de\s+(\d{4})/);
  if (m) {
    const day1 = parseInt(m[1], 10);
    const mes = MESES[m[2].normalize("NFD").replace(/[\u0300-\u036f]/g, "")];
    const year = parseInt(m[3], 10);
    if (mes) {
      const d = new Date(Date.UTC(year, mes - 1, day1));
      return toIsoDate(mondayOf(d));
    }
  }
  return null;
}

function textOf(el: Element | null): string {
  return (el?.textContent ?? "").replace(/\s+/g, " ").trim();
}

// Extrae el primer número entero de un string (para minutos / cántico)
function extractInt(s: string): number | null {
  const m = s.match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

// Extrae duración (mins.) de cualquier texto: "(10 mins.)" → 10
function extractMins(s: string): number | null {
  const m = s.match(/\((\d+)\s*mins?\.?\)/i);
  return m ? parseInt(m[1], 10) : null;
}

// Limpia título quitando numeración inicial y "(X mins.)" final
function cleanTitulo(s: string): string {
  return s
    .replace(/^\s*\d+\.\s*/, "")
    .replace(/\s*\(\s*\d+\s*mins?\.?\s*\)\s*$/i, "")
    .trim();
}

interface PlantillaParseada {
  fecha_semana: string | null;
  lectura_semana: string | null;
  cantico_inicial: number | null;
  cantico_intermedio: number | null;
  cantico_final: number | null;
  tesoros: { titulo: string; duracion: number | null };
  perlas: { titulo: string; duracion: number | null };
  lectura_biblica: { cita: string; duracion: number | null };
  maestros: Array<{ titulo: string; tipo: "demostracion" | "discurso"; duracion: number | null }>;
  vida_cristiana: Array<{ titulo: string; duracion: number | null }>;
  estudio_biblico: { duracion: number | null };
  avisos: string[];
}

function parseHtml(html: string): PlantillaParseada {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const avisos: string[] = [];
  const out: PlantillaParseada = {
    fecha_semana: null,
    lectura_semana: null,
    cantico_inicial: null,
    cantico_intermedio: null,
    cantico_final: null,
    tesoros: { titulo: "", duracion: null },
    perlas: { titulo: "", duracion: null },
    lectura_biblica: { cita: "", duracion: null },
    maestros: [],
    vida_cristiana: [],
    estudio_biblico: { duracion: null },
    avisos,
  };
  if (!doc) {
    avisos.push("No se pudo parsear el HTML");
    return out;
  }

  // Fecha semana: buscar en h1/header del artículo
  const h1 = doc.querySelector("h1") as Element | null;
  const headerText = textOf(h1);
  out.fecha_semana = parseFechaSemana(headerText);

  // Lectura de la semana: suele estar en el sub-encabezado o "bandera" con cita bíblica
  const banderaSel = ["#p2", ".du-color--gold", "header p", ".lectura-semanal"];
  for (const sel of banderaSel) {
    const el = doc.querySelector(sel) as Element | null;
    const t = textOf(el);
    if (t && /[A-ZÁÉÍÓÚ]/.test(t) && t.length < 120 && /\d/.test(t)) {
      out.lectura_semana = t;
      break;
    }
  }

  // Cánticos: enlaces con texto "Canción N" o "Cántico N"
  const cancionRegex = /(?:canción|cantico|cántico)\s*(\d{1,3})/i;
  const allText = doc.querySelectorAll("a, p, strong");
  const cancionesEncontradas: number[] = [];
  for (let i = 0; i < allText.length; i++) {
    const t = textOf(allText[i] as Element);
    const m = t.match(cancionRegex);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > 0 && n < 1000 && !cancionesEncontradas.includes(n)) {
        cancionesEncontradas.push(n);
      }
    }
    if (cancionesEncontradas.length >= 3) break;
  }
  if (cancionesEncontradas[0]) out.cantico_inicial = cancionesEncontradas[0];
  if (cancionesEncontradas[1]) out.cantico_intermedio = cancionesEncontradas[1];
  if (cancionesEncontradas[2]) out.cantico_final = cancionesEncontradas[2];

  // Recorrer puntos numerados (1..N) — están como h3 con número o como dt
  // Estrategia robusta: tomar todos los h3 dentro del artículo
  const headings = doc.querySelectorAll("h3");
  const items: Array<{ num: number | null; titulo: string; duracion: number | null; raw: string }> = [];
  for (let i = 0; i < headings.length; i++) {
    const h = headings[i] as Element;
    const raw = textOf(h);
    if (!raw) continue;
    const numMatch = raw.match(/^\s*(\d+)\./);
    const num = numMatch ? parseInt(numMatch[1], 10) : null;
    const dur = extractMins(raw);
    const titulo = cleanTitulo(raw);
    items.push({ num, titulo, duracion: dur, raw });
  }

  // Tesoros = punto 1; Perlas = punto 2; Lectura = punto 3
  const punto1 = items.find((x) => x.num === 1);
  const punto2 = items.find((x) => x.num === 2);
  const punto3 = items.find((x) => x.num === 3);
  if (punto1) out.tesoros = { titulo: punto1.titulo, duracion: punto1.duracion };
  if (punto2) out.perlas = { titulo: punto2.titulo, duracion: punto2.duracion };
  if (punto3) {
    // citar la lectura (ej "Isaías 59:1-12")
    const m = punto3.raw.match(/\(([^)]+\d[^)]*)\)/);
    let cita = "";
    if (m) cita = m[1].split(",")[0].trim();
    if (!cita) cita = punto3.titulo.replace(/^lectura de la biblia\s*/i, "").trim();
    out.lectura_biblica = { cita, duracion: punto3.duracion };
  }

  // Maestros = puntos 4..N hasta el siguiente bloque (típicamente 4,5,6)
  const maestros = items.filter((x) => x.num !== null && x.num >= 4 && x.num <= 7);
  for (const m of maestros) {
    const titLower = m.titulo.toLowerCase();
    const tipo: "demostracion" | "discurso" = titLower.startsWith("discurso") || titLower.includes("explique sus creencias") ? "discurso" : "demostracion";
    out.maestros.push({ titulo: m.titulo, tipo, duracion: m.duracion });
  }

  // Vida cristiana: puntos numerados > último maestro pero antes del estudio bíblico
  // El "Estudio bíblico de la congregación" siempre es el ÚLTIMO punto numerado.
  const sortedNum = items.filter((x) => x.num !== null).sort((a, b) => (a.num! - b.num!));
  const ultimoPunto = sortedNum[sortedNum.length - 1];
  const ultimoMaestroNum = maestros.length ? Math.max(...maestros.map((m) => m.num!)) : 3;

  if (ultimoPunto && /estudio b[íi]blico/i.test(ultimoPunto.titulo)) {
    out.estudio_biblico = { duracion: ultimoPunto.duracion ?? 30 };
    // Partes de Vida cristiana = puntos numerados entre (ultimoMaestroNum+1) .. (ultimoPunto.num - 1)
    const vc = items.filter((x) => x.num !== null && x.num! > ultimoMaestroNum && x.num! < ultimoPunto.num!);
    for (const p of vc) {
      out.vida_cristiana.push({ titulo: p.titulo, duracion: p.duracion });
    }
  } else if (ultimoPunto) {
    // No detectó estudio bíblico, igual asumimos default 30
    out.estudio_biblico = { duracion: 30 };
    avisos.push("No se detectó claramente el Estudio bíblico de la congregación (se usó 30 min por defecto)");
    const vc = items.filter((x) => x.num !== null && x.num! > ultimoMaestroNum);
    for (const p of vc) out.vida_cristiana.push({ titulo: p.titulo, duracion: p.duracion });
  }

  // Validaciones blandas
  if (!out.fecha_semana) avisos.push("No se pudo detectar la fecha de la semana");
  if (out.cantico_inicial === null) avisos.push("No se detectó el cántico inicial");
  if (!out.tesoros.titulo) avisos.push("No se detectó el punto 1 (Tesoros)");

  return out;
}

interface Resultado {
  url: string;
  fecha_semana: string | null;
  estado: "creada" | "actualizada" | "parcial" | "error";
  mensaje: string;
}

async function procesarUrl(
  url: string,
  importadoPor: string,
  serviceClient: ReturnType<typeof createClient>,
): Promise<Resultado> {
  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; SuiteProBot/1.0; +https://suitepro.org)",
        "Accept-Language": "es",
      },
    });
    if (!resp.ok) {
      return { url, fecha_semana: null, estado: "error", mensaje: `HTTP ${resp.status}` };
    }
    const html = await resp.text();
    const parsed = parseHtml(html);
    if (!parsed.fecha_semana) {
      return { url, fecha_semana: null, estado: "error", mensaje: "No se detectó la fecha de la semana" };
    }
    const payload = {
      fecha_semana: parsed.fecha_semana,
      idioma: "es",
      url_origen: url,
      lectura_semana: parsed.lectura_semana,
      cantico_inicial: parsed.cantico_inicial,
      cantico_intermedio: parsed.cantico_intermedio,
      cantico_final: parsed.cantico_final,
      tesoros: parsed.tesoros,
      perlas: parsed.perlas,
      lectura_biblica: parsed.lectura_biblica,
      maestros: parsed.maestros,
      vida_cristiana: parsed.vida_cristiana,
      estudio_biblico: parsed.estudio_biblico,
      importado_por: importadoPor,
      updated_at: new Date().toISOString(),
    };
    // Saber si ya existía
    const { data: existente } = await serviceClient
      .from("plantillas_vida_ministerio_oficial")
      .select("id")
      .eq("fecha_semana", parsed.fecha_semana)
      .eq("idioma", "es")
      .maybeSingle();

    const { error } = await serviceClient
      .from("plantillas_vida_ministerio_oficial")
      .upsert(payload, { onConflict: "fecha_semana,idioma" });

    if (error) {
      return { url, fecha_semana: parsed.fecha_semana, estado: "error", mensaje: error.message };
    }
    const estado: Resultado["estado"] = parsed.avisos.length > 0
      ? "parcial"
      : existente ? "actualizada" : "creada";
    const mensaje = parsed.avisos.length > 0
      ? `Guardada con avisos: ${parsed.avisos.join("; ")}`
      : existente ? "Plantilla actualizada" : "Plantilla creada";
    return { url, fecha_semana: parsed.fecha_semana, estado, mensaje };
  } catch (e) {
    return { url, fecha_semana: null, estado: "error", mensaje: e instanceof Error ? e.message : String(e) };
  }
}

// Procesa en lotes de N en paralelo
async function procesarBatch<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += n) {
    const slice = items.slice(i, i + n);
    const res = await Promise.allSettled(slice.map(fn));
    for (const r of res) {
      if (r.status === "fulfilled") out.push(r.value);
      else out.push({ url: "", fecha_semana: null, estado: "error", mensaje: String(r.reason) } as unknown as R);
    }
  }
  return out;
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
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "No autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
    const userId = userData.user.id;

    const serviceClient = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: isSA, error: rpcErr } = await serviceClient.rpc("is_super_admin", { _user_id: userId });
    if (rpcErr || !isSA) {
      return new Response(JSON.stringify({ error: "Solo super_admin puede importar plantillas" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const urls: string[] = Array.isArray(body.urls) ? body.urls.filter((u: unknown) => typeof u === "string" && u.startsWith("http")) : [];
    if (urls.length === 0) {
      return new Response(JSON.stringify({ error: "Debe enviar al menos una URL válida" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (urls.length > 20) {
      return new Response(JSON.stringify({ error: "Máximo 20 URLs por importación" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resultados = await procesarBatch(urls, 5, (u) => procesarUrl(u, userId, serviceClient));
    return new Response(JSON.stringify({ ok: true, resultados }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
