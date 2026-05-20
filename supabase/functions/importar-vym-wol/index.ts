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

function normMes(s: string): number | null {
  const k = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return MESES[k] ?? null;
}

// Intenta extraer un año desde múltiples fuentes auxiliares (URL, breadcrumb, title)
function inferYear(html: string, url: string): number | null {
  // mwbYY → 20YY
  const mwb = (html.match(/mwb(\d{2})\b/i) || url.match(/mwb(\d{2})\b/i));
  if (mwb) return 2000 + parseInt(mwb[1], 10);
  // /lp-s/2026... primeros 4 dígitos de un código largo
  const lp = url.match(/\/lp-s\/(\d{4})\d+/);
  if (lp) {
    const y = parseInt(lp[1], 10);
    if (y >= 2020 && y <= 2099) return y;
  }
  // <title> con "de 2026"
  const t = html.match(/de\s+(20\d{2})/);
  if (t) return parseInt(t[1], 10);
  return null;
}

// Parsea encabezado tipo "1-7 de junio de 2026" o "29 de junio a 5 de julio" (año opcional)
function parseFechaSemana(headerText: string, fallbackYear: number | null): string | null {
  const t = headerText.toLowerCase().replace(/\s+/g, " ").trim();
  // patrón 1: "29 de junio a 5 de julio [de 2026]"
  let m = t.match(/(\d{1,2})\s+de\s+([a-záéíóú]+)\s*(?:a|-|–|—|al)\s*(\d{1,2})\s+de\s+([a-záéíóú]+)(?:\s+de\s+(\d{4}))?/);
  if (m) {
    const day1 = parseInt(m[1], 10);
    const mes1 = normMes(m[2]);
    const year = m[5] ? parseInt(m[5], 10) : fallbackYear;
    if (mes1 && year) {
      const d = new Date(Date.UTC(year, mes1 - 1, day1));
      return toIsoDate(mondayOf(d));
    }
  }
  // patrón 2: "1-7 de junio [de 2026]" o "1 a 7 de junio"
  m = t.match(/(\d{1,2})\s*(?:-|–|—|a|al)\s*\d{1,2}\s+de\s+([a-záéíóú]+)(?:\s+de\s+(\d{4}))?/);
  if (m) {
    const day1 = parseInt(m[1], 10);
    const mes = normMes(m[2]);
    const year = m[3] ? parseInt(m[3], 10) : fallbackYear;
    if (mes && year) {
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

// Mapa de abreviaturas → nombre completo del libro bíblico (español)
const LIBROS_BIBLIA: Record<string, string> = {
  "gé": "Génesis", "gen": "Génesis", "génesis": "Génesis", "genesis": "Génesis",
  "éx": "Éxodo", "ex": "Éxodo", "éxodo": "Éxodo", "exodo": "Éxodo",
  "lv": "Levítico", "lev": "Levítico", "levítico": "Levítico", "levitico": "Levítico",
  "nú": "Números", "num": "Números", "núm": "Números", "números": "Números", "numeros": "Números",
  "dt": "Deuteronomio", "deu": "Deuteronomio", "deut": "Deuteronomio", "deuteronomio": "Deuteronomio",
  "jos": "Josué", "josué": "Josué", "josue": "Josué",
  "jue": "Jueces", "jueces": "Jueces",
  "rut": "Rut",
  "1sa": "1 Samuel", "1 sa": "1 Samuel", "1 sam": "1 Samuel", "1 samuel": "1 Samuel",
  "2sa": "2 Samuel", "2 sa": "2 Samuel", "2 sam": "2 Samuel", "2 samuel": "2 Samuel",
  "1re": "1 Reyes", "1 re": "1 Reyes", "1 rey": "1 Reyes", "1 reyes": "1 Reyes",
  "2re": "2 Reyes", "2 re": "2 Reyes", "2 rey": "2 Reyes", "2 reyes": "2 Reyes",
  "1cr": "1 Crónicas", "1 cr": "1 Crónicas", "1 cró": "1 Crónicas", "1 crónicas": "1 Crónicas", "1 cronicas": "1 Crónicas",
  "2cr": "2 Crónicas", "2 cr": "2 Crónicas", "2 cró": "2 Crónicas", "2 crónicas": "2 Crónicas", "2 cronicas": "2 Crónicas",
  "esd": "Esdras", "esdras": "Esdras",
  "ne": "Nehemías", "neh": "Nehemías", "nehemías": "Nehemías", "nehemias": "Nehemías",
  "est": "Ester", "ester": "Ester",
  "job": "Job",
  "sl": "Salmos", "sal": "Salmos", "salmo": "Salmos", "salmos": "Salmos",
  "pr": "Proverbios", "pro": "Proverbios", "prov": "Proverbios", "proverbios": "Proverbios",
  "ec": "Eclesiastés", "ecl": "Eclesiastés", "eclesiastés": "Eclesiastés", "eclesiastes": "Eclesiastés",
  "cnt": "Cantar de los Cantares", "cant": "Cantar de los Cantares", "cantar": "Cantar de los Cantares",
  "is": "Isaías", "isa": "Isaías", "isaías": "Isaías", "isaias": "Isaías",
  "jer": "Jeremías", "jeremías": "Jeremías", "jeremias": "Jeremías",
  "lam": "Lamentaciones", "lamentaciones": "Lamentaciones",
  "eze": "Ezequiel", "ez": "Ezequiel", "ezeq": "Ezequiel", "ezequiel": "Ezequiel",
  "da": "Daniel", "dan": "Daniel", "daniel": "Daniel",
  "os": "Oseas", "ose": "Oseas", "oseas": "Oseas",
  "jl": "Joel", "joel": "Joel",
  "am": "Amós", "amós": "Amós", "amos": "Amós",
  "abd": "Abdías", "abdías": "Abdías", "abdias": "Abdías",
  "jon": "Jonás", "jonás": "Jonás", "jonas": "Jonás",
  "miq": "Miqueas", "miqueas": "Miqueas",
  "nah": "Nahúm", "nahúm": "Nahúm", "nahum": "Nahúm",
  "hab": "Habacuc", "habacuc": "Habacuc",
  "sof": "Sofonías", "sofonías": "Sofonías", "sofonias": "Sofonías",
  "ag": "Ageo", "ageo": "Ageo",
  "zac": "Zacarías", "zacarías": "Zacarías", "zacarias": "Zacarías",
  "mal": "Malaquías", "malaquías": "Malaquías", "malaquias": "Malaquías",
  "mt": "Mateo", "mat": "Mateo", "mateo": "Mateo",
  "mr": "Marcos", "mar": "Marcos", "marcos": "Marcos",
  "lu": "Lucas", "luc": "Lucas", "lucas": "Lucas",
  "jn": "Juan", "juan": "Juan",
  "hch": "Hechos", "hech": "Hechos", "hechos": "Hechos",
  "ro": "Romanos", "rom": "Romanos", "romanos": "Romanos",
  "1co": "1 Corintios", "1 co": "1 Corintios", "1 cor": "1 Corintios", "1 corintios": "1 Corintios",
  "2co": "2 Corintios", "2 co": "2 Corintios", "2 cor": "2 Corintios", "2 corintios": "2 Corintios",
  "gál": "Gálatas", "gal": "Gálatas", "gálatas": "Gálatas", "galatas": "Gálatas",
  "ef": "Efesios", "efe": "Efesios", "efesios": "Efesios",
  "flp": "Filipenses", "fil": "Filipenses", "filipenses": "Filipenses",
  "col": "Colosenses", "colosenses": "Colosenses",
  "1te": "1 Tesalonicenses", "1 te": "1 Tesalonicenses", "1 tes": "1 Tesalonicenses", "1 tesalonicenses": "1 Tesalonicenses",
  "2te": "2 Tesalonicenses", "2 te": "2 Tesalonicenses", "2 tes": "2 Tesalonicenses", "2 tesalonicenses": "2 Tesalonicenses",
  "1ti": "1 Timoteo", "1 ti": "1 Timoteo", "1 tim": "1 Timoteo", "1 timoteo": "1 Timoteo",
  "2ti": "2 Timoteo", "2 ti": "2 Timoteo", "2 tim": "2 Timoteo", "2 timoteo": "2 Timoteo",
  "tit": "Tito", "tito": "Tito",
  "flm": "Filemón", "filem": "Filemón", "filemón": "Filemón", "filemon": "Filemón",
  "heb": "Hebreos", "hebreos": "Hebreos",
  "snt": "Santiago", "stg": "Santiago", "sant": "Santiago", "santiago": "Santiago",
  "1pe": "1 Pedro", "1 pe": "1 Pedro", "1 ped": "1 Pedro", "1 pedro": "1 Pedro",
  "2pe": "2 Pedro", "2 pe": "2 Pedro", "2 ped": "2 Pedro", "2 pedro": "2 Pedro",
  "1jn": "1 Juan", "1 jn": "1 Juan", "1 juan": "1 Juan",
  "2jn": "2 Juan", "2 jn": "2 Juan", "2 juan": "2 Juan",
  "3jn": "3 Juan", "3 jn": "3 Juan", "3 juan": "3 Juan",
  "jud": "Judas", "judas": "Judas",
  "ap": "Apocalipsis", "apo": "Apocalipsis", "apoc": "Apocalipsis", "apocalipsis": "Apocalipsis",
};

function expandirLibroBiblico(cita: string): string {
  // Captura: opcional dígito inicial (1/2/3), nombre/abreviatura del libro, resto (cap:vers)
  const m = cita.trim().match(/^(\d\s*)?([A-Za-zÁÉÍÓÚáéíóúñÑ]+)\.?\s*(.*)$/);
  if (!m) return cita;
  const prefijo = (m[1] ?? "").replace(/\s+/g, "").trim();
  const abrev = m[2].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const resto = m[3].trim();
  const claves = prefijo ? [`${prefijo} ${abrev}`, `${prefijo}${abrev}`] : [abrev];
  for (const k of claves) {
    if (LIBROS_BIBLIA[k]) return `${LIBROS_BIBLIA[k]} ${resto}`.trim();
  }
  return cita;
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

function parseHtml(html: string, url: string): PlantillaParseada {
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

  // Fecha semana: SIEMPRE intentar parsearla desde el HTML (h1 + año inferido).
  // La fecha manual del usuario solo se usa como fallback en procesarUrl.
  const h1 = doc.querySelector("h1") as Element | null;
  const headerText = textOf(h1);
  const year = inferYear(html, url);
  out.fecha_semana = parseFechaSemana(headerText, year);



  // Lectura de la semana: suele estar en el sub-encabezado o "bandera" con cita bíblica
  const banderaSel = ["#p2", ".du-color--gold", "header p", ".lectura-semanal"];
  for (const sel of banderaSel) {
    const el = doc.querySelector(sel) as Element | null;
    const t = textOf(el);
    if (t && /[A-ZÁÉÍÓÚ]/.test(t) && t.length < 120 && /\d/.test(t)) {
      out.lectura_semana = t.replace(/(\d)\s*[-–—]\s*(\d)/g, "$1, $2");
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

  // Recorrer h2 (secciones) y h3 (puntos numerados) en orden del documento
  // para asignar correctamente cada punto a su sección.
  type Seccion = "tesoros" | "maestros" | "vida_cristiana" | "desconocida";
  const detectarSeccion = (t: string): Seccion | null => {
    const s = t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (s.includes("tesoros de la biblia")) return "tesoros";
    if (s.includes("seamos mejores maestros")) return "maestros";
    if (s.includes("nuestra vida cristiana")) return "vida_cristiana";
    return null;
  };
  const headings = doc.querySelectorAll("h2, h3");
  const items: Array<{ num: number | null; titulo: string; duracion: number | null; raw: string; seccion: Seccion }> = [];
  let seccionActual: Seccion = "desconocida";
  for (let i = 0; i < headings.length; i++) {
    const h = headings[i] as Element;
    const headText = textOf(h);
    if (!headText) continue;
    if (h.tagName === "H2") {
      const s = detectarSeccion(headText);
      if (s) seccionActual = s;
      continue;
    }
    // h3: acumular hermanos hasta el próximo h2/h3
    let extra = "";
    let sib = h.nextElementSibling as Element | null;
    while (sib && sib.tagName !== "H3" && sib.tagName !== "H2") {
      extra += " " + textOf(sib);
      sib = sib.nextElementSibling as Element | null;
    }
    const raw = (headText + " " + extra).replace(/\s+/g, " ").trim();
    const numMatch = headText.match(/^\s*(\d+)\./);
    const num = numMatch ? parseInt(numMatch[1], 10) : null;
    const dur = extractMins(raw);
    const titulo = cleanTitulo(headText);
    items.push({ num, titulo, duracion: dur, raw, seccion: seccionActual });
  }

  // Tesoros = punto 1; Perlas = punto 2; Lectura = punto 3
  const punto1 = items.find((x) => x.num === 1);
  const punto2 = items.find((x) => x.num === 2);
  const punto3 = items.find((x) => x.num === 3);
  if (punto1) out.tesoros = { titulo: punto1.titulo, duracion: punto1.duracion };
  if (punto2) out.perlas = { titulo: punto2.titulo, duracion: punto2.duracion };
  if (punto3) {
    // Buscar cita bíblica con patrón: [1/2/3] Libro cap:vers[-vers]
    let cita = "";
    const ref = punto3.raw.match(/((?:[123]\s*)?[A-Za-zÁÉÍÓÚáéíóúñÑ]+\.?)\s+(\d{1,3}:\d{1,3}(?:[-–]\d{1,3})?)/);
    if (ref) {
      cita = `${ref[1].replace(/\.$/, "")} ${ref[2]}`;
    } else {
      const matches = [...punto3.raw.matchAll(/\(([^)]+)\)/g)];
      for (const m of matches) {
        const t = m[1].trim();
        if (/mins?\.?/i.test(t)) continue;
        if (/\d/.test(t)) { cita = t.split(",")[0].trim(); break; }
      }
      if (!cita) cita = punto3.titulo.replace(/^lectura de la biblia\s*/i, "").trim();
    }
    cita = expandirLibroBiblico(cita);
    out.lectura_biblica = { cita, duracion: punto3.duracion };
  }

  // Maestros = puntos numerados cuya sección es "maestros"
  const maestros = items.filter((x) => x.num !== null && x.seccion === "maestros");
  for (const m of maestros) {
    const titLower = m.titulo.toLowerCase();
    const tipo: "demostracion" | "discurso" = titLower.startsWith("discurso") || titLower.includes("explique sus creencias") ? "discurso" : "demostracion";
    out.maestros.push({ titulo: m.titulo, tipo, duracion: m.duracion });
  }

  // Estudio bíblico = último punto numerado (siempre es el último de "vida_cristiana")
  const sortedNum = items.filter((x) => x.num !== null).sort((a, b) => (a.num! - b.num!));
  const ultimoPunto = sortedNum[sortedNum.length - 1];

  if (ultimoPunto && /estudio b[íi]blico/i.test(ultimoPunto.titulo)) {
    out.estudio_biblico = { duracion: ultimoPunto.duracion ?? 30 };
    // Vida cristiana = puntos de la sección "vida_cristiana" excluyendo el estudio bíblico
    const vc = items.filter((x) => x.num !== null && x.seccion === "vida_cristiana" && x.num !== ultimoPunto.num);
    for (const p of vc) out.vida_cristiana.push({ titulo: p.titulo, duracion: p.duracion });
  } else {
    out.estudio_biblico = { duracion: 30 };
    if (ultimoPunto) avisos.push("No se detectó claramente el Estudio bíblico de la congregación (se usó 30 min por defecto)");
    const vc = items.filter((x) => x.num !== null && x.seccion === "vida_cristiana");
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
  item: { url: string; fecha_semana?: string | null },
  importadoPor: string,
  serviceClient: ReturnType<typeof createClient>,
): Promise<Resultado> {
  const url = item.url;
  const fechaOverride = item.fecha_semana || null;
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
    const parsed = parseHtml(html, url, fechaOverride);
    if (!parsed.fecha_semana) {
      return { url, fecha_semana: null, estado: "error", mensaje: "No se detectó la fecha. Indica la fecha manualmente." };
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

    // Reemplazar también el contenido de los borradores existentes en las
    // congregaciones para esa semana (preservando asignaciones de participantes
    // cuando es posible), aplicando la misma lógica del botón "Cargar".
    try {
      const { data: borradores } = await serviceClient
        .from("programa_vida_ministerio")
        .select("id, tesoros, lectura_biblica, maestros, vida_cristiana, estudio_biblico")
        .eq("fecha_semana", parsed.fecha_semana)
        .eq("estado", "borrador");

      if (Array.isArray(borradores) && borradores.length > 0) {
        for (const b of borradores) {
          const tesorosPrev = (b.tesoros ?? {}) as any;
          const lecturaPrev = (b.lectura_biblica ?? {}) as any;
          const estudioPrev = (b.estudio_biblico ?? {}) as any;
          const maestrosPrev = Array.isArray(b.maestros) ? (b.maestros as any[]) : [];
          const vidaPrev = Array.isArray(b.vida_cristiana) ? (b.vida_cristiana as any[]) : [];

          const updatePayload: Record<string, unknown> = {
            cantico_inicial: parsed.cantico_inicial ?? null,
            cantico_intermedio: parsed.cantico_intermedio ?? null,
            cantico_final: parsed.cantico_final ?? null,
            lectura_semana: parsed.lectura_semana
              ? parsed.lectura_semana.replace(/(\d)\s*[-–—]\s*(\d)/g, "$1, $2")
              : parsed.lectura_semana,
            tesoros: {
              ...tesorosPrev,
              titulo: parsed.tesoros?.titulo ?? tesorosPrev.titulo ?? "",
              duracion: parsed.tesoros?.duracion ?? tesorosPrev.duracion ?? null,
              perlas_duracion: parsed.perlas?.duracion ?? tesorosPrev.perlas_duracion ?? null,
            },
            lectura_biblica: {
              ...lecturaPrev,
              cita: parsed.lectura_biblica?.cita ?? lecturaPrev.cita ?? "",
              duracion: parsed.lectura_biblica?.duracion ?? lecturaPrev.duracion ?? null,
            },
            estudio_biblico: {
              ...estudioPrev,
              duracion: parsed.estudio_biblico?.duracion ?? estudioPrev.duracion ?? null,
            },
            updated_at: new Date().toISOString(),
          };

          if (Array.isArray(parsed.maestros) && parsed.maestros.length > 0) {
            updatePayload.maestros = parsed.maestros.map((m: any, idx: number) => {
              const prev = maestrosPrev[idx] ?? {};
              return {
                ...prev,
                titulo: m.titulo ?? "",
                tipo: m.tipo === "discurso" ? "discurso" : "demostracion",
                duracion: m.duracion ?? null,
                titular_id: prev.titular_id ?? null,
                ayudante_id: prev.ayudante_id ?? null,
              };
            });
          }
          if (Array.isArray(parsed.vida_cristiana) && parsed.vida_cristiana.length > 0) {
            updatePayload.vida_cristiana = parsed.vida_cristiana.map((v: any, idx: number) => {
              const prev = vidaPrev[idx] ?? {};
              return {
                ...prev,
                titulo: v.titulo ?? "",
                duracion: v.duracion ?? null,
                participante_id: prev.participante_id ?? null,
              };
            });
          }

          await serviceClient
            .from("programa_vida_ministerio")
            .update(updatePayload)
            .eq("id", b.id);
        }
      }
    } catch (_e) {
      // No bloqueamos el resultado por errores al actualizar borradores
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
    // Acepta `items: [{url, fecha_semana?}]` o legacy `urls: string[]`
    let items: Array<{ url: string; fecha_semana?: string | null }> = [];
    if (Array.isArray(body.items)) {
      items = body.items
        .filter((it: any) => it && typeof it.url === "string" && it.url.startsWith("http"))
        .map((it: any) => ({
          url: it.url.trim(),
          fecha_semana: typeof it.fecha_semana === "string" && /^\d{4}-\d{2}-\d{2}$/.test(it.fecha_semana) ? it.fecha_semana : null,
        }));
    } else if (Array.isArray(body.urls)) {
      items = body.urls
        .filter((u: unknown) => typeof u === "string" && (u as string).startsWith("http"))
        .map((u: string) => ({ url: u.trim(), fecha_semana: null }));
    }
    if (items.length === 0) {
      return new Response(JSON.stringify({ error: "Debe enviar al menos una URL válida" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (items.length > 20) {
      return new Response(JSON.stringify({ error: "Máximo 20 URLs por importación" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resultados = await procesarBatch(items, 5, (it) => procesarUrl(it, userId, serviceClient));

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
