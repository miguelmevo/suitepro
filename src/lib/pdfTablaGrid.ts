import type jsPDF from "jspdf";

/**
 * Motor mínimo de tablas para PDF dibujado (jsPDF): celdas con colSpan/rowSpan, relleno,
 * bordes, varios bloques de texto por celda (con espacio entre bloques) y texto que baja de
 * línea dentro de su celda (nunca se corta una palabra). Mide primero y dibuja después, para
 * poder reducir o estirar la tabla hasta que llene la hoja.
 *
 * Las medidas de las celdas se dan en "px de la hoja HTML" (las mismas de la impresión) y se
 * convierten a mm con el factor `mmPorPx` de cada diseño.
 */

export type RGB = [number, number, number];

export interface CeldaPdf {
  /** Un solo párrafo (atajo de `bloques`). Puede bajar de línea. */
  texto?: string;
  /** Bloques de líneas (cada línea baja de línea si no cabe); se separan con `gapBloques`. */
  bloques?: string[][];
  bg?: RGB;
  color?: RGB;
  negrita?: boolean;
  /** Tamaño de letra en px de la hoja HTML. */
  px?: number;
  align?: "left" | "center" | "right";
  colSpan?: number;
  rowSpan?: number;
  padX?: number;
  padY?: number;
  /** Alto de línea como múltiplo del tamaño de letra. */
  lh?: number;
  /** Espacio entre bloques (px). */
  gapBloques?: number;
  /** Alto mínimo de cada bloque (px). */
  minBloque?: number;
  /** Borde de la celda; null = sin borde. Por defecto el de la tabla. */
  borde?: { color: RGB; ancho: number } | null;
  /** Espaciado entre letras (px). */
  charSpace?: number;
  /** Las celdas con el mismo grupo comparten un único tamaño de letra: el menor que necesite alguna. */
  grupoFuente?: string;
}

export interface FilaPdf {
  celdas: CeldaPdf[];
  /** Fila fija (encabezados): no se estira cuando la tabla se ajusta al alto de la hoja. */
  fija?: boolean;
}

export interface TablaPdf {
  x: number;
  anchos: number[]; // mm
  filas: FilaPdf[];
  bordeCelda: { color: RGB; ancho: number };
  bordeExterior?: { color: RGB; ancho: number };
  mmPorPx: number;
}

interface Colocada {
  c: CeldaPdf;
  fila: number;
  col: number;
  cs: number;
  rs: number;
}

function colocar(t: TablaPdf): Colocada[] {
  const ocupado: boolean[][] = t.filas.map(() => t.anchos.map(() => false));
  const out: Colocada[] = [];
  t.filas.forEach((f, r) => {
    let col = 0;
    f.celdas.forEach((c) => {
      while (col < t.anchos.length && ocupado[r][col]) col++;
      const cs = Math.max(1, c.colSpan ?? 1);
      const rs = Math.max(1, c.rowSpan ?? 1);
      for (let dr = 0; dr < rs; dr++) {
        for (let dc = 0; dc < cs; dc++) {
          if (r + dr < ocupado.length && col + dc < t.anchos.length) ocupado[r + dr][col + dc] = true;
        }
      }
      out.push({ c, fila: r, col, cs, rs });
      col += cs;
    });
  });
  return out;
}

export class MotorTabla {
  private grupos = new Map<string, number>();
  constructor(private doc: jsPDF, private k: number) {}

  /** Calcula el tamaño de letra común de cada grupo (el menor que necesite alguna de sus celdas). */
  private prepararGrupos(t: TablaPdf) {
    this.grupos = new Map();
    colocar(t).forEach((p) => {
      const g = p.c.grupoFuente;
      if (!g) return;
      const w = t.anchos.slice(p.col, p.col + p.cs).reduce((s, a) => s + a, 0);
      const px = this.pxEfectivo(t, p.c, w - this.u(t, p.c.padX ?? 5) * 2);
      this.grupos.set(g, Math.min(this.grupos.get(g) ?? Infinity, px));
    });
  }

  private u(t: TablaPdf, px: number) {
    return px * t.mmPorPx * this.k;
  }

  /** Tamaño de letra de la celda: se achica lo necesario para que su palabra más larga quepa entera. */
  private pxEfectivo(t: TablaPdf, c: CeldaPdf, anchoUtilMm: number): number {
    const px = c.px ?? 9;
    const textos = c.bloques ? c.bloques.flat() : [c.texto ?? ""];
    this.setFont(t, px, c.negrita);
    let max = 0;
    textos.forEach((l) => l.split(/\s+/).forEach((w) => (max = Math.max(max, this.doc.getTextWidth(w)))));
    if (max <= anchoUtilMm || max === 0) return px;
    // Con un pequeño margen: si la palabra quedara justo al borde, la medida podría pasarse por un pelo.
    return Math.max(px * (anchoUtilMm / max) * 0.95, px * 0.5);
  }

  private lineasDeBloque(t: TablaPdf, c: CeldaPdf, bloque: string[], anchoMm: number, px: number): string[] {
    this.setFont(t, px, c.negrita);
    const res: string[] = [];
    bloque.forEach((l) => res.push(...this.envolver(l, anchoMm)));
    return res;
  }

  /** Salto de línea sólo ENTRE palabras: una palabra nunca se corta (si no cupiera, se deja entera). */
  private envolver(texto: string, anchoMm: number): string[] {
    const palabras = texto.split(/\s+/).filter(Boolean);
    if (palabras.length === 0) return [" "];
    const lineas: string[] = [];
    let actual = "";
    for (const p of palabras) {
      const prueba = actual ? `${actual} ${p}` : p;
      if (!actual || this.doc.getTextWidth(prueba) <= anchoMm) actual = prueba;
      else {
        lineas.push(actual);
        actual = p;
      }
    }
    lineas.push(actual);
    return lineas;
  }

  private setFont(t: TablaPdf, px: number, negrita?: boolean) {
    this.doc.setFont("helvetica", negrita ? "bold" : "normal");
    // px de la hoja → mm (mmPorPx·k) → pt (×72/25.4)
    this.doc.setFontSize(px * t.mmPorPx * this.k * (72 / 25.4));
  }

  private contenido(t: TablaPdf, c: CeldaPdf, anchoCeldaMm: number) {
    const padX = this.u(t, c.padX ?? 5);
    const px = c.grupoFuente && this.grupos.has(c.grupoFuente) ? this.grupos.get(c.grupoFuente)! : this.pxEfectivo(t, c, anchoCeldaMm - padX * 2);
    const lh = this.u(t, px * (c.lh ?? 1.25));
    const bloquesTxt: string[][] = c.bloques ?? (c.texto !== undefined ? [[c.texto]] : [[""]]);
    const bloques = bloquesTxt.map((b) => this.lineasDeBloque(t, c, b, anchoCeldaMm - padX * 2, px));
    const gap = this.u(t, c.gapBloques ?? 0);
    const minB = this.u(t, c.minBloque ?? 0);
    const altos = bloques.map((b) => Math.max(b.length * lh, minB));
    const alto = altos.reduce((s, a) => s + a, 0) + gap * Math.max(bloques.length - 1, 0);
    return { bloques, altos, lh, gap, alto, padX, px };
  }

  /** Alto natural de cada fila (mm). */
  medir(t: TablaPdf): number[] {
    this.prepararGrupos(t);
    const col = colocar(t);
    const ancho = (c: number, n: number) => t.anchos.slice(c, c + n).reduce((s, w) => s + w, 0);
    const alturas = t.filas.map(() => 0);
    col
      .filter((p) => p.rs === 1)
      .forEach((p) => {
        const info = this.contenido(t, p.c, ancho(p.col, p.cs));
        const h = info.alto + this.u(t, (p.c.padY ?? 4) * 2);
        alturas[p.fila] = Math.max(alturas[p.fila], h);
      });
    col
      .filter((p) => p.rs > 1)
      .forEach((p) => {
        const info = this.contenido(t, p.c, ancho(p.col, p.cs));
        const h = info.alto + this.u(t, (p.c.padY ?? 4) * 2);
        const hay = alturas.slice(p.fila, p.fila + p.rs).reduce((s, a) => s + a, 0);
        if (h > hay) alturas[p.fila + p.rs - 1] += h - hay;
      });
    return alturas;
  }

  /** Dibuja la tabla con las alturas dadas, desde (t.x, y). */
  dibujar(t: TablaPdf, y: number, alturas: number[]) {
    this.prepararGrupos(t);
    const doc = this.doc;
    const colocadas = colocar(t);
    const xCol: number[] = [];
    t.anchos.reduce((x, w, i) => {
      xCol[i] = t.x + x;
      return x + w;
    }, 0);
    const yFila: number[] = [];
    alturas.reduce((acc, h, i) => {
      yFila[i] = y + acc;
      return acc + h;
    }, 0);

    // 1) rellenos
    colocadas.forEach((p) => {
      if (!p.c.bg) return;
      const w = t.anchos.slice(p.col, p.col + p.cs).reduce((s, a) => s + a, 0);
      const h = alturas.slice(p.fila, p.fila + p.rs).reduce((s, a) => s + a, 0);
      doc.setFillColor(p.c.bg[0], p.c.bg[1], p.c.bg[2]);
      doc.rect(xCol[p.col], yFila[p.fila], w, h, "F");
    });

    // 2) texto
    colocadas.forEach((p) => {
      const w = t.anchos.slice(p.col, p.col + p.cs).reduce((s, a) => s + a, 0);
      const h = alturas.slice(p.fila, p.fila + p.rs).reduce((s, a) => s + a, 0);
      const info = this.contenido(t, p.c, w);
      const c = p.c.color ?? [34, 34, 34];
      this.setFont(t, info.px, p.c.negrita);
      doc.setTextColor(c[0], c[1], c[2]);
      const fs = this.u(t, info.px);
      const align = p.c.align ?? "center";
      const x =
        align === "center" ? xCol[p.col] + w / 2 : align === "right" ? xCol[p.col] + w - info.padX : xCol[p.col] + info.padX;
      let ty = yFila[p.fila] + (h - info.alto) / 2;
      if (p.c.charSpace) doc.setCharSpace(this.u(t, p.c.charSpace));
      info.bloques.forEach((lineas, bi) => {
        const altoB = info.altos[bi];
        // el bloque se centra dentro de su alto mínimo
        let ly = ty + (altoB - lineas.length * info.lh) / 2;
        lineas.forEach((l) => {
          const base = ly + (info.lh - (0.716 + 0.212) * fs) / 2 + 0.716 * fs;
          if (l.trim()) doc.text(l, x, base, { align });
          ly += info.lh;
        });
        ty += altoB + info.gap;
      });
      if (p.c.charSpace) doc.setCharSpace(0);
    });

    // 3) bordes
    colocadas.forEach((p) => {
      const b = p.c.borde === undefined ? t.bordeCelda : p.c.borde;
      if (!b) return;
      const w = t.anchos.slice(p.col, p.col + p.cs).reduce((s, a) => s + a, 0);
      const h = alturas.slice(p.fila, p.fila + p.rs).reduce((s, a) => s + a, 0);
      doc.setDrawColor(b.color[0], b.color[1], b.color[2]);
      doc.setLineWidth(this.u(t, b.ancho));
      doc.rect(xCol[p.col], yFila[p.fila], w, h, "S");
    });

    if (t.bordeExterior) {
      const total = alturas.reduce((s, a) => s + a, 0);
      const w = t.anchos.reduce((s, a) => s + a, 0);
      doc.setDrawColor(t.bordeExterior.color[0], t.bordeExterior.color[1], t.bordeExterior.color[2]);
      doc.setLineWidth(this.u(t, t.bordeExterior.ancho));
      doc.rect(t.x, y, w, total, "S");
    }
  }
}
