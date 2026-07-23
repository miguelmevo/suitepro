import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { startOfMonth, endOfMonth, isWithinInterval, parseISO, addMonths } from "date-fns";
import { useCongregacionId } from "@/contexts/CongregacionContext";

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
  updated_at: string;
  cerrado: boolean;
  cerrado_por: string | null;
  fecha_cierre: string | null;
}

export function useProgramasPublicados(tipoProgramaFilter?: string) {
  const queryClient = useQueryClient();
  const congregacionId = useCongregacionId();

  const { data: programas = [], isLoading } = useQuery({
    queryKey: ["programas-publicados", tipoProgramaFilter, congregacionId],
    queryFn: async () => {
      let query = supabase
        .from("programas_publicados")
        .select("*")
        .eq("activo", true)
        .eq("congregacion_id", congregacionId)
        .order("created_at", { ascending: false });

      if (tipoProgramaFilter) {
        query = query.eq("tipo_programa", tipoProgramaFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as ProgramaPublicado[];
    },
    enabled: !!congregacionId,
  });

  // Obtener el programa del mes actual (para Inicio)
  const programaMesActual = programas.find((p) => {
    const hoy = new Date();
    const inicioMesActual = startOfMonth(hoy);
    const finMesActual = endOfMonth(hoy);
    
    try {
      const fechaInicio = parseISO(p.fecha_inicio);
      // El programa es del mes actual si su fecha_inicio está en el mes actual
      return isWithinInterval(fechaInicio, { start: inicioMesActual, end: finMesActual });
    } catch {
      return false;
    }
  });

  // Obtener el programa del mes siguiente (para publicación anticipada)
  const programaMesSiguiente = programas.find((p) => {
    const inicioMesSiguiente = startOfMonth(addMonths(new Date(), 1));
    const finMesSiguiente = endOfMonth(addMonths(new Date(), 1));

    try {
      const fechaInicio = parseISO(p.fecha_inicio);
      return isWithinInterval(fechaInicio, { start: inicioMesSiguiente, end: finMesSiguiente });
    } catch {
      return false;
    }
  });

  // Buscar programa existente para un período específico
  const buscarProgramaPorPeriodo = (tipoProgramaId: string, fechaInicio: string, fechaFin: string) => {
    return programas.find(
      (p) => p.tipo_programa === tipoProgramaId && 
             p.fecha_inicio === fechaInicio && 
             p.fecha_fin === fechaFin
    );
  };

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
      // Buscar si ya existe un programa para este período específico
      const programaExistente = programas.find(
        (p) => p.tipo_programa === tipoProgramaId && 
               p.fecha_inicio === fechaInicio && 
               p.fecha_fin === fechaFin
      );

      // Generar nombre único para el archivo
      const timestamp = Date.now();
      const fileName = `${congregacionId}/${tipoProgramaId}/${periodo.replace(/\s+/g, "_")}_${timestamp}.pdf`;

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

      if (programaExistente) {
        // ACTUALIZAR: Eliminar el archivo antiguo y actualizar el registro
        await supabase.storage
          .from("programas-pdf")
          .remove([programaExistente.pdf_path]);

        const { data, error } = await supabase
          .from("programas_publicados")
          .update({
            pdf_url: urlData.publicUrl,
            pdf_path: fileName,
            updated_at: new Date().toISOString(),
          })
          .eq("id", programaExistente.id)
          .select()
          .single();

        if (error) throw error;

        // Limpiar otros programas del mismo mes y tipo (mantener solo 1 por mes)
        const mesInicio = startOfMonth(parseISO(fechaInicio));
        const mesFin = endOfMonth(mesInicio);
        const otrosDelMes = programas.filter(
          (p) =>
            p.tipo_programa === tipoProgramaId &&
            p.id !== programaExistente.id &&
            isWithinInterval(parseISO(p.fecha_inicio), { start: mesInicio, end: mesFin })
        );
        for (const viejo of otrosDelMes) {
          await supabase.storage.from("programas-pdf").remove([viejo.pdf_path]);
          await supabase.from("programas_publicados").delete().eq("id", viejo.id);
        }

        return { ...data, isUpdate: true };
      } else {
        // CREAR NUEVO: No desactivar otros, simplemente crear uno nuevo
        const { data, error } = await supabase
          .from("programas_publicados")
          .insert({
            tipo_programa: tipoProgramaId,
            periodo,
            fecha_inicio: fechaInicio,
            fecha_fin: fechaFin,
            pdf_url: urlData.publicUrl,
            pdf_path: fileName,
            congregacion_id: congregacionId,
          })
          .select()
          .single();

        if (error) throw error;

        // Limpiar otros programas del mismo mes y tipo (mantener solo 1 por mes)
        const mesInicio = startOfMonth(parseISO(fechaInicio));
        const mesFin = endOfMonth(mesInicio);
        const otrosDelMes = programas.filter(
          (p) =>
            p.tipo_programa === tipoProgramaId &&
            p.id !== data.id &&
            isWithinInterval(parseISO(p.fecha_inicio), { start: mesInicio, end: mesFin })
        );
        for (const viejo of otrosDelMes) {
          await supabase.storage.from("programas-pdf").remove([viejo.pdf_path]);
          await supabase.from("programas_publicados").delete().eq("id", viejo.id);
        }

        return { ...data, isUpdate: false };
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["programas-publicados"] });
      if (data.isUpdate) {
        toast.success("Programa actualizado correctamente");
      } else {
        toast.success("Programa publicado correctamente");
      }
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

  const cerrarPrograma = useMutation({
    mutationFn: async (programaId: string) => {
      const { error } = await supabase.rpc("cerrar_programa", {
        _programa_id: programaId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["programas-publicados"] });
      toast.success("Programa cerrado correctamente");
    },
    onError: (error) => {
      console.error("Error al cerrar programa:", error);
      toast.error("Error al cerrar el programa");
    },
  });

  const reabrirPrograma = useMutation({
    mutationFn: async (programaId: string) => {
      const { error } = await supabase.rpc("reabrir_programa", {
        _programa_id: programaId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["programas-publicados"] });
      toast.success("Programa reabierto correctamente");
    },
    onError: (error: any) => {
      console.error("Error al reabrir programa:", error);
      toast.error(error.message || "Error al reabrir el programa");
    },
  });

  return {
    programas,
    programaMesActual,
    programaMesSiguiente,
    buscarProgramaPorPeriodo,
    isLoading,
    publicarPrograma,
    eliminarPrograma,
    cerrarPrograma,
    reabrirPrograma,
  };
}
