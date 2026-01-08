import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Congregacion {
  id: string;
  nombre: string;
  slug: string;
  activo: boolean;
  url_oculta: boolean;
  created_at: string;
  updated_at: string;
}

interface NuevaCongregacion {
  nombre: string;
  slug?: string;
  url_oculta?: boolean;
}

interface UsuarioCongregacion {
  id: string;
  user_id: string;
  rol: string;
  activo: boolean;
  created_at: string;
  profile: {
    nombre: string | null;
    apellido: string | null;
    email: string;
  } | null;
}

// Genera un identificador aleatorio para URLs ocultas
function generarSlugAleatorio(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function useCongregaciones() {
  const queryClient = useQueryClient();

  const { data: congregaciones = [], isLoading, error } = useQuery({
    queryKey: ["congregaciones"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("congregaciones")
        .select("*")
        .order("nombre");

      if (error) throw error;
      return data as Congregacion[];
    },
  });

  // Obtener conteo de usuarios por congregación
  const { data: conteoUsuarios = {} } = useQuery({
    queryKey: ["usuarios-por-congregacion"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("usuarios_congregacion")
        .select("congregacion_id")
        .eq("activo", true);

      if (error) throw error;
      
      const conteo: Record<string, number> = {};
      data.forEach((u) => {
        conteo[u.congregacion_id] = (conteo[u.congregacion_id] || 0) + 1;
      });
      return conteo;
    },
  });

  // Obtener usuarios de una congregación específica
  const obtenerUsuariosCongregacion = async (congregacionId: string): Promise<UsuarioCongregacion[]> => {
    const { data, error } = await supabase
      .from("usuarios_congregacion")
      .select(`
        id,
        user_id,
        rol,
        activo,
        created_at,
        profile:profiles!usuarios_congregacion_user_id_fkey(nombre, apellido, email)
      `)
      .eq("congregacion_id", congregacionId)
      .eq("activo", true)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data || []) as unknown as UsuarioCongregacion[];
  };

  const crearCongregacion = useMutation({
    mutationFn: async (nueva: NuevaCongregacion) => {
      // Si URL oculta, generar slug aleatorio; si no, usar el proporcionado o generar del nombre
      let slug: string;
      
      if (nueva.url_oculta) {
        slug = generarSlugAleatorio();
      } else {
        slug = nueva.slug || nueva.nombre.toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");
      }

      const { data, error } = await supabase
        .from("congregaciones")
        .insert({
          nombre: nueva.nombre,
          slug,
          activo: true,
          url_oculta: nueva.url_oculta || false,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["congregaciones"] });
      toast.success("Congregación creada correctamente");
    },
    onError: (error: Error) => {
      console.error("Error al crear congregación:", error);
      toast.error("Error al crear congregación: " + error.message);
    },
  });

  const actualizarCongregacion = useMutation({
    mutationFn: async ({ id, ...datos }: Partial<Congregacion> & { id: string }) => {
      const { data, error } = await supabase
        .from("congregaciones")
        .update(datos)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["congregaciones"] });
      toast.success("Congregación actualizada correctamente");
    },
    onError: (error: Error) => {
      console.error("Error al actualizar congregación:", error);
      toast.error("Error al actualizar congregación: " + error.message);
    },
  });

  const eliminarCongregacion = useMutation({
    mutationFn: async (id: string) => {
      // Eliminar en cascada: primero datos dependientes, luego la congregación
      
      // 1. Eliminar configuracion_sistema
      await supabase.from("configuracion_sistema").delete().eq("congregacion_id", id);
      
      // 2. Eliminar disponibilidad_capitanes
      await supabase.from("disponibilidad_capitanes").delete().eq("congregacion_id", id);
      
      // 3. Eliminar asignaciones_capitan_fijas
      await supabase.from("asignaciones_capitan_fijas").delete().eq("congregacion_id", id);
      
      // 4. Eliminar miembros_grupo
      await supabase.from("miembros_grupo").delete().eq("congregacion_id", id);
      
      // 5. Eliminar grupos_servicio
      await supabase.from("grupos_servicio").delete().eq("congregacion_id", id);
      
      // 6. Eliminar programa_predicacion
      await supabase.from("programa_predicacion").delete().eq("congregacion_id", id);
      
      // 7. Eliminar programas_publicados
      await supabase.from("programas_publicados").delete().eq("congregacion_id", id);
      
      // 8. Eliminar mensajes_adicionales
      await supabase.from("mensajes_adicionales").delete().eq("congregacion_id", id);
      
      // 9. Eliminar dias_especiales
      await supabase.from("dias_especiales").delete().eq("congregacion_id", id);
      
      // 10. Eliminar puntos_encuentro
      await supabase.from("puntos_encuentro").delete().eq("congregacion_id", id);
      
      // 11. Eliminar horarios_salida
      await supabase.from("horarios_salida").delete().eq("congregacion_id", id);
      
      // 12. Eliminar manzanas_territorio
      await supabase.from("manzanas_territorio").delete().eq("congregacion_id", id);
      
      // 13. Eliminar territorios
      await supabase.from("territorios").delete().eq("congregacion_id", id);
      
      // 14. Eliminar participantes
      await supabase.from("participantes").delete().eq("congregacion_id", id);
      
      // 15. Eliminar grupos_predicacion
      await supabase.from("grupos_predicacion").delete().eq("congregacion_id", id);
      
      // 16. Eliminar usuarios_congregacion
      await supabase.from("usuarios_congregacion").delete().eq("congregacion_id", id);
      
      // 17. Finalmente eliminar la congregación
      const { error } = await supabase
        .from("congregaciones")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["congregaciones"] });
      queryClient.invalidateQueries({ queryKey: ["usuarios-por-congregacion"] });
      toast.success("Congregación eliminada correctamente");
    },
    onError: (error: Error) => {
      console.error("Error al eliminar congregación:", error);
      toast.error("Error al eliminar congregación: " + error.message);
    },
  });

  return {
    congregaciones,
    isLoading,
    error,
    conteoUsuarios,
    obtenerUsuariosCongregacion,
    crearCongregacion,
    actualizarCongregacion,
    eliminarCongregacion,
  };
}
