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

export function CongregacionProvider({ children }: { children: ReactNode }) {
  const { user, userCongregaciones } = useAuth();
  const [congregacionActual, setCongregacionActual] = useState<Congregacion | null>(null);
  const [congregaciones, setCongregaciones] = useState<Congregacion[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Derive primary congregation ID directly instead of using function reference
  const primaryCongregacionId = userCongregaciones.find(c => c.es_principal)?.congregacion_id 
    || userCongregaciones[0]?.congregacion_id 
    || null;

  useEffect(() => {
    const fetchCongregaciones = async () => {
      // Si no hay usuario, no cargar nada
      if (!user) {
        setCongregaciones([]);
        setCongregacionActual(null);
        setIsLoading(false);
        return;
      }

      // Si el usuario no tiene membresías todavía, esperar
      if (userCongregaciones.length === 0) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        // Obtener las congregaciones a las que el usuario tiene acceso
        const congregacionIds = userCongregaciones.map(c => c.congregacion_id);
        
        const { data: congregacionesData, error } = await supabase
          .from("congregaciones")
          .select("*")
          .in("id", congregacionIds)
          .eq("activo", true)
          .order("nombre");

        if (error) throw error;

        setCongregaciones(congregacionesData || []);

        // Determinar la congregación principal del usuario
        if (primaryCongregacionId) {
          const targetCongregacion = congregacionesData?.find(
            (c) => c.id === primaryCongregacionId
          );
          
          if (targetCongregacion) {
            setCongregacionActual(targetCongregacion);
          } else if (congregacionesData && congregacionesData.length > 0) {
            // Si la principal no está disponible, usar la primera
            setCongregacionActual(congregacionesData[0]);
          }
        } else if (congregacionesData && congregacionesData.length > 0) {
          setCongregacionActual(congregacionesData[0]);
        }
      } catch (error) {
        console.error("Error fetching congregaciones:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCongregaciones();
  }, [user?.id, userCongregaciones.length, primaryCongregacionId]);

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
export function useCongregacionId(): string | null {
  const { congregacionActual } = useCongregacion();
  return congregacionActual?.id || null;
}
