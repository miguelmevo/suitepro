import jsPDF from "jspdf";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { getColorTheme } from "@/lib/congregation-colors";
import type { ProgramaReunionPublica } from "@/hooks/useReunionPublica";
import type { Participante } from "@/types/grupos-servicio";

/**
 * PDF del programa de Reunión Pública DIBUJADO con texto y líneas reales (jsPDF), a
 * partir de los datos (no de una captura de pantalla). Reproduce la hoja impresa
 * (ImpresionReunionPublica): título con el color del tema, un recuadro por reunión con su
 * fecha, presidente, orador, tema y lector, días especiales y mensajes adicionales.
 * Hoja carta, márgenes de 10 mm arriba/abajo y 12 mm a los lados; si no cabe en la hoja,
 * se reduce todo parejo. Ver docs/pdf-reunion-publica.md (y cómo volver al método anterior).
 *
 * Las medidas salen de las de la hoja HTML (px de CSS, ancho de 600 px llevado al ancho útil
 * de la hoja).
 */

const PAGE_W = 215.9;
const PAGE_H = 279.4;
const MARGEN_X = 12;
const MARGEN_Y = 10;
const ANCHO = PAGE_W - MARGEN_X * 2;
const BASE_PX = 600; // ancho de la hoja HTML
const PT_POR_PX = 0.75;

type RGB = [number, number, number];

function aRGB(color: string | undefined, respaldo: RGB): RGB {
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

/** Blanco y gris claro necesitan texto oscuro en vez de blanco para seguir siendo legibles. */
function textoContraste(bg: string): RGB {
  const c = (bg || "").toLowerCase();
  if (c === "#ffffff" || c === "#fff" || c === "#e1fecf") return [0x4d, 0x7c, 0x0f];
  if (c === "#e5e7eb") return [0, 0, 0];
  return [255, 255, 255];
}

const titleCase = (s: string) =>
  s
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");

export interface OpcionesPdfRP {
  programa: ProgramaReunionPublica[];
  participantes: Participante[];
  fechas: Date[];
  congregacionNombre: string;
  mesAnio: string;
  colorTema?: string;
  diasEspeciales?: { fecha: string; mensaje: string; color: string; color_pdf?: string | null }[];
  mensajesAdicionales?: { fecha: string; mensaje: string; color: string }[];
}

class Dibujante {
  constructor(private doc: jsPDF, private k: number, private pintar: boolean) {}

  /** mm por px de la hoja HTML, con el factor de ajuste a la hoja. */
  private px(v: number) {
    return ((v * ANCHO) / BASE_PX) * this.k;
  }

  private fuente(px: number, negrita = false) {
    this.doc.setFont("helvetica", negrita ? "bold" : "normal");
    this.doc.setFontSize(((px * ANCHO) / BASE_PX) * this.k * (96 / 25.4) * PT_POR_PX);
  }

  private ancho(t: string, px: number, negrita = false) {
    this.fuente(px, negrita);
    return this.doc.getTextWidth(t);
  }

  private lineas(t: string, px: number, anchoMm: number, negrita = false) {
    this.fuente(px, negrita);
    return this.doc.splitTextToSize(t || " ", Math.max(anchoMm, 5)) as string[];
  }

  private texto(
    t: string,
    x: number,
    top: number,
    px: number,
    lhPx: number,
    opts: { negrita?: boolean; color?: RGB; align?: "left" | "center" | "right"; charSpace?: number } = {}
  ) {
    if (!this.pintar || !t) return;
    this.fuente(px, opts.negrita);
    const c = opts.color ?? [34, 34, 34];
    this.doc.setTextColor(c[0], c[1], c[2]);
    const fs = this.px(px) * 1; // alto de letra en mm
    const caja = this.px(lhPx);
    const base = top + (caja - (0.716 + 0.212) * fs) / 2 + 0.716 * fs;
    if (opts.charSpace) this.doc.setCharSpace(this.px(opts.charSpace));
    this.doc.text(t, x, base, { align: opts.align ?? "left" });
    if (opts.charSpace) this.doc.setCharSpace(0);
  }

  private rect(x: number, y: number, w: number, h: number, color: RGB) {
    if (!this.pintar) return;
    this.doc.setFillColor(color[0], color[1], color[2]);
    this.doc.rect(x, y, w, h, "F");
  }

  titulo(texto: string, y: number, color: RGB): number {
    const alto = this.px(8 * 2 + 13 * 1.2);
    if (this.pintar) {
      this.doc.setFillColor(color[0], color[1], color[2]);
      this.doc.roundedRect(MARGEN_X, y, ANCHO, alto, this.px(6), this.px(6), "F");
      this.texto(texto, MARGEN_X + ANCHO / 2, y + this.px(8), 13, 13 * 1.2, {
        negrita: true,
        color: [255, 255, 255],
        align: "center",
        charSpace: 0.5,
      });
    }
    return alto;
  }

  /** Un recuadro de reunión; devuelve su alto (incluido el margen inferior de 10 px). */
  bloque(b: Bloque, y: number, theme: { headerDark: RGB; headerLight: RGB }): number {
    const X = MARGEN_X;
    const borde = this.px(2);
    const xi = X + borde;
    const wi = ANCHO - borde * 2;
    let cy = y + borde;
    const secciones: (() => void)[] = [];

    // Mensaje adicional (banda de color arriba)
    let alto = borde;
    const dibujar: { alto: number; pintar: (yy: number) => void }[] = [];

    if (b.mensaje) {
      const a = this.px(5 * 2 + 11 * 1.3);
      const m = b.mensaje;
      dibujar.push({
        alto: a,
        pintar: (yy) => {
          this.rect(xi, yy, wi, a, aRGB(m.color, [255, 255, 255]));
          this.texto(m.mensaje.toUpperCase(), X + ANCHO / 2, yy + this.px(5), 11, 11 * 1.3, {
            negrita: true,
            color: textoContraste(m.color),
            align: "center",
            charSpace: 0.3,
          });
        },
      });
    }

    // Fecha
    {
      const a = this.px(5 * 2 + 11 * 1.3) + this.px(2);
      dibujar.push({
        alto: a,
        pintar: (yy) => {
          this.rect(xi, yy, wi, a, theme.headerLight);
          this.rect(xi, yy, wi, this.px(2), theme.headerDark); // border-top
          this.texto(b.fechaLabel, X + ANCHO / 2, yy + this.px(2) + this.px(5), 11, 11 * 1.3, {
            negrita: true,
            color: [255, 255, 255],
            align: "center",
          });
        },
      });
    }

    if (b.especiales.length > 0) {
      const lh = 12 * 1.5;
      const anchoTexto = wi - this.px(24);
      const lineasEsp = b.especiales.map((e) => this.lineas(e.mensaje, 12, anchoTexto, true));
      let nLineas = 0;
      lineasEsp.forEach((l) => (nLineas += l.length));
      const a = this.px(10 * 2) + this.px(lh) * nLineas + this.px(4) * (b.especiales.length - 1);
      dibujar.push({
        alto: a,
        pintar: (yy) => {
          this.rect(xi, yy, wi, a, aRGB(b.especiales[0].color, [255, 255, 255]));
          let ty = yy + this.px(10);
          b.especiales.forEach((e, i) => {
            if (i > 0) ty += this.px(4);
            lineasEsp[i].forEach((l) => {
              this.texto(l, X + ANCHO / 2, ty, 12, lh, { negrita: true, color: textoContraste(e.color), align: "center" });
              ty += this.px(lh);
            });
          });
        },
      });
    } else {
      const xLabel = xi + this.px(8);
      const xValor = xi + this.px(8 + 140 + 8 + 8);
      const anchoValor = xi + wi - this.px(8) - xValor;
      const filas: { label: string; valor: string; negrita?: boolean; extra?: { label: string; valor: string } }[] = [
        { label: "Presidente:", valor: b.presidente },
        { label: "Orador:", valor: b.orador, extra: b.oradorCongregacion ? { label: "Congregación:", valor: b.oradorCongregacion } : undefined },
        { label: "Tema:", valor: b.tema, negrita: true },
        { label: "Lector de La Atalaya :", valor: b.lector },
      ];
      const lh = 10.5 * 1.4;
      filas.forEach((f, i) => {
        // Valor (+ congregación a continuación, separada 20 px, como en la hoja)
        const lineasValor = this.lineas(f.valor, 10.5, anchoValor, f.negrita);
        const extraTexto = f.extra ? `${f.extra.label} ${f.extra.valor}` : "";
        let nLineas = Math.max(lineasValor.length, 1);
        const ultima = lineasValor[lineasValor.length - 1] ?? "";
        const anchoUltima = f.valor ? this.ancho(ultima, 10.5, f.negrita) : 0;
        const margenExtra = f.valor ? this.px(20) : 0;
        let extraEnMismaLinea = true;
        if (extraTexto) {
          const anchoExtra = this.ancho(extraTexto, 10.5, false);
          if (anchoUltima + margenExtra + anchoExtra > anchoValor) {
            extraEnMismaLinea = false;
            nLineas += 1;
          }
        }
        const a = this.px(3 * 2) + this.px(lh) * nLineas + (i < filas.length - 1 ? this.px(1) : 0);
        dibujar.push({
          alto: a,
          pintar: (yy) => {
            const top = yy + this.px(3);
            this.texto(f.label, xLabel, top, 10.5, lh, { negrita: true, color: [68, 68, 68] });
            lineasValor.forEach((l, j) => this.texto(l, xValor, top + j * this.px(lh), 10.5, lh, { negrita: f.negrita }));
            if (extraTexto) {
              const lineaExtra = extraEnMismaLinea ? lineasValor.length - 1 : lineasValor.length;
              const xExtra = extraEnMismaLinea ? xValor + anchoUltima + margenExtra : xValor;
              const yExtra = top + Math.max(lineaExtra, 0) * this.px(lh);
              this.texto(f.extra!.label, xExtra, yExtra, 10.5, lh, { negrita: true, color: [85, 85, 85] });
              this.texto(` ${f.extra!.valor}`, xExtra + this.ancho(f.extra!.label, 10.5, true), yExtra, 10.5, lh, { color: [85, 85, 85] });
            }
            if (i < filas.length - 1 && this.pintar) {
              this.doc.setDrawColor(229, 229, 229);
              this.doc.setLineWidth(this.px(1));
              this.doc.line(xi, yy + a - this.px(0.5), xi + wi, yy + a - this.px(0.5));
            }
          },
        });
      });
    }

    const interior = dibujar.reduce((s, d) => s + d.alto, 0);
    const altoBloque = interior + borde * 2;
    if (this.pintar) {
      // Todo lo de adentro se recorta con las esquinas redondeadas del recuadro.
      this.doc.saveGraphicsState();
      this.doc.roundedRect(X, y, ANCHO, altoBloque, this.px(6), this.px(6), null);
      this.doc.clip();
      this.doc.discardPath();
      let yy = cy;
      dibujar.forEach((d) => {
        d.pintar(yy);
        yy += d.alto;
      });
      this.doc.restoreGraphicsState();
      this.doc.setDrawColor(204, 204, 204);
      this.doc.setLineWidth(borde);
      this.doc.roundedRect(X + borde / 2, y + borde / 2, ANCHO - borde, altoBloque - borde, this.px(6), this.px(6), "S");
    }
    void secciones;
    return altoBloque + this.px(10);
  }
}

interface Bloque {
  fechaLabel: string;
  presidente: string;
  orador: string;
  oradorCongregacion: string;
  tema: string;
  lector: string;
  especiales: { mensaje: string; color: string }[];
  mensaje?: { mensaje: string; color: string };
}

export function generarPdfReunionPublica({
  programa,
  participantes,
  fechas,
  congregacionNombre,
  mesAnio,
  colorTema = "blue",
  diasEspeciales = [],
  mensajesAdicionales = [],
}: OpcionesPdfRP): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const pdf = getColorTheme(colorTema).pdf;
  const theme = { headerDark: aRGB(pdf.headerDark, [26, 82, 118]), headerLight: aRGB(pdf.headerLight, [41, 128, 185]) };

  const getNombre = (id: string | null | undefined) => {
    if (!id) return "";
    const p = participantes.find((x) => x.id === id);
    return p ? `${p.nombre} ${p.apellido}` : "";
  };
  const especialesPorFecha = new Map<string, { mensaje: string; color: string }[]>();
  diasEspeciales.forEach((d) => {
    const l = especialesPorFecha.get(d.fecha) || [];
    l.push({ mensaje: d.mensaje, color: d.color_pdf || d.color });
    especialesPorFecha.set(d.fecha, l);
  });
  const mensajePorFecha = new Map(mensajesAdicionales.map((m) => [m.fecha, m]));

  const tituloTexto = `PROGRAMA REUNIÓN PÚBLICA ${titleCase(congregacionNombre)} - ${mesAnio.toUpperCase()}`;

  const bloques: Bloque[] = fechas.map((fecha) => {
    const fechaStr = format(fecha, "yyyy-MM-dd");
    const prog = programa.find((p) => p.fecha === fechaStr);
    const label = format(fecha, "EEEE dd 'de' MMMM", { locale: es });
    return {
      fechaLabel: label.charAt(0).toUpperCase() + label.slice(1),
      presidente: getNombre(prog?.presidente_id),
      orador: prog?.orador_nombre || "",
      oradorCongregacion: titleCase(((prog as any)?.orador_congregacion || "") as string),
      tema: prog?.tema_discurso || "",
      lector: getNombre(prog?.lector_atalaya_id),
      especiales: especialesPorFecha.get(fechaStr) || [],
      mensaje: mensajePorFecha.get(fechaStr),
    };
  });

  // Se busca el mayor factor (≤ 1) con el que todo cabe en una hoja.
  const disponible = PAGE_H - MARGEN_Y * 2;
  let k = 1.0;
  for (let i = 0; i < 60; i++) {
    const m = new Dibujante(doc, k, false);
    let alto = m.titulo(tituloTexto, 0, theme.headerDark) + m["px"](4);
    bloques.forEach((b) => (alto += m.bloque(b, 0, theme)));
    if (alto <= disponible || k <= 0.5) break;
    k -= 0.02;
  }

  const d = new Dibujante(doc, k, true);
  let y = MARGEN_Y;
  y += d.titulo(tituloTexto, y, theme.headerDark) + d["px"](4);
  bloques.forEach((b) => {
    y += d.bloque(b, y, theme);
  });
  return doc;
}
