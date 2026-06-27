import { useState } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { useToast } from "@/hooks/use-toast";
import { PerfilPermiso, usePerfilesPermisos } from "@/hooks/usePerfilesPermisos";
import { PerfilPermisoDialog } from "./PerfilPermisoDialog";
import { MODULOS } from "@/lib/permisos";

const ICONOS_EMOJI: Record<string, string> = {
  users: "👥", book: "📖", map: "🗺️", calendar: "📅", settings: "⚙️",
  edit: "✏️", eye: "👁️", lock: "🔒", star: "⭐", shield: "🛡️",
};

function resumenPermisos(permisos: PerfilPermiso["permisos"]): { label: string; count: number }[] {
  const grupos = new Map<string, number>();
  for (const m of MODULOS) {
    const p = permisos[m.id];
    if (!p || (!p.ver && !p.crear && !p.editar && !p.eliminar)) continue;
    grupos.set(m.grupo, (grupos.get(m.grupo) ?? 0) + 1);
  }
  return Array.from(grupos.entries()).map(([label, count]) => ({ label, count }));
}

interface Props {
  congregacionId: string;
}

export function PerfilesTab({ congregacionId }: Props) {
  const { toast } = useToast();
  const { perfiles, isLoading, eliminar } = usePerfilesPermisos(congregacionId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editandoPerfil, setEditandoPerfil] = useState<PerfilPermiso | null>(null);

  const handleEditar = (perfil: PerfilPermiso) => {
    setEditandoPerfil(perfil);
    setDialogOpen(true);
  };

  const handleNuevo = () => {
    setEditandoPerfil(null);
    setDialogOpen(true);
  };

  const handleEliminar = async (id: string) => {
    try {
      await eliminar.mutateAsync(id);
      toast({ title: "Perfil eliminado" });
    } catch (e: any) {
      toast({ title: "Error al eliminar", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Perfiles de permisos</h3>
          <p className="text-sm text-muted-foreground">
            Crea grupos de permisos reutilizables para asignar a usuarios fácilmente.
          </p>
        </div>
        <Button onClick={handleNuevo} size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Nuevo perfil
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : perfiles.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-10 gap-3">
            <span className="text-4xl">👥</span>
            <p className="text-sm text-muted-foreground text-center max-w-xs">
              No hay perfiles creados aún. Crea tu primer perfil para asignar permisos a los usuarios más rápido.
            </p>
            <Button onClick={handleNuevo} size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Crear primer perfil
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {perfiles.map((perfil) => {
            const resumen = resumenPermisos(perfil.permisos);
            const emoji = ICONOS_EMOJI[perfil.icono] ?? "👥";
            return (
              <Card key={perfil.id} className="relative group">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{emoji}</span>
                      <div>
                        <CardTitle className="text-sm font-semibold">{perfil.nombre}</CardTitle>
                        {perfil.descripcion && (
                          <CardDescription className="text-xs mt-0.5">{perfil.descripcion}</CardDescription>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleEditar(perfil)}
                        title="Editar perfil"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            title="Eliminar perfil"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar perfil?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Se eliminará el perfil <strong>{perfil.nombre}</strong>. Los usuarios que ya tienen estos
                              permisos asignados no se verán afectados.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => handleEliminar(perfil.id)}
                            >
                              Eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {resumen.length === 0 ? (
                    <span className="text-xs text-muted-foreground">Sin permisos asignados</span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {resumen.map(({ label, count }) => (
                        <Badge key={label} variant="secondary" className="text-xs font-normal">
                          {label} ({count})
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <PerfilPermisoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        congregacionId={congregacionId}
        perfil={editandoPerfil}
      />
    </div>
  );
}
