import { useSyncExternalStore } from "react";

// Confirmación del último envío de manzanas de cada territorio. Vive fuera de la
// pantalla para que no se pierda si la ficha se vuelve a montar mientras se envía.
interface MensajeEnvio {
  completado: boolean;
}

const DURACION_MS = 60_000;
const mensajes = new Map<string, MensajeEnvio>();
const temporizadores = new Map<string, number>();
const oyentes = new Set<() => void>();
const avisar = () => oyentes.forEach((oyente) => oyente());

export function mostrarMensajeEnvio(territorioId: string, completado: boolean) {
  window.clearTimeout(temporizadores.get(territorioId));
  mensajes.set(territorioId, { completado });
  temporizadores.set(
    territorioId,
    window.setTimeout(() => {
      mensajes.delete(territorioId);
      avisar();
    }, DURACION_MS),
  );
  avisar();
}

export function useMensajeEnvioManzanas(territorioId?: string) {
  return useSyncExternalStore(
    (oyente) => {
      oyentes.add(oyente);
      return () => oyentes.delete(oyente);
    },
    () => (territorioId ? mensajes.get(territorioId) : undefined),
  );
}
