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
import { Input } from "@/components/ui/input";
import { Loader2, Plus, ChevronRight, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ACCIONES,
  AccionPermiso,
  MODULOS,
  MODULOS_SOLO_VER,
  ModuloPermiso,
  PermisoFila,
} from "@/lib/permisos";
import { AppRole } from "@/hooks/useAuth";
import { PerfilPermiso, usePerfilesPermisos } from "@/hooks/usePerfilesPermisos";

// Prioridad de app_role: define el rol principal cuando hay múltiples perfiles de sistema seleccionados
const ROLE_PRIORITY: AppRole[] = [
  "admin", "editor", "viewer", "sservicio", "srpublica", "svministerio", "saservicio", "user",
];

type Estado = Record<ModuloPermiso, Record<AccionPermiso, boolean>>;
const ACCIONES_IDS: AccionPermiso[] = ["ver", "crear", "editar", "eliminar"];

function emptyEstado(): Estado {
  const e = {} as Estado;
  for (const m of MODULOS) e[m.id] = { ver: false, crear: false, editar: false, eliminar: false };
  return e;
}

function mergeIntoEstado(
  base: Estado,
  permisos: Partial<Record<string, Partial<Record<AccionPermiso, boolean>>>>,
): Estado {
  const result = { ...base };
  for (const [mod, p] of Object.entries(permisos)) {
    const m = mod as ModuloPermiso;
    if (result[m] && p) {
      result[m] = {
        ver: result[m].ver || (p.ver ?? false),
        crear: result[m].crear || (p.crear ?? false),
        editar: result[m].editar || (p.editar ?? false),
        eliminar: result[m].eliminar || (p.eliminar ?? false),
      };
    }
  }
  return result;
}

function initials(label: string) {
  return label.split(/[\s,]+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
}

interface PermisosModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
  userLabel?: string;
  userEmail?: string;
  userRoles?: AppRole[];
}

export function PermisosModal({
  open,
  onOpenChange,
  userId,
  userLabel,
  userEmail,
}: PermisosModalProps) {
  const { congregacionActual } = useCongregacion();
  const congregacionId = congregacionActual?.id ?? null;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { perfilesSistema, perfiles, crear: crearPerfil } = usePerfilesPermisos(congregacionId);

  const [estado, setEstado] = useState<Estado>(() => emptyEstado());
  const [rolPrincipal, setRolPrincipal] = useState<AppRole>("user");
  // IDs unificados: puede ser un perfil de sistema o uno personalizado
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState("roles");
  const [showSavePerfil, setShowSavePerfil] = useState(false);
  const [nombreNuevoPerfil, setNombreNuevoPerfil] = useState("");
  const [savingPerfil, setSavingPerfil] = useState(false);

  const { data: rolActual } = useQuery({
    queryKey: ["rol-usuario-congregacion", userId, congregacionId],
    enabled: open && !!userId && !!congregacionId,
    queryFn: async (): Promise<AppRole> => {
      const { data } = await supabase
        .from("usuarios_congregacion")
        .select("rol")
        .eq("user_id", userId!)
        .eq("congregacion_id", congregacionId!)
        .eq("activo", true)
        .maybeSingle();
      return (data?.rol ?? "user") as AppRole;
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

  // Carga permisos y resetea estado al abrir el modal
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
    setRolPrincipal((rolActual ?? "user") as AppRole);
    setSelectedIds(new Set()); // se completa en el efecto de abajo
    setActiveTab("roles");
    setShowSavePerfil(false);
    setNombreNuevoPerfil("");
  }, [open, filas, rolActual]);

  // Pre-selecciona el perfil del sistema que coincide con el rol actual del usuario
  useEffect(() => {
    if (!open || perfilesSistema.length === 0 || !rolActual) return;
    setSelectedIds((prev) => {
      if (prev.size > 0) return prev; // no sobreescribir si el usuario ya cambió algo
      const match = perfilesSistema.find((p) => p.app_role === rolActual);
      return match ? new Set([match.id]) : prev;
    });
  }, [open, perfilesSistema, rolActual]);

  const derivarRolDesdeSeleccion = (ids: Set<string>): AppRole => {
    // Busca el perfil de sistema de mayor prioridad en la selección
    for (const role of ROLE_PRIORITY) {
      const found = perfilesSistema.find((p) => ids.has(p.id) && p.app_role === role);
      if (found) return role as AppRole;
    }
    return "user";
  };

  const togglePerfil = (perfil: PerfilPermiso) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(perfil.id)) {
        next.delete(perfil.id);
      } else {
        next.add(perfil.id);
        // Aplica permisos del perfil sobre el estado actual (union)
        setEstado((e) => mergeIntoEstado(e, perfil.permisos));
      }
      // Actualiza el rol principal basado en perfiles de sistema seleccionados
      setRolPrincipal(derivarRolDesdeSeleccion(next));
      return next;
    });
  };

  const toggle = (m: ModuloPermiso, a: AccionPermiso, value: boolean) => {
    setEstado((prev) => {
      const next = { ...prev, [m]: { ...prev[m], [a]: value } };
      if (a !== "ver" && value) next[m].ver = true;
      if (a === "ver" && !value) next[m] = { ver: false, crear: false, editar: false, eliminar: false };
      return next;
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

  const handleSavePerfil = async () => {
    if (!nombreNuevoPerfil.trim() || !congregacionId) return;
    setSavingPerfil(true);
    try {
      const permisos: Record<string, Record<string, boolean>> = {};
      for (const m of MODULOS) {
        const s = estado[m.id];
        if (s.ver || s.crear || s.editar || s.eliminar) permisos[m.id] = s;
      }
      await crearPerfil.mutateAsync({ nombre: nombreNuevoPerfil.trim(), descripcion: null, icono: "users", permisos });
      toast({ title: "Perfil guardado", duration: 1500 });
      setShowSavePerfil(false);
      setNombreNuevoPerfil("");
    } catch (e: any) {
      toast({ title: "Error al guardar perfil", description: e.message, variant: "destructive" });
    } finally {
      setSavingPerfil(false);
    }
  };

  const guardar = useMutation({
    mutationFn: async () => {
      if (!userId || !congregacionId) throw new Error("Datos incompletos");

      const { error: rolError } = await supabase
        .from("usuarios_congregacion")
        .update({ rol: rolPrincipal })
        .eq("user_id", userId)
        .eq("congregacion_id", congregacionId);
      if (rolError) throw rolError;

      const { error: delError } = await supabase
        .from("permisos_usuario_congregacion" as any)
        .delete()
        .eq("user_id", userId)
        .eq("congregacion_id", congregacionId);
      if (delError) throw delError;

      const rows = MODULOS.filter((m) => {
        const s = estado[m.id];
        return s.ver || s.crear || s.editar || s.eliminar;
      }).map((m) => ({
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

  const activeLabels = [
    ...perfilesSistema.filter((p) => selectedIds.has(p.id)).map((p) => p.nombre),
    ...perfiles.filter((p) => selectedIds.has(p.id)).map((p) => p.nombre),
  ];

  const renderPerfilCard = (p: PerfilPermiso) => {
    const selected = selectedIds.has(p.id);
    return (
      <button
        key={p.id}
        type="button"
        onClick={() => togglePerfil(p)}
        className={`flex items-center gap-2.5 border rounded-lg px-3 py-2 text-left transition-colors w-full ${
          selected
            ? "border-primary/40 bg-primary/5"
            : "border-border hover:border-muted-foreground/30 hover:bg-muted/30"
        }`}
      >
        <div
          className="w-2 h-2 rounded-full shrink-0"
          style={{ background: p.color ?? "#94a3b8" }}
        />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium leading-tight truncate">{p.nombre}</p>
          <p className="text-[10px] text-muted-foreground truncate">
            {p.descripcion ?? (p.es_sistema ? "Perfil del sistema" : "Perfil personalizado")}
          </p>
        </div>
        <div
          className={`w-3.5 h-3.5 rounded border shrink-0 flex items-center justify-center ${
            selected ? "bg-primary border-primary" : "border-muted-foreground/30"
          }`}
        >
          {selected && <span className="text-[8px] text-white font-bold leading-none">✓</span>}
        </div>
      </button>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[80vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-5 pt-4 pb-3 border-b shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold shrink-0">
              {initials(userLabel ?? "U")}
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-sm leading-tight">{userLabel}</DialogTitle>
              <p className="text-xs text-muted-foreground">{userEmail}</p>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="w-full rounded-none border-b bg-muted/20 h-9 shrink-0 px-0 justify-start gap-0 p-0">
            <TabsTrigger
              value="roles"
              className="rounded-none h-full border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-5 text-xs"
            >
              Roles
            </TabsTrigger>
            <TabsTrigger
              value="individual"
              className="rounded-none h-full border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-5 text-xs"
            >
              Permisos granulares
            </TabsTrigger>
          </TabsList>

          {/* TAB: Roles */}
          <TabsContent value="roles" className="flex-1 overflow-y-auto px-5 py-4 mt-0 space-y-4">
            {/* Roles predefinidos del sistema */}
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Roles predefinidos
              </p>
              {perfilesSistema.length === 0 ? (
                <p className="text-xs text-muted-foreground">Cargando roles...</p>
              ) : (
                <div className="grid grid-cols-2 gap-1.5">
                  {perfilesSistema.map(renderPerfilCard)}
                </div>
              )}
            </div>

            {/* Perfiles personalizados de la congregación */}
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Perfiles personalizados
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {perfiles.map(renderPerfilCard)}
                <button
                  type="button"
                  onClick={() => setActiveTab("individual")}
                  className="flex items-center gap-2 border border-dashed rounded-lg px-3 py-2 text-muted-foreground hover:border-muted-foreground/40 hover:bg-muted/20 transition-colors"
                >
                  <Plus className="h-3 w-3" />
                  <span className="text-xs">Nuevo perfil</span>
                </button>
              </div>
            </div>

            {/* Resumen de selección */}
            {activeLabels.length > 0 && (
              <div className="border rounded-lg px-3 py-2.5 bg-muted/20">
                <p className="text-[10px] font-medium text-muted-foreground mb-1.5">
                  Roles activos de este usuario
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {activeLabels.map((l) => (
                    <Badge key={l} variant="secondary" className="text-[10px] py-0 px-2">
                      {l}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* TAB: Permisos granulares */}
          <TabsContent value="individual" className="flex-1 overflow-y-auto px-5 py-3 mt-0">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : (
              <>
                {/* Barra de acciones rápidas + guardar como perfil */}
                <div className="flex flex-wrap items-center gap-1.5 mb-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      const e = emptyEstado();
                      for (const m of MODULOS) e[m.id] = { ver: true, crear: false, editar: false, eliminar: false };
                      setEstado(e);
                    }}
                  >
                    Solo lectura
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
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
                    Acceso total
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setEstado(emptyEstado())}
                  >
                    Limpiar
                  </Button>

                  <div className="ml-auto flex items-center gap-1.5">
                    {showSavePerfil ? (
                      <>
                        <Input
                          value={nombreNuevoPerfil}
                          onChange={(e) => setNombreNuevoPerfil(e.target.value)}
                          placeholder="Nombre del perfil"
                          className="h-7 text-xs w-36"
                          onKeyDown={(e) => e.key === "Enter" && handleSavePerfil()}
                          autoFocus
                        />
                        <Button
                          size="sm"
                          className="h-7 text-xs"
                          onClick={handleSavePerfil}
                          disabled={!nombreNuevoPerfil.trim() || savingPerfil}
                        >
                          {savingPerfil ? <Loader2 className="h-3 w-3 animate-spin" /> : "Guardar"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs px-2"
                          onClick={() => { setShowSavePerfil(false); setNombreNuevoPerfil(""); }}
                        >
                          ✕
                        </Button>
                      </>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => setShowSavePerfil(true)}
                      >
                        <Save className="h-3 w-3" />
                        Guardar como perfil
                      </Button>
                    )}
                  </div>
                </div>

                {/* Matriz de permisos */}
                <div className="space-y-3">
                  {grupos.map(([grupo, modulos]) => {
                    const getGroupState = (a: AccionPermiso): boolean | "indeterminate" => {
                      const applicable = modulos.filter(
                        (m) => !(MODULOS_SOLO_VER.has(m.id) && a !== "ver"),
                      );
                      if (applicable.length === 0) return false;
                      const count = applicable.filter((m) => estado[m.id][a]).length;
                      if (count === 0) return false;
                      if (count === applicable.length) return true;
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
                        <div className="bg-muted px-3 py-1.5 text-xs font-semibold">{grupo}</div>
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b text-muted-foreground">
                              <th className="text-left px-3 py-1 font-medium">Módulo</th>
                              {ACCIONES.map((a) => (
                                <th key={a.id} className="px-2 py-1 font-medium w-14 text-center">
                                  <div className="flex flex-col items-center gap-0.5">
                                    <span>{a.label}</span>
                                    <Checkbox
                                      checked={getGroupState(a.id)}
                                      onCheckedChange={(v) => toggleGroup(a.id, v === true)}
                                      className="h-3 w-3"
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
                                  <td className="px-3 py-1.5">{m.label}</td>
                                  {ACCIONES_IDS.map((a) => {
                                    const disabled = soloVer && a !== "ver";
                                    return (
                                      <td key={a} className="px-2 py-1.5 text-center">
                                        {disabled ? (
                                          <span className="text-muted-foreground/40">—</span>
                                        ) : (
                                          <Checkbox
                                            checked={estado[m.id][a]}
                                            onCheckedChange={(v) => toggle(m.id, a, v === true)}
                                            className="h-3 w-3"
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

        <DialogFooter className="px-5 py-3 border-t shrink-0">
          {activeTab === "roles" && (
            <button
              type="button"
              onClick={() => setActiveTab("individual")}
              className="text-xs text-primary flex items-center gap-1 mr-auto hover:underline"
            >
              Ver permisos combinados <ChevronRight className="h-3 w-3" />
            </button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={guardar.isPending}
          >
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={() => guardar.mutate()}
            disabled={guardar.isPending || isLoading}
          >
            {guardar.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
