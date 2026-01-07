import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Congregacion {
  id: string;
  nombre: string;
  slug: string;
  activo: boolean;
}

interface CongregacionContextType {
  congregacionActual: Congregacion | null;
  congregaciones: Congregacion[];
  isLoading: boolean;
  cambiarCongregacion: (congregacionId: string) => void;
}

const CongregacionContext = createContext<CongregacionContextType | undefined>(undefined);

// ID de la congregación por defecto (Villa Real)
const CONGREGACION_DEFAULT_ID = "00000000-0000-0000-0000-000000000001";

export function CongregacionProvider({ children }: { children: ReactNode }) {
  const { user, userCongregaciones, getPrimaryCongregacionId } = useAuth();
  const [congregacionActual, setCongregacionActual] = useState<Congregacion | null>(null);
  const [congregaciones, setCongregaciones] = useState<Congregacion[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCongregaciones = async () => {
      setIsLoading(true);
      try {
        // Obtener todas las congregaciones activas
        const { data: congregacionesData, error } = await supabase
          .from("congregaciones")
          .select("*")
          .eq("activo", true)
          .order("nombre");

        if (error) throw error;

        setCongregaciones(congregacionesData || []);

        // Determinar qué congregación usar
        let targetCongregacionId: string | null = null;

        // 1. Prioridad: la congregación principal del usuario
        if (userCongregaciones && userCongregaciones.length > 0) {
          const primaryCongregacionId = getPrimaryCongregacionId();
          if (primaryCongregacionId) {
            targetCongregacionId = primaryCongregacionId;
          }
        }

        // 2. Fallback: usar la congregación por defecto
        if (!targetCongregacionId) {
          targetCongregacionId = CONGREGACION_DEFAULT_ID;
        }

        // Buscar la congregación en los datos cargados
        const targetCongregacion = congregacionesData?.find(
          (c) => c.id === targetCongregacionId
        );

        if (targetCongregacion) {
          setCongregacionActual(targetCongregacion);
        } else if (congregacionesData && congregacionesData.length > 0) {
          // Si no existe la target, usar la primera disponible
          setCongregacionActual(congregacionesData[0]);
        }
      } catch (error) {
        console.error("Error fetching congregaciones:", error);
        // En caso de error, crear un objeto mínimo para que la app funcione
        setCongregacionActual({
          id: CONGREGACION_DEFAULT_ID,
          nombre: "Villa Real",
          slug: "villareal",
          activo: true,
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchCongregaciones();
  }, [user, userCongregaciones, getPrimaryCongregacionId]);

  const cambiarCongregacion = (congregacionId: string) => {
    const congregacion = congregaciones.find((c) => c.id === congregacionId);
    if (congregacion) {
      setCongregacionActual(congregacion);
    }
  };

  return (
    <CongregacionContext.Provider
      value={{
        congregacionActual,
        congregaciones,
        isLoading,
        cambiarCongregacion,
      }}
    >
      {children}
    </CongregacionContext.Provider>
  );
}

export function useCongregacion() {
  const context = useContext(CongregacionContext);
  if (context === undefined) {
    throw new Error("useCongregacion debe ser usado dentro de un CongregacionProvider");
  }
  return context;
}

// Hook helper para obtener solo el ID de la congregación actual
export function useCongregacionId(): string {
  const { congregacionActual } = useCongregacion();
  return congregacionActual?.id || CONGREGACION_DEFAULT_ID;
}
