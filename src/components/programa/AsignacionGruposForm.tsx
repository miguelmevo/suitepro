import { useState, useEffect } from "react";
import { DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, X, Users, Plus, Trash2, ChevronsUpDown } from "lucide-react";
import { Territorio, AsignacionGrupo, PuntoEncuentro } from "@/types/programa-predicacion";
import { GrupoPredicacion } from "@/hooks/useGruposPredicacion";
import { Participante } from "@/types/grupos-servicio";

import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { sortTerritorioNumeros } from "@/lib/sorting";

interface AsignacionGruposFormProps {
  grupos: GrupoPredicacion[];
  territorios: Territorio[];
  participantes: Participante[];
  puntosEncuentro: PuntoEncuentro[];
  asignacionesIniciales?: AsignacionGrupo[];
  onSubmit: (asignaciones: AsignacionGrupo[]) => void;
  onCancel: () => void;
  isLoading?: boolean;
  submitLabel?: string;
}

interface LineaAsignacion {
  id: string;
  grupoIds: string[];
  territorioIds: string[];
  capitanId: string | null;
  puntoEncuentroId: string | null;
}

export function AsignacionGruposForm({
  grupos,
  territorios,
  participantes,
  puntosEncuentro,
  asignacionesIniciales = [],
  onSubmit,
  onCancel,
  isLoading,
  submitLabel = "Guardar",
}: AsignacionGruposFormProps) {
  const [lineas, setLineas] = useState<LineaAsignacion[]>([]);

  // Función para obtener territorios filtrados por los grupos seleccionados en una línea
  const getTerritoriosFiltradosParaLinea = (grupoIds: string[]): Territorio[] => {
    if (grupoIds.length === 0) {
      // Sin grupos seleccionados, mostrar todos
      return [...territorios].sort((a, b) => {
        const numA = parseInt(a.numero, 10);
        const numB = parseInt(b.numero, 10);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.numero.localeCompare(b.numero);
      });
    }

    // Buscar territorios asignados a cualquiera de los grupos seleccionados
    const territoriosDeGrupos = territorios.filter(t => 
      t.grupo_predicacion_id && grupoIds.includes(t.grupo_predicacion_id)
    );

    // Si no hay territorios asignados a ninguno de los grupos, mostrar todos
    if (territoriosDeGrupos.length === 0) {
      return [...territorios].sort((a, b) => {
        const numA = parseInt(a.numero, 10);
        const numB = parseInt(b.numero, 10);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.numero.localeCompare(b.numero);
      });
    }

    // Si hay territorios asignados, mostrar solo la unión de territorios de los grupos
    return territoriosDeGrupos.sort((a, b) => {
      const numA = parseInt(a.numero, 10);
      const numB = parseInt(b.numero, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.numero.localeCompare(b.numero);
    });
  };

  // Helper para mostrar los territorios seleccionados
  const getTerritoriosDisplay = (territorioIds: string[]): string => {
    if (territorioIds.length === 0) return "Seleccionar territorios...";
    
    const numeros = territorioIds
      .map(id => territorios.find(t => t.id === id)?.numero)
      .filter((n): n is string => !!n);
    
    const ordenados = sortTerritorioNumeros(numeros);
    
    if (ordenados.length <= 3) {
      return ordenados.join(", ");
    }
    return `${ordenados.length} territorios`;
  };

  useEffect(() => {
    // Agrupar asignaciones iniciales por salida_index
    const porSalida: Record<number, { grupoIds: string[]; territorioIds: string[]; capitanId: string | null; puntoEncuentroId: string | null }> = {};
    
    asignacionesIniciales.forEach((a) => {
      const salidaIdx = a.salida_index ?? 0;
      if (!porSalida[salidaIdx]) {
        porSalida[salidaIdx] = { grupoIds: [], territorioIds: [], capitanId: null, puntoEncuentroId: null };
      }
      porSalida[salidaIdx].grupoIds.push(a.grupo_id);
      // Soportar territorio_ids o territorio_id
      if (a.territorio_ids && a.territorio_ids.length > 0) {
        a.territorio_ids.forEach(tid => {
          if (!porSalida[salidaIdx].territorioIds.includes(tid)) {
            porSalida[salidaIdx].territorioIds.push(tid);
          }
        });
      } else if (a.territorio_id && !porSalida[salidaIdx].territorioIds.includes(a.territorio_id)) {
        porSalida[salidaIdx].territorioIds.push(a.territorio_id);
      }
      if (a.capitan_id) {
        porSalida[salidaIdx].capitanId = a.capitan_id;
      }
      if (a.punto_encuentro_id) {
        porSalida[salidaIdx].puntoEncuentroId = a.punto_encuentro_id;
      }
    });

    const lineasIniciales: LineaAsignacion[] = Object.entries(porSalida)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .map(([idx, data]) => ({
        id: `linea-${idx}`,
        grupoIds: data.grupoIds,
        territorioIds: data.territorioIds,
        capitanId: data.capitanId,
        puntoEncuentroId: data.puntoEncuentroId
      }));

    // Si no hay lineas, crear una vacía
    if (lineasIniciales.length === 0) {
      lineasIniciales.push({
        id: `linea-0`,
        grupoIds: [],
        territorioIds: [],
        capitanId: null,
        puntoEncuentroId: null
      });
    }

    setLineas(lineasIniciales);
  }, [asignacionesIniciales]);

  const agregarLinea = () => {
    setLineas(prev => [...prev, {
      id: `linea-${Date.now()}`,
      grupoIds: [],
      territorioIds: [],
      capitanId: null,
      puntoEncuentroId: null
    }]);
  };

  const eliminarLinea = (lineaId: string) => {
    setLineas(prev => prev.filter(l => l.id !== lineaId));
  };

  const toggleGrupoEnLinea = (lineaId: string, grupoId: string) => {
    setLineas(prev => prev.map(linea => {
      if (linea.id !== lineaId) {
        // Quitar el grupo de otras líneas si está
        return {
          ...linea,
          grupoIds: linea.grupoIds.filter(id => id !== grupoId)
        };
      }
      // Toggle en la línea actual
      const existe = linea.grupoIds.includes(grupoId);
      return {
        ...linea,
        grupoIds: existe 
          ? linea.grupoIds.filter(id => id !== grupoId)
          : [...linea.grupoIds, grupoId]
      };
    }));
  };

  const toggleTerritorioEnLinea = (lineaId: string, territorioId: string) => {
    setLineas(prev => prev.map(linea => {
      if (linea.id !== lineaId) return linea;
      const existe = linea.territorioIds.includes(territorioId);
      return {
        ...linea,
        territorioIds: existe
          ? linea.territorioIds.filter(id => id !== territorioId)
          : [...linea.territorioIds, territorioId]
      };
    }));
  };

  const setCapitanEnLinea = (lineaId: string, capitanId: string | null) => {
    setLineas(prev => prev.map(linea => 
      linea.id === lineaId 
        ? { ...linea, capitanId } 
        : linea
    ));
  };

  const setPuntoEncuentroEnLinea = (lineaId: string, puntoEncuentroId: string | null) => {
    setLineas(prev => prev.map(linea => 
      linea.id === lineaId 
        ? { ...linea, puntoEncuentroId } 
        : linea
    ));
  };

  const getGruposAsignadosEnOtrasLineas = (lineaId: string): Set<string> => {
    const asignados = new Set<string>();
    lineas.forEach(linea => {
      if (linea.id !== lineaId) {
        linea.grupoIds.forEach(id => asignados.add(id));
      }
    });
    return asignados;
  };

  const handleSubmit = () => {
    const asignacionesArray: AsignacionGrupo[] = [];
    lineas.forEach((linea, index) => {
      linea.grupoIds.forEach(grupoId => {
        asignacionesArray.push({
          grupo_id: grupoId,
          territorio_id: linea.territorioIds[0] || "",
          territorio_ids: linea.territorioIds,
          salida_index: index,
          capitan_id: linea.capitanId || undefined,
          punto_encuentro_id: linea.puntoEncuentroId || undefined
        });
      });
    });
    onSubmit(asignacionesArray.filter(a => a.grupo_id));
  };

  const totalGruposAsignados = lineas.reduce((sum, l) => sum + l.grupoIds.length, 0);

  return (
    <div className="space-y-3">
      <div className="font-medium text-sm border-b pb-2 flex items-center gap-2">
        <Users className="h-4 w-4" />
        <span>Asignar grupos por salida</span>
      </div>

      <p className="text-xs text-muted-foreground">
        Agrupa los grupos que salen juntos, asigna territorios y capitán.
      </p>

      <div className="max-h-[50vh] overflow-y-auto pr-2">
        <div className="space-y-4">
          {lineas.map((linea, index) => {
            const gruposEnOtras = getGruposAsignadosEnOtrasLineas(linea.id);
            
            return (
              <div key={linea.id} className="border rounded-md p-3 space-y-2 bg-muted/30">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    Salida {index + 1}
                  </span>
                  {lineas.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                      onClick={() => eliminarLinea(linea.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>

                {/* Selección de grupos */}
                <div className="flex flex-wrap gap-1">
                  {grupos.map((grupo) => {
                    const estaEnEstaLinea = linea.grupoIds.includes(grupo.id);
                    const estaEnOtraLinea = gruposEnOtras.has(grupo.id);
                    
                    return (
                      <label
                        key={grupo.id}
                        className={`
                          flex items-center gap-1 px-2 py-1 rounded text-xs cursor-pointer border transition-colors
                          ${estaEnEstaLinea 
                            ? 'bg-primary text-primary-foreground border-primary' 
                            : estaEnOtraLinea
                              ? 'bg-muted/50 text-muted-foreground border-transparent opacity-40 cursor-not-allowed'
                              : 'bg-background hover:bg-muted border-border'
                          }
                        `}
                      >
                        <Checkbox
                          checked={estaEnEstaLinea}
                          onCheckedChange={() => !estaEnOtraLinea && toggleGrupoEnLinea(linea.id, grupo.id)}
                          disabled={estaEnOtraLinea}
                          className="h-3 w-3 hidden"
                        />
                        G{grupo.numero}
                      </label>
                    );
                  })}
                </div>

                {/* Punto de Encuentro - solo si hay 2+ grupos seleccionados */}
                {linea.grupoIds.length >= 2 && (
                  <Select
                    value={linea.puntoEncuentroId || "none"}
                    onValueChange={(value) => setPuntoEncuentroEnLinea(linea.id, value === "none" ? null : value)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Punto de Encuentro" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border shadow-lg z-[100]">
                      <SelectItem value="none">Sin punto de encuentro</SelectItem>
                      {puntosEncuentro.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {/* Selección múltiple de territorios con combo */}
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Territorios (selecciona uno o más):</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="h-8 w-full justify-between font-normal text-xs"
                      >
                        <span className="truncate">{getTerritoriosDisplay(linea.territorioIds)}</span>
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
                            {getTerritoriosFiltradosParaLinea(linea.grupoIds).map((t) => (
                              <CommandItem
                                key={t.id}
                                value={`${t.numero} ${t.nombre || ""}`}
                                onSelect={() => toggleTerritorioEnLinea(linea.id, t.id)}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    linea.territorioIds.includes(t.id) ? "opacity-100" : "opacity-0"
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
                  {linea.territorioIds.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {sortTerritorioNumeros(
                        linea.territorioIds.map(id => territorios.find(t => t.id === id)?.numero)
                      ).map(numero => {
                        const t = territorios.find(ter => ter.numero === numero);
                        return t ? (
                          <Badge key={t.id} variant="secondary" className="text-xs">
                            {t.numero}
                            <button
                              type="button"
                              className="ml-1 hover:text-destructive"
                              onClick={() => toggleTerritorioEnLinea(linea.id, t.id)}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>

                {/* Capitán */}
                <Select
                  value={linea.capitanId || "none"}
                  onValueChange={(value) => setCapitanEnLinea(linea.id, value === "none" ? null : value)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Capitán" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border shadow-lg z-[100]">
                    <SelectItem value="none">Sin capitán</SelectItem>
                    {[...participantes].sort((a, b) => {
                      const apellidoCompare = (a.apellido || "").localeCompare(b.apellido || "");
                      if (apellidoCompare !== 0) return apellidoCompare;
                      return (a.nombre || "").localeCompare(b.nombre || "");
                    }).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.apellido}, {p.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Resumen de la línea */}
                {linea.grupoIds.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    G{linea.grupoIds
                      .map(id => grupos.find(g => g.id === id)?.numero)
                      .sort((a, b) => (a || 0) - (b || 0))
                      .join(" - ")}
                    {linea.territorioIds.length > 0 && `: ${linea.territorioIds
                      .map(id => territorios.find(t => t.id === id)?.numero)
                      .filter((n): n is string => !!n)
                      .sort((a, b) => {
                        const numA = parseInt(a, 10);
                        const numB = parseInt(b, 10);
                        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                        return a.localeCompare(b);
                      })
                      .join(", ")}`}
                    {linea.capitanId && (() => {
                      const cap = participantes.find(p => p.id === linea.capitanId);
                      return cap ? ` - ${cap.apellido}, ${cap.nombre}` : "";
                    })()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full"
        onClick={agregarLinea}
      >
        <Plus className="h-4 w-4 mr-1" />
        Agregar otra salida
      </Button>

      <div className="text-xs text-muted-foreground text-center">
        {totalGruposAsignados} grupo(s) asignados
      </div>

      <div className="flex gap-2 pt-2">
        <DialogClose asChild>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="flex-1"
          >
            <X className="h-4 w-4 mr-1" />
            Cancelar
          </Button>
        </DialogClose>
        <Button
          size="sm"
          className="flex-1"
          onClick={handleSubmit}
          disabled={isLoading}
        >
          <Check className="h-4 w-4 mr-1" />
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
