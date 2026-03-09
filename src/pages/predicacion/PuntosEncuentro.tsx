import { useState } from "react";
import { Plus, Pencil, Trash2, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  SortableTableHead,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useCatalogos } from "@/hooks/useCatalogos";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useCongregacionId } from "@/contexts/CongregacionContext";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { useTableSort } from "@/hooks/useTableSort";

interface PuntoEncuentro {
  id: string;
  nombre: string;
  direccion: string | null;
  url_maps: string | null;
  numero_salida: number | null;
  activo: boolean;
}

export default function PuntosEncuentro() {
  const { puntos, isLoading } = useCatalogos();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const congregacionId = useCongregacionId();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    nombre: "",
    direccion: "",
    url_maps: "",
    numero_salida: "",
  });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; punto: PuntoEncuentro | null }>({
    open: false,
    punto: null,
  });

  const { sortedData, sortConfig, requestSort } = useTableSort(
    puntos,
    { key: "numero_salida", direction: "asc" }
  );

  const resetForm = () => {
    setFormData({ nombre: "", direccion: "", url_maps: "", numero_salida: "" });
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const dataToSave = {
        nombre: formData.nombre,
        direccion: formData.direccion || null,
        url_maps: formData.url_maps || null,
        numero_salida: formData.numero_salida ? parseInt(formData.numero_salida, 10) : null,
      };

      if (editingId) {
        const { error } = await supabase
          .from("puntos_encuentro")
          .update(dataToSave)
          .eq("id", editingId);
        if (error) throw error;
        toast({ title: "Punto de encuentro actualizado" });
      } else {
        const { error } = await supabase
          .from("puntos_encuentro")
          .insert({
            ...dataToSave,
            congregacion_id: congregacionId,
          });
        if (error) throw error;
        toast({ title: "Punto de encuentro creado" });
      }
      
      queryClient.invalidateQueries({ queryKey: ["puntos-encuentro"] });
      setOpen(false);
      resetForm();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleEdit = (punto: typeof puntos[0]) => {
    setFormData({
      nombre: punto.nombre,
      direccion: punto.direccion || "",
      url_maps: punto.url_maps || "",
      numero_salida: punto.numero_salida?.toString() || "",
    });
    setEditingId(punto.id);
    setOpen(true);
  };

  const handleToggleActivo = async (punto: typeof puntos[0]) => {
    try {
      const { error } = await supabase
        .from("puntos_encuentro")
        .update({ activo: !punto.activo })
        .eq("id", punto.id);
      if (error) throw error;
      toast({ title: punto.activo ? "Punto desactivado" : "Punto activado" });
      queryClient.invalidateQueries({ queryKey: ["puntos-encuentro"] });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog.punto) return;
    try {
      const { error } = await supabase
        .from("puntos_encuentro")
        .update({ activo: false })
        .eq("id", deleteDialog.punto.id);
      if (error) throw error;
      toast({ title: "Punto de encuentro eliminado" });
      queryClient.invalidateQueries({ queryKey: ["puntos-encuentro"] });
      setDeleteDialog({ open: false, punto: null });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
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
          <h1 className="font-display text-2xl font-bold">Puntos de Encuentro</h1>
          <p className="text-muted-foreground">
            Gestiona los lugares de reunión para predicar
          </p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Agregar
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingId ? "Editar" : "Nuevo"} Punto de Encuentro
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="nombre">Nombre</Label>
                  <Input
                    id="nombre"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="numero_salida">Nro. Salida</Label>
                  <Input
                    id="numero_salida"
                    type="number"
                    min="1"
                    value={formData.numero_salida}
                    onChange={(e) => setFormData({ ...formData, numero_salida: e.target.value })}
                    placeholder="Ej: 13"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="direccion">Dirección</Label>
                <Input
                  id="direccion"
                  value={formData.direccion}
                  onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="url_maps">URL Google Maps</Label>
                <Input
                  id="url_maps"
                  type="url"
                  value={formData.url_maps}
                  onChange={(e) => setFormData({ ...formData, url_maps: e.target.value })}
                  placeholder="https://maps.google.com/..."
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => { setOpen(false); resetForm(); }}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingId ? "Actualizar" : "Crear"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px]">Nro.</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Dirección</TableHead>
              <TableHead>Maps</TableHead>
              <TableHead className="w-[80px] text-center">Estado</TableHead>
              <TableHead className="w-[100px]">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {puntos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No hay puntos de encuentro
                </TableCell>
              </TableRow>
            ) : (
              puntos.map((punto) => (
                <TableRow key={punto.id} className={!punto.activo ? "opacity-50" : ""}>
                  <TableCell className="text-center font-bold">
                    {punto.numero_salida || "-"}
                  </TableCell>
                  <TableCell className="font-medium">{punto.nombre}</TableCell>
                  <TableCell>{punto.direccion || "-"}</TableCell>
                  <TableCell>
                    {punto.url_maps ? (
                      <a
                        href={punto.url_maps}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline inline-flex items-center gap-1"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Ver
                      </a>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={punto.activo}
                      onCheckedChange={() => handleToggleActivo(punto)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(punto)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteDialog({ open: true, punto })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <ConfirmDeleteDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, punto: open ? deleteDialog.punto : null })}
        onConfirm={handleDelete}
        title="¿Eliminar punto de encuentro?"
        itemName={deleteDialog.punto?.nombre}
      />
    </div>
  );
}
