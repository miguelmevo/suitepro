import { useState, useEffect } from "react";
import { DialogClose } from "@/components/ui/dialog";
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
  const [territoriosPorGrupo, setTerritoriosPorGrupo] = useState<Record<string, string[]>>({});
  const [puntoPorGrupo, setPuntoPorGrupo] = useState<Record<string, string>>({});

  const getTerritoriosFiltradosParaGrupo = (grupoId: string): Territorio[] => {
    const territoriosDelGrupo = territorios.filter(t => t.grupo_predicacion_id === grupoId);
    const lista = territoriosDelGrupo.length === 0 ? [...territorios] : territoriosDelGrupo;
    return lista.sort((a, b) => {
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
      const ids = asig.territorio_ids?.length ? asig.territorio_ids : (asig.territorio_id ? [asig.territorio_id] : []);
      if (ids.length > 0) {
        inicial[asig.grupo_id] = ids;
      }
      if (asig.punto_encuentro_id) {
        inicialPuntos[asig.grupo_id] = asig.punto_encuentro_id;
      }
    });
    setTerritoriosPorGrupo(inicial);
    setPuntoPorGrupo(inicialPuntos);
  }, [asignacionesIniciales]);

  const handleTerritorioToggle = (grupoId: string, territorioId: string) => {
    setTerritoriosPorGrupo((prev) => {
      const current = prev[grupoId] || [];
      if (current.includes(territorioId)) {
        return { ...prev, [grupoId]: current.filter(id => id !== territorioId) };
      } else {
        return { ...prev, [grupoId]: [...current, territorioId] };
      }
    });
  };

  const handlePuntoChange = (grupoId: string, puntoId: string) => {
    setPuntoPorGrupo((prev) => ({
      ...prev,
      [grupoId]: puntoId === "none" ? "" : puntoId,
    }));
  };

  const handleSubmit = () => {
    const asignaciones: AsignacionGrupo[] = grupos
      .filter((grupo) => territoriosPorGrupo[grupo.id]?.length > 0 || puntoPorGrupo[grupo.id])
      .map((grupo, index) => ({
        grupo_id: grupo.id,
        territorio_id: territoriosPorGrupo[grupo.id]?.[0] || "",
        territorio_ids: territoriosPorGrupo[grupo.id] || [],
        salida_index: index,
        punto_encuentro_id: puntoPorGrupo[grupo.id] || undefined,
      }));
    onSubmit(asignaciones);
  };

  const getTerritoriosDisplay = (grupoId: string): string => {
    const ids = territoriosPorGrupo[grupoId] || [];
    if (ids.length === 0) return "Seleccionar...";
    const numeros = ids
      .map(id => territorios.find(t => t.id === id)?.numero)
      .filter((n): n is string => !!n);
    const ordenados = sortTerritorioNumeros(numeros);
    if (ordenados.length <= 3) return ordenados.join(", ");
    return `${ordenados.length} territorios`;
  };

  const puntosActivos = puntos.filter(p => p.activo);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="grid grid-cols-[auto_1fr_1fr] gap-x-3 gap-y-2 items-center">
          <span className="text-xs font-semibold text-muted-foreground">GRUPO</span>
          <span className="text-xs font-semibold text-muted-foreground">SALIDA</span>
          <span className="text-xs font-semibold text-muted-foreground">TERRITORIO(S)</span>
          
          {grupos.map((grupo) => {
            const selectedIds = territoriosPorGrupo[grupo.id] || [];
            const territoriosFiltrados = getTerritoriosFiltradosParaGrupo(grupo.id);
            const puntoSeleccionado = puntoPorGrupo[grupo.id] || "";
            
            return (
              <div key={grupo.id} className="contents">
                <span className="text-sm font-medium">
                  G{grupo.numero}:
                </span>
                
                {/* Punto de encuentro selector */}
                <Select value={puntoSeleccionado || "none"} onValueChange={(val) => handlePuntoChange(grupo.id, val)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Sin salida" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border shadow-lg z-[100]">
                    <SelectItem value="none">Sin salida</SelectItem>
                    {puntosActivos.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.numero_salida ? `Salida ${p.numero_salida}` : p.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Territorio selector */}
                <div className="space-y-1">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="h-8 w-full justify-between font-normal text-left"
                      >
                        <span className="truncate">{getTerritoriosDisplay(grupo.id)}</span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      showOverlay={false}
                      className="w-[200px] p-0 bg-popover border shadow-lg z-[100]"
                      align="start"
                    >
                      <Command>
                        <CommandInput placeholder="Buscar..." className="h-8" />
                        <CommandList className="max-h-[200px] overflow-y-auto">
                          <CommandEmpty>No encontrado.</CommandEmpty>
                          <CommandGroup>
                            {territoriosFiltrados.map((t) => (
                              <CommandItem
                                key={t.id}
                                value={`${t.numero} ${t.nombre || ""}`}
                                onSelect={() => handleTerritorioToggle(grupo.id, t.id)}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedIds.includes(t.id) ? "opacity-100" : "opacity-0"
                                  )}
                                />
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
                      {sortTerritorioNumeros(
                        selectedIds.map(id => territorios.find(t => t.id === id)?.numero)
                      ).map(numero => {
                        const t = territorios.find(ter => ter.numero === numero);
                        return t ? (
                          <Badge key={t.id} variant="secondary" className="text-xs">
                            {t.numero}
                            <button
                              type="button"
                              className="ml-1 hover:text-destructive"
                              onClick={() => handleTerritorioToggle(grupo.id, t.id)}
                            >
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
