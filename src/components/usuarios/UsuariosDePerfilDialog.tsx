import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { usePerfilesPermisos, type PerfilPermiso } from "@/hooks/usePerfilesPermisos";
import { aplicarPerfilesAUsuario, perfilesActualesDeUsuario } from "@/lib/aplicarPerfiles";
import { UsuariosDialogBase, type FilaUsuarioDialogo } from "./UsuariosDialogBase";

// Invisible para el resto, igual que en la página de Usuarios.
const SUPER_ADMIN_EMAILS = new Set(["miguelmevo@gmail.com"]);

interface UsuarioFila {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
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
          perfilesActuales: perfilesActualesDeUsuario(asignadosPorUsuario.get(p.id) ?? [], rolPorUsuario.get(p.id), todosLosPerfiles),
        }))
        .sort((a, b) => `${a.apellido} ${a.nombre}`.localeCompare(`${b.apellido} ${b.nombre}`));
    },
  });

  const conPerfil = useMemo(() => usuarios.filter((u) => perfil && u.perfilesActuales.has(perfil.id)), [usuarios, perfil]);
  const sinPerfil = useMemo(() => usuarios.filter((u) => perfil && !u.perfilesActuales.has(perfil.id)), [usuarios, perfil]);

  const esAdministrador = !!perfil?.es_sistema && perfil.app_role === "admin";

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
      for (const key of [
        "usuarios-de-perfil", "usuarios-de-permiso", "perfiles-asignados", "perfiles-asignados-congregacion",
        "admin-users", "permisos-usuario", "mis-permisos", "rol-usuario-congregacion",
      ]) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const filas: FilaUsuarioDialogo[] = conPerfil.map((u) => {
    let motivoNoQuitar: string | undefined;
    if (esAdministrador && u.id === usuarioActual?.id) motivoNoQuitar = "No puedes quitarte el rol de administrador a ti mismo";
    else if (esAdministrador && conPerfil.length <= 1) motivoNoQuitar = "Debe quedar al menos un administrador";
    const otros = todosLosPerfiles.filter((p) => p.id !== perfil?.id && u.perfilesActuales.has(p.id)).map((p) => p.nombre);
    return {
      id: u.id,
      titulo: `${u.apellido}, ${u.nombre}`,
      subtitulo: `${u.email} · Perfil: ${perfil?.nombre}`,
      badges: otros,
      motivoNoQuitar,
    };
  });

  return (
    <UsuariosDialogBase
      abierto={!!perfil}
      titulo={`Quién tiene «${perfil?.nombre}»${isLoading ? "" : ` (${conPerfil.length})`}`}
      descripcion="Usuarios con este perfil (a la derecha, sus otros perfiles). Sus permisos se recalculan con los perfiles que les queden."
      cargando={isLoading}
      ocupado={cambiar.isPending}
      filas={filas}
      textoVacio="Nadie tiene este perfil todavía."
      opcionesAgregar={sinPerfil.map((u) => ({ id: u.id, label: `${u.apellido}, ${u.nombre}` }))}
      confirmarQuitarTitulo={`¿Quitar el perfil «${perfil?.nombre}»?`}
      confirmarQuitarTexto={(f) =>
        `${f.titulo} dejará de tener los permisos de este perfil y conservará los de sus otros perfiles. Si tenía permisos ajustados a mano fuera de sus perfiles, se pierden.`
      }
      onQuitar={(id) => {
        const usuario = conPerfil.find((u) => u.id === id);
        if (usuario) cambiar.mutate({ usuario, agregar: false });
      }}
      onAgregar={async (id) => {
        const usuario = sinPerfil.find((u) => u.id === id);
        if (usuario) await cambiar.mutateAsync({ usuario, agregar: true });
      }}
      onClose={onClose}
    />
  );
}
