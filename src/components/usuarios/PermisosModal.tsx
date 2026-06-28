import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCongregacion } from "@/contexts/CongregacionContext";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ACCIONES,
  AccionPermiso,
  MODULOS,
  MODULOS_SOLO_VER,
  ModuloPermiso,
  PermisoFila,
  PRESETS_PERMISOS,
  PresetPermiso,
} from "@/lib/permisos";
import { AppRole } from "@/hooks/useAuth";
import { usePerfilesPermisos } from "@/hooks/usePerfilesPermisos";

const ROL_OPCIONES: { value: AppRole; label: string }[] = [
  { value: "admin", label: "Administrador" },
  { value: "editor", label: "Editor" },
  { value: "viewer", label: "Visualizador" },
  { value: "sservicio", label: "S. Servicio" },
  { value: "srpublica", label: "S. Reunión Pública" },
  { value: "svministerio", label: "S. Vida y Ministerio" },
  { value: "saservicio", label: "S.A. Servicio" },
  { value: "user", label: "Usuario (sin rol)" },
];

// Íconos emoji para los presets predefinidos (por id)
const PRESET_EMOJI: Record<string, string> = {
  admin_total: "⚙️",
  editor: "✏️",
  solo_lectura: "👁️",
  predicacion: "🗺️",
  reunion_publica: "📖",
  vida_ministerio: "📅",
  asignaciones_servicio: "📋",
  personalizado: "🔧",
};

const ICONOS_EMOJI: Record<string, string> = {
  users: "👥", book: "📖", map: "🗺️", calendar: "📅", settings: "⚙️",
  edit: "✏️", eye: "👁️", lock: "🔒", star: "⭐", shield: "🛡️",
};

interface PermisosModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
  userLabel?: string;
  userEmail?: string;
  userRoles?: AppRole[];
}

type Estado = Record<ModuloPermiso, Record<AccionPermiso, boolean>>;
const ACCIONES_IDS: AccionPermiso[] = ["ver", "crear", "editar", "eliminar"];

function emptyEstado(): Estado {
  const e = {} as Estado;
  for (const m of MODULOS) e[m.id] = { ver: false, crear: false, editar: false, eliminar: false };
  return e;
}

function initials(label: string) {
  return label
    .split(/[\s,]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

export function PermisosModal({
  open,
  onOpenChange,
  userId,
  userLabel,
  userEmail,
  userRoles = [],
}: PermisosModalProps) {
  const { congregacionActual } = useCongregacion();
  const congregacionId = congregacionActual?.id ?? null;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { perfiles } = usePerfilesPermisos(congregacionId);

  const [estado, setEstado] = useState<Estado>(() => emptyEstado());
  const [rolSeleccionado, setRolSeleccionado] = useState<AppRole | null>(null);
  const [activeTab, setActiveTab] = useState("rapido");

  // Rol actual
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
    if (open) {
      setRolSeleccionado(rolActual ?? null);
      setActiveTab("rapido");
    }
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
      toast({ title: "Rol actualizado", duration: 1500 });
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
      if (a !== "ver" && value) next[m].ver = true;
      if (a === "ver" && !value) next[m] = { ver: false, crear: false, editar: false, eliminar: false };
      return next;
    });
  };

  const aplicarPermisosObj = (permisos: Record<string, Record<string, boolean>>) => {
    setEstado(() => {
      const e = emptyEstado();
      for (const [mod, acciones] of Object.entries(permisos)) {
        if (e[mod as ModuloPermiso] && acciones) {
          e[mod as ModuloPermiso] = {
            ver: acciones.ver ?? false,
            crear: acciones.crear ?? false,
            editar: acciones.editar ?? false,
            eliminar: acciones.eliminar ?? false,
          };
        }
      }
      return e;
    });
    toast({ title: "Perfil aplicado", description: "Guarda los cambios para confirmar.", duration: 2000 });
    setActiveTab("individual");
  };

  const aplicarPreset = (preset: PresetPermiso) => {
    const e = emptyEstado();
    if (preset.acceso_total) {
      for (const m of MODULOS) {
        const soloVer = MODULOS_SOLO_VER.has(m.id);
        e[m.id] = soloVer
          ? { ver: true, crear: false, editar: false, eliminar: false }
          : { ver: true, crear: true, editar: true, eliminar: true };
      }
    } else {
      for (const [mod, p] of Object.entries(preset.permisos ?? {})) {
        if (e[mod as ModuloPermiso] && p) e[mod as ModuloPermiso] = p as any;
      }
    }
    setEstado(e);
    toast({ title: `Perfil "${preset.label}" aplicado`, description: "Guarda los cambios para confirmar.", duration: 2000 });
    setActiveTab("individual");
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

      // Guardar rol si cambió
      if (rolSeleccionado && rolSeleccionado !== rolActual) {
        const { error } = await supabase
          .from("usuarios_congregacion")
          .update({ rol: rolSeleccionado })
          .eq("user_id", userId)
          .eq("congregacion_id", congregacionId);
        if (error) throw error;
      }

      // Guardar permisos granulares
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
          .insert(rows as any);
        if (insError) throw insError;
      }
    },
    onSuccess: () => {
      toast({ title: "Permisos guardados" });
      queryClient.invalidateQueries({ queryKey: ["permisos-usuario", userId, congregacionId] });
      queryClient.invalidateQueries({ queryKey: ["rol-usuario-congregacion", userId, congregacionId] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["mis-permisos"] });
      onOpenChange(false);
    },
    onError: (e: Error) => {
      toast({ title: "Error al guardar", description: e.message, variant: "destructive" });
    },
  });

  const rolLabel = ROL_OPCIONES.find((r) => r.value === (rolSeleccionado ?? rolActual))?.label;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header con info del usuario */}
        <DialogHeader className="px-6 pt-5 pb-4 border-b shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold shrink-0">
              {initials(userLabel ?? "U")}
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base">{userLabel}</DialogTitle>
              <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
            </div>
            {rolLabel && (
              <Badge variant="secondary" className="shrink-0">{rolLabel}</Badge>
            )}
          </div>
        </DialogHeader>

        {/* Selector de rol legacy */}
        <div className="px-6 py-3 border-b bg-muted/30 shrink-0 flex items-center gap-3">
          <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Rol de acceso</span>
          <Select
            value={rolSeleccionado ?? undefined}
            onValueChange={(v) => setRolSeleccionado(v as AppRole)}
          >
            <SelectTrigger className="h-8 text-xs w-52">
              <SelectValue placeholder="Selecciona un rol" />
            </SelectTrigger>
            <SelectContent>
              {ROL_OPCIONES.map((r) => (
                <SelectItem key={r.value} value={r.value} className="text-xs">
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">
            El rol define permisos por defecto. Los permisos granulares abajo tienen prioridad.
          </span>
        </div>

        {/* Tabs principales */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-6 mt-4 mb-0 w-fit shrink-0">
            <TabsTrigger value="rapido">Perfil rápido</TabsTrigger>
            <TabsTrigger value="individual">Permisos individuales</TabsTrigger>
          </TabsList>

          {/* TAB: Perfil rápido */}
          <TabsContent value="rapido" className="flex-1 overflow-y-auto px-6 py-4 mt-0">
            {/* Perfiles personalizados del DB */}
            {perfiles.length > 0 && (
              <div className="mb-6">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Perfiles de tu congregación
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {perfiles.map((p) => {
                    const emoji = ICONOS_EMOJI[p.icono] ?? "👥";
                    const totalModulos = Object.values(p.permisos).filter(
                      (acc) => acc && (acc.ver || acc.crear || acc.editar || acc.eliminar)
                    ).length;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => aplicarPermisosObj(p.permisos as any)}
                        className="text-left border rounded-xl p-4 hover:border-primary hover:bg-primary/5 transition-colors group"
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-xl">{emoji}</span>
                          <span className="text-sm font-semibold group-hover:text-primary">{p.nombre}</span>
                        </div>
                        {p.descripcion && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-1.5">{p.descripcion}</p>
                        )}
                        <span className="text-xs text-muted-foreground">{totalModulos} módulos</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Presets predefinidos del sistema */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Perfiles predefinidos del sistema
              </p>
              <div className="grid grid-cols-2 gap-3">
                {PRESETS_PERMISOS.filter((p) => p.id !== "personalizado").map((preset) => {
                  const emoji = PRESET_EMOJI[preset.id] ?? "👥";
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => aplicarPreset(preset)}
                      className="text-left border rounded-xl p-4 hover:border-primary hover:bg-primary/5 transition-colors group"
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-xl">{emoji}</span>
                        <span className="text-sm font-semibold group-hover:text-primary">{preset.label}</span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{preset.descripcion}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <p className="text-xs text-muted-foreground mt-4 flex items-center gap-1.5">
              <span>ℹ️</span>
              Al seleccionar un perfil se pre-cargan los permisos en la pestaña "Permisos individuales" — guarda los cambios para confirmar.
            </p>
          </TabsContent>

          {/* TAB: Permisos individuales */}
          <TabsContent value="individual" className="flex-1 overflow-y-auto px-6 py-4 mt-0">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <>
                <div className="flex flex-wrap gap-2 mb-4">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const e = emptyEstado();
                      for (const m of MODULOS) e[m.id] = { ver: true, crear: false, editar: false, eliminar: false };
                      setEstado(e);
                    }}
                  >
                    Solo lectura (todo)
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const e = emptyEstado();
                      for (const m of MODULOS) {
                        e[m.id] = MODULOS_SOLO_VER.has(m.id)
                          ? { ver: true, crear: false, editar: false, eliminar: false }
                          : { ver: true, crear: true, editar: true, eliminar: true };
                      }
                      setEstado(e);
                    }}
                  >
                    Acceso total (todo)
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setEstado(emptyEstado())}>
                    Limpiar
                  </Button>
                </div>

                <div className="space-y-4">
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
                          if (a === "ver" && !value) { row.crear = false; row.editar = false; row.eliminar = false; }
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
              </>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="px-6 py-4 border-t shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={guardar.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => guardar.mutate()} disabled={guardar.isPending || isLoading}>
            {guardar.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Guardar cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
