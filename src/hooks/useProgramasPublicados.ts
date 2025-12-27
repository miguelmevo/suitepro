import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ProgramaPublicado {
  id: string;
  tipo_programa: string;
  periodo: string;
  fecha_inicio: string;
  fecha_fin: string;
  pdf_url: string;
  pdf_path: string;
  publicado_por: string | null;
  activo: boolean;
  created_at: string;
}

export function useProgramasPublicados(tipoProgramaFilter?: string) {
  const queryClient = useQueryClient();

  const { data: programas = [], isLoading } = useQuery({
    queryKey: ["programas-publicados", tipoProgramaFilter],
    queryFn: async () => {
      let query = supabase
        .from("programas_publicados")
        .select("*")
        .eq("activo", true)
        .order("created_at", { ascending: false });

      if (tipoProgramaFilter) {
        query = query.eq("tipo_programa", tipoProgramaFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as ProgramaPublicado[];
    },
  });

  const publicarPrograma = useMutation({
    mutationFn: async ({
      tipoProgramaId,
      periodo,
      fechaInicio,
      fechaFin,
      pdfBlob,
    }: {
      tipoProgramaId: string;
      periodo: string;
      fechaInicio: string;
      fechaFin: string;
      pdfBlob: Blob;
    }) => {
      // Generar nombre único para el archivo
      const timestamp = Date.now();
      const fileName = `${tipoProgramaId}/${periodo.replace(/\s+/g, "_")}_${timestamp}.pdf`;

      // Subir el PDF al storage
      const { error: uploadError } = await supabase.storage
        .from("programas-pdf")
        .upload(fileName, pdfBlob, {
          contentType: "application/pdf",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Obtener URL pública
      const { data: urlData } = supabase.storage
        .from("programas-pdf")
        .getPublicUrl(fileName);

      // Desactivar programas anteriores del mismo tipo
      await supabase
        .from("programas_publicados")
        .update({ activo: false })
        .eq("tipo_programa", tipoProgramaId)
        .eq("activo", true);

      // Crear registro del programa publicado
      const { data, error } = await supabase
        .from("programas_publicados")
        .insert({
          tipo_programa: tipoProgramaId,
          periodo,
          fecha_inicio: fechaInicio,
          fecha_fin: fechaFin,
          pdf_url: urlData.publicUrl,
          pdf_path: fileName,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["programas-publicados"] });
      toast.success("Programa publicado correctamente");
    },
    onError: (error) => {
      console.error("Error al publicar programa:", error);
      toast.error("Error al publicar el programa");
    },
  });

  const eliminarPrograma = useMutation({
    mutationFn: async (programa: ProgramaPublicado) => {
      // Eliminar archivo del storage
      const { error: deleteStorageError } = await supabase.storage
        .from("programas-pdf")
        .remove([programa.pdf_path]);

      if (deleteStorageError) {
        console.error("Error eliminando archivo:", deleteStorageError);
      }

      // Eliminar registro de la base de datos
      const { error } = await supabase
        .from("programas_publicados")
        .delete()
        .eq("id", programa.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["programas-publicados"] });
      toast.success("Programa eliminado correctamente");
    },
    onError: (error) => {
      console.error("Error al eliminar programa:", error);
      toast.error("Error al eliminar el programa");
    },
  });

  return {
    programas,
    isLoading,
    publicarPrograma,
    eliminarPrograma,
  };
}
