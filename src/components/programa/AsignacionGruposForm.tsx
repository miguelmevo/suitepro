import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, X, Users } from "lucide-react";
import { Territorio, AsignacionGrupo } from "@/types/programa-predicacion";
import { GrupoPredicacion } from "@/hooks/useGruposPredicacion";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AsignacionGruposFormProps {
  grupos: GrupoPredicacion[];
  territorios: Territorio[];
  asignacionesIniciales?: AsignacionGrupo[];
  onSubmit: (asignaciones: AsignacionGrupo[]) => void;
  onCancel: () => void;
  isLoading?: boolean;
  submitLabel?: string;
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
  const [asignaciones, setAsignaciones] = useState<Record<string, string>>({});

  useEffect(() => {
    // Inicializar con asignaciones existentes
    const inicial: Record<string, string> = {};
    asignacionesIniciales.forEach((a) => {
      inicial[a.grupo_id] = a.territorio_id;
    });
    setAsignaciones(inicial);
  }, [asignacionesIniciales]);

  const handleTerritorioChange = (grupoId: string, territorioId: string) => {
    setAsignaciones((prev) => {
      if (territorioId === "none") {
        const newAsig = { ...prev };
        delete newAsig[grupoId];
        return newAsig;
      }
      return { ...prev, [grupoId]: territorioId };
    });
  };

  const handleSubmit = () => {
    const asignacionesArray: AsignacionGrupo[] = Object.entries(asignaciones)
      .filter(([_, territorioId]) => territorioId)
      .map(([grupo_id, territorio_id]) => ({ grupo_id, territorio_id }));
    onSubmit(asignacionesArray);
  };

  const asignacionesCount = Object.keys(asignaciones).length;

  return (
    <div className="space-y-3">
      <div className="font-medium text-sm border-b pb-2 flex items-center gap-2">
        <Users className="h-4 w-4" />
        <span>Asignar territorios por grupo</span>
      </div>

      <p className="text-xs text-muted-foreground">
        Selecciona el territorio que trabajará cada grupo de predicación.
      </p>

      <ScrollArea className="h-[280px] pr-3">
        <div className="space-y-2">
          {grupos.map((grupo) => (
            <div key={grupo.id} className="flex items-center gap-2">
              <div className="w-20 text-sm font-medium shrink-0">
                Grupo #{grupo.numero}
              </div>
              <Select
                value={asignaciones[grupo.id] || "none"}
                onValueChange={(value) => handleTerritorioChange(grupo.id, value)}
              >
                <SelectTrigger className="h-8 text-xs flex-1">
                  <SelectValue placeholder="Sin asignar" />
                </SelectTrigger>
                <SelectContent className="bg-popover border shadow-lg z-[100]">
                  <SelectItem value="none">Sin asignar</SelectItem>
                  {territorios.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      Terr. {t.numero} {t.nombre && `- ${t.nombre}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="text-xs text-muted-foreground text-center">
        {asignacionesCount} grupo(s) con territorio asignado
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
          disabled={isLoading || asignacionesCount === 0}
        >
          <Check className="h-4 w-4 mr-1" />
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
