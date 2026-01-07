import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Congregacion {
  id: string;
  nombre: string;
  slug: string;
  activo: boolean;
}

/**
 * Extrae el slug de la congregación desde query params.
 * Ej: "suitepro.org/auth?slug=villareal" → "villareal"
 * Ej: "suitepro.org/auth" → null (dominio principal)
 */
function getSlugFromQuery(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("slug");
}

/**
 * Hook que detecta el subdominio actual y busca la congregación correspondiente.
 */
export function useCongregacionBySlug() {
  const [congregacion, setCongregacion] = useState<Congregacion | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const slug = useMemo(() => getSlugFromQuery(), []);
  const isDominioPrincipal = slug === null;

  useEffect(() => {
    const fetchCongregacion = async () => {
      // Si es dominio principal, no buscar congregación
      if (!slug) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Usar función RPC segura en lugar de consulta directa
        const { data, error: fetchError } = await supabase
          .rpc("get_congregacion_by_slug", { _slug: slug });

        if (fetchError) {
          console.error("Error buscando congregación por slug:", fetchError);
          setError("Error al buscar la congregación");
        } else if (!data || data.length === 0) {
          setError("Congregación no encontrada");
        } else {
          setCongregacion(data[0]);
        }
      } catch (err) {
        console.error("Error:", err);
        setError("Error de conexión");
      } finally {
        setIsLoading(false);
      }
    };

    fetchCongregacion();
  }, [slug]);

  return {
    slug,
    congregacion,
    isLoading,
    error,
    isDominioPrincipal,
  };
}
