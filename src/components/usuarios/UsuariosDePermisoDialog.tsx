import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePerfilesPermisos } from "@/hooks/usePerfilesPermisos";
import type { AccionPermiso, ModuloDef } from "@/lib/permisos";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Invisible para el resto, igual que en la página de Usuarios.
const SUPER_ADMIN_EMAILS = new Set(["miguelmevo@gmail.com"]);

const ETIQUETA: Record<AccionPermiso, string> = { ver: "Ver", crear: "Crear", editar: "Editar", eliminar: "Eliminar" };
const ACCIONES: AccionPermiso[] = ["ver", "crear", "editar", "eliminar"];

interface FilaUsuario {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  acciones: AccionPermiso[];
  origen: string;
}

interface Props {
  modulo: ModuloDef | null;
  congregacionId: string | null;
  onClose: () => void;
}

/**
 * Quién tiene un permiso (módulo) y con qué acciones. Sale de los permisos
 * guardados por usuario; un administrador sin permisos guardados los tiene
 * todos por su rol. El origen indica si le llegan por un perfil o si es un
 * permiso individual.
 */
export function UsuariosDePermisoDialog({ modulo, congregacionId, onClose }: Props) {
  const { perfilesSistema, perfiles } = usePerfilesPermisos(congregacionId);
  const todosLosPerfiles = useMemo(() => [...perfilesSistema, ...perfiles], [perfilesSistema, perfiles]);

  const { data, isLoading } = useQuery({
    queryKey: ["usuarios-de-permiso", congregacionId, modulo?.id, todosLosPerfiles.length],
    enabled: !!modulo && !!congregacionId,
    queryFn: async (): Promise<FilaUsuario[]> => {
      const { data: miembros, error } = await supabase
        .from("usuarios_congregacion")
        .select("user_id, rol")
        .eq("congregacion_id", congregacionId!)
        .eq("activo", true);
      if (error) throw error;
      const ids = (miembros ?? []).map((m) => m.user_id);
      if (ids.length === 0) return [];

      const [{ data: usuarios }, { data: filas }, { data: asignados }] = await Promise.all([
        supabase.from("profiles").select("id, nombre, apellido, email, aprobado").in("id", ids),
        supabase
          .from("permisos_usuario_congregacion" as any)
          .select("user_id, modulo, puede_ver, puede_crear, puede_editar, puede_eliminar")
          .eq("congregacion_id", congregacionId!),
        supabase
          .from("usuario_perfiles_asignados" as any)
          .select("user_id, perfil_id")
          .eq("congregacion_id", congregacionId!),
      ]);

      type Fila = { user_id: string; modulo: string; puede_ver: boolean; puede_crear: boolean; puede_editar: boolean; puede_eliminar: boolean };
      const todasLasFilas = (filas ?? []) as unknown as Fila[];
      const conPermisosGuardados = new Set(todasLasFilas.map((f) => f.user_id));
      const rolPorUsuario = new Map((miembros ?? []).map((m) => [m.user_id, m.rol as string]));
      const perfilesPorUsuario = new Map<string, string[]>();
      for (const a of (asignados ?? []) as unknown as { user_id: string; perfil_id: string }[]) {
        perfilesPorUsuario.set(a.user_id, [...(perfilesPorUsuario.get(a.user_id) ?? []), a.perfil_id]);
      }

      const resultado: FilaUsuario[] = [];
      for (const u of usuarios ?? []) {
        if (!u.aprobado || SUPER_ADMIN_EMAILS.has((u.email ?? "").toLowerCase())) continue;

        let acciones: AccionPermiso[] = [];
        let origen = "Permiso individual";

        if (conPermisosGuardados.has(u.id)) {
          const f = todasLasFilas.find((x) => x.user_id === u.id && x.modulo === modulo!.id);
          if (!f) continue;
          if (f.puede_ver) acciones.push("ver");
          if (f.puede_crear) acciones.push("crear");
          if (f.puede_editar) acciones.push("editar");
          if (f.puede_eliminar) acciones.push("eliminar");
          const porPerfil = (perfilesPorUsuario.get(u.id) ?? [])
            .map((pid) => todosLosPerfiles.find((p) => p.id === pid))
            .filter((p) => p && Object.values((p.permisos as any)?.[modulo!.id] ?? {}).some(Boolean))
            .map((p) => p!.nombre);
          if (porPerfil.length > 0) origen = `Perfil: ${porPerfil.join(", ")}`;
        } else if (rolPorUsuario.get(u.id) === "admin") {
          acciones = [...ACCIONES];
          origen = "Rol Administrador";
        }

        if (acciones.length === 0) continue;
        resultado.push({ id: u.id, nombre: u.nombre ?? "", apellido: u.apellido ?? "", email: u.email ?? "", acciones, origen });
      }
      return resultado.sort((a, b) => `${a.apellido} ${a.nombre}`.localeCompare(`${b.apellido} ${b.nombre}`));
    },
  });

  const filas = data ?? [];

  return (
    <Dialog open={!!modulo} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            Quién tiene «{modulo?.label}»{!isLoading && ` (${filas.length})`}
          </DialogTitle>
          <DialogDescription>
            Usuarios con este permiso, las acciones que tienen y cómo les llega. Para cambiarlo, edita su perfil o sus permisos.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="max-h-[50vh] overflow-y-auto rounded-md border divide-y">
            {filas.length > 0 ? (
              filas.map((u) => (
                <div key={u.id} className="px-3 py-2 space-y-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium truncate">{u.apellido}, {u.nombre}</p>
                    <div className="flex flex-wrap justify-end gap-1 shrink-0">
                      {u.acciones.map((a) => (
                        <Badge key={a} variant="secondary" className="text-[10px] font-normal">{ETIQUETA[a]}</Badge>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{u.email} · {u.origen}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">Nadie tiene este permiso.</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
