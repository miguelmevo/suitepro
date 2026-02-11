import { useState } from "react";
import { Plus, Pencil, Trash2, Loader2, MapPin, Image, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  SortableTableHead,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTableSort } from "@/hooks/useTableSort";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { useCatalogos } from "@/hooks/useCatalogos";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { TerritorioForm } from "@/components/territorios/TerritorioForm";
import { DireccionesBloqueadasManager } from "@/components/territorios/DireccionesBloqueadasManager";
import { Territorio, ManzanaTerritorio } from "@/types/programa-predicacion";
import { useCongregacionId } from "@/contexts/CongregacionContext";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { useGruposPredicacion } from "@/hooks/useGruposPredicacion";

export default function Territorios() {
  const { territorios: rawTerritorios, isLoading } = useCatalogos();
  const { grupos: gruposPredicacion } = useGruposPredicacion();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const congregacionId = useCongregacionId();

  // Fetch all manzanas for all territories
  const { data: allManzanas = [] } = useQuery({
    queryKey: ["manzanas-all", congregacionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("manzanas_territorio")
        .select("*")
        .eq("congregacion_id", congregacionId)
        .eq("activo", true)
        .order("letra");
      if (error) throw error;
      return data as ManzanaTerritorio[];
    },
    enabled: !!congregacionId,
  });

  // Group manzanas by territorio_id
  const manzanasByTerritorio = allManzanas.reduce((acc, m) => {
    if (!acc[m.territorio_id]) acc[m.territorio_id] = [];
    acc[m.territorio_id].push(m.letra);
    return acc;
  }, {} as Record<string, string[]>);

  const getGrupoNombre = (grupoId: string | null) => {
    if (!grupoId) return "Sin asignar";
    const grupo = gruposPredicacion?.find(g => g.id === grupoId);
    return grupo ? `G${grupo.numero}` : "Sin asignar";
  };

  const [open, setOpen] = useState(false);
  const [editingTerritorio, setEditingTerritorio] = useState<Territorio | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; territorio: Territorio | null }>({
    open: false,
    territorio: null,
  });

  const { sortedData: territorios, sortConfig, requestSort } = useTableSort(
    [...rawTerritorios],
    { key: "numero", direction: "asc" },
    {
      grupo: (t) => {
        const grupo = gruposPredicacion?.find(g => g.id === t.grupo_predicacion_id);
        return grupo ? grupo.numero : 999;
      },
      manzanas: (t) => (manzanasByTerritorio[t.id] || []).length,
    }
  );

  const handleSubmit = async (formData: {
    numero: string;
    nombre: string;
    url_maps: string;
    imagen_url: string;
    grupo_predicacion_id: string;
    manzanas: string[];
  }) => {
    try {
      const dataToSave = {
        numero: formData.numero,
        nombre: formData.nombre || null,
        url_maps: formData.url_maps || null,
        imagen_url: formData.imagen_url || null,
        grupo_predicacion_id: formData.grupo_predicacion_id || null,
      };

      let territorioId: string;

      if (editingTerritorio) {
        const { error } = await supabase
          .from("territorios")
          .update(dataToSave)
          .eq("id", editingTerritorio.id);
        if (error) throw error;
        territorioId = editingTerritorio.id;
      } else {
        const { data, error } = await supabase.from("territorios").insert({
          ...dataToSave,
          congregacion_id: congregacionId,
        }).select("id").single();
        if (error) throw error;
        territorioId = data.id;
      }

      // Sync manzanas
      await syncManzanas(territorioId, formData.manzanas);

      toast({ title: editingTerritorio ? "Territorio actualizado" : "Territorio creado" });
      queryClient.invalidateQueries({ queryKey: ["territorios"] });
      queryClient.invalidateQueries({ queryKey: ["manzanas-all"] });
      setOpen(false);
      setEditingTerritorio(null);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const syncManzanas = async (territorioId: string, newManzanas: string[]) => {
    // Get current manzanas for this territory
    const { data: currentManzanas, error: fetchError } = await supabase
      .from("manzanas_territorio")
      .select("*")
      .eq("territorio_id", territorioId)
      .eq("congregacion_id", congregacionId);
    
    if (fetchError) throw fetchError;

    const currentLetras = currentManzanas?.filter(m => m.activo).map(m => m.letra) || [];
    const allExistingLetras = currentManzanas?.map(m => m.letra) || [];

    // Letters to add
    const letrasToAdd = newManzanas.filter(l => !allExistingLetras.includes(l));
    
    // Letters to activate (exist but inactive)
    const letrasToActivate = newManzanas.filter(l => {
      const existing = currentManzanas?.find(m => m.letra === l);
      return existing && !existing.activo;
    });

    // Letters to deactivate
    const letrasToDeactivate = currentLetras.filter(l => !newManzanas.includes(l));

    // Insert new manzanas
    if (letrasToAdd.length > 0) {
      const { error } = await supabase.from("manzanas_territorio").insert(
        letrasToAdd.map(letra => ({
          territorio_id: territorioId,
          letra,
          congregacion_id: congregacionId,
          activo: true,
        }))
      );
      if (error) throw error;
    }

    // Activate existing manzanas
    if (letrasToActivate.length > 0) {
      const idsToActivate = currentManzanas
        ?.filter(m => letrasToActivate.includes(m.letra))
        .map(m => m.id) || [];
      
      if (idsToActivate.length > 0) {
        const { error } = await supabase
          .from("manzanas_territorio")
          .update({ activo: true })
          .in("id", idsToActivate);
        if (error) throw error;
      }
    }

    // Deactivate removed manzanas
    if (letrasToDeactivate.length > 0) {
      const idsToDeactivate = currentManzanas
        ?.filter(m => letrasToDeactivate.includes(m.letra))
        .map(m => m.id) || [];
      
      if (idsToDeactivate.length > 0) {
        const { error } = await supabase
          .from("manzanas_territorio")
          .update({ activo: false })
          .in("id", idsToDeactivate);
        if (error) throw error;
      }
    }
  };

  const handleEdit = (territorio: Territorio) => {
    setEditingTerritorio(territorio);
    setOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteDialog.territorio) return;
    try {
      const { error } = await supabase
        .from("territorios")
        .update({ activo: false })
        .eq("id", deleteDialog.territorio.id);
      if (error) throw error;
      toast({ title: "Territorio eliminado" });
      queryClient.invalidateQueries({ queryKey: ["territorios"] });
      setDeleteDialog({ open: false, territorio: null });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDialogChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) setEditingTerritorio(null);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Territorios</h1>
          <p className="text-muted-foreground">
            Gestiona los territorios de predicación
          </p>
        </div>
        <Dialog open={open} onOpenChange={handleDialogChange}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Agregar
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingTerritorio ? "Editar" : "Nuevo"} Territorio
              </DialogTitle>
            </DialogHeader>
            <TerritorioForm
              initialData={
                editingTerritorio
                  ? {
                      numero: editingTerritorio.numero,
                      nombre: editingTerritorio.nombre || "",
                      url_maps: editingTerritorio.url_maps || "",
                      imagen_url: editingTerritorio.imagen_url || "",
                      grupo_predicacion_id: editingTerritorio.grupo_predicacion_id || "",
                      manzanas: manzanasByTerritorio[editingTerritorio.id] || [],
                    }
                  : undefined
              }
              onSubmit={handleSubmit}
              onCancel={() => handleDialogChange(false)}
              isEditing={!!editingTerritorio}
              existingNumeros={territorios.map((t) => t.numero)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead sortKey="numero" currentSort={sortConfig} onSort={requestSort} className="w-[80px]">Número</SortableTableHead>
              <SortableTableHead sortKey="nombre" currentSort={sortConfig} onSort={requestSort}>Nombre</SortableTableHead>
              <SortableTableHead sortKey="grupo" currentSort={sortConfig} onSort={requestSort}>Grupo</SortableTableHead>
              <SortableTableHead sortKey="manzanas" currentSort={sortConfig} onSort={requestSort}>Manzanas</SortableTableHead>
              <TableHead className="w-[80px] text-center">Info</TableHead>
              <TableHead className="w-[100px]">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {territorios.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No hay territorios
                </TableCell>
              </TableRow>
            ) : (
              territorios.map((territorio) => {
                const manzanas = manzanasByTerritorio[territorio.id] || [];
                return (
                  <Collapsible key={territorio.id} asChild open={expandedId === territorio.id}>
                    <>
                      <TableRow>
                        <TableCell className="font-bold">{territorio.numero}</TableCell>
                        <TableCell>{territorio.nombre || "-"}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {getGrupoNombre(territorio.grupo_predicacion_id)}
                        </TableCell>
                        <TableCell>
                          {manzanas.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {manzanas.slice(0, 5).map((letra) => (
                                <Badge key={letra} variant="outline" className="px-1.5 py-0 text-xs">
                                  {letra}
                                </Badge>
                              ))}
                              {manzanas.length > 5 && (
                                <Badge variant="secondary" className="px-1.5 py-0 text-xs">
                                  +{manzanas.length - 5}
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            {territorio.url_maps && (
                              <a
                                href={territorio.url_maps}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:text-primary/80"
                                title="Ver en Google Maps"
                              >
                                <MapPin className="h-4 w-4" />
                              </a>
                            )}
                            {territorio.imagen_url && (
                              <a
                                href={territorio.imagen_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:text-primary/80"
                                title="Ver imagen"
                              >
                                <Image className="h-4 w-4" />
                              </a>
                            )}
                            <CollapsibleTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() =>
                                  setExpandedId(expandedId === territorio.id ? null : territorio.id)
                                }
                                title="Ver direcciones bloqueadas"
                              >
                                <Ban className="h-4 w-4" />
                              </Button>
                            </CollapsibleTrigger>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(territorio)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteDialog({ open: true, territorio })}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      <CollapsibleContent asChild>
                        <TableRow className="bg-muted/30">
                          <TableCell colSpan={6} className="py-4">
                            <div className="pl-4">
                              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                                <Ban className="h-4 w-4" />
                                Direcciones No Pasar
                              </h4>
                              <DireccionesBloqueadasManager territorioId={territorio.id} />
                            </div>
                          </TableCell>
                        </TableRow>
                      </CollapsibleContent>
                    </>
                  </Collapsible>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <ConfirmDeleteDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, territorio: open ? deleteDialog.territorio : null })}
        onConfirm={handleDelete}
        title="¿Eliminar territorio?"
        itemName={deleteDialog.territorio ? `Territorio ${deleteDialog.territorio.numero}${deleteDialog.territorio.nombre ? ` - ${deleteDialog.territorio.nombre}` : ''}` : undefined}
      />
    </div>
  );
}
