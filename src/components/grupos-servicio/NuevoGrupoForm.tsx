import { useState } from "react";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { GrupoConMiembros } from "@/types/grupos-servicio";

interface NuevoGrupoFormProps {
  onCrear: (data: { nombre: string; descripcion?: string }) => void;
  isLoading?: boolean;
  grupoEditar?: GrupoConMiembros | null;
  onActualizar?: (data: { id: string; nombre: string; descripcion?: string }) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function NuevoGrupoForm({
  onCrear,
  isLoading,
  grupoEditar,
  onActualizar,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: NuevoGrupoFormProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [nombre, setNombre] = useState(grupoEditar?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(grupoEditar?.descripcion ?? "");

  const open = controlledOpen ?? internalOpen;
  const onOpenChange = controlledOnOpenChange ?? setInternalOpen;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return;

    if (grupoEditar && onActualizar) {
      onActualizar({
        id: grupoEditar.id,
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || undefined,
      });
    } else {
      onCrear({
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || undefined,
      });
    }

    setNombre("");
    setDescripcion("");
    onOpenChange(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && grupoEditar) {
      setNombre(grupoEditar.nombre);
      setDescripcion(grupoEditar.descripcion ?? "");
    } else if (!newOpen) {
      setNombre("");
      setDescripcion("");
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {!grupoEditar && (
        <DialogTrigger asChild>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Nuevo Grupo
          </Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">
            {grupoEditar ? "Editar Grupo" : "Crear Nuevo Grupo"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre del grupo *</Label>
            <Input
              id="nombre"
              placeholder="Ej: Grupo 1"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="descripcion">Descripción (opcional)</Label>
            <Textarea
              id="descripcion"
              placeholder="Descripción del grupo..."
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading || !nombre.trim()}>
              {grupoEditar ? "Guardar cambios" : "Crear grupo"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}