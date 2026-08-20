import { useEffect, useMemo, useState } from "react";
import { Loader2, Check, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { ACCIONES, ACCIONES as _, MODULOS, MODULOS_SOLO_VER, ModuloPermiso, AccionPermiso } from "@/lib/permisos";
import { PerfilPermiso, PerfilPermisoInput, usePerfilesPermisos } from "@/hooks/usePerfilesPermisos";

type Estado = Record<ModuloPermiso, Record<AccionPermiso, boolean>>;
const ACCIONES_IDS: AccionPermiso[] = ["ver", "crear", "editar", "eliminar"];

function emptyEstado(): Estado {
  const e = {} as Estado;
  for (const m of MODULOS) e[m.id] = { ver: false, crear: false, editar: false, eliminar: false };
  return e;
}

function perfilToEstado(permisos: PerfilPermiso["permisos"]): Estado {
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
}

function estadoToPermisos(estado: Estado): PerfilPermiso["permisos"] {
  const p: PerfilPermiso["permisos"] = {};
  for (const m of MODULOS) {
    const s = estado[m.id];
    if (s.ver || s.crear || s.editar || s.eliminar) {
      p[m.id] = { ver: s.ver, crear: s.crear, editar: s.editar, eliminar: s.eliminar };
    }
  }
  return p;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  congregacionId: string;
  perfil?: PerfilPermiso | null;
}

export function PerfilPermisoDialog({ open, onOpenChange, congregacionId, perfil }: Props) {
  const { toast } = useToast();
  const { crear, actualizar, eliminar, perfiles, perfilesSistema } = usePerfilesPermisos(congregacionId);

  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [icono, setIcono] = useState("users");
  const [estado, setEstado] = useState<Estado>(() => emptyEstado());

  useEffect(() => {
    if (!open) return;
    if (perfil) {
      setNombre(perfil.nombre);
      setDescripcion(perfil.descripcion ?? "");
      setIcono(perfil.icono);
      setEstado(perfilToEstado(perfil.permisos));
    } else {
      setNombre("");
      setDescripcion("");
      setIcono("users");
      setEstado(emptyEstado());
    }
  }, [open, perfil]);

  // Aviso en vivo si ya existe un perfil (personalizado o de sistema) con ese
  // nombre, para no descubrirlo recién al guardar.
  const nombreTrim = nombre.trim();
  const nombreDuplicado = useMemo(() => {
    if (!nombreTrim) return false;
    const nombreNormalizado = nombreTrim.toLowerCase();
    return [...perfilesSistema, ...perfiles].some(
      (p) => p.id !== perfil?.id && p.nombre.trim().toLowerCase() === nombreNormalizado,
    );
  }, [nombreTrim, perfilesSistema, perfiles, perfil]);

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

  const isPending = crear.isPending || actualizar.isPending;

  const handleGuardar = async () => {
    if (!nombre.trim()) {
      toast({ title: "El nombre es obligatorio", variant: "destructive" });
      return;
    }
    if (nombreDuplicado) {
      toast({ title: "Ya existe un perfil con ese nombre", description: "Prueba con otro distinto.", variant: "destructive" });
      return;
    }
    const input: PerfilPermisoInput = {
      nombre: nombre.trim(),
      descripcion: descripcion.trim() || null,
      icono,
      permisos: estadoToPermisos(estado),
    };
    try {
      if (perfil) {
        await actualizar.mutateAsync({ id: perfil.id, ...input });
        toast({ title: "Perfil actualizado" });
      } else {
        await crear.mutateAsync(input);
        toast({ title: "Perfil creado" });
      }
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Error al guardar", description: e.message, variant: "destructive" });
    }
  };

  const handleEliminar = async () => {
    if (!perfil) return;
    try {
      await eliminar.mutateAsync(perfil.id);
      toast({ title: "Perfil eliminado" });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Error al eliminar", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>{perfil ? "Editar perfil" : "Crear perfil de permisos"}</DialogTitle>
            {/* Solo perfiles personalizados se pueden eliminar; Administrador y
                el resto de los de sistema quedan protegidos. */}
            {perfil && !perfil.es_sistema && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                    disabled={isPending || eliminar.isPending}
                    title="Eliminar perfil"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Eliminar perfil?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Se eliminará el perfil <strong>{perfil.nombre}</strong> y se les quitará a los
                      usuarios que lo tengan asignado. Esta acción no se puede deshacer.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={handleEliminar}
                    >
                      Eliminar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="nombre-perfil">Nombre</Label>
              <Input
                id="nombre-perfil"
                placeholder="Ej: Encargado de territorios"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
              />
              {nombreTrim && (
                nombreDuplicado ? (
                  <p className="flex items-center gap-1 text-xs text-destructive">
                    <X className="h-3.5 w-3.5" />
                    Ya existe, prueba con otro nombre
                  </p>
                ) : (
                  <p className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-500">
                    <Check className="h-3.5 w-3.5" />
                    Nombre disponible
                  </p>
                )
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="desc-perfil">Descripción (opcional)</Label>
              <Textarea
                id="desc-perfil"
                placeholder="Describe brevemente para qué sirve este perfil"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                rows={2}
                className="resize-none"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
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
                  const soloVer = MODULOS_SOLO_VER.has(m.id);
                  e[m.id] = soloVer
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
            {grupos.map(([grupo, modulos]) => (
              <div key={grupo} className="border rounded-md overflow-hidden">
                <div className="bg-muted px-3 py-2 text-sm font-semibold">{grupo}</div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="text-left px-3 py-1.5 font-medium">Módulo</th>
                      {ACCIONES.map((a) => (
                        <th key={a.id} className="px-2 py-1.5 font-medium w-16 text-center">
                          {a.label}
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
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleGuardar} disabled={isPending || nombreDuplicado}>
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {perfil ? "Guardar cambios" : "Crear perfil"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
