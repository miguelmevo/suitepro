import jsPDF from "jspdf";
import type { ProgramaVidaMinisterio } from "@/types/vida-ministerio";
import type { Participante } from "@/types/grupos-servicio";
import { construirSemanaVym, type SemanaVym, type FilaVym, type ParteVym } from "@/lib/vidaMinisterioFilas";

/**
 * PDF del programa de Vida y Ministerio DIBUJADO con texto y líneas reales (jsPDF), a
 * partir de los datos de cada semana (no de una captura de pantalla). Reproduce la hoja
 * impresa (ImpresionVidaMinisterio): hoja carta con márgenes de 10 mm arriba/abajo y
 * 12 mm a los lados, encabezado de congregación y dos semanas por página. Sale igual en
 * Safari, Chrome, Edge y Firefox, con texto seleccionable. Ver docs/pdf-vida-ministerio.md
 * (y cómo volver al método anterior de captura).
 *
 * Las medidas salen de las de la hoja HTML (px de CSS): 1 px = 0,2646 mm. Si una página
 * no cabe, todo (letra y espacios) se reduce parejo hasta que quepa.
 */

const PAGE_W = 215.9;
const PAGE_H = 279.4;
const MARGEN_X = 12;
const MARGEN_Y = 10;
const ANCHO = PAGE_W - MARGEN_X * 2;
const PX = 25.4 / 96; // mm por px de CSS
const PT_POR_PX = 0.75;

const COL_HORA_PX = 44;
const COL_PARTE_PX = 230;
const PAD_X_PX = 6;
const PAD_Y_PX = 2;
const FONT_PX = 11.5;
const INTERLINEADO = 1.35;
const SEMANAS_POR_PAGINA = 2;

const GRIS_TEXTO: [number, number, number] = [102, 102, 102];
const GRIS_BARRA: [number, number, number] = [153, 153, 153];
const NEGRO: [number, number, number] = [26, 26, 26];

function aRGB(hex: string): [number, number, number] {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return NEGRO;
  return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)];
}

export interface OpcionesPdfVym {
  programas: ProgramaVidaMinisterio[];
  participantes: Participante[];
  congregacionNombre: string;
  horaInicio?: string;
  consejoMaestrosMins?: number;
  diaEntreSemana?: string;
}

class Dibujante {
  constructor(private doc: jsPDF, private k: number, private pintar: boolean) {}

  private px(v: number) {
    return v * PX * this.k;
  }

  private fuente(px: number, negrita = false) {
    this.doc.setFont("helvetica", negrita ? "bold" : "normal");
    this.doc.setFontSize(px * PT_POR_PX * this.k);
  }

  /** Alto de una línea de texto de `px` px. */
  private lh(px: number) {
    return this.px(px * INTERLINEADO);
  }

  private ancho(texto: string, px: number, negrita = false) {
    this.fuente(px, negrita);
    return this.doc.getTextWidth(texto);
  }

  private lineas(texto: string, px: number, anchoMm: number, negrita = false): string[] {
    this.fuente(px, negrita);
    return this.doc.splitTextToSize(texto || " ", Math.max(anchoMm, 5)) as string[];
  }

  /** Escribe una línea con su baseline centrada en una caja de alto `lh` que empieza en `top`. */
  private texto(
    t: string,
    x: number,
    top: number,
    px: number,
    opts: { negrita?: boolean; color?: [number, number, number]; align?: "left" | "right" | "center" } = {}
  ) {
    if (!this.pintar || !t) return;
    this.fuente(px, opts.negrita);
    const c = opts.color ?? NEGRO;
    this.doc.setTextColor(c[0], c[1], c[2]);
    const fs = this.px(px); // alto de letra en mm
    const caja = this.lh(px);
    const base = top + (caja - (0.716 + 0.212) * fs) / 2 + 0.716 * fs;
    this.doc.text(t, x, base, { align: opts.align ?? "left" });
  }

  /** Texto a la derecha: segmentos (etiqueta gris + valor) alineados a la derecha en `xDer`. */
  private derechaSegmentos(
    segs: { t: string; negrita?: boolean; color?: [number, number, number] }[],
    xDer: number,
    top: number,
    px: number
  ) {
    let total = 0;
    segs.forEach((s) => (total += this.ancho(s.t, px, s.negrita)));
    let x = xDer - total;
    segs.forEach((s) => {
      this.texto(s.t, x, top, px, { negrita: s.negrita, color: s.color });
      x += this.ancho(s.t, px, s.negrita);
    });
  }

  /** Dibuja (o mide) una semana empezando en y; devuelve el alto usado. */
  semana(s: SemanaVym, y0: number, conSeparador: boolean): number {
    const X0 = MARGEN_X;
    let y = y0;
    const anchoParte = COL_PARTE_PX * PX;
    const padX = this.px(PAD_X_PX);
    const padY = this.px(PAD_Y_PX);

    // --- Encabezado de la semana ---
    const fechaPx = 13;
    const textoFecha = s.lectura ? `${s.fecha} | ${s.lectura}` : s.fecha;
    const lFecha = this.lineas(textoFecha, fechaPx, ANCHO - anchoParte - padX, true);
    const altoFecha = lFecha.length * this.lh(fechaPx);
    const altoPresi = s.sinReunion === true ? 0 : 2 * this.lh(FONT_PX);
    const altoHeader = Math.max(altoFecha, altoPresi) + padY * 2;
    lFecha.forEach((l, i) => this.texto(l, X0, y + padY + i * this.lh(fechaPx), fechaPx, { negrita: true }));
    if (s.sinReunion === false) {
      const xDer = X0 + ANCHO - padX;
      this.derechaSegmentos(
        [
          { t: "Presidente:", negrita: true, color: GRIS_TEXTO },
          { t: ` ${s.presidente}` },
        ],
        xDer,
        y + padY,
        FONT_PX
      );
      this.derechaSegmentos(
        [
          { t: "Oración:", negrita: true, color: GRIS_TEXTO },
          { t: ` ${s.oracion}` },
        ],
        xDer,
        y + padY + this.lh(FONT_PX),
        FONT_PX
      );
    }
    y += altoHeader + this.px(4);

    if (s.sinReunion === true) {
      // Leyenda centrada con el/los motivos.
      const px = 20.5;
      y += this.px(22);
      s.motivos.forEach((m) => {
        const ls = this.lineas(m, px, ANCHO, true);
        ls.forEach((l) => {
          this.texto(l, X0 + ANCHO / 2, y, px, { negrita: true, align: "center" });
          y += this.px(px * 1.3);
        });
      });
      y += this.px(14);
    } else {
      s.bloques.forEach((b) => {
        if (b.t === "seccion") {
          y += this.px(4);
          const px = 11;
          const alto = this.px(px * INTERLINEADO + 8);
          if (this.pintar) {
            const c = aRGB(b.color);
            this.doc.setFillColor(c[0], c[1], c[2]);
            this.doc.rect(X0, y, ANCHO * 0.65, alto, "F");
            this.doc.setCharSpace(this.px(0.4));
            this.texto(b.titulo, X0 + this.px(8), y + this.px(4), px, { negrita: true, color: [255, 255, 255] });
            this.doc.setCharSpace(0);
            if (b.aux) {
              this.texto(b.aux, X0 + ANCHO - this.px(4), y + this.px(4), FONT_PX, { negrita: true, color: [0, 0, 0], align: "right" });
            }
          }
          y += alto;
        } else {
          b.filas.forEach((f) => {
            y += this.fila(f, y);
          });
        }
      });
    }

    // Separador entre semanas de la misma página.
    if (conSeparador) {
      y += this.px(10);
      if (this.pintar) {
        this.doc.setDrawColor(212, 212, 212);
        this.doc.setLineWidth(this.px(1));
        this.doc.line(X0, y, X0 + ANCHO, y);
      }
      y += this.px(1) + this.px(28);
    }
    return y - y0;
  }

  /** Una fila de la tabla (hora | título | parte). Devuelve su alto. */
  private fila(f: FilaVym, y: number): number {
    const X0 = MARGEN_X;
    const padX = this.px(PAD_X_PX);
    const padY = this.px(PAD_Y_PX);
    const xHora = X0 + padX;
    const xTitulo = X0 + COL_HORA_PX * PX + padX;
    const anchoTitulo = ANCHO - COL_HORA_PX * PX - COL_PARTE_PX * PX - padX * 2;
    const anchoParte = COL_PARTE_PX * PX - padX * 2;
    const xParteDer = X0 + ANCHO - padX;
    const extra = f.negritaTitulo ? this.px(6) : 0; // "Discurso Superintendente": aire arriba

    const lTitulo = this.lineas(f.titulo, FONT_PX, anchoTitulo, !!f.negritaTitulo);
    // Parte: se arma como líneas de segmentos para medir/dibujar.
    const lParte = this.lineasParte(f.parte, anchoParte);
    const nLineas = Math.max(lTitulo.length, lParte.length, 1);
    const alto = nLineas * this.lh(FONT_PX) + padY * 2 + extra;

    const top = y + padY + extra;
    if (f.hora) this.texto(f.hora, xHora, top, FONT_PX, { color: GRIS_TEXTO });
    lTitulo.forEach((l, i) => this.texto(l, xTitulo, top + i * this.lh(FONT_PX), FONT_PX, { negrita: !!f.negritaTitulo }));
    lParte.forEach((segs, i) => this.derechaSegmentos(segs, xParteDer, top + i * this.lh(FONT_PX), FONT_PX));
    return alto;
  }

  private lineasParte(p: ParteVym | undefined, anchoMm: number) {
    type Seg = { t: string; negrita?: boolean; color?: [number, number, number] };
    if (!p) return [] as Seg[][];
    if (p.t === "texto") {
      return this.lineas(p.texto, FONT_PX, anchoMm).map((l) => [{ t: l }] as Seg[]);
    }
    if (p.t === "oracion") {
      const lbl = "Oración:";
      const resto = this.lineas(p.nombre, FONT_PX, anchoMm - this.ancho(`${lbl} `, FONT_PX, true));
      return resto.map((l, i) => (i === 0 ? ([{ t: lbl, negrita: true, color: GRIS_TEXTO }, { t: ` ${l}` }] as Seg[]) : ([{ t: l }] as Seg[])));
    }
    // par: "Titular / Ayudante"; si no cabe en una línea, cada nombre en la suya.
    const total = this.ancho(`${p.a} / ${p.b}`, FONT_PX);
    const segs: Seg[] = [{ t: p.a }, { t: " / ", color: GRIS_BARRA }, { t: p.b }];
    if (total <= anchoMm) return [segs];
    return [
      [{ t: p.a }, { t: " /", color: GRIS_BARRA }] as Seg[],
      [{ t: p.b }] as Seg[],
    ];
  }

  encabezadoPagina(congregacion: string): number {
    const px = 16;
    const top = MARGEN_Y;
    const alto = this.lh(px);
    this.texto((congregacion || "").toUpperCase(), MARGEN_X, top, px, { negrita: true });
    this.texto("PROGRAMA PARA LA REUNIÓN DE ENTRE SEMANA", MARGEN_X + ANCHO, top, px, { negrita: true, align: "right" });
    const yLinea = top + alto + this.px(4);
    if (this.pintar) {
      this.doc.setDrawColor(26, 26, 26);
      this.doc.setLineWidth(this.px(2));
      this.doc.line(MARGEN_X, yLinea + this.px(1), MARGEN_X + ANCHO, yLinea + this.px(1));
    }
    return yLinea + this.px(2) + this.px(10) - top; // alto del encabezado incluido su margen inferior
  }
}

export function generarPdfVidaMinisterio({
  programas,
  participantes,
  congregacionNombre,
  horaInicio,
  consejoMaestrosMins,
  diaEntreSemana,
}: OpcionesPdfVym): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const getNombre = (id: string | null | undefined) => {
    if (!id) return "—";
    const p = participantes.find((x) => x.id === id);
    return p ? `${p.nombre} ${p.apellido}` : "—";
  };
  const semanas = programas.map((p) => construirSemanaVym(p, { getNombre, horaInicio, consejoMaestrosMins, diaEntreSemana }));

  for (let i = 0; i < semanas.length; i += SEMANAS_POR_PAGINA) {
    const grupo = semanas.slice(i, i + SEMANAS_POR_PAGINA);
    if (i > 0) doc.addPage();

    // Se busca el mayor factor (≤ 1) con el que la página entera cabe.
    const disponible = PAGE_H - MARGEN_Y * 2;
    let k = 1;
    for (let intento = 0; intento < 40; intento++) {
      const medidor = new Dibujante(doc, k, false);
      let alto = medidor.encabezadoPagina(congregacionNombre);
      grupo.forEach((s, j) => {
        alto += medidor.semana(s, 0, j < grupo.length - 1);
      });
      if (alto <= disponible || k <= 0.6) break;
      k -= 0.02;
    }

    const d = new Dibujante(doc, k, true);
    let y = MARGEN_Y + d.encabezadoPagina(congregacionNombre);
    grupo.forEach((s, j) => {
      y += d.semana(s, y, j < grupo.length - 1);
    });
  }
  return doc;
}
