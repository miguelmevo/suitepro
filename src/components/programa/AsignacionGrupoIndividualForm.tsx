import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, X } from "lucide-react";
import { Territorio, AsignacionGrupo } from "@/types/programa-predicacion";
import { GrupoPredicacion } from "@/hooks/useGruposPredicacion";

interface AsignacionGrupoIndividualFormProps {
  grupos: GrupoPredicacion[];
  territorios: Territorio[];
  asignacionesIniciales?: AsignacionGrupo[];
  onSubmit: (asignaciones: AsignacionGrupo[]) => void;
  onCancel: () => void;
  isLoading?: boolean;
  submitLabel: string;
}

export function AsignacionGrupoIndividualForm({
  grupos,
  territorios,
  asignacionesIniciales = [],
  onSubmit,
  onCancel,
  isLoading,
  submitLabel,
}: AsignacionGrupoIndividualFormProps) {
  // Estado para territorio seleccionado por cada grupo
  const [territoriosPorGrupo, setTerritoriosPorGrupo] = useState<Record<string, string>>({});

  useEffect(() => {
    // Inicializar con asignaciones existentes
    const inicial: Record<string, string> = {};
    asignacionesIniciales.forEach((asig) => {
      if (asig.territorio_id) {
        inicial[asig.grupo_id] = asig.territorio_id;
      }
    });
    setTerritoriosPorGrupo(inicial);
  }, [asignacionesIniciales]);

  const handleTerritorioChange = (grupoId: string, territorioId: string) => {
    setTerritoriosPorGrupo((prev) => ({
      ...prev,
      [grupoId]: territorioId === "none" ? "" : territorioId,
    }));
  };

  const handleSubmit = () => {
    const asignaciones: AsignacionGrupo[] = grupos
      .filter((grupo) => territoriosPorGrupo[grupo.id])
      .map((grupo) => ({
        grupo_id: grupo.id,
        territorio_id: territoriosPorGrupo[grupo.id],
      }));
    onSubmit(asignaciones);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 items-center">
          <span className="text-xs font-semibold text-muted-foreground">GRUPO</span>
          <span className="text-xs font-semibold text-muted-foreground">TERRITORIO</span>
          
          {grupos.map((grupo) => (
            <>
              <span key={`label-${grupo.id}`} className="text-sm font-medium">
                G{grupo.numero}:
              </span>
              <Select
                key={`select-${grupo.id}`}
                value={territoriosPorGrupo[grupo.id] || "none"}
                onValueChange={(value) => handleTerritorioChange(grupo.id, value)}
              >
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent className="bg-popover border shadow-lg z-[100]">
                  <SelectItem value="none">Sin asignar</SelectItem>
                  {territorios.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.numero} {t.nombre && `- ${t.nombre}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          ))}
        </div>
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
