import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Congregacion {
  id: string;
  nombre: string;
  slug: string;
  activo: boolean;
}

/**
 * Extrae el subdominio del hostname actual.
 * Ej: "gabriel.suitepro.org" → "gabriel"
 * Ej: "suitepro.org" → null
 * Ej: "localhost:5173" → null (desarrollo)
 */
function getSubdomain(): string | null {
  const hostname = window.location.hostname;
  
  // En desarrollo local, no hay subdominio
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    // Para testing, se puede usar query param ?slug=xxx
    const params = new URLSearchParams(window.location.search);
    return params.get("slug");
  }
  
  // Detectar subdominios en producción
  // Formato esperado: [slug].suitepro.org o [slug].lovableproject.com
  const parts = hostname.split(".");
  
  // Si tiene más de 2 partes (ej: gabriel.suitepro.org → ["gabriel", "suitepro", "org"])
  // El primer elemento es el subdominio/slug
  if (parts.length >= 3) {
    const potentialSlug = parts[0];
    // Excluir "www" como subdominio válido
    if (potentialSlug !== "www") {
      return potentialSlug;
    }
  }
  
  return null;
}

/**
 * Hook que detecta el subdominio actual y busca la congregación correspondiente.
 */
export function useCongregacionBySlug() {
  const [congregacion, setCongregacion] = useState<Congregacion | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const slug = useMemo(() => getSubdomain(), []);
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
