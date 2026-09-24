import { useState } from "react";
import { ChevronDown, Loader2, Lock, Pencil, Plus, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { UsuariosDePerfilDialog } from "./UsuariosDePerfilDialog";
import { MODULOS, type ModuloDef } from "@/lib/permisos";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { UsuariosDePermisoDialog } from "./UsuariosDePermisoDialog";

const ICONOS_EMOJI: Record<string, string> = {
  users: "👥", book: "📖", map: "🗺️", calendar: "📅", settings: "⚙️",
  edit: "✏️", eye: "👁️", lock: "🔒", star: "⭐", shield: "🛡️",
};

interface Props {
  congregacionId: string;
  isSuperAdmin?: boolean;
}

export function PerfilesTab({ congregacionId, isSuperAdmin = false }: Props) {
  const { toast } = useToast();
  const { perfiles, perfilesSistema, isLoading, eliminar } = usePerfilesPermisos(congregacionId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editandoPerfil, setEditandoPerfil] = useState<PerfilPermiso | null>(null);
  const [verUsuariosDe, setVerUsuariosDe] = useState<PerfilPermiso | null>(null);
  const [verUsuariosDeModulo, setVerUsuariosDeModulo] = useState<ModuloDef | null>(null);
  const [modulosAbierto, setModulosAbierto] = useState(true);

  const modulosPorGrupo = MODULOS.reduce<Record<string, ModuloDef[]>>((acc, m) => {
    (acc[m.grupo] ??= []).push(m);
    return acc;
  }, {});

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

  const renderCard = (perfil: PerfilPermiso, canEdit: boolean) => {
    const emoji = ICONOS_EMOJI[perfil.icono] ?? "👥";
    return (
      <div key={perfil.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          {perfil.color ? (
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
              style={{ background: perfil.color }}>
              {perfil.nombre.slice(0, 1).toUpperCase()}
            </div>
          ) : (
            <span className="text-xl">{emoji}</span>
          )}
          <span className="text-sm font-medium truncate" title={perfil.descripcion ?? undefined}>{perfil.nombre}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => setVerUsuariosDe(perfil)}>
            <Users className="h-3.5 w-3.5" />
            Ver usuarios
          </Button>
          {canEdit ? (
            <>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditar(perfil)} title="Editar perfil">
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              {!perfil.es_sistema && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" title="Eliminar perfil">
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
              )}
            </>
          ) : (
            <span className="h-7 w-7 flex items-center justify-center" title={perfil.app_role === "admin" ? "Acceso total: no se puede modificar" : "Solo super_admin puede editar"}>
              <Lock className="h-3.5 w-3.5 text-muted-foreground/40" />
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
    <div className="grid gap-6 lg:grid-cols-2 items-start">
      <div className="space-y-6">
      {/* Perfiles personalizados */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-base font-semibold">Perfiles personalizados</h3>
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
      ) : perfiles.length === 0 && perfilesSistema.length === 0 ? (
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
        <div className="space-y-2">
          {perfilesSistema.map((p) => renderCard(p, isSuperAdmin && p.app_role !== "admin"))}
          {perfiles.map((p) => renderCard(p, true))}
        </div>
      )}
      </div>
      </div>

      {/* Quién tiene cada permiso (módulo) */}
      <Collapsible open={modulosAbierto} onOpenChange={setModulosAbierto}>
        <Card>
          <CardHeader className="pb-3">
            <CollapsibleTrigger asChild>
              <button type="button" className="flex w-full items-center justify-between gap-3 text-left">
                <div>
                  <CardTitle className="text-base">Permisos por módulo</CardTitle>
                  <CardDescription>Consulta qué usuarios tienen cada permiso (por ejemplo "Historial de territorios") y con qué acciones.</CardDescription>
                </div>
                <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${modulosAbierto ? "rotate-180" : ""}`} />
              </button>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-4 pt-0">
              {Object.entries(modulosPorGrupo).map(([grupo, modulos]) => (
                <div key={grupo}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">{grupo}</p>
                  <div className="divide-y rounded-md border">
                    {modulos.map((m) => (
                      <div key={m.id} className="flex items-center justify-between gap-3 px-3 py-1.5">
                        <span className="text-sm">{m.label}</span>
                        <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => setVerUsuariosDeModulo(m)}>
                          <Users className="h-3.5 w-3.5" />
                          Ver usuarios
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>

      <UsuariosDePermisoDialog
        modulo={verUsuariosDeModulo}
        congregacionId={congregacionId}
        onClose={() => setVerUsuariosDeModulo(null)}
      />

      <UsuariosDePerfilDialog
        perfil={verUsuariosDe}
        congregacionId={congregacionId}
        onClose={() => setVerUsuariosDe(null)}
      />

      <PerfilPermisoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        congregacionId={congregacionId}
        perfil={editandoPerfil}
      />
    </div>
  );
}
