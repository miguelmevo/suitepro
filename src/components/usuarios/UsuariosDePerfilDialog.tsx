import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, UserMinus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { usePerfilesPermisos, type PerfilPermiso } from "@/hooks/usePerfilesPermisos";
import { aplicarPerfilesAUsuario, perfilesActualesDeUsuario } from "@/lib/aplicarPerfiles";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Invisible para el resto, igual que en la página de Usuarios.
const SUPER_ADMIN_EMAILS = new Set(["miguelmevo@gmail.com"]);

interface UsuarioFila {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  rol: string;
  perfilesActuales: Set<string>;
}

interface Props {
  perfil: PerfilPermiso | null;
  congregacionId: string | null;
  onClose: () => void;
}

/**
 * Quién tiene un perfil: lista a los usuarios que lo tienen, permite quitarlo
 * (se recalculan sus permisos con los perfiles que le quedan) y agregarlo a
 * otro usuario aprobado de la congregación.
 */
export function UsuariosDePerfilDialog({ perfil, congregacionId, onClose }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user: usuarioActual } = useAuthContext();
  const { perfilesSistema, perfiles } = usePerfilesPermisos(congregacionId);
  const todosLosPerfiles = useMemo(() => [...perfilesSistema, ...perfiles], [perfilesSistema, perfiles]);

  const [seleccionado, setSeleccionado] = useState("");
  const [aQuitar, setAQuitar] = useState<UsuarioFila | null>(null);

  const { data: usuarios = [], isLoading } = useQuery({
    queryKey: ["usuarios-de-perfil", congregacionId, todosLosPerfiles.length],
    enabled: !!perfil && !!congregacionId && todosLosPerfiles.length > 0,
    queryFn: async (): Promise<UsuarioFila[]> => {
      const { data: miembros, error } = await supabase
        .from("usuarios_congregacion")
        .select("user_id, rol")
        .eq("congregacion_id", congregacionId!)
        .eq("activo", true);
      if (error) throw error;
      const ids = (miembros ?? []).map((m) => m.user_id);
      if (ids.length === 0) return [];

      const [{ data: perfilesUsuarios }, { data: asignados }] = await Promise.all([
        supabase.from("profiles").select("id, nombre, apellido, email, aprobado").in("id", ids),
        supabase
          .from("usuario_perfiles_asignados" as any)
          .select("user_id, perfil_id")
          .eq("congregacion_id", congregacionId!),
      ]);

      const asignadosPorUsuario = new Map<string, string[]>();
      for (const a of (asignados ?? []) as unknown as { user_id: string; perfil_id: string }[]) {
        asignadosPorUsuario.set(a.user_id, [...(asignadosPorUsuario.get(a.user_id) ?? []), a.perfil_id]);
      }
      const rolPorUsuario = new Map((miembros ?? []).map((m) => [m.user_id, m.rol as string]));

      return (perfilesUsuarios ?? [])
        .filter((p) => p.aprobado && !SUPER_ADMIN_EMAILS.has((p.email ?? "").toLowerCase()))
        .map((p) => ({
          id: p.id,
          nombre: p.nombre ?? "",
          apellido: p.apellido ?? "",
          email: p.email ?? "",
          rol: rolPorUsuario.get(p.id) ?? "user",
          perfilesActuales: perfilesActualesDeUsuario(asignadosPorUsuario.get(p.id) ?? [], rolPorUsuario.get(p.id), todosLosPerfiles),
        }))
        .sort((a, b) => `${a.apellido} ${a.nombre}`.localeCompare(`${b.apellido} ${b.nombre}`));
    },
  });

  const conPerfil = useMemo(() => usuarios.filter((u) => perfil && u.perfilesActuales.has(perfil.id)), [usuarios, perfil]);
  const sinPerfil = useMemo(() => usuarios.filter((u) => perfil && !u.perfilesActuales.has(perfil.id)), [usuarios, perfil]);

  const cambiar = useMutation({
    mutationFn: async ({ usuario, agregar }: { usuario: UsuarioFila; agregar: boolean }) => {
      if (!perfil || !congregacionId) throw new Error("Datos incompletos");
      const siguiente = new Set(usuario.perfilesActuales);
      if (agregar) siguiente.add(perfil.id);
      else siguiente.delete(perfil.id);
      await aplicarPerfilesAUsuario({
        userId: usuario.id,
        congregacionId,
        perfilIds: Array.from(siguiente),
        perfilesDisponibles: todosLosPerfiles,
      });
    },
    onSuccess: (_d, { usuario, agregar }) => {
      toast({ title: agregar ? "Perfil asignado" : "Perfil quitado", description: `${usuario.apellido}, ${usuario.nombre}` });
      queryClient.invalidateQueries({ queryKey: ["usuarios-de-perfil"] });
      queryClient.invalidateQueries({ queryKey: ["perfiles-asignados"] });
      queryClient.invalidateQueries({ queryKey: ["perfiles-asignados-congregacion"] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["permisos-usuario"] });
      queryClient.invalidateQueries({ queryKey: ["mis-permisos"] });
      queryClient.invalidateQueries({ queryKey: ["rol-usuario-congregacion"] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const esAdministrador = perfil?.es_sistema && perfil.app_role === "admin";

  const intentarQuitar = (u: UsuarioFila) => {
    if (esAdministrador) {
      if (u.id === usuarioActual?.id) {
        toast({ title: "No puedes quitarte el rol de administrador a ti mismo", variant: "destructive" });
        return;
      }
      if (conPerfil.length <= 1) {
        toast({ title: "Debe quedar al menos un administrador", variant: "destructive" });
        return;
      }
    }
    setAQuitar(u);
  };

  return (
    <>
      <Dialog open={!!perfil} onOpenChange={(v) => !v && !cambiar.isPending && onClose()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Usuarios con el perfil «{perfil?.nombre}»</DialogTitle>
            <DialogDescription>
              Quita el perfil a quien ya no lo necesita o agrégalo a otro usuario. Sus permisos se recalculan con los perfiles que le queden.
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="max-h-[40vh] overflow-y-auto rounded-md border divide-y">
                {conPerfil.length > 0 ? (
                  conPerfil.map((u) => (
                    <div key={u.id} className="flex items-center justify-between gap-3 px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{u.apellido}, {u.nombre}</p>
                        <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-destructive hover:text-destructive shrink-0"
                        disabled={cambiar.isPending}
                        onClick={() => intentarQuitar(u)}
                      >
                        <UserMinus className="h-4 w-4" />
                        Quitar
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-6">Nadie tiene este perfil todavía.</p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Select value={seleccionado} onValueChange={setSeleccionado}>
                  <SelectTrigger className="flex-1 min-w-0">
                    <SelectValue placeholder="Agregar a un usuario..." />
                  </SelectTrigger>
                  <SelectContent>
                    {sinPerfil.length > 0 ? (
                      sinPerfil.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.apellido}, {u.nombre}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="_none" disabled>
                        Todos los usuarios ya lo tienen
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <Button
                  className="gap-1.5 shrink-0"
                  disabled={!seleccionado || cambiar.isPending}
                  onClick={async () => {
                    const usuario = sinPerfil.find((u) => u.id === seleccionado);
                    if (!usuario) return;
                    try {
                      await cambiar.mutateAsync({ usuario, agregar: true });
                      setSeleccionado("");
                    } catch {
                      // el toast de error ya se mostró
                    }
                  }}
                >
                  {cambiar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Agregar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!aQuitar} onOpenChange={(v) => !v && setAQuitar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Quitar el perfil «{perfil?.nombre}»?</AlertDialogTitle>
            <AlertDialogDescription>
              {aQuitar?.apellido}, {aQuitar?.nombre} dejará de tener los permisos de este perfil. Conservará los de sus otros perfiles.
              Si tenía permisos ajustados a mano fuera de sus perfiles, se pierden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (aQuitar) cambiar.mutate({ usuario: aQuitar, agregar: false });
                setAQuitar(null);
              }}
            >
              Quitar perfil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
