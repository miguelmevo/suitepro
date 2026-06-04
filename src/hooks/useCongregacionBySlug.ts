import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Congregacion {
  id: string;
  nombre: string;
  slug: string;
  codigo_publico: string;
  color_primario?: string;
  activo: boolean;
}

/**
 * Extrae el código público de la congregación desde query params.
 * Ej: "suitepro.org/auth?c=K7M2XQ9P" → "K7M2XQ9P"
 * Ej: "suitepro.org/auth" → null (dominio principal)
 */
function getCodigoFromQuery(): string | null {
  const params = new URLSearchParams(window.location.search);
  const c = params.get("c");
  return c ? c.toUpperCase() : null;
}

/**
 * Hook que detecta el código público en la URL y busca la congregación.
 * (El nombre se mantiene por compatibilidad histórica; ahora usa ?c=)
 */
export function useCongregacionBySlug() {
  const [congregacion, setCongregacion] = useState<Congregacion | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const codigo = getCodigoFromQuery();
  const isDominioPrincipal = codigo === null;

  useEffect(() => {
    const fetchCongregacion = async () => {
      if (!codigo) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const { data, error: fetchError } = await supabase
          .rpc("get_congregacion_by_codigo", { _codigo: codigo });

        if (fetchError) {
          console.error("Error buscando congregación por código:", fetchError);
          setError("Error al buscar la congregación");
        } else if (!data || data.length === 0) {
          setError("Congregación no encontrada");
        } else {
          setCongregacion(data[0] as Congregacion);
        }
      } catch (err) {
        console.error("Error:", err);
        setError("Error de conexión");
      } finally {
        setIsLoading(false);
      }
    };

    fetchCongregacion();
  }, [codigo]);

  return {
    slug: codigo, // alias por compatibilidad
    codigo,
    congregacion,
    isLoading,
    error,
    isDominioPrincipal,
  };
}
