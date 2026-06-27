import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { ACCIONES, ACCIONES as _, MODULOS, MODULOS_SOLO_VER, ModuloPermiso, AccionPermiso } from "@/lib/permisos";
import { PerfilPermiso, PerfilPermisoInput, usePerfilesPermisos } from "@/hooks/usePerfilesPermisos";

const ICONOS = [
  { id: "users", emoji: "👥" },
  { id: "book", emoji: "📖" },
  { id: "map", emoji: "🗺️" },
  { id: "calendar", emoji: "📅" },
  { id: "settings", emoji: "⚙️" },
  { id: "edit", emoji: "✏️" },
  { id: "eye", emoji: "👁️" },
  { id: "lock", emoji: "🔒" },
  { id: "star", emoji: "⭐" },
  { id: "shield", emoji: "🛡️" },
];

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
  const { crear, actualizar } = usePerfilesPermisos(congregacionId);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{perfil ? "Editar perfil" : "Crear perfil de permisos"}</DialogTitle>
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
            </div>
            <div className="space-y-1.5">
              <Label>Ícono</Label>
              <div className="flex flex-wrap gap-2">
                {ICONOS.map((ic) => (
                  <button
                    key={ic.id}
                    type="button"
                    onClick={() => setIcono(ic.id)}
                    className={`w-8 h-8 rounded border text-base flex items-center justify-center transition-colors ${
                      icono === ic.id
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    }`}
                    title={ic.id}
                  >
                    {ic.emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="desc-perfil">Descripción (opcional)</Label>
            <Textarea
              id="desc-perfil"
              placeholder="Describe brevemente para qué sirve este perfil"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={2}
            />
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
          <Button onClick={handleGuardar} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {perfil ? "Guardar cambios" : "Crear perfil"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
