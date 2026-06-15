import { useState } from "react";
import { Plus, Pencil, Trash2, Loader2, ShieldAlert } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCongregacionId } from "@/contexts/CongregacionContext";
import { useTableSort } from "@/hooks/useTableSort";
import { usePermisos } from "@/hooks/usePermisos";

interface TipoSalida {
  id: string;
  nombre: string;
  forma: string;
  color: string;
  icono: string | null;
  orden: number;
  activo: boolean;
}

const FORMAS = [
  { value: "grupo", label: "Grupo" },
  { value: "individual", label: "Individual" },
  { value: "pareja", label: "Pareja" },
];

const formaLabel = (v: string) => FORMAS.find((f) => f.value === v)?.label ?? v;

export default function TiposSalida() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const congregacionId = useCongregacionId();
  const { canCreate, canEdit, canDelete } = usePermisos();
  const puedeCrear = canCreate("predicacion_puntos");
  const puedeEditar = canEdit("predicacion_puntos");
  const puedeEliminar = canDelete("predicacion_puntos");
  const isReadOnly = !puedeCrear && !puedeEditar && !puedeEliminar;

  const { data: tipos = [], isLoading } = useQuery({
    queryKey: ["tipos-salida", congregacionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tipos_salida" as any)
        .select("*")
        .eq("congregacion_id", congregacionId)
        .order("orden")
        .order("nombre");
      if (error) throw error;
      return (data ?? []) as unknown as TipoSalida[];
    },
    enabled: !!congregacionId,
  });

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    nombre: "",
    forma: "grupo",
    color: "#3b82f6",
    icono: "",
    orden: "0",
  });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; tipo: TipoSalida | null }>({
    open: false,
    tipo: null,
  });

  const { sortedData, sortConfig, requestSort } = useTableSort(tipos, { key: "orden", direction: "asc" });

  const resetForm = () => {
    setFormData({ nombre: "", forma: "grupo", color: "#3b82f6", icono: "", orden: "0" });
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        nombre: formData.nombre.trim(),
        forma: formData.forma,
        color: formData.color,
        icono: formData.icono.trim() || null,
        orden: parseInt(formData.orden, 10) || 0,
      };
      if (editingId) {
        const { error } = await supabase
          .from("tipos_salida" as any)
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;
        toast({ title: "Tipo de salida actualizado" });
      } else {
        const { error } = await supabase
          .from("tipos_salida" as any)
          .insert({ ...payload, congregacion_id: congregacionId });
        if (error) throw error;
        toast({ title: "Tipo de salida creado" });
      }
      queryClient.invalidateQueries({ queryKey: ["tipos-salida"] });
      setOpen(false);
      resetForm();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleEdit = (tipo: TipoSalida) => {
    setFormData({
      nombre: tipo.nombre,
      forma: tipo.forma,
      color: tipo.color,
      icono: tipo.icono ?? "",
      orden: String(tipo.orden ?? 0),
    });
    setEditingId(tipo.id);
    setOpen(true);
  };

  const handleToggleActivo = async (tipo: TipoSalida) => {
    try {
      const { error } = await supabase
        .from("tipos_salida" as any)
        .update({ activo: !tipo.activo })
        .eq("id", tipo.id);
      if (error) throw error;
      toast({ title: tipo.activo ? "Tipo desactivado" : "Tipo activado" });
      queryClient.invalidateQueries({ queryKey: ["tipos-salida"] });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog.tipo) return;
    try {
      const { error } = await supabase
        .from("tipos_salida" as any)
        .delete()
        .eq("id", deleteDialog.tipo.id);
      if (error) throw error;
      toast({ title: "Tipo de salida eliminado" });
      queryClient.invalidateQueries({ queryKey: ["tipos-salida"] });
      setDeleteDialog({ open: false, tipo: null });
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
          <h1 className="font-display text-2xl font-bold">Tipos de Salida</h1>
          <p className="text-muted-foreground">
            Clasifica las salidas de predicación (carrito, casa en casa, cartas, etc.)
          </p>
        </div>
        {puedeCrear && (
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Agregar
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingId ? "Editar" : "Nuevo"} Tipo de Salida</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nombre">Nombre</Label>
                  <Input
                    id="nombre"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    placeholder="Ej: Carrito, Casa en casa, Cartas"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="forma">Forma</Label>
                    <Select
                      value={formData.forma}
                      onValueChange={(v) => setFormData({ ...formData, forma: v })}
                    >
                      <SelectTrigger id="forma">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FORMAS.map((f) => (
                          <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="orden">Orden</Label>
                    <Input
                      id="orden"
                      type="number"
                      value={formData.orden}
                      onChange={(e) => setFormData({ ...formData, orden: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="color">Color</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="color"
                        type="color"
                        value={formData.color}
                        onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                        className="h-10 w-16 p-1"
                      />
                      <Input
                        value={formData.color}
                        onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                        placeholder="#3b82f6"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="icono">Ícono (opcional)</Label>
                    <Input
                      id="icono"
                      value={formData.icono}
                      onChange={(e) => setFormData({ ...formData, icono: e.target.value })}
                      placeholder="Ej: 🛒 o nombre de ícono"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => { setOpen(false); resetForm(); }}>
                    Cancelar
                  </Button>
                  <Button type="submit">{editingId ? "Actualizar" : "Crear"}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isReadOnly && (
        <Alert variant="destructive" className="bg-destructive/10 border-destructive/30">
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription>
            Tu rol no permite modificar esta sección. Solo puedes visualizar la información.
          </AlertDescription>
        </Alert>
      )}

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead sortKey="orden" currentSort={sortConfig} onSort={requestSort} className="w-[80px]">
                Orden
              </SortableTableHead>
              <SortableTableHead sortKey="nombre" currentSort={sortConfig} onSort={requestSort}>
                Nombre
              </SortableTableHead>
              <SortableTableHead sortKey="forma" currentSort={sortConfig} onSort={requestSort}>
                Forma
              </SortableTableHead>
              <TableHead>Color</TableHead>
              <TableHead>Ícono</TableHead>
              <SortableTableHead sortKey="activo" currentSort={sortConfig} onSort={requestSort} className="w-[80px] text-center">
                Estado
              </SortableTableHead>
              <TableHead className="w-[100px]">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No hay tipos de salida. Crea el primero para clasificar tus salidas.
                </TableCell>
              </TableRow>
            ) : (
              sortedData.map((tipo) => (
                <TableRow key={tipo.id} className={!tipo.activo ? "opacity-50" : ""}>
                  <TableCell className="text-center">{tipo.orden}</TableCell>
                  <TableCell className="font-medium">{tipo.nombre}</TableCell>
                  <TableCell>{formaLabel(tipo.forma)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-5 w-5 rounded border"
                        style={{ backgroundColor: tipo.color }}
                      />
                      <span className="text-xs text-muted-foreground">{tipo.color}</span>
                    </div>
                  </TableCell>
                  <TableCell>{tipo.icono || "-"}</TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={tipo.activo}
                      disabled={!puedeEditar}
                      onCheckedChange={() => handleToggleActivo(tipo)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {puedeEditar && (
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(tipo)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {puedeEliminar && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteDialog({ open: true, tipo })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
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
        onOpenChange={(open) => setDeleteDialog({ open, tipo: open ? deleteDialog.tipo : null })}
        onConfirm={handleDelete}
        title="¿Eliminar tipo de salida?"
        itemName={deleteDialog.tipo?.nombre}
      />
    </div>
  );
}
