import jsPDF from "jspdf";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { getColorTheme } from "@/lib/congregation-colors";
import type { AsignacionServicio, TipoAsignacionServicio } from "@/hooks/useAsignacionesServicio";
import { MotorTabla, type CeldaPdf, type FilaPdf, type RGB, type TablaPdf } from "@/lib/pdfTablaGrid";

/**
 * PDF de Asignaciones de Servicio DIBUJADO con texto y líneas reales (jsPDF), a partir de los
 * datos (no de una captura de pantalla). Reproduce las dos hojas impresas:
 *  - "horizontal" (ImpresionAsignacionesServicio): una columna por fecha y una fila por asignación;
 *  - "vertical"   (ImpresionAsignacionesServicioVertical): una fila por día y columnas agrupadas
 *    (acomodadores, micrófonos, audio y video, aseo, hospitalidad).
 * Cada congregación elige su formato en Ajustes y el PDF lo respeta: el formato vertical sale en hoja
 * carta VERTICAL y el horizontal en hoja carta APAISADA. Mismo tamaño y distribución que la hoja
 * impresa (tabla a su alto natural, arriba); si no cabe en la hoja, se reduce todo parejo. Ver docs/pdf-asignaciones-servicio.md
 * (y cómo volver al método anterior de captura).
 */

export type FormatoAsignaciones = "horizontal" | "vertical";

interface TipoCfg {
  value: TipoAsignacionServicio;
  label: string;
  tipoCampo: "individual" | "grupo";
  soloFinSemana?: boolean;
}

interface GrupoPdf {
  id: string;
  numero: number;
  superintendente?: { id: string; nombre: string; apellido: string } | null;
  auxiliar?: { id: string; nombre: string; apellido: string } | null;
}

export interface OpcionesPdfAsignaciones {
  formato: FormatoAsignaciones;
  fechasReunion: { fecha: string; dia_reunion: "entre_semana" | "fin_semana" }[];
  tipos: TipoCfg[];
  asignaciones: AsignacionServicio[];
  participantes: { id: string; nombre: string; apellido: string }[];
  grupos: GrupoPdf[];
  congregacionNombre: string;
  mesAnio: string;
  colorTema?: string;
  diasEspeciales?: { fecha: string; mensaje: string; color: string; color_pdf?: string | null }[];
  mensajesAdicionales?: { id: string; fecha: string; mensaje: string; color: string }[];
  /** Nota al pie (ya filtrada: sólo si se debe mostrar). */
  nota?: string;
}

const CARTA_ANCHO = 215.9;
const CARTA_ALTO = 279.4;

const BLANCO: RGB = [255, 255, 255];
const GRIS_VACIO: RGB = [153, 153, 153];

function aRGB(color: string | undefined, respaldo: RGB = BLANCO): RGB {
  if (!color) return respaldo;
  const c = color.trim();
  let m = /^#([0-9a-f]{3})$/i.exec(c);
  if (m) return [...m[1]].map((h) => parseInt(h + h, 16)) as RGB;
  m = /^#([0-9a-f]{6})$/i.exec(c);
  if (m) return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)];
  m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(c);
  if (m) {
    const a = m[4] === undefined ? 1 : parseFloat(m[4]);
    return [Number(m[1]), Number(m[2]), Number(m[3])].map((v) => Math.round(v * a + 255 * (1 - a))) as RGB;
  }
  return respaldo;
}

function aclarar(c: RGB, cantidad: number): RGB {
  return c.map((v) => Math.round(v + (255 - v) * cantidad)) as RGB;
}

/** Blanco y gris claro necesitan texto oscuro en vez de blanco para seguir siendo legibles. */
function textoContraste(bg: string): RGB {
  const c = (bg || "").toLowerCase();
  if (c === "#ffffff" || c === "#fff" || c === "#e1fecf") return [0x4d, 0x7c, 0x0f];
  if (c === "#e5e7eb") return [0, 0, 0];
  return [255, 255, 255];
}

const esTextoLibre = (a?: { notas?: string | null } | null) => a != null && a.notas != null;

const titleCase = (s: string) =>
  s
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");

const AUDIOVISUAL: TipoAsignacionServicio[] = ["audio", "video", "zoom", "plataforma", "pasillo_1", "pasillo_2"];
const ACOMODADORES: TipoAsignacionServicio[] = ["acomodador_auditorio", "acomodador_entrada_1", "acomodador_entrada_2"];

interface Datos {
  o: OpcionesPdfAsignaciones;
  theme: { headerDark: RGB; headerLight: RGB; rowAlt: RGB };
  especialPorFecha: Map<string, { mensaje: string; color: string }[]>;
  mensajePorFecha: Map<string, { mensaje: string; color: string }>;
  byKey: Map<string, AsignacionServicio>;
}

function prepararDatos(o: OpcionesPdfAsignaciones): Datos {
  const pdf = getColorTheme(o.colorTema ?? "blue").pdf;
  const especialPorFecha = new Map<string, { mensaje: string; color: string }[]>();
  (o.diasEspeciales ?? []).forEach((d) => {
    const l = especialPorFecha.get(d.fecha) || [];
    l.push({ mensaje: d.mensaje, color: d.color_pdf || d.color });
    especialPorFecha.set(d.fecha, l);
  });
  const mensajePorFecha = new Map<string, { mensaje: string; color: string }>();
  (o.mensajesAdicionales ?? []).forEach((m) => mensajePorFecha.set(m.fecha, { mensaje: m.mensaje, color: m.color }));
  const byKey = new Map<string, AsignacionServicio>();
  o.asignaciones.forEach((a) => byKey.set(`${a.fecha}__${a.tipo_asignacion}`, a));
  return {
    o,
    theme: { headerDark: aRGB(pdf.headerDark), headerLight: aRGB(pdf.headerLight), rowAlt: aRGB(pdf.rowAlt) },
    especialPorFecha,
    mensajePorFecha,
    byKey,
  };
}

/* ------------------------------------------------------------------ */
/*  Formato horizontal                                                */
/* ------------------------------------------------------------------ */

const H_BASE_PX = 979; // 259 mm de la hoja HTML

function tablaHorizontal(d: Datos, anchoMm: number): TablaPdf {
  const { o, theme, especialPorFecha, mensajePorFecha, byKey } = d;
  const mmPorPx = anchoMm / H_BASE_PX;
  const n = o.fechasReunion.length;
  const wLabel = 160 * mmPorPx;
  const anchos = [wLabel, ...o.fechasReunion.map(() => (anchoMm - wLabel) / Math.max(n, 1))];
  const bordeFuerte = { color: theme.headerDark, ancho: 1 };
  const GRIS_BORDE: RGB = [204, 204, 204];
  const ZEBRA: RGB = [0x86, 0xef, 0xac];
  const GROUP_HEADER_BG: RGB = [0xbb, 0xf7, 0xd0];
  const GROUP_LABEL_BG: RGB = [0xd1, 0xfa, 0xe5];

  const filas: FilaPdf[] = [];

  // Encabezado: Asignación + fechas
  filas.push({
    fija: true,
    celdas: [
      { texto: "Asignación", bg: theme.headerLight, color: BLANCO, negrita: true, px: 9, align: "left", padY: 5, padX: 4, borde: bordeFuerte, grupoFuente: "encabezado" },
      ...o.fechasReunion.map((dr): CeldaPdf => {
        const colorFecha = mensajePorFecha.get(dr.fecha)?.color ?? especialPorFecha.get(dr.fecha)?.[0]?.color;
        const bg = colorFecha ? aRGB(colorFecha) : theme.headerLight;
        const color = colorFecha ? textoContraste(colorFecha) : BLANCO;
        return {
          texto: format(parseISO(dr.fecha), "EEE d MMM", { locale: es }),
          bg,
          color,
          negrita: true,
          px: 9,
          padY: 5,
          padX: 4,
          borde: bordeFuerte,
          grupoFuente: "encabezado",
        };
      }),
    ],
  });
  if ((o.mensajesAdicionales ?? []).length > 0) {
    filas.push({
      fija: true,
      celdas: [
        { texto: "", bg: BLANCO, borde: null, padY: 2 },
        ...o.fechasReunion.map((dr): CeldaPdf => {
          const m = mensajePorFecha.get(dr.fecha);
          if (!m) return { texto: "", bg: BLANCO, borde: null, padY: 2 };
          return {
            texto: m.mensaje.toUpperCase(),
            bg: aRGB(m.color),
            color: textoContraste(m.color),
            negrita: true,
            px: 8.5,
            padY: 4,
            padX: 3,
            lh: 1.2,
            charSpace: 0.2,
            borde: bordeFuerte,
          };
        }),
      ],
    });
  }

  const tipos = o.tipos;
  const grupos3 = [
    { label: "Audiovisual", tipos: tipos.filter((t) => AUDIOVISUAL.includes(t.value)) },
    { label: "Acomodadores", tipos: tipos.filter((t) => ACOMODADORES.includes(t.value)) },
    { label: "Aseo / Hospitalidad", tipos: tipos.filter((t) => t.value.startsWith("aseo_") || t.value.startsWith("hospitalidad")) },
  ];
  const firstNonEmptyIdx = grupos3.findIndex((g) => g.tipos.length > 0);

  // Filas del cuerpo (se colocan con la misma regla de la hoja HTML)
  let dataRowIdx = -1;
  let rowSpanCount = 0;
  grupos3.forEach((g, gIdx) => {
    if (firstNonEmptyIdx < 0 || gIdx < firstNonEmptyIdx) return;
    if (gIdx === firstNonEmptyIdx) rowSpanCount += g.tipos.length;
    else {
      if (g.tipos.length > 0) rowSpanCount += 1;
      rowSpanCount += g.tipos.length;
    }
  });

  const valor = (fecha: string, t: TipoCfg, dr: "entre_semana" | "fin_semana"): string => {
    if (t.soloFinSemana && dr !== "fin_semana") return "—";
    const a = byKey.get(`${fecha}__${t.value}`);
    if (!a) return "";
    if (t.tipoCampo === "grupo" && esTextoLibre(a)) return a.notas || "";
    if (t.tipoCampo === "individual" && a.participante_id) {
      const p = o.participantes.find((x) => x.id === a.participante_id);
      return p ? `${p.nombre} ${p.apellido}`.toUpperCase() : "";
    }
    if (t.tipoCampo === "grupo" && a.grupo_predicacion_id) {
      const g = o.grupos.find((x) => x.id === a.grupo_predicacion_id);
      return g ? `Grupo ${g.numero}` : "";
    }
    return "";
  };

  grupos3.forEach((g, gIdx) => {
    if (g.tipos.length > 0) {
      // Fila de título del grupo: las fechas con día especial quedan cubiertas por su celda combinada.
      const celdas: CeldaPdf[] = [
        { texto: g.label.toUpperCase(), bg: GROUP_HEADER_BG, negrita: true, px: 9.5, align: "left", padY: 4, padX: 5, charSpace: 0.5 },
      ];
      let corrida = 0;
      const cierraCorrida = () => {
        if (corrida > 0) celdas.push({ texto: "", bg: GROUP_HEADER_BG, colSpan: corrida, padY: 4 });
        corrida = 0;
      };
      o.fechasReunion.forEach((dr) => {
        const esp = especialPorFecha.get(dr.fecha);
        const cubierta = gIdx > firstNonEmptyIdx && !!esp && esp.length > 0;
        if (cubierta) cierraCorrida();
        else corrida++;
      });
      cierraCorrida();
      filas.push({ celdas });
    }
    g.tipos.forEach((t, tIdx) => {
      dataRowIdx += 1;
      const rowBg: RGB = dataRowIdx % 2 === 0 ? BLANCO : ZEBRA;
      const celdas: CeldaPdf[] = [
        { texto: t.label.toUpperCase(), bg: GROUP_LABEL_BG, negrita: true, px: 8.5, align: "left", padY: 4, padX: 5 },
      ];
      o.fechasReunion.forEach((dr) => {
        const esp = especialPorFecha.get(dr.fecha);
        if (esp && esp.length > 0) {
          if (gIdx === firstNonEmptyIdx && tIdx === 0) {
            celdas.push({
              bloques: [esp.map((e) => e.mensaje.toUpperCase())],
              bg: aRGB(esp[0].color),
              color: textoContraste(esp[0].color),
              negrita: true,
              px: 10.5,
              rowSpan: rowSpanCount,
              padY: 4,
            });
          }
          return;
        }
        if (t.value.startsWith("aseo_")) {
          const aseo1 = byKey.get(`${dr.fecha}__aseo_1`);
          if (esTextoLibre(aseo1)) {
            if (t.value === "aseo_1") {
              const aseoCount = g.tipos.filter((x) => x.value.startsWith("aseo_")).length;
              celdas.push({ texto: aseo1?.notas || "—", rowSpan: aseoCount, px: 9.5, padY: 4, bg: rowBg });
            }
            return;
          }
        }
        const v = valor(dr.fecha, t, dr.dia_reunion);
        celdas.push({
          texto: v || "—",
          px: 9.5,
          padY: 4,
          bg: rowBg,
          color: v ? undefined : GRIS_VACIO,
        });
      });
      filas.push({ celdas });
    });
  });

  return {
    x: 0,
    anchos,
    filas,
    bordeCelda: { color: GRIS_BORDE, ancho: 1 },
    bordeExterior: bordeFuerte,
    mmPorPx,
  };
}

/* ------------------------------------------------------------------ */
/*  Formato vertical                                                  */
/* ------------------------------------------------------------------ */

const V_BASE_PX = 748; // 198 mm de la hoja HTML

interface ColumnaV {
  label: string;
  tipos: TipoAsignacionServicio[];
  tipo?: "responsables";
  peso: number;
}

function tablaVertical(d: Datos, anchoMm: number, escala = 1): TablaPdf {
  const { o, theme, especialPorFecha, mensajePorFecha, byKey } = d;
  const mmPorPx = (anchoMm / V_BASE_PX) * escala;
  const tipoMap = new Map(o.tipos.map((t) => [t.value, t]));
  const buildCol = (label: string, vals: TipoAsignacionServicio[], peso = 1): ColumnaV | null => {
    const present = vals.filter((v) => tipoMap.has(v));
    return present.length > 0 ? { label, tipos: present, peso } : null;
  };
  const grupos5: { label: string; columnas: ColumnaV[] }[] = [
    { label: "ACOMODADORES", columnas: [buildCol("AUDITORIO", ["acomodador_auditorio"], 1.12), buildCol("ENTRADA", ["acomodador_entrada_1", "acomodador_entrada_2"], 1.12)].filter(Boolean) as ColumnaV[] },
    { label: "MICRÓFONOS", columnas: [buildCol("PLATAFORMA", ["plataforma"], 1.25), buildCol("PASILLOS", ["pasillo_1", "pasillo_2"], 1.12)].filter(Boolean) as ColumnaV[] },
    { label: "AUDIO Y VIDEO", columnas: [buildCol("AUDIO", ["audio"], 1.12), buildCol("VIDEO", ["video"], 1.12), buildCol("ZOOM", ["zoom"], 1.12)].filter(Boolean) as ColumnaV[] },
    {
      // Sin filas de Hospitalidad (homologada con Aseo): la misma columna sirve a ambas
      label: o.tipos.some((t) => t.value.startsWith("hospitalidad")) ? "ASEO" : "ASEO Y HOSPITALIDAD",
      columnas: [
        buildCol("GRUPOS", ["aseo_1", "aseo_2", "aseo_3", "aseo_4", "aseo_5"], 0.72),
        (() => {
          const present = (["aseo_1", "aseo_2", "aseo_3", "aseo_4", "aseo_5"] as TipoAsignacionServicio[]).filter((v) => tipoMap.has(v));
          return present.length > 0 ? ({ label: "RESPONSABLES", tipos: present, tipo: "responsables" as const, peso: 1.35 } as ColumnaV) : null;
        })(),
      ].filter(Boolean) as ColumnaV[],
    },
    { label: "HOSPITALIDAD", columnas: [buildCol("HOSPITALIDAD", ["hospitalidad", "hospitalidad_2", "hospitalidad_3", "hospitalidad_4", "hospitalidad_5"], 1.3)].filter(Boolean) as ColumnaV[] },
  ].filter((g) => g.columnas.length > 0);

  const todas = grupos5.flatMap((g) => g.columnas);
  const pesoDia = 0.85;
  const pesoTotal = pesoDia + todas.reduce((s, c) => s + c.peso, 0);
  const anchos = [(anchoMm * pesoDia) / pesoTotal, ...todas.map((c) => (anchoMm * c.peso) / pesoTotal)];
  const totalCols = anchos.length;

  const bordeInterno = aclarar(theme.headerLight, 0.7);
  const bordeTabla = { color: theme.headerLight, ancho: 0.5 };
  const bordeHeader = { color: BLANCO, ancho: 0.5 };

  const encabezadoBase: CeldaPdf = { bg: theme.headerLight, color: BLANCO, negrita: true, px: 8, padY: 4, padX: 2, lh: 1.3, borde: bordeHeader, grupoFuente: "encabezado" };
  const filas: FilaPdf[] = [];
  filas.push({
    fija: true,
    celdas: [
      { ...encabezadoBase, texto: "DÍA", rowSpan: 2 },
      ...grupos5.map((g): CeldaPdf => {
        const merged = g.columnas.length === 1 && g.columnas[0].label === g.label;
        return { ...encabezadoBase, texto: g.label, colSpan: g.columnas.length, rowSpan: merged ? 2 : 1 };
      }),
    ],
  });
  filas.push({
    fija: true,
    celdas: grupos5.flatMap((g) => {
      const merged = g.columnas.length === 1 && g.columnas[0].label === g.label;
      if (merged) return [];
      return g.columnas.map((c): CeldaPdf => ({ ...encabezadoBase, texto: c.label }));
    }),
  });

  const fmt = (n: string, ap: string) => `${n.charAt(0).toUpperCase()}. ${ap.toUpperCase()}`;
  const GAP = 10;

  const bloquesValor = (fecha: string, t: TipoCfg, dr: "entre_semana" | "fin_semana"): string[] | null => {
    if (t.soloFinSemana && dr !== "fin_semana") return null;
    const a = byKey.get(`${fecha}__${t.value}`);
    if (!a) return [];
    if (t.tipoCampo === "grupo" && esTextoLibre(a)) return a.notas ? [a.notas] : [];
    if (t.tipoCampo === "individual" && a.participante_id) {
      const p = o.participantes.find((x) => x.id === a.participante_id);
      return p ? [p.nombre.toUpperCase(), p.apellido.toUpperCase()] : [];
    }
    if (t.tipoCampo === "grupo" && a.grupo_predicacion_id) {
      const g = o.grupos.find((x) => x.id === a.grupo_predicacion_id);
      if (!g) return [];
      if (t.value.startsWith("hospitalidad")) {
        const l = [`G${g.numero}`];
        if (g.superintendente) l.push(fmt(g.superintendente.nombre, g.superintendente.apellido));
        if (g.auxiliar) l.push(fmt(g.auxiliar.nombre, g.auxiliar.apellido));
        return l;
      }
      return [`G${g.numero}`];
    }
    return [];
  };

  const base: CeldaPdf = { px: 8, padY: 6, padX: 5, lh: 1.2 };
  const valorBase: CeldaPdf = { ...base, grupoFuente: "cuerpo" };
  o.fechasReunion.forEach((dr, idx) => {
    const esp = especialPorFecha.get(dr.fecha);
    const msgAdic = mensajePorFecha.get(dr.fecha);
    const fechaObj = parseISO(dr.fecha);
    const diaNombre = format(fechaObj, "EEEE", { locale: es }).toUpperCase();
    const diaNum = format(fechaObj, "dd");
    const filaBg: RGB = idx % 2 === 0 ? theme.rowAlt : BLANCO;

    if (msgAdic) {
      filas.push({
        celdas: [
          {
            texto: msgAdic.mensaje.toUpperCase(),
            colSpan: totalCols,
            bg: aRGB(msgAdic.color),
            color: textoContraste(msgAdic.color),
            negrita: true,
            px: 9,
            padY: 5,
            padX: 6,
            charSpace: 0.3,
            borde: { color: bordeInterno, ancho: 0.3 },
          },
        ],
      });
    }
    const colorDia = msgAdic ?? (esp && esp.length > 0 ? esp[0] : undefined);
    const celdas: CeldaPdf[] = [
      {
        ...base,
        bloques: [[diaNombre, diaNum]],
        bg: colorDia ? aRGB(colorDia.color) : filaBg,
        color: colorDia ? textoContraste(colorDia.color) : theme.headerDark,
        negrita: true,
        lh: 1.25,
      },
    ];
    if (esp && esp.length > 0) {
      celdas.push({
        bloques: [esp.map((e) => e.mensaje.toUpperCase())],
        colSpan: totalCols - 1,
        bg: aRGB(esp[0].color),
        color: textoContraste(esp[0].color),
        negrita: true,
        px: 10,
        padY: 4,
      });
    } else {
      grupos5.forEach((g) => {
        if (g.label === "ASEO") {
          const aseo1 = byKey.get(`${dr.fecha}__aseo_1`);
          if (esTextoLibre(aseo1)) {
            celdas.push({ ...valorBase, texto: aseo1?.notas || "—", colSpan: g.columnas.length, bg: filaBg });
            return;
          }
        }
        g.columnas.forEach((c) => {
          if (c.tipo === "responsables") {
            const bloques = c.tipos.map((tv) => {
              const a = byKey.get(`${dr.fecha}__${tv}`);
              if (!a?.grupo_predicacion_id) return null;
              const grp = o.grupos.find((x) => x.id === a.grupo_predicacion_id);
              if (!grp) return null;
              const nombres: string[] = [];
              if (grp.superintendente) nombres.push(fmt(grp.superintendente.nombre, grp.superintendente.apellido));
              if (grp.auxiliar) nombres.push(fmt(grp.auxiliar.nombre, grp.auxiliar.apellido));
              return nombres;
            });
            const algunoConDatos = bloques.some((b) => b && b.length > 0);
            celdas.push({
              ...valorBase,
              bloques: algunoConDatos ? bloques.map((b) => (b && b.length > 0 ? b : ["—"])) : [["—"]],
              gapBloques: GAP,
              minBloque: 14,
              bg: filaBg,
              color: algunoConDatos ? undefined : GRIS_VACIO,
              borde: { color: bordeInterno, ancho: 0.3 },
            });
            return;
          }
          const valores = c.tipos
            .map((tv) => bloquesValor(dr.fecha, tipoMap.get(tv)!, dr.dia_reunion))
            .filter((v): v is string[] => !!v && v.length > 0 && !(v.length === 1 && v[0] === "—"));
          celdas.push({
            ...valorBase,
            bloques: valores.length === 0 ? [["—"]] : valores,
            gapBloques: GAP,
            bg: filaBg,
            color: valores.length === 0 ? GRIS_VACIO : undefined,
            borde: { color: bordeInterno, ancho: 0.3 },
          });
        });
      });
    }
    filas.push({ celdas });
  });

  return { x: 0, anchos, filas, bordeCelda: { color: bordeInterno, ancho: 0.3 }, bordeExterior: bordeTabla, mmPorPx };
}

/* ------------------------------------------------------------------ */
/*  Hoja completa                                                     */
/* ------------------------------------------------------------------ */

export function generarPdfAsignacionesServicio(o: OpcionesPdfAsignaciones): jsPDF {
  const vertical = o.formato === "vertical";
  const doc = new jsPDF({ orientation: vertical ? "portrait" : "landscape", unit: "mm", format: "letter" });
  const d = prepararDatos(o);
  const PAGE_W = vertical ? CARTA_ANCHO : CARTA_ALTO;
  const PAGE_H = vertical ? CARTA_ALTO : CARTA_ANCHO;
  // Mismo tamaño y ubicación que la hoja impresa (ancho 198 mm centrado en la vertical; 259 mm en la
  // apaisada) y con la tabla a su alto natural, arriba, sin estirarla para llenar la hoja.
  const W = vertical ? 198 : 259.4;
  const MX = (PAGE_W - W) / 2;
  const MY = 8;
  const H = PAGE_H - MY * 2;
  const escala = 1;

  const baseTitulo = vertical ? V_BASE_PX : H_BASE_PX;
  const nombre = titleCase(o.congregacionNombre);
  const lineasTitulo = vertical
    ? [`PROGRAMA DE PRIVILEGIOS${nombre ? ` ${nombre.toUpperCase()}` : ""}`, o.mesAnio.toUpperCase()]
    : [`ASIGNACIONES DE SERVICIO ${nombre ? `- ${nombre} ` : ""}- ${o.mesAnio.toUpperCase()}`.replace(/\s+/g, " ").toUpperCase()];
  const tituloPx = vertical ? 12 : 12.5;
  const notaPx = vertical ? 8 : 9;
  const bordeNota = vertical ? d.theme.headerLight : d.theme.headerDark;

  const construir = () => (vertical ? tablaVertical(d, W, escala) : tablaHorizontal(d, W));

  // Mide toda la hoja con un factor k; devuelve altos para poder ajustar.
  const medida = (k: number) => {
    const mmPorPx = (W / baseTitulo) * escala;
    const u = (px: number) => px * mmPorPx * k;
    const tabla = construir();
    const motor = new MotorTabla(doc, k);
    const alturas = motor.medir(tabla);
    const altoTabla = alturas.reduce((s, a) => s + a, 0);
    const altoTitulo = u(8 * 2) + lineasTitulo.length * u(tituloPx * 1.2) + u(8);
    let altoNota = 0;
    let lineasNota: string[] = [];
    if (o.nota) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(notaPx * mmPorPx * k * (72 / 25.4));
      lineasNota = o.nota.split("\n").flatMap((l) => doc.splitTextToSize(l || " ", W - u(16)) as string[]);
      altoNota = u(8) + u(6 * 2) + lineasNota.length * u(notaPx * 1.35);
    }
    return { tabla, motor, alturas, altoTabla, altoTitulo, altoNota, lineasNota, u, total: altoTitulo + altoTabla + altoNota };
  };

  let k = 1;
  let m = medida(k);
  for (let i = 0; i < 60 && m.total > H && k > 0.5; i++) {
    k -= 0.02;
    m = medida(k);
  }

  const alturas = m.alturas;

  const u = m.u;
  let y = MY;
  // Título (franja de color con esquinas redondeadas)
  doc.setFillColor(d.theme.headerDark[0], d.theme.headerDark[1], d.theme.headerDark[2]);
  doc.roundedRect(MX, y, W, m.altoTitulo - u(8), u(4), u(4), "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(tituloPx * (W / baseTitulo) * escala * k * (72 / 25.4));
  doc.setCharSpace(u(0.5));
  lineasTitulo.forEach((l, i) => {
    const caja = u(tituloPx * 1.2);
    const fs = u(tituloPx);
    const base = y + u(8) + i * caja + (caja - (0.716 + 0.212) * fs) / 2 + 0.716 * fs;
    doc.text(l, MX + W / 2, base, { align: "center" });
  });
  doc.setCharSpace(0);
  y += m.altoTitulo;

  m.tabla.x = MX;
  m.motor.dibujar(m.tabla, y, alturas);
  y += alturas.reduce((s, a) => s + a, 0);

  if (o.nota && m.lineasNota.length > 0) {
    y += u(8);
    const alto = u(6 * 2) + m.lineasNota.length * u(notaPx * 1.35);
    doc.setFillColor(250, 250, 250);
    doc.setDrawColor(bordeNota[0], bordeNota[1], bordeNota[2]);
    doc.setLineWidth(u(0.5));
    doc.roundedRect(MX, y, W, alto, u(4), u(4), "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(notaPx * (W / baseTitulo) * escala * k * (72 / 25.4));
    doc.setTextColor(51, 51, 51);
    m.lineasNota.forEach((l, i) => {
      const caja = u(notaPx * 1.35);
      const fs = u(notaPx);
      const base = y + u(6) + i * caja + (caja - (0.716 + 0.212) * fs) / 2 + 0.716 * fs;
      doc.text(l, MX + u(8), base);
    });
  }
  return doc;
}
