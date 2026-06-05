import { useState, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Pencil, Trash2, Loader2, MapPin, Image, Ban, ArrowLeft, ShieldAlert, History } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { useAuthContext } from "@/contexts/AuthProvider";
import { useCongregacion } from "@/contexts/CongregacionContext";
import { HistorialManzanasModal } from "@/components/territorios/HistorialManzanasModal";
import { usePermisos } from "@/hooks/usePermisos";

const HistorialTerritoriosContent = lazy(() => import("./HistorialTerritorios"));

export default function Territorios() {
  const { roles } = useAuthContext();
  const { congregacionActual } = useCongregacion();
  const isSuperAdmin = roles.includes("super_admin");
  const congregacionId2 = congregacionActual?.id || "";
  const { isAdminOrEditorInCongregacion, getRoleInCongregacion } = useAuthContext();
  const { canCreate, canEdit, canDelete, canView } = usePermisos();
  const puedeCrear = canCreate("predicacion_territorios");
  const puedeEditar = canEdit("predicacion_territorios");
  const puedeEliminar = canDelete("predicacion_territorios");
  const isReadOnly = !puedeEditar && !puedeCrear && !puedeEliminar;
  const canSeeHistorial = canView("predicacion_territorios_historial");
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

  const getGruposBadges = (territorio: Territorio) => {
    const ids = territorio.grupos_predicacion_ids || [];
    if (ids.length === 0) {
      return <Badge variant="secondary" className="text-xs">Todos</Badge>;
    }
    const grupos = ids
      .map((id) => gruposPredicacion?.find((g) => g.id === id))
      .filter((g): g is NonNullable<typeof g> => !!g)
      .sort((a, b) => a.numero - b.numero);
    return (
      <div className="flex flex-wrap gap-1">
        {grupos.map((g) => (
          <Badge key={g.id} variant="outline" className="px-1.5 py-0 text-xs">
            G{g.numero}
          </Badge>
        ))}
      </div>
    );
  };

  const [open, setOpen] = useState(false);
  const [editingTerritorio, setEditingTerritorio] = useState<Territorio | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; territorio: Territorio | null }>({
    open: false,
    territorio: null,
  });
  const [historialDialog, setHistorialDialog] = useState<{ open: boolean; territorio: Territorio | null }>({
    open: false,
    territorio: null,
  });

  const { sortedData: territorios, sortConfig, requestSort } = useTableSort(
    [...rawTerritorios],
    { key: "numero", direction: "asc" },
    {
      grupo: (t) => {
        const ids = t.grupos_predicacion_ids || [];
        if (ids.length === 0) return -1; // "Todos" primero
        const nums = ids
          .map((id) => gruposPredicacion?.find((g) => g.id === id)?.numero)
          .filter((n): n is number => typeof n === "number");
        return nums.length > 0 ? Math.min(...nums) : 999;
      },
      manzanas: (t) => (manzanasByTerritorio[t.id] || []).length,
    }
  );

  const syncGruposPredicacion = async (territorioId: string, newGrupoIds: string[]) => {
    const { data: current, error: fetchErr } = await supabase
      .from("territorios_grupos_predicacion")
      .select("id, grupo_predicacion_id")
      .eq("territorio_id", territorioId)
      .eq("congregacion_id", congregacionId);
    if (fetchErr) throw fetchErr;

    const currentIds = (current || []).map((r) => r.grupo_predicacion_id);
    const toAdd = newGrupoIds.filter((id) => !currentIds.includes(id));
    const toRemoveRows = (current || []).filter((r) => !newGrupoIds.includes(r.grupo_predicacion_id));

    if (toAdd.length > 0) {
      const { error } = await supabase.from("territorios_grupos_predicacion").insert(
        toAdd.map((grupo_predicacion_id) => ({
          territorio_id: territorioId,
          grupo_predicacion_id,
          congregacion_id: congregacionId,
        }))
      );
      if (error) throw error;
    }

    if (toRemoveRows.length > 0) {
      const { error } = await supabase
        .from("territorios_grupos_predicacion")
        .delete()
        .in("id", toRemoveRows.map((r) => r.id));
      if (error) throw error;
    }
  };

  const handleSubmit = async (formData: {
    numero: string;
    nombre: string;
    url_maps: string;
    imagen_url: string;
    grupos_predicacion_ids: string[];
    manzanas: string[];
  }) => {
    try {
      const dataToSave = {
        numero: formData.numero,
        nombre: formData.nombre || null,
        url_maps: formData.url_maps || null,
        imagen_url: formData.imagen_url || null,
        // Mantener compat: guardar el primero (o null) en la columna legacy
        grupo_predicacion_id: formData.grupos_predicacion_ids[0] || null,
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
      // Sync grupos (N-a-N)
      await syncGruposPredicacion(territorioId, formData.grupos_predicacion_ids);

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

  const navigate = useNavigate();
  const isMobile = useIsMobile();

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
          <h1 className="font-display text-xl md:text-2xl font-bold">Territorios</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Gestiona los territorios de predicación
          </p>
        </div>
      </div>

      <Tabs defaultValue="territorios">
        <TabsList>
          <TabsTrigger value="territorios">Territorios</TabsTrigger>
          {canSeeHistorial && <TabsTrigger value="historial">Historial</TabsTrigger>}
        </TabsList>

        <TabsContent value="territorios" className="space-y-4 mt-4">
          {isReadOnly ? (
            <Alert variant="destructive" className="bg-destructive/10 border-destructive/30">
              <ShieldAlert className="h-4 w-4" />
              <AlertDescription>
                Tu rol no permite modificar esta sección. Solo puedes visualizar la información.
              </AlertDescription>
            </Alert>
          ) : (
          <div className="flex justify-end">
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
                          grupos_predicacion_ids: editingTerritorio.grupos_predicacion_ids || [],
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
          )}

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
                            <TableCell>
                              {getGruposBadges(territorio)}
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
                                  isReadOnly ? (
                                    <span className="text-muted-foreground/50 cursor-not-allowed" title="Ver en Google Maps">
                                      <MapPin className="h-4 w-4" />
                                    </span>
                                  ) : (
                                    <a href={territorio.url_maps} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80" title="Ver en Google Maps">
                                      <MapPin className="h-4 w-4" />
                                    </a>
                                  )
                                )}
                                {territorio.imagen_url && (
                                  isReadOnly ? (
                                    <span className="text-muted-foreground/50 cursor-not-allowed" title="Ver imagen">
                                      <Image className="h-4 w-4" />
                                    </span>
                                  ) : (
                                    <a href={territorio.imagen_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80" title="Ver imagen">
                                      <Image className="h-4 w-4" />
                                    </a>
                                  )
                                )}
                                <CollapsibleTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    disabled={isReadOnly}
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
                                  onClick={() => setHistorialDialog({ open: true, territorio })}
                                  title="Historial de manzanas"
                                >
                                  <History className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  disabled={isReadOnly}
                                  onClick={() => handleEdit(territorio)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  disabled={isReadOnly}
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
        </TabsContent>

        {canSeeHistorial && (
          <TabsContent value="historial" className="mt-4">
            <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
              <HistorialTerritoriosContent />
            </Suspense>
          </TabsContent>
        )}
      </Tabs>

      <ConfirmDeleteDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, territorio: open ? deleteDialog.territorio : null })}
        onConfirm={handleDelete}
        title="¿Eliminar territorio?"
        itemName={deleteDialog.territorio ? `Territorio ${deleteDialog.territorio.numero}${deleteDialog.territorio.nombre ? ` - ${deleteDialog.territorio.nombre}` : ''}` : undefined}
      />

      <HistorialManzanasModal
        open={historialDialog.open}
        onOpenChange={(open) => setHistorialDialog({ open, territorio: open ? historialDialog.territorio : null })}
        territorioId={historialDialog.territorio?.id || null}
        territorioLabel={historialDialog.territorio ? `${historialDialog.territorio.numero}${historialDialog.territorio.nombre ? ` - ${historialDialog.territorio.nombre}` : ''}` : ''}
      />
    </div>
  );
}
