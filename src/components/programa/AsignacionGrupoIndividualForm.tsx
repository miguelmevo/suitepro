import { useState, useEffect, useMemo } from "react";
import { DialogClose } from "@/components/ui/dialog";
import { useFormatoImpresion } from "@/hooks/useFormatoImpresion";
import { useConfiguracionSistema } from "@/hooks/useConfiguracionSistema";
import { useGruposPredicacionFicticios } from "@/hooks/useGruposPredicacionFicticios";
import { Button } from "@/components/ui/button";
import { Check, X, ChevronsUpDown } from "lucide-react";
import { Territorio, AsignacionGrupo } from "@/types/programa-predicacion";
import { GrupoPredicacion } from "@/hooks/useGruposPredicacion";
import { PuntoEncuentro } from "@/types/programa-predicacion";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { sortTerritorioNumeros } from "@/lib/sorting";

interface AsignacionGrupoIndividualFormProps {
  grupos: GrupoPredicacion[];
  territorios: Territorio[];
  puntos?: PuntoEncuentro[];
  asignacionesIniciales?: AsignacionGrupo[];
  onSubmit: (asignaciones: AsignacionGrupo[]) => void;
  onCancel: () => void;
  isLoading?: boolean;
  submitLabel: string;
}

// Tipo unificado para render
interface GrupoItem {
  key: string; // id real o `fic_${id}`
  id: string;
  label: string; // "G1" o nombre ficticio
  esFicticio: boolean;
  nombre?: string;
  numero?: number;
}

export function AsignacionGrupoIndividualForm({
  grupos,
  territorios,
  puntos = [],
  asignacionesIniciales = [],
  onSubmit,
  onCancel,
  isLoading,
  submitLabel,
}: AsignacionGrupoIndividualFormProps) {
  const formatoImpresion = useFormatoImpresion();
  const mostrarSalida = formatoImpresion === "calendario";
  const { gruposFicticiosActivos } = useGruposPredicacionFicticios();

  const [territoriosPorGrupo, setTerritoriosPorGrupo] = useState<Record<string, string[]>>({});
  const [puntoPorGrupo, setPuntoPorGrupo] = useState<Record<string, string>>({});

  const { getConfigValue } = useConfiguracionSistema("predicacion");
  const asociacionGruposHabilitada = getConfigValue?.("asociacion_grupos")?.habilitado ?? false;

  const gruposCombinados: GrupoItem[] = useMemo(() => {
    const reales: GrupoItem[] = grupos.map((g) => ({
      key: g.id,
      id: g.id,
      label: `G${g.numero}`,
      esFicticio: false,
      numero: g.numero,
    }));
    const ficticios: GrupoItem[] = (gruposFicticiosActivos || []).map((g) => ({
      key: `fic_${g.id}`,
      id: g.id,
      label: g.nombre,
      esFicticio: true,
      nombre: g.nombre,
    }));
    return [...reales, ...ficticios];
  }, [grupos, gruposFicticiosActivos]);

  const getTerritoriosFiltradosParaGrupo = (item: GrupoItem): Territorio[] => {
    const lista = item.esFicticio
      ? territorios // ficticios: todos los territorios
      : territorios.filter((t) => {
          const ids = t.grupos_predicacion_ids || [];
          if (ids.length === 0) return true;
          return ids.includes(item.id);
        });
    return [...lista].sort((a, b) => {
      const numA = parseInt(a.numero, 10);
      const numB = parseInt(b.numero, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.numero.localeCompare(b.numero);
    });
  };

  useEffect(() => {
    const inicial: Record<string, string[]> = {};
    const inicialPuntos: Record<string, string> = {};
    asignacionesIniciales.forEach((asig) => {
      const key = asig.grupo_ficticio_id ? `fic_${asig.grupo_ficticio_id}` : asig.grupo_id;
      const ids = asig.territorio_ids?.length ? asig.territorio_ids : (asig.territorio_id ? [asig.territorio_id] : []);
      if (ids.length > 0) inicial[key] = ids;
      if (asig.punto_encuentro_id) inicialPuntos[key] = asig.punto_encuentro_id;
    });
    setTerritoriosPorGrupo(inicial);
    setPuntoPorGrupo(inicialPuntos);
  }, [asignacionesIniciales]);

  const handleTerritorioToggle = (key: string, territorioId: string) => {
    setTerritoriosPorGrupo((prev) => {
      const current = prev[key] || [];
      if (current.includes(territorioId)) {
        return { ...prev, [key]: current.filter((id) => id !== territorioId) };
      }
      return { ...prev, [key]: [...current, territorioId] };
    });
  };

  const handlePuntoChange = (key: string, puntoId: string) => {
    setPuntoPorGrupo((prev) => ({ ...prev, [key]: puntoId === "none" ? "" : puntoId }));
  };

  const handleSubmit = () => {
    const asignaciones: AsignacionGrupo[] = gruposCombinados
      .filter((item) => territoriosPorGrupo[item.key]?.length > 0 || puntoPorGrupo[item.key])
      .map((item, index) => {
        const base: AsignacionGrupo = {
          grupo_id: item.esFicticio ? "" : item.id,
          territorio_id: territoriosPorGrupo[item.key]?.[0] || "",
          territorio_ids: territoriosPorGrupo[item.key] || [],
          salida_index: index,
          punto_encuentro_id: puntoPorGrupo[item.key] || undefined,
        };
        if (item.esFicticio) {
          base.grupo_ficticio_id = item.id;
          base.grupo_ficticio_nombre = item.nombre;
        }
        return base;
      });
    onSubmit(asignaciones);
  };

  const getTerritoriosDisplay = (key: string): string => {
    const ids = territoriosPorGrupo[key] || [];
    if (ids.length === 0) return "Seleccionar...";
    const numeros = ids.map((id) => territorios.find((t) => t.id === id)?.numero).filter((n): n is string => !!n);
    const ordenados = sortTerritorioNumeros(numeros);
    if (ordenados.length <= 3) return ordenados.join(", ");
    return `${ordenados.length} territorios`;
  };

  const puntosActivos = puntos.filter((p) => p.activo);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className={cn("grid gap-x-3 gap-y-2 items-center", mostrarSalida ? "grid-cols-[auto_1fr_1fr]" : "grid-cols-[auto_1fr]")}>
          <span className="text-xs font-semibold text-muted-foreground">GRUPO</span>
          {mostrarSalida && <span className="text-xs font-semibold text-muted-foreground">SALIDA</span>}
          <span className="text-xs font-semibold text-muted-foreground">TERRITORIO(S)</span>

          {gruposCombinados.map((item) => {
            const selectedIds = territoriosPorGrupo[item.key] || [];
            const territoriosFiltrados = getTerritoriosFiltradosParaGrupo(item);
            const puntoSeleccionado = puntoPorGrupo[item.key] || "";

            return (
              <div key={item.key} className="contents">
                <span className="text-sm font-medium flex items-center gap-1">
                  {item.label}:
                  {item.esFicticio && (
                    <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">Ficticio</Badge>
                  )}
                </span>

                {mostrarSalida && (
                  <Select value={puntoSeleccionado || "none"} onValueChange={(val) => handlePuntoChange(item.key, val)}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Sin salida" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border shadow-lg z-[100]">
                      <SelectItem value="none">Sin salida</SelectItem>
                      {[...puntosActivos].sort((a, b) => (a.numero_salida || 999) - (b.numero_salida || 999)).map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.numero_salida ? `${p.numero_salida}. ${p.nombre}` : p.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <div className="space-y-1">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="h-8 w-full justify-between font-normal text-left">
                        <span className="truncate">{getTerritoriosDisplay(item.key)}</span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      showOverlay={false}
                      className="w-[var(--radix-popover-trigger-width)] min-w-[220px] max-h-[320px] overflow-hidden p-0 bg-popover border shadow-lg z-[100]"
                      align="start"
                    >
                      <Command className="max-h-[320px]">
                        <CommandInput placeholder="Buscar..." className="h-8" />
                        <CommandList className="h-[260px] max-h-[260px] overflow-y-auto overscroll-contain">
                          <CommandEmpty>No encontrado.</CommandEmpty>
                          <CommandGroup>
                            {territoriosFiltrados.map((t) => (
                              <CommandItem
                                key={t.id}
                                value={`${t.numero} ${t.nombre || ""}`}
                                onSelect={() => handleTerritorioToggle(item.key, t.id)}
                              >
                                <Check className={cn("mr-2 h-4 w-4", selectedIds.includes(t.id) ? "opacity-100" : "opacity-0")} />
                                {t.numero} {t.nombre && `- ${t.nombre}`}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {selectedIds.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {sortTerritorioNumeros(selectedIds.map((id) => territorios.find((t) => t.id === id)?.numero)).map((numero) => {
                        const t = territorios.find((ter) => ter.numero === numero);
                        return t ? (
                          <Badge key={t.id} variant="secondary" className="text-xs">
                            {t.numero}
                            <button type="button" className="ml-1 hover:text-destructive" onClick={() => handleTerritorioToggle(item.key, t.id)}>
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <DialogClose asChild>
          <Button type="button" size="sm" variant="outline" className="flex-1">
            <X className="h-4 w-4 mr-1" />
            Cancelar
          </Button>
        </DialogClose>
        <Button size="sm" className="flex-1" onClick={handleSubmit} disabled={isLoading}>
          <Check className="h-4 w-4 mr-1" />
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
