import { useState } from "react";
import { Plus, Pencil, Trash2, ExternalLink, Loader2, ShoppingCart } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCongregacionId } from "@/contexts/CongregacionContext";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { useTableSort } from "@/hooks/useTableSort";

interface Carrito {
  id: string;
  numero: number;
  ubicacion: string;
  direccion: string | null;
  url_maps: string | null;
  activo: boolean;
}

export default function Carritos() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const congregacionId = useCongregacionId();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    numero: "",
    ubicacion: "",
    direccion: "",
    url_maps: "",
  });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; carrito: Carrito | null }>({
    open: false,
    carrito: null,
  });

  const { data: carritos = [], isLoading } = useQuery({
    queryKey: ["carritos", congregacionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("carritos")
        .select("*")
        .eq("congregacion_id", congregacionId)
        .order("numero");
      if (error) throw error;
      return data as Carrito[];
    },
    enabled: !!congregacionId,
  });

  const { sortedData, sortConfig, requestSort } = useTableSort(
    carritos,
    { key: "numero", direction: "asc" }
  );

  const resetForm = () => {
    setFormData({ numero: "", ubicacion: "", direccion: "", url_maps: "" });
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const dataToSave = {
        numero: parseInt(formData.numero, 10),
        ubicacion: formData.ubicacion,
        direccion: formData.direccion || null,
        url_maps: formData.url_maps || null,
      };

      if (editingId) {
        const { error } = await supabase
          .from("carritos")
          .update(dataToSave)
          .eq("id", editingId);
        if (error) throw error;
        toast({ title: "Carrito actualizado" });
      } else {
        const { error } = await supabase
          .from("carritos")
          .insert({
            ...dataToSave,
            congregacion_id: congregacionId,
          });
        if (error) throw error;
        toast({ title: "Carrito creado" });
      }

      queryClient.invalidateQueries({ queryKey: ["carritos"] });
      setOpen(false);
      resetForm();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleEdit = (carrito: Carrito) => {
    setFormData({
      numero: carrito.numero.toString(),
      ubicacion: carrito.ubicacion,
      direccion: carrito.direccion || "",
      url_maps: carrito.url_maps || "",
    });
    setEditingId(carrito.id);
    setOpen(true);
  };

  const handleToggleActivo = async (carrito: Carrito) => {
    try {
      const { error } = await supabase
        .from("carritos")
        .update({ activo: !carrito.activo })
        .eq("id", carrito.id);
      if (error) throw error;
      toast({ title: carrito.activo ? "Carrito desactivado" : "Carrito activado" });
      queryClient.invalidateQueries({ queryKey: ["carritos"] });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog.carrito) return;
    try {
      const { error } = await supabase
        .from("carritos")
        .delete()
        .eq("id", deleteDialog.carrito.id);
      if (error) throw error;
      toast({ title: "Carrito eliminado" });
      queryClient.invalidateQueries({ queryKey: ["carritos"] });
      setDeleteDialog({ open: false, carrito: null });
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
          <h1 className="font-display text-2xl font-bold">Carritos</h1>
          <p className="text-muted-foreground">
            Gestiona las ubicaciones de carritos de predicación
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
                {editingId ? "Editar" : "Nuevo"} Carrito
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="numero">Nro.</Label>
                  <Input
                    id="numero"
                    type="number"
                    min="1"
                    value={formData.numero}
                    onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                    required
                    placeholder="Ej: 1"
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="ubicacion">Ubicación</Label>
                  <Input
                    id="ubicacion"
                    value={formData.ubicacion}
                    onChange={(e) => setFormData({ ...formData, ubicacion: e.target.value })}
                    required
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
              <SortableTableHead
                sortKey="numero"
                currentSort={sortConfig}
                onSort={requestSort}
                className="w-[60px]"
              >
                Nro.
              </SortableTableHead>
              <SortableTableHead
                sortKey="ubicacion"
                currentSort={sortConfig}
                onSort={requestSort}
              >
                Ubicación
              </SortableTableHead>
              <TableHead>Dirección</TableHead>
              <TableHead>Maps</TableHead>
              <SortableTableHead
                sortKey="activo"
                currentSort={sortConfig}
                onSort={requestSort}
                className="w-[80px] text-center"
              >
                Estado
              </SortableTableHead>
              <TableHead className="w-[100px]">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No hay carritos registrados
                </TableCell>
              </TableRow>
            ) : (
              sortedData.map((carrito) => (
                <TableRow key={carrito.id} className={!carrito.activo ? "opacity-50" : ""}>
                  <TableCell className="text-center font-bold">
                    {carrito.numero}
                  </TableCell>
                  <TableCell className="font-medium">{carrito.ubicacion}</TableCell>
                  <TableCell>{carrito.direccion || "-"}</TableCell>
                  <TableCell>
                    {carrito.url_maps ? (
                      <a
                        href={carrito.url_maps}
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
                      checked={carrito.activo}
                      onCheckedChange={() => handleToggleActivo(carrito)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(carrito)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteDialog({ open: true, carrito })}
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
        onOpenChange={(open) => setDeleteDialog({ open, carrito: open ? deleteDialog.carrito : null })}
        onConfirm={handleDelete}
        title="¿Eliminar carrito?"
        itemName={deleteDialog.carrito?.ubicacion}
      />
    </div>
  );
}
