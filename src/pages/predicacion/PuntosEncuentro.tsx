import { useState } from "react";
import { Plus, Pencil, Trash2, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useCatalogos } from "@/hooks/useCatalogos";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

export default function PuntosEncuentro() {
  const { puntos, isLoading } = useCatalogos();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    nombre: "",
    direccion: "",
    url_maps: "",
  });

  const resetForm = () => {
    setFormData({ nombre: "", direccion: "", url_maps: "" });
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingId) {
        const { error } = await supabase
          .from("puntos_encuentro")
          .update(formData)
          .eq("id", editingId);
        if (error) throw error;
        toast({ title: "Punto de encuentro actualizado" });
      } else {
        const { error } = await supabase
          .from("puntos_encuentro")
          .insert(formData);
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
    });
    setEditingId(punto.id);
    setOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("puntos_encuentro")
        .update({ activo: false })
        .eq("id", id);
      if (error) throw error;
      toast({ title: "Punto de encuentro eliminado" });
      queryClient.invalidateQueries({ queryKey: ["puntos-encuentro"] });
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
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre</Label>
                <Input
                  id="nombre"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  required
                />
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
              <TableHead>Nombre</TableHead>
              <TableHead>Dirección</TableHead>
              <TableHead>Maps</TableHead>
              <TableHead className="w-[100px]">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {puntos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  No hay puntos de encuentro
                </TableCell>
              </TableRow>
            ) : (
              puntos.map((punto) => (
                <TableRow key={punto.id}>
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
                        onClick={() => handleDelete(punto.id)}
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
    </div>
  );
}