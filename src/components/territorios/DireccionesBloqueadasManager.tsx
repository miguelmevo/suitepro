import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCongregacionId } from "@/contexts/CongregacionContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Loader2, Ban } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";

interface DireccionBloqueada {
  id: string;
  direccion: string;
  motivo: string | null;
}

interface DireccionesBloqueadasManagerProps {
  territorioId: string;
}

export function DireccionesBloqueadasManager({ territorioId }: DireccionesBloqueadasManagerProps) {
  const congregacionId = useCongregacionId();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [nuevaDireccion, setNuevaDireccion] = useState("");
  const [nuevoMotivo, setNuevoMotivo] = useState("");
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; direccion: DireccionBloqueada | null }>({
    open: false,
    direccion: null,
  });
  const { data: direcciones = [], isLoading } = useQuery({
    queryKey: ["direcciones_bloqueadas", territorioId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("direcciones_bloqueadas")
        .select("id, direccion, motivo")
        .eq("territorio_id", territorioId)
        .eq("activo", true)
        .order("direccion");
      if (error) throw error;
      return data as DireccionBloqueada[];
    },
    enabled: !!territorioId,
  });

  const agregarMutation = useMutation({
    mutationFn: async ({ direccion, motivo }: { direccion: string; motivo: string }) => {
      const { error } = await supabase.from("direcciones_bloqueadas").insert({
        territorio_id: territorioId,
        congregacion_id: congregacionId,
        direccion: direccion.trim(),
        motivo: motivo.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["direcciones_bloqueadas", territorioId] });
      setNuevaDireccion("");
      setNuevoMotivo("");
      toast({ title: "Dirección bloqueada agregada" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const eliminarMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("direcciones_bloqueadas")
        .update({ activo: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["direcciones_bloqueadas", territorioId] });
      toast({ title: "Dirección eliminada" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleAgregar = () => {
    if (!nuevaDireccion.trim()) return;
    agregarMutation.mutate({ direccion: nuevaDireccion, motivo: nuevoMotivo });
  };

  if (isLoading) {
    return <Loader2 className="h-4 w-4 animate-spin" />;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-destructive">
        <Ban className="h-4 w-4" />
        Direcciones Bloqueadas (No pasar)
      </div>

      {/* Lista de direcciones */}
      {direcciones.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay direcciones bloqueadas</p>
      ) : (
        <div className="space-y-2">
          {direcciones.map((dir) => (
            <div
              key={dir.id}
              className="flex items-center justify-between gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm"
            >
              <div className="flex-1">
                <span className="font-medium">{dir.direccion}</span>
                {dir.motivo && (
                  <span className="ml-2 text-muted-foreground">({dir.motivo})</span>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={() => setDeleteDialog({ open: true, direccion: dir })}
                disabled={eliminarMutation.isPending}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Formulario para agregar */}
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1">
          <label className="text-xs text-muted-foreground">Dirección</label>
          <Input
            placeholder="Ej: Calle Principal #123"
            value={nuevaDireccion}
            onChange={(e) => setNuevaDireccion(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <div className="w-32 space-y-1">
          <label className="text-xs text-muted-foreground">Motivo (opcional)</label>
          <Input
            placeholder="Ej: Perro"
            value={nuevoMotivo}
            onChange={(e) => setNuevoMotivo(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <Button
          size="sm"
          onClick={handleAgregar}
          disabled={!nuevaDireccion.trim() || agregarMutation.isPending}
          className="h-8"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <ConfirmDeleteDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, direccion: open ? deleteDialog.direccion : null })}
        onConfirm={() => {
          if (deleteDialog.direccion) {
            eliminarMutation.mutate(deleteDialog.direccion.id);
            setDeleteDialog({ open: false, direccion: null });
          }
        }}
        title="¿Eliminar dirección bloqueada?"
        itemName={deleteDialog.direccion?.direccion}
      />
    </div>
  );
}
