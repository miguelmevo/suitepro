import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthProvider";
import { applyColorTheme, resetColorTheme } from "@/lib/congregation-colors";

interface Congregacion {
  id: string;
  nombre: string;
  slug: string;
  activo: boolean;
  color_primario?: string;
}

interface CongregacionContextType {
  congregacionActual: Congregacion | null;
  congregaciones: Congregacion[];
  isLoading: boolean;
  cambiarCongregacion: (congregacionId: string) => void;
  resetearSeleccion: () => void;
  requiresSelection: boolean;
  hasSelectedCongregacion: boolean;
}

const CongregacionContext = createContext<CongregacionContextType | undefined>(undefined);

export function CongregacionProvider({ children }: { children: ReactNode }) {
  const { user, userCongregaciones, isSuperAdmin } = useAuthContext();
  const [congregacionActual, setCongregacionActual] = useState<Congregacion | null>(null);
  const [congregaciones, setCongregaciones] = useState<Congregacion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasSelectedCongregacion, setHasSelectedCongregacion] = useState(false);

  const isSuperAdminUser = isSuperAdmin();

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
        setHasSelectedCongregacion(false);
        return;
      }

      setIsLoading(true);
      try {
        // Super admin: cargar TODAS las congregaciones
        if (isSuperAdminUser) {
          const { data: allCongregaciones, error } = await supabase
            .from("congregaciones")
            .select("*")
            .eq("activo", true)
            .order("nombre");

          if (error) throw error;

          setCongregaciones(allCongregaciones || []);
          
          // Super admin no tiene congregación por defecto - debe seleccionar
          // Solo establecer si ya había seleccionado una antes
          if (hasSelectedCongregacion && congregacionActual) {
            const stillExists = allCongregaciones?.find(c => c.id === congregacionActual.id);
            if (!stillExists) {
              setCongregacionActual(null);
              setHasSelectedCongregacion(false);
            }
          }
        } else {
          // Usuario normal: cargar solo sus congregaciones
          if (userCongregaciones.length === 0) {
            setIsLoading(false);
            return;
          }

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
              setHasSelectedCongregacion(true);
              // Aplicar color de la congregación
              if (targetCongregacion.color_primario) {
                applyColorTheme(targetCongregacion.color_primario);
              }
            } else if (congregacionesData && congregacionesData.length > 0) {
              setCongregacionActual(congregacionesData[0]);
              setHasSelectedCongregacion(true);
              if (congregacionesData[0].color_primario) {
                applyColorTheme(congregacionesData[0].color_primario);
              }
            }
          } else if (congregacionesData && congregacionesData.length > 0) {
            setCongregacionActual(congregacionesData[0]);
            setHasSelectedCongregacion(true);
            if (congregacionesData[0].color_primario) {
              applyColorTheme(congregacionesData[0].color_primario);
            }
          }
        }
      } catch (error) {
        console.error("Error fetching congregaciones:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCongregaciones();
  }, [user?.id, userCongregaciones.length, primaryCongregacionId, isSuperAdminUser]);

  const cambiarCongregacion = (congregacionId: string) => {
    const congregacion = congregaciones.find((c) => c.id === congregacionId);
    if (congregacion) {
      setCongregacionActual(congregacion);
      setHasSelectedCongregacion(true);
      // Aplicar color de la congregación seleccionada
      if (congregacion.color_primario) {
        applyColorTheme(congregacion.color_primario);
      } else {
        resetColorTheme();
      }
    }
  };

  // Función para resetear la selección (útil para super_admin)
  const resetearSeleccion = () => {
    setCongregacionActual(null);
    setHasSelectedCongregacion(false);
    resetColorTheme();
  };

  // Super admin requiere selección manual si no ha elegido una congregación
  const requiresSelection = isSuperAdminUser && !hasSelectedCongregacion && congregaciones.length > 0;

  return (
    <CongregacionContext.Provider
      value={{
        congregacionActual,
        congregaciones,
        isLoading,
        cambiarCongregacion,
        resetearSeleccion,
        requiresSelection,
        hasSelectedCongregacion,
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
