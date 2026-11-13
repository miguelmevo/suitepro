/**
 * Un mensaje especial de Predicación puede traer hasta 2 motivos de día
 * especial, guardados en el mismo campo separados por salto de línea,
 * en el orden en que se eligieron.
 */
export function motivosDeMensaje(mensaje: string | null | undefined): string[] {
  return (mensaje || "")
    .split("\n")
    .map((m) => m.trim())
    .filter(Boolean);
}
