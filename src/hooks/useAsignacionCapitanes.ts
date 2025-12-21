import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getDay, parseISO } from "date-fns";

export interface AsignacionFija {
  id: string;
  dia_semana: number;
  horario_id: string;
  capitan_id: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
  capitan?: {
    id: string;
    nombre: string;
    apellido: string;
  };
  horario?: {
    id: string;
    nombre: string;
    hora?: string;
  };
}

interface CreateAsignacionFijaData {
  dia_semana: number;
  horario_id: string;
  capitan_id: string;
}

// Mapeo de restricciones a días de la semana (0=Domingo, 6=Sábado)
const RESTRICCIONES_DIAS: Record<string, number[]> = {
  sin_restriccion: [0, 1, 2, 3, 4, 5, 6],
  solo_fines_semana: [0, 6],
  solo_entre_semana: [1, 2, 3, 4, 5],
  solo_sabados: [6],
  solo_domingos: [0],
};

export function useAsignacionCapitanes() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Query para obtener asignaciones fijas
  const asignacionesFijasQuery = useQuery({
    queryKey: ["asignaciones-capitan-fijas"],
    queryFn: async (): Promise<AsignacionFija[]> => {
      const { data, error } = await supabase
        .from("asignaciones_capitan_fijas")
        .select(`
          *,
          capitan:participantes!capitan_id(id, nombre, apellido),
          horario:horarios_salida!horario_id(id, nombre, hora)
        `)
        .eq("activo", true)
        .order("dia_semana")
        .order("horario_id");

      if (error) throw error;
      return data as unknown as AsignacionFija[];
    },
  });

  // Query para obtener capitanes elegibles (es_capitan_grupo = true)
  const capitanesElegiblesQuery = useQuery({
    queryKey: ["capitanes-elegibles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participantes")
        .select("id, nombre, apellido, restriccion_disponibilidad")
        .eq("activo", true)
        .eq("es_capitan_grupo", true)
        .order("apellido")
        .order("nombre");

      if (error) throw error;
      return data;
    },
  });

  // Crear asignación fija
  const crearAsignacionFija = useMutation({
    mutationFn: async (data: CreateAsignacionFijaData) => {
      // Primero buscar si existe un registro inactivo con el mismo día/horario
      const { data: existente } = await supabase
        .from("asignaciones_capitan_fijas")
        .select("id")
        .eq("dia_semana", data.dia_semana)
        .eq("horario_id", data.horario_id)
        .eq("activo", false)
        .maybeSingle();

      if (existente) {
        // Reactivar y actualizar el capitán
        const { data: asignacion, error } = await supabase
          .from("asignaciones_capitan_fijas")
          .update({ capitan_id: data.capitan_id, activo: true })
          .eq("id", existente.id)
          .select()
          .single();

        if (error) throw error;
        return asignacion;
      }

      // Si no existe, crear nuevo
      const { data: asignacion, error } = await supabase
        .from("asignaciones_capitan_fijas")
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return asignacion;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["asignaciones-capitan-fijas"] });
      toast({ title: "Asignación fija creada" });
    },
    onError: (error) => {
      toast({ title: "Error al crear asignación", description: error.message, variant: "destructive" });
    },
  });

  // Eliminar asignación fija
  const eliminarAsignacionFija = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("asignaciones_capitan_fijas")
        .update({ activo: false })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["asignaciones-capitan-fijas"] });
      toast({ title: "Asignación fija eliminada" });
    },
    onError: (error) => {
      toast({ title: "Error al eliminar asignación", description: error.message, variant: "destructive" });
    },
  });

  // Función para obtener capitán disponible para una fecha y horario
  const obtenerCapitanDisponible = (
    fecha: string,
    horarioId: string,
    asignacionesFijas: AsignacionFija[],
    capitanesElegibles: typeof capitanesElegiblesQuery.data,
    options?: {
      estrategia?: "rotacion" | "aleatoria";
      estadoRotacion?: Map<string, number>;
      excluirCapitanes?: Set<string>;
      /**
       * Permite mantener una sola lista consecutiva a través de varios días/horarios.
       * Ej: "global" para rotación continua (mañana→tarde→siguiente día...).
       */
      claveRotacion?: string;
    }
  ): string | null => {
    if (!capitanesElegibles || capitanesElegibles.length === 0) return null;

    // IMPORTANTE: evitar new Date('YYYY-MM-DD') por desfase de zona horaria.
    const diaSemana = getDay(parseISO(fecha)); // 0=Domingo, 6=Sábado

    // 1. Buscar asignación fija para este día + horario
    const asignacionFija = asignacionesFijas.find(
      (a) => a.dia_semana === diaSemana && a.horario_id === horarioId
    );

    if (asignacionFija) {
      return asignacionFija.capitan_id;
    }

    const excluir = options?.excluirCapitanes ?? new Set<string>();

    const esDisponible = (capitan: { id: string; restriccion_disponibilidad?: string | null }) => {
      if (excluir.has(capitan.id)) return false;
      const restriccion = capitan.restriccion_disponibilidad || "sin_restriccion";
      const diasPermitidos = RESTRICCIONES_DIAS[restriccion] || [0, 1, 2, 3, 4, 5, 6];
      return diasPermitidos.includes(diaSemana);
    };

    const estrategia = options?.estrategia ?? "rotacion";

    // 2. Selección por rotación (recorre la lista completa en orden y toma el siguiente disponible)
    if (estrategia === "rotacion" && options?.estadoRotacion) {
      const key = options?.claveRotacion ?? `${diaSemana}-${horarioId}`;
      const total = capitanesElegibles.length;
      const start = options.estadoRotacion.get(key) ?? 0;

      for (let i = 0; i < total; i++) {
        const idx = (start + i) % total;
        const candidato = capitanesElegibles[idx];
        if (!esDisponible(candidato)) continue;

        options.estadoRotacion.set(key, (idx + 1) % total);
        return candidato.id;
      }

      return null;
    }

    // 3. Fallback: selección aleatoria entre disponibles
    const disponibles = capitanesElegibles.filter(esDisponible);
    if (disponibles.length === 0) return null;

    const indiceAleatorio = Math.floor(Math.random() * disponibles.length);
    return disponibles[indiceAleatorio].id;
  };

  return {
    asignacionesFijas: asignacionesFijasQuery.data ?? [],
    capitanesElegibles: capitanesElegiblesQuery.data ?? [],
    isLoading: asignacionesFijasQuery.isLoading || capitanesElegiblesQuery.isLoading,
    crearAsignacionFija,
    eliminarAsignacionFija,
    obtenerCapitanDisponible,
  };
}
