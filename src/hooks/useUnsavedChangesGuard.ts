import { useEffect, useRef, useCallback } from "react";

/**
 * Hook para detectar cambios sin guardar y avisar al usuario antes de salir.
 * - Bloquea el cierre de pestaña / navegación nativa con beforeunload.
 * - Provee `confirmNavigation(action)` para envolver navegaciones internas
 *   (botones, flechas) y mostrar un diálogo controlado por el componente.
 */
export function useUnsavedChangesGuard(isDirty: boolean) {
  const isDirtyRef = useRef(isDirty);

  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  // Bloquear cierre de pestaña / refresco
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!isDirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  return { isDirtyRef };
}
