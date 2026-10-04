import { descargarBlob } from "@/lib/pdfDesdeElemento";

export type ResultadoCompartir = "compartido" | "descargado" | "cancelado";

export interface DatosFichaImagen {
  numero: string;
  nombre: string | null;
  /** Letras de las manzanas aún no trabajadas; null si la ficha no muestra manzanas. */
  manzanasNoTrabajadas: string[] | null;
  imagenUrl: string | null;
  direcciones: { direccion: string; motivo: string | null }[];
}

const FUENTE = `"Inter", -apple-system, "Helvetica Neue", Arial, sans-serif`;
const ANCHO = 720; // px lógicos; se exporta a escala 2
const MARGEN = 16;
const ANCHO_TARJETA = ANCHO - MARGEN * 2;
const PAD = 20;
const GAP = 16;
const ANCHO_TEXTO = ANCHO_TARJETA - PAD * 2;

/** Color del tema ("221 83% 53%" en las variables CSS) con transparencia opcional. */
function colorTema(variable: string, alpha: number, respaldo: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  if (!v) return respaldo;
  return `hsl(${v} / ${alpha})`;
}

function cargarImagen(url: string): Promise<HTMLImageElement | null> {
  return new Promise((ok) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => ok(img);
    img.onerror = () => ok(null);
    img.src = url;
  });
}

type Tramo = { texto: string; negrita?: boolean };

/** Parte los tramos en líneas que caben en `ancho` (nunca corta una palabra a la mitad). */
function envolver(ctx: CanvasRenderingContext2D, tramos: Tramo[], px: number, ancho: number): Tramo[][] {
  const fuente = (neg?: boolean) => `${neg ? "700" : "400"} ${px}px ${FUENTE}`;
  const lineas: Tramo[][] = [[]];
  let usado = 0;
  for (const t of tramos) {
    ctx.font = fuente(t.negrita);
    const espacio = ctx.measureText(" ").width;
    for (const palabra of t.texto.split(/\s+/).filter(Boolean)) {
      const w = ctx.measureText(palabra).width;
      const actual = lineas[lineas.length - 1];
      const extra = actual.length ? espacio : 0;
      if (actual.length && usado + extra + w > ancho) {
        lineas.push([{ texto: palabra, negrita: t.negrita }]);
        usado = w;
      } else {
        actual.push({ texto: (actual.length ? " " : "") + palabra, negrita: t.negrita });
        usado += extra + w;
      }
    }
  }
  return lineas;
}

function dibujarLineas(
  ctx: CanvasRenderingContext2D,
  lineas: Tramo[][],
  x: number,
  y: number,
  px: number,
  interlineado: number,
  color: string,
) {
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  lineas.forEach((l, i) => {
    let cx = x;
    for (const t of l) {
      ctx.font = `${t.negrita ? "700" : "400"} ${px}px ${FUENTE}`;
      ctx.fillText(t.texto, cx, y + i * interlineado + interlineado / 2);
      cx += ctx.measureText(t.texto).width;
    }
  });
}

function tarjeta(
  ctx: CanvasRenderingContext2D,
  y: number,
  alto: number,
  borde: string,
  relleno = "#ffffff",
) {
  ctx.beginPath();
  ctx.roundRect(MARGEN, y, ANCHO_TARJETA, alto, 12);
  ctx.fillStyle = relleno;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = borde;
  ctx.stroke();
}

function iconoPin(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(cx, cy + 13);
  ctx.bezierCurveTo(cx - 14, cy - 1, cx - 11, cy - 13, cx, cy - 13);
  ctx.bezierCurveTo(cx + 11, cy - 13, cx + 14, cy - 1, cx, cy + 13);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy - 4, 4, 0, Math.PI * 2);
  ctx.stroke();
}

function iconoCirculo(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string, tipo: "!" | "no") {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  if (tipo === "no") {
    const d = r * 0.71;
    ctx.beginPath();
    ctx.moveTo(cx - d, cy - d);
    ctx.lineTo(cx + d, cy + d);
    ctx.stroke();
  } else {
    ctx.fillRect(cx - 1, cy - r * 0.5, 2, r * 0.6);
    ctx.fillRect(cx - 1, cy + r * 0.3, 2, 2);
  }
}

/** Dibuja la ficha completa y devuelve el PNG. */
export async function generarImagenFicha(d: DatosFichaImagen): Promise<Blob> {
  await document.fonts?.ready;
  const img = d.imagenUrl ? await cargarImagen(d.imagenUrl) : null;

  const primario = colorTema("--primary", 1, "#2563eb");
  const primarioSuave = colorTema("--primary", 0.1, "rgba(37,99,235,0.1)");
  const primarioBorde = colorTema("--primary", 0.3, "rgba(37,99,235,0.3)");
  const rojo = colorTema("--destructive", 1, "#ef4444");
  const rojoBorde = colorTema("--destructive", 0.5, "rgba(239,68,68,0.5)");
  const borde = "#e2e8f0";
  const texto = "#0f172a";
  const gris = "#64748b";

  // --- medición ---
  const medida = document.createElement("canvas").getContext("2d")!;

  const altoTitulo = PAD + 34 + (d.nombre ? 28 : 0) + PAD;

  let lineasAviso: Tramo[][] = [];
  let altoAviso = 0;
  let altoManzanas = 0;
  let filasChips: string[][] = [];
  const CHIP_H = 32;
  const man = d.manzanasNoTrabajadas;
  if (man) {
    lineasAviso = envolver(
      medida,
      [{ texto: "Capitán:", negrita: true }, { texto: "Recuerda informar las manzanas trabajadas" }],
      17,
      ANCHO_TEXTO - 24 - 36,
    );
    altoAviso = Math.max(52, lineasAviso.length * 26 + 28);
    altoManzanas = 28;
    if (man.length) {
      medida.font = `700 16px ${FUENTE}`;
      let fila: string[] = [];
      let usado = 0;
      for (const l of man) {
        const w = Math.max(44, medida.measureText(l).width + 28);
        if (fila.length && usado + w + 8 > ANCHO_TEXTO) {
          filasChips.push(fila);
          fila = [];
          usado = 0;
        }
        fila.push(l);
        usado += w + 8;
      }
      filasChips.push(fila);
      altoManzanas += 8 + filasChips.length * (CHIP_H + 8) - 8;
    }
  }
  const BOTON_H = 44;
  const altoCardManzanas = man ? PAD + altoAviso + 16 + altoManzanas + 16 + BOTON_H + PAD : 0;

  let altoImagen = 0;
  if (img) altoImagen = Math.round((img.naturalHeight / img.naturalWidth) * (ANCHO_TARJETA - 16));
  const altoCardImagen = img ? altoImagen + 16 : 0;

  const bloques = d.direcciones.map((dir) => ({
    dir: envolver(medida, [{ texto: dir.direccion, negrita: false }], 18, ANCHO_TEXTO - 15),
    motivo: dir.motivo ? envolver(medida, [{ texto: dir.motivo }], 15, ANCHO_TEXTO - 15) : [],
  }));
  let altoLista = 0;
  if (bloques.length) {
    altoLista = bloques.reduce((s, b) => s + b.dir.length * 28 + b.motivo.length * 22 + 16, 0) + (bloques.length - 1) * 12;
  } else {
    altoLista = 80;
  }
  const altoNoPasar = PAD + 28 + 16 + altoLista + PAD;

  const tarjetas = [altoTitulo, altoCardManzanas, altoCardImagen, altoNoPasar].filter((h) => h > 0);
  const total = MARGEN * 2 + tarjetas.reduce((s, h) => s + h, 0) + GAP * (tarjetas.length - 1);

  // --- dibujo ---
  const ESCALA = 2;
  const canvas = document.createElement("canvas");
  canvas.width = ANCHO * ESCALA;
  canvas.height = total * ESCALA;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(ESCALA, ESCALA);
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, ANCHO, total);

  let y = MARGEN;
  const X = MARGEN + PAD;

  // Título
  tarjeta(ctx, y, altoTitulo, borde);
  iconoPin(ctx, X + 14, y + PAD + 17, primario);
  ctx.fillStyle = texto;
  ctx.font = `700 30px ${FUENTE}`;
  ctx.textBaseline = "middle";
  ctx.fillText(`Territorio ${d.numero}`, X + 40, y + PAD + 17);
  if (d.nombre) {
    ctx.fillStyle = gris;
    ctx.font = `400 18px ${FUENTE}`;
    ctx.fillText(d.nombre, X, y + PAD + 34 + 14);
  }
  y += altoTitulo + GAP;

  // Aviso + manzanas
  if (man) {
    tarjeta(ctx, y, altoCardManzanas, borde);
    let yy = y + PAD;
    ctx.beginPath();
    ctx.roundRect(X, yy, ANCHO_TEXTO, altoAviso, 10);
    ctx.fillStyle = primarioSuave;
    ctx.fill();
    ctx.strokeStyle = primarioBorde;
    ctx.stroke();
    iconoCirculo(ctx, X + 24, yy + altoAviso / 2, 9, primario, "!");
    dibujarLineas(ctx, lineasAviso, X + 48, yy + (altoAviso - lineasAviso.length * 26) / 2, 17, 26, texto);
    yy += altoAviso + 16;

    ctx.fillStyle = texto;
    ctx.font = `500 17px ${FUENTE}`;
    ctx.textBaseline = "middle";
    if (man.length) {
      ctx.fillText("Manzanas no trabajadas:", X, yy + 14);
      yy += 28 + 8;
      for (const fila of filasChips) {
        let cx = X;
        for (const l of fila) {
          ctx.font = `700 16px ${FUENTE}`;
          const w = Math.max(44, ctx.measureText(l).width + 28);
          ctx.beginPath();
          ctx.roundRect(cx, yy, w, CHIP_H, CHIP_H / 2);
          ctx.fillStyle = "#ffffff";
          ctx.fill();
          ctx.strokeStyle = "#cbd5e1";
          ctx.stroke();
          ctx.fillStyle = texto;
          ctx.textAlign = "center";
          ctx.fillText(l, cx + w / 2, yy + CHIP_H / 2 + 1);
          ctx.textAlign = "left";
          cx += w + 8;
        }
        yy += CHIP_H + 8;
      }
    } else {
      ctx.fillStyle = gris;
      ctx.fillText("✅ Todas las manzanas han sido trabajadas en este ciclo.", X, yy + 14);
      yy += 36;
    }
    // Botón (sólo ilustra que el capitán puede registrar desde la app).
    yy += 8;
    ctx.beginPath();
    ctx.roundRect(X, yy, ANCHO_TEXTO, BOTON_H, 10);
    ctx.fillStyle = primario;
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = `600 17px ${FUENTE}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Registrar manzanas trabajadas  ⌄", X + ANCHO_TEXTO / 2, yy + BOTON_H / 2);
    ctx.textAlign = "left";
    y += altoCardManzanas + GAP;
  }

  // Mapa
  if (img) {
    tarjeta(ctx, y, altoCardImagen, borde);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(MARGEN + 8, y + 8, ANCHO_TARJETA - 16, altoImagen, 8);
    ctx.clip();
    ctx.drawImage(img, MARGEN + 8, y + 8, ANCHO_TARJETA - 16, altoImagen);
    ctx.restore();
    y += altoCardImagen + GAP;
  }

  // No Pasar
  tarjeta(ctx, y, altoNoPasar, rojoBorde);
  iconoCirculo(ctx, X + 11, y + PAD + 14, 11, rojo, "no");
  ctx.fillStyle = rojo;
  ctx.font = `700 22px ${FUENTE}`;
  ctx.textBaseline = "middle";
  ctx.fillText("No Pasar", X + 32, y + PAD + 14);
  let yy = y + PAD + 28 + 16;
  if (bloques.length) {
    for (const b of bloques) {
      const alto = b.dir.length * 28 + b.motivo.length * 22 + 16;
      ctx.fillStyle = rojo;
      ctx.fillRect(X, yy, 3, alto);
      dibujarLineas(ctx, b.dir, X + 15, yy + 8, 18, 28, texto);
      dibujarLineas(ctx, b.motivo, X + 15, yy + 8 + b.dir.length * 28, 15, 22, gris);
      yy += alto + 12;
    }
  } else {
    ctx.fillStyle = gris;
    ctx.font = `400 17px ${FUENTE}`;
    ctx.textAlign = "center";
    ctx.fillText("No hay direcciones bloqueadas", ANCHO / 2, yy + 36);
    ctx.textAlign = "left";
  }

  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/png"));
  if (!blob) throw new Error("No se pudo generar la imagen");
  return blob;
}

/**
 * Ofrece la imagen al menú de compartir del teléfono (ahí se elige WhatsApp y
 * el destinatario). Si el dispositivo no puede compartir archivos, la descarga.
 */
export async function compartirImagen(blob: Blob, nombreArchivo: string, texto: string): Promise<ResultadoCompartir> {
  const archivo = new File([blob], `${nombreArchivo}.png`, { type: "image/png" });
  if (navigator.canShare?.({ files: [archivo] })) {
    try {
      await navigator.share({ files: [archivo], title: nombreArchivo, text: texto });
      return "compartido";
    } catch (e) {
      if ((e as DOMException)?.name === "AbortError") return "cancelado";
    }
  }
  descargarBlob(blob, `${nombreArchivo}.png`);
  return "descargado";
}
