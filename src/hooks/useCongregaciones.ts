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
    // Primero obtener usuarios de la congregación
    const { data: usuarios, error: errorUsuarios } = await supabase
      .from("usuarios_congregacion")
      .select("id, user_id, rol, activo, created_at")
      .eq("congregacion_id", congregacionId)
      .eq("activo", true)
      .order("created_at", { ascending: false });

    if (errorUsuarios) throw errorUsuarios;
    if (!usuarios || usuarios.length === 0) return [];

    // Obtener perfiles de esos usuarios
    const userIds = usuarios.map(u => u.user_id);
    const { data: profiles, error: errorProfiles } = await supabase
      .from("profiles")
      .select("id, nombre, apellido, email")
      .in("id", userIds);

    if (errorProfiles) throw errorProfiles;

    // Combinar datos
    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
    return usuarios.map(u => ({
      ...u,
      profile: profileMap.get(u.user_id) || null
    }));
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
      // Usar función RPC para eliminar en cascada con privilegios elevados
      const { error } = await supabase.rpc("delete_congregation_cascade", {
        _congregacion_id: id
      });

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
