import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCongregacion } from "@/contexts/CongregacionContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  ACCIONES,
  AccionPermiso,
  MODULOS,
  MODULOS_SOLO_VER,
  ModuloPermiso,
  PermisoFila,
} from "@/lib/permisos";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AppRole } from "@/hooks/useAuth";

const ROL_OPCIONES: { value: AppRole; label: string; descripcion: string }[] = [
  { value: "admin", label: "Administrador", descripcion: "Acceso total dentro de la congregación" },
  { value: "editor", label: "Editor", descripcion: "Puede crear y editar (no cierra programas)" },
  { value: "viewer", label: "Visualizador", descripcion: "Solo lectura" },
  { value: "sservicio", label: "S. Servicio", descripcion: "Acceso a Predicación" },
  { value: "srpublica", label: "S. Reunión Pública", descripcion: "Acceso a Reunión Pública" },
  { value: "svministerio", label: "S. Vida y Ministerio", descripcion: "Acceso a Vida y Ministerio" },
  { value: "saservicio", label: "S.A. Servicio", descripcion: "Acceso a Asignaciones de Servicio" },
  { value: "user", label: "Usuario (sin rol)", descripcion: "Solo permisos granulares asignados" },
];


interface PermisosModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
  userLabel?: string;
}

type Estado = Record<ModuloPermiso, Record<AccionPermiso, boolean>>;

const ACCIONES_IDS: AccionPermiso[] = ["ver", "crear", "editar", "eliminar"];

function emptyEstado(): Estado {
  const e = {} as Estado;
  for (const m of MODULOS) {
    e[m.id] = { ver: false, crear: false, editar: false, eliminar: false };
  }
  return e;
}

export function PermisosModal({ open, onOpenChange, userId, userLabel }: PermisosModalProps) {
  const { congregacionActual } = useCongregacion();
  const congregacionId = congregacionActual?.id ?? null;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [estado, setEstado] = useState<Estado>(() => emptyEstado());
  const [rolSeleccionado, setRolSeleccionado] = useState<AppRole | null>(null);

  // Rol actual del usuario en esta congregación
  const { data: rolActual } = useQuery({
    queryKey: ["rol-usuario-congregacion", userId, congregacionId],
    enabled: open && !!userId && !!congregacionId,
    queryFn: async (): Promise<AppRole | null> => {
      const { data, error } = await supabase
        .from("usuarios_congregacion")
        .select("rol")
        .eq("user_id", userId!)
        .eq("congregacion_id", congregacionId!)
        .eq("activo", true)
        .maybeSingle();
      if (error) throw error;
      return (data?.rol ?? null) as AppRole | null;
    },
  });

  useEffect(() => {
    if (open) setRolSeleccionado(rolActual ?? null);
  }, [open, rolActual]);

  const guardarRol = useMutation({
    mutationFn: async (nuevoRol: AppRole) => {
      if (!userId || !congregacionId) throw new Error("Datos incompletos");
      const { error } = await supabase
        .from("usuarios_congregacion")
        .update({ rol: nuevoRol })
        .eq("user_id", userId)
        .eq("congregacion_id", congregacionId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Rol actualizado", duration: 1000 });
      queryClient.invalidateQueries({ queryKey: ["rol-usuario-congregacion", userId, congregacionId] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["mis-permisos"] });
    },
    onError: (e: Error) => {
      toast({ title: "Error al actualizar rol", description: e.message, variant: "destructive" });
    },
  });


  const { data: filas, isLoading } = useQuery({
    queryKey: ["permisos-usuario", userId, congregacionId],
    enabled: open && !!userId && !!congregacionId,
    queryFn: async (): Promise<PermisoFila[]> => {
      const { data, error } = await supabase
        .from("permisos_usuario_congregacion" as any)
        .select("modulo, puede_ver, puede_crear, puede_editar, puede_eliminar")
        .eq("user_id", userId!)
        .eq("congregacion_id", congregacionId!);
      if (error) throw error;
      return (data ?? []) as unknown as PermisoFila[];
    },
  });

  useEffect(() => {
    if (!open) return;
    const e = emptyEstado();
    for (const f of filas ?? []) {
      if (e[f.modulo as ModuloPermiso]) {
        e[f.modulo as ModuloPermiso] = {
          ver: f.puede_ver,
          crear: f.puede_crear,
          editar: f.puede_editar,
          eliminar: f.puede_eliminar,
        };
      }
    }
    setEstado(e);
  }, [open, filas]);

  const toggle = (m: ModuloPermiso, a: AccionPermiso, value: boolean) => {
    setEstado((prev) => {
      const next = { ...prev, [m]: { ...prev[m], [a]: value } };
      // Cascada: marcar otra acción implica ver
      if (a !== "ver" && value) {
        next[m].ver = true;
      }
      // Desmarcar ver implica desmarcar el resto
      if (a === "ver" && !value) {
        next[m] = { ver: false, crear: false, editar: false, eliminar: false };
      }
      return next;
    });
  };

  const aplicarPreset = (preset: "solo_lectura" | "acceso_total" | "limpiar") => {
    setEstado(() => {
      const e = emptyEstado();
      if (preset === "limpiar") return e;
      for (const m of MODULOS) {
        const soloVer = MODULOS_SOLO_VER.has(m.id);
        if (preset === "solo_lectura" || soloVer) {
          e[m.id] = { ver: true, crear: false, editar: false, eliminar: false };
        } else {
          e[m.id] = { ver: true, crear: true, editar: true, eliminar: true };
        }
      }
      return e;
    });
  };

  const grupos = useMemo(() => {
    const map = new Map<string, typeof MODULOS>();
    for (const m of MODULOS) {
      const arr = map.get(m.grupo) ?? [];
      arr.push(m);
      map.set(m.grupo, arr);
    }
    return Array.from(map.entries());
  }, []);

  const guardar = useMutation({
    mutationFn: async () => {
      if (!userId || !congregacionId) throw new Error("Datos incompletos");
      // Borrar todo y reinsertar lo marcado (estrategia simple, set pequeño)
      const { error: delError } = await supabase
        .from("permisos_usuario_congregacion" as any)
        .delete()
        .eq("user_id", userId)
        .eq("congregacion_id", congregacionId);
      if (delError) throw delError;

      const rows = MODULOS
        .filter((m) => {
          const s = estado[m.id];
          return s.ver || s.crear || s.editar || s.eliminar;
        })
        .map((m) => ({
          user_id: userId,
          congregacion_id: congregacionId,
          modulo: m.id,
          puede_ver: estado[m.id].ver,
          puede_crear: estado[m.id].crear,
          puede_editar: estado[m.id].editar,
          puede_eliminar: estado[m.id].eliminar,
        }));

      if (rows.length > 0) {
        const { error: insError } = await supabase
          .from("permisos_usuario_congregacion" as any)
          .insert(rows);
        if (insError) throw insError;
      }
    },
    onSuccess: () => {
      toast({ title: "Permisos guardados", duration: 1000 });
      queryClient.invalidateQueries({ queryKey: ["permisos-usuario", userId, congregacionId] });
      queryClient.invalidateQueries({ queryKey: ["mis-permisos"] });
      onOpenChange(false);
    },
    onError: (e: Error) => {
      toast({ title: "Error al guardar", description: e.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Permisos del usuario</DialogTitle>
          <DialogDescription>
            {userLabel ?? ""} — define a qué módulos tiene acceso y qué acciones puede realizar.
            Mientras no se asigne ningún permiso, se aplica el rol tradicional del usuario.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2 py-2">
          <Button type="button" variant="outline" size="sm" onClick={() => aplicarPreset("solo_lectura")}>
            Solo lectura (todo)
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => aplicarPreset("acceso_total")}>
            Acceso total (todo)
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => aplicarPreset("limpiar")}>
            Limpiar
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            {grupos.map(([grupo, modulos]) => {
              const getGroupState = (a: AccionPermiso): boolean | "indeterminate" => {
                const applicable = modulos.filter((m) => !(MODULOS_SOLO_VER.has(m.id) && a !== "ver"));
                if (applicable.length === 0) return false;
                const checkedCount = applicable.filter((m) => estado[m.id][a]).length;
                if (checkedCount === 0) return false;
                if (checkedCount === applicable.length) return true;
                return "indeterminate";
              };
              const toggleGroup = (a: AccionPermiso, value: boolean) => {
                setEstado((prev) => {
                  const next = { ...prev };
                  for (const m of modulos) {
                    if (MODULOS_SOLO_VER.has(m.id) && a !== "ver") continue;
                    const row = { ...next[m.id], [a]: value };
                    if (a !== "ver" && value) row.ver = true;
                    if (a === "ver" && !value) {
                      row.crear = false;
                      row.editar = false;
                      row.eliminar = false;
                    }
                    next[m.id] = row;
                  }
                  return next;
                });
              };
              return (
              <div key={grupo} className="border rounded-md overflow-hidden">
                <div className="bg-muted px-3 py-2 text-sm font-semibold">{grupo}</div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="text-left px-3 py-1.5 font-medium">Módulo</th>
                      {ACCIONES.map((a) => (
                        <th key={a.id} className="px-2 py-1.5 font-medium w-16 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span>{a.label}</span>
                            <Checkbox
                              checked={getGroupState(a.id)}
                              onCheckedChange={(v) => toggleGroup(a.id, v === true)}
                              aria-label={`Seleccionar todo ${a.label} en ${grupo}`}
                            />
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {modulos.map((m) => {
                      const soloVer = MODULOS_SOLO_VER.has(m.id);
                      return (
                        <tr key={m.id} className="border-b last:border-b-0">
                          <td className="px-3 py-2">{m.label}</td>
                          {ACCIONES_IDS.map((a) => {
                            const disabled = soloVer && a !== "ver";
                            return (
                              <td key={a} className="px-2 py-2 text-center">
                                {disabled ? (
                                  <span className="text-muted-foreground/40">—</span>
                                ) : (
                                  <Checkbox
                                    checked={estado[m.id][a]}
                                    onCheckedChange={(v) => toggle(m.id, a, v === true)}
                                  />
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              );
            })}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={guardar.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => guardar.mutate()} disabled={guardar.isPending || isLoading}>
            {guardar.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Guardar permisos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
