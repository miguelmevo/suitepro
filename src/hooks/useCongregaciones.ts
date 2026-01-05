import { useState } from "react";
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
      const { error } = await supabase
        .from("congregaciones")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["congregaciones"] });
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
    crearCongregacion,
    actualizarCongregacion,
    eliminarCongregacion,
  };
}
