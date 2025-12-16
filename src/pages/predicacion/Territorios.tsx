import { useState } from "react";
import { Plus, Pencil, Trash2, Loader2, MapPin, Image, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { useCatalogos } from "@/hooks/useCatalogos";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { TerritorioForm } from "@/components/territorios/TerritorioForm";
import { ManzanasManager } from "@/components/territorios/ManzanasManager";
import { Territorio } from "@/types/programa-predicacion";

export default function Territorios() {
  const { territorios: rawTerritorios, isLoading } = useCatalogos();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingTerritorio, setEditingTerritorio] = useState<Territorio | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Sort territories numerically
  const territorios = [...rawTerritorios].sort((a, b) => {
    const numA = parseInt(a.numero, 10);
    const numB = parseInt(b.numero, 10);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return a.numero.localeCompare(b.numero);
  });

  const handleSubmit = async (formData: {
    numero: string;
    nombre: string;
    descripcion: string;
    url_maps: string;
    imagen_url: string;
  }) => {
    try {
      const dataToSave = {
        numero: formData.numero,
        nombre: formData.nombre || null,
        descripcion: formData.descripcion || null,
        url_maps: formData.url_maps || null,
        imagen_url: formData.imagen_url || null,
      };

      if (editingTerritorio) {
        const { error } = await supabase
          .from("territorios")
          .update(dataToSave)
          .eq("id", editingTerritorio.id);
        if (error) throw error;
        toast({ title: "Territorio actualizado" });
      } else {
        const { error } = await supabase.from("territorios").insert(dataToSave);
        if (error) throw error;
        toast({ title: "Territorio creado" });
      }

      queryClient.invalidateQueries({ queryKey: ["territorios"] });
      setOpen(false);
      setEditingTerritorio(null);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleEdit = (territorio: Territorio) => {
    setEditingTerritorio(territorio);
    setOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("territorios")
        .update({ activo: false })
        .eq("id", id);
      if (error) throw error;
      toast({ title: "Territorio eliminado" });
      queryClient.invalidateQueries({ queryKey: ["territorios"] });
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
          <DialogContent className="max-w-lg">
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
                      descripcion: editingTerritorio.descripcion || "",
                      url_maps: editingTerritorio.url_maps || "",
                      imagen_url: editingTerritorio.imagen_url || "",
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
              <TableHead className="w-[80px]">Número</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead className="w-[100px] text-center">Info</TableHead>
              <TableHead className="w-[100px]">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {territorios.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No hay territorios
                </TableCell>
              </TableRow>
            ) : (
              territorios.map((territorio) => (
                <Collapsible key={territorio.id} asChild open={expandedId === territorio.id}>
                  <>
                    <TableRow>
                      <TableCell className="font-bold">{territorio.numero}</TableCell>
                      <TableCell>{territorio.nombre || "-"}</TableCell>
                      <TableCell className="text-muted-foreground max-w-[200px] truncate">
                        {territorio.descripcion || "-"}
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
                              title="Ver manzanas"
                            >
                              <LayoutGrid className="h-4 w-4" />
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
                            onClick={() => handleDelete(territorio.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    <CollapsibleContent asChild>
                      <TableRow className="bg-muted/30">
                        <TableCell colSpan={5} className="py-4">
                          <div className="pl-4">
                            <p className="mb-2 text-sm font-medium">Manzanas / Bloques</p>
                            <ManzanasManager territorioId={territorio.id} />
                          </div>
                        </TableCell>
                      </TableRow>
                    </CollapsibleContent>
                  </>
                </Collapsible>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
