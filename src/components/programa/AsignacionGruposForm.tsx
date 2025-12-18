import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, X, Users, Plus, Trash2 } from "lucide-react";
import { Territorio, AsignacionGrupo } from "@/types/programa-predicacion";
import { GrupoPredicacion } from "@/hooks/useGruposPredicacion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";

interface AsignacionGruposFormProps {
  grupos: GrupoPredicacion[];
  territorios: Territorio[];
  asignacionesIniciales?: AsignacionGrupo[];
  onSubmit: (asignaciones: AsignacionGrupo[]) => void;
  onCancel: () => void;
  isLoading?: boolean;
  submitLabel?: string;
}

interface LineaAsignacion {
  id: string;
  grupoIds: string[];
  territorioId: string | null;
}

export function AsignacionGruposForm({
  grupos,
  territorios,
  asignacionesIniciales = [],
  onSubmit,
  onCancel,
  isLoading,
  submitLabel = "Guardar",
}: AsignacionGruposFormProps) {
  const [lineas, setLineas] = useState<LineaAsignacion[]>([]);

  useEffect(() => {
    // Agrupar asignaciones iniciales por territorio
    const porTerritorio: Record<string, string[]> = {};
    const sinTerritorio: string[] = [];
    
    asignacionesIniciales.forEach((a) => {
      if (a.territorio_id) {
        if (!porTerritorio[a.territorio_id]) {
          porTerritorio[a.territorio_id] = [];
        }
        porTerritorio[a.territorio_id].push(a.grupo_id);
      } else {
        sinTerritorio.push(a.grupo_id);
      }
    });

    const lineasIniciales: LineaAsignacion[] = Object.entries(porTerritorio).map(([territorioId, grupoIds], idx) => ({
      id: `linea-${idx}`,
      grupoIds,
      territorioId
    }));

    // Si hay grupos sin territorio, agregar una línea para ellos
    if (sinTerritorio.length > 0) {
      lineasIniciales.push({
        id: `linea-sin-terr`,
        grupoIds: sinTerritorio,
        territorioId: null
      });
    }

    // Si no hay lineas, crear una vacía
    if (lineasIniciales.length === 0) {
      lineasIniciales.push({
        id: `linea-0`,
        grupoIds: [],
        territorioId: null
      });
    }

    setLineas(lineasIniciales);
  }, [asignacionesIniciales]);

  const agregarLinea = () => {
    setLineas(prev => [...prev, {
      id: `linea-${Date.now()}`,
      grupoIds: [],
      territorioId: null
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

  const setTerritorioEnLinea = (lineaId: string, territorioId: string | null) => {
    setLineas(prev => prev.map(linea => 
      linea.id === lineaId 
        ? { ...linea, territorioId } 
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
    lineas.forEach(linea => {
      linea.grupoIds.forEach(grupoId => {
        asignacionesArray.push({
          grupo_id: grupoId,
          territorio_id: linea.territorioId || ""
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
        Agrupa los grupos que salen juntos y asigna un territorio opcional.
      </p>

      <ScrollArea className="h-[320px] pr-2">
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

                <Select
                  value={linea.territorioId || "none"}
                  onValueChange={(value) => setTerritorioEnLinea(linea.id, value === "none" ? null : value)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Territorio (opcional)" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border shadow-lg z-[100]">
                    <SelectItem value="none">Sin territorio</SelectItem>
                    {territorios.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        Terr. {t.numero} {t.nombre && `- ${t.nombre}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {linea.grupoIds.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    Grupos: {linea.grupoIds
                      .map(id => grupos.find(g => g.id === id)?.numero)
                      .sort((a, b) => (a || 0) - (b || 0))
                      .join(" - ")}
                    {linea.territorioId && (() => {
                      const terr = territorios.find(t => t.id === linea.territorioId);
                      return terr ? ` → Terr. ${terr.numero}` : "";
                    })()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>

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
        <Button
          size="sm"
          variant="outline"
          className="flex-1"
          onClick={onCancel}
        >
          <X className="h-4 w-4 mr-1" />
          Cancelar
        </Button>
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