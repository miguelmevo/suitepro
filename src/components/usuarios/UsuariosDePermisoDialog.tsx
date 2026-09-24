import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { usePerfilesPermisos } from "@/hooks/usePerfilesPermisos";
import { guardarPermisoDeModulo } from "@/lib/aplicarPerfiles";
import type { AccionPermiso, ModuloDef } from "@/lib/permisos";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { UsuariosDialogBase, type FilaUsuarioDialogo } from "./UsuariosDialogBase";

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
  porRolAdmin: boolean;
}

interface Candidato {
  id: string;
  nombre: string;
  apellido: string;
}

interface Props {
  modulo: ModuloDef | null;
  congregacionId: string | null;
  onClose: () => void;
}

/**
 * Quién tiene un permiso (módulo) y con qué acciones. Sale de los permisos
 * guardados por usuario; un administrador sin permisos guardados los tiene
 * todos por su rol. Permite quitarlo o dárselo a otro usuario eligiendo las
 * acciones (es un ajuste individual: no cambia sus perfiles).
 */
export function UsuariosDePermisoDialog({ modulo, congregacionId, onClose }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user: usuarioActual } = useAuthContext();
  const { perfilesSistema, perfiles } = usePerfilesPermisos(congregacionId);
  const todosLosPerfiles = useMemo(() => [...perfilesSistema, ...perfiles], [perfilesSistema, perfiles]);
  const [accionesNuevas, setAccionesNuevas] = useState<AccionPermiso[]>(["ver"]);

  const { data, isLoading } = useQuery({
    queryKey: ["usuarios-de-permiso", congregacionId, modulo?.id, todosLosPerfiles.length],
    enabled: !!modulo && !!congregacionId,
    queryFn: async (): Promise<{ filas: FilaUsuario[]; candidatos: Candidato[] }> => {
      const { data: miembros, error } = await supabase
        .from("usuarios_congregacion")
        .select("user_id, rol")
        .eq("congregacion_id", congregacionId!)
        .eq("activo", true);
      if (error) throw error;
      const ids = (miembros ?? []).map((m) => m.user_id);
      if (ids.length === 0) return { filas: [], candidatos: [] };

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
      const candidatos: Candidato[] = [];
      for (const u of usuarios ?? []) {
        if (!u.aprobado || SUPER_ADMIN_EMAILS.has((u.email ?? "").toLowerCase())) continue;

        let acciones: AccionPermiso[] = [];
        let origen = "Permiso individual";
        let porRolAdmin = false;

        if (conPermisosGuardados.has(u.id)) {
          const f = todasLasFilas.find((x) => x.user_id === u.id && x.modulo === modulo!.id);
          if (f) {
            if (f.puede_ver) acciones.push("ver");
            if (f.puede_crear) acciones.push("crear");
            if (f.puede_editar) acciones.push("editar");
            if (f.puede_eliminar) acciones.push("eliminar");
            const porPerfil = (perfilesPorUsuario.get(u.id) ?? [])
              .map((pid) => todosLosPerfiles.find((p) => p.id === pid))
              .filter((p) => p && Object.values((p.permisos as any)?.[modulo!.id] ?? {}).some(Boolean))
              .map((p) => p!.nombre);
            if (porPerfil.length > 0) origen = `Perfil: ${porPerfil.join(", ")}`;
          }
        } else if (rolPorUsuario.get(u.id) === "admin") {
          acciones = [...ACCIONES];
          origen = "Rol Administrador";
          porRolAdmin = true;
        }

        if (acciones.length > 0) {
          resultado.push({ id: u.id, nombre: u.nombre ?? "", apellido: u.apellido ?? "", email: u.email ?? "", acciones, origen, porRolAdmin });
        } else {
          candidatos.push({ id: u.id, nombre: u.nombre ?? "", apellido: u.apellido ?? "" });
        }
      }
      const orden = (a: { apellido: string; nombre: string }, b: { apellido: string; nombre: string }) =>
        `${a.apellido} ${a.nombre}`.localeCompare(`${b.apellido} ${b.nombre}`);
      return { filas: resultado.sort(orden), candidatos: candidatos.sort(orden) };
    },
  });

  const cambiar = useMutation({
    mutationFn: async ({ userId, acciones }: { userId: string; acciones: AccionPermiso[] | null }) => {
      if (!modulo || !congregacionId) throw new Error("Datos incompletos");
      await guardarPermisoDeModulo({ userId, congregacionId, modulo: modulo.id, acciones });
    },
    onSuccess: (_d, { acciones }) => {
      toast({ title: acciones ? "Permiso asignado" : "Permiso quitado" });
      for (const key of ["usuarios-de-permiso", "usuarios-de-perfil", "permisos-usuario", "mis-permisos"]) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const filasUsuarios = data?.filas ?? [];
  const candidatos = data?.candidatos ?? [];

  const filas: FilaUsuarioDialogo[] = filasUsuarios.map((u) => {
    let motivoNoQuitar: string | undefined;
    if (u.porRolAdmin) motivoNoQuitar = "Es administrador por su rol: quítale el perfil Administrador desde Perfiles";
    else if (u.id === usuarioActual?.id && modulo?.id === "configuracion_usuarios") motivoNoQuitar = "No puedes quitarte el acceso a Usuarios a ti mismo";
    return {
      id: u.id,
      titulo: `${u.apellido}, ${u.nombre}`,
      subtitulo: `${u.email} · ${u.origen}`,
      badges: u.acciones.map((a) => ETIQUETA[a]),
      motivoNoQuitar,
    };
  });

  const alternarAccion = (a: AccionPermiso, marcado: boolean) =>
    setAccionesNuevas((prev) => (marcado ? Array.from(new Set([...prev, a])) : prev.filter((x) => x !== a)));

  return (
    <UsuariosDialogBase
      abierto={!!modulo}
      titulo={`Quién tiene «${modulo?.label}»${isLoading ? "" : ` (${filasUsuarios.length})`}`}
      descripcion="Usuarios con este permiso, las acciones que tienen y cómo les llega. Quitar o agregar aquí es un ajuste individual y no cambia sus perfiles."
      cargando={isLoading}
      ocupado={cambiar.isPending}
      filas={filas}
      textoVacio="Nadie tiene este permiso."
      opcionesAgregar={candidatos.map((c) => ({ id: c.id, label: `${c.apellido}, ${c.nombre}` }))}
      extraAgregar={
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1">
          <span className="text-xs text-muted-foreground">Acciones:</span>
          {ACCIONES.map((a) => (
            <div key={a} className="flex items-center gap-1.5">
              <Checkbox id={`accion-${a}`} checked={accionesNuevas.includes(a)} onCheckedChange={(v) => alternarAccion(a, v === true)} />
              <Label htmlFor={`accion-${a}`} className="text-xs font-normal">{ETIQUETA[a]}</Label>
            </div>
          ))}
        </div>
      }
      confirmarQuitarTitulo={`¿Quitar el permiso «${modulo?.label}»?`}
      confirmarQuitarTexto={(f) => {
        const u = filasUsuarios.find((x) => x.id === f.id);
        const viene = u?.origen.startsWith("Perfil") ? ` Le llega por el ${u.origen.toLowerCase()}: seguirá con ese perfil, pero sin este permiso.` : "";
        return `${f.titulo} dejará de tener este permiso.${viene}`;
      }}
      onQuitar={(id) => cambiar.mutate({ userId: id, acciones: null })}
      onAgregar={async (id) => {
        if (accionesNuevas.length === 0) {
          toast({ title: "Elige al menos una acción", variant: "destructive" });
          throw new Error("sin acciones");
        }
        await cambiar.mutateAsync({ userId: id, acciones: accionesNuevas });
      }}
      onClose={onClose}
    />
  );
}
