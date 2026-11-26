export type BlockS13 = { asignado: string; inicio: string; fin: string };
export type FilaS13 = {
  numero: string;
  ultimaFecha: string;
  blocks: BlockS13[];
  /** Primera fila de una vuelta (desde la segunda): se separa con una línea más gruesa. */
  inicioVuelta?: boolean;
};

export type RegistrosTerritorioS13 = {
  numero: string;
  /** Última fecha en que se completó antes del período. */
  ultimaPrevia: string;
  /** Registros del período, del más antiguo al más reciente. */
  blocks: BlockS13[];
};

/**
 * Ordena las filas del S-13 por vueltas: primero la lista completa de
 * territorios con sus primeros registros; si alguno no cabe, se repite la lista
 * completa con los siguientes, y así sucesivamente.
 *
 * Desde la segunda vuelta, una fila solo se llena si el territorio tiene
 * registros para ella; su "última fecha" es la del último registro de la vuelta
 * anterior. Si no los tiene, queda solo el número.
 */
export function armarFilasS13(territorios: RegistrosTerritorioS13[], porFila: number): FilaS13[] {
  const vueltas = Math.max(1, ...territorios.map((t) => Math.ceil(t.blocks.length / porFila)));
  const filas: FilaS13[] = [];
  for (let vuelta = 0; vuelta < vueltas; vuelta++) {
    const desde = vuelta * porFila;
    for (const [i, t] of territorios.entries()) {
      const blocks = t.blocks.slice(desde, desde + porFila);
      let ultimaFecha = "";
      if (vuelta === 0) ultimaFecha = t.ultimaPrevia;
      else if (blocks.length > 0) ultimaFecha = t.blocks[desde - 1].fin;
      filas.push({ numero: t.numero, ultimaFecha, blocks, inicioVuelta: vuelta > 0 && i === 0 });
    }
  }
  return filas;
}
