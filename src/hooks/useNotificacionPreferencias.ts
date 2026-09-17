import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CategoriaNotificacion =
  | "predicacion_recordatorio"
  | "predicacion_punto_encuentro"
  | "predicacion_programa"
  | "vida_ministerio"
  | "servicio"
  | "eventos";

export const CATEGORIAS_NOTIFICACION: { value: CategoriaNotificacion; label: string; descripcion: string }[] = [
  {
    value: "predicacion_recordatorio",
    label: "Predicación: recordatorio de asignación",
    descripcion: "Aviso 16 horas y 1 hora antes de tu salida de predicación como capitán",
  },
  {
    value: "predicacion_punto_encuentro",
    label: "Predicación: punto de encuentro",
    descripcion: "Dónde es el punto de encuentro de tu salida (junto al aviso de 1 hora)",
  },
  {
    value: "predicacion_programa",
    label: "Predicación: nuevo programa",
    descripcion: "Cuando se publique el programa de predicación del mes",
  },
  {
    value: "vida_ministerio",
    label: "Vida y Ministerio",
    descripcion: "Recordatorio el día de tu parte y cuando se publique el programa",
  },
  {
    value: "servicio",
    label: "Asignaciones de Servicio",
    descripcion: "Recordatorio el día de tu asignación y cuando se publique el programa",
  },
  {
    value: "eventos",
    label: "Eventos",
    descripcion: "Cuando se agregue un nuevo evento a la congregación",
  },
];

export function useNotificacionPreferencias(userId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: preferencias, isLoading } = useQuery({
    queryKey: ["notificacion-preferencias", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notificacion_preferencias")
        .select("categoria, activo")
        .eq("user_id", userId as string);
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  // Opt-in: sin preferencia guardada, la categoría se considera desactivada.
  const activoPara = (categoria: CategoriaNotificacion) =>
    preferencias?.find((p) => p.categoria === categoria)?.activo ?? false;

  const setActivo = useMutation({
    mutationFn: async ({ categoria, activo }: { categoria: CategoriaNotificacion; activo: boolean }) => {
      const { error } = await supabase
        .from("notificacion_preferencias")
        .upsert({ user_id: userId as string, categoria, activo }, { onConflict: "user_id,categoria" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notificacion-preferencias", userId] });
    },
  });

  return { isLoading, activoPara, setActivo };
}
