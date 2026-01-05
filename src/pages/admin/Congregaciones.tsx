import { useState } from "react";
import { Building2, Plus, Pencil, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { useCongregaciones } from "@/hooks/useCongregaciones";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function Congregaciones() {
  const { congregaciones, isLoading, crearCongregacion, actualizarCongregacion, eliminarCongregacion } = useCongregaciones();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [formData, setFormData] = useState({ nombre: "", slug: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nombre.trim()) return;

    if (editando) {
      await actualizarCongregacion.mutateAsync({
        id: editando,
        nombre: formData.nombre,
        slug: formData.slug,
      });
    } else {
      await crearCongregacion.mutateAsync({
        nombre: formData.nombre,
        slug: formData.slug,
      });
    }

    setDialogOpen(false);
    setEditando(null);
    setFormData({ nombre: "", slug: "" });
  };

  const handleEditar = (congregacion: { id: string; nombre: string; slug: string }) => {
    setEditando(congregacion.id);
    setFormData({ nombre: congregacion.nombre, slug: congregacion.slug });
    setDialogOpen(true);
  };

  const handleEliminar = async (id: string) => {
    await eliminarCongregacion.mutateAsync(id);
  };

  const handleNombreChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nombre = e.target.value;
    // Auto-generar slug si no estamos editando
    if (!editando) {
      const slug = nombre.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      setFormData({ nombre, slug });
    } else {
      setFormData({ ...formData, nombre });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Congregaciones</h1>
          <p className="text-muted-foreground">
            Administra las congregaciones registradas en el sistema
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditando(null);
            setFormData({ nombre: "", slug: "" });
          }
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Congregación
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>
                  {editando ? "Editar Congregación" : "Nueva Congregación"}
                </DialogTitle>
                <DialogDescription>
                  {editando 
                    ? "Modifica los datos de la congregación"
                    : "Crea una nueva congregación. Serás asignado como administrador automáticamente."
                  }
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="nombre">Nombre de la Congregación</Label>
                  <Input
                    id="nombre"
                    value={formData.nombre}
                    onChange={handleNombreChange}
                    placeholder="Ej: Villa Real"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Identificador (slug)</Label>
                  <Input
                    id="slug"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    placeholder="Ej: villa-real"
                    pattern="[a-z0-9-]+"
                    title="Solo letras minúsculas, números y guiones"
                  />
                  <p className="text-xs text-muted-foreground">
                    Se usa para URLs y referencias internas. Solo letras minúsculas, números y guiones.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button 
                  type="submit" 
                  disabled={crearCongregacion.isPending || actualizarCongregacion.isPending}
                >
                  {editando ? "Guardar Cambios" : "Crear Congregación"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : congregaciones.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No hay congregaciones</h3>
            <p className="text-muted-foreground text-center mb-4">
              Crea tu primera congregación para comenzar a usar el sistema
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Crear Primera Congregación
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {congregaciones.map((congregacion) => (
            <Card key={congregacion.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">{congregacion.nombre}</CardTitle>
                  </div>
                  <Badge variant={congregacion.activo ? "default" : "secondary"}>
                    {congregacion.activo ? "Activa" : "Inactiva"}
                  </Badge>
                </div>
                <CardDescription>/{congregacion.slug}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Creada: {format(new Date(congregacion.created_at), "d 'de' MMMM, yyyy", { locale: es })}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEditar(congregacion)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Eliminar congregación?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta acción no se puede deshacer. Se eliminará la congregación "{congregacion.nombre}" 
                            y todos sus datos asociados.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleEliminar(congregacion.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Eliminar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
