import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ParticipanteSelector } from "./ParticipanteSelector";
import { extraerMinutosDeTitulo } from "./DuracionInput";
import { esNecesidadesCongregacion } from "@/lib/vida-ministerio-historial";
import type { VidaCristianaParte } from "@/types/vida-ministerio";

interface Props {
  value: VidaCristianaParte[];
  onChange: (next: VidaCristianaParte[]) => void;
  disabled?: boolean;
  showErrors?: boolean;
  fechaPrograma?: string;
}

const MAX = 3;

function nuevo(): VidaCristianaParte {
  return { id: crypto.randomUUID(), titulo: "", participante_id: null };
}

export function VidaCristianaRepeater({ value, onChange, disabled, showErrors, fechaPrograma }: Props) {
  const update = (idx: number, partial: Partial<VidaCristianaParte>) => {
    onChange(value.map((p, i) => (i === idx ? { ...p, ...partial } : p)));
  };
  const remove = (idx: number) => onChange(value.filter((_, i) => i !== idx));
  const add = () => {
    if (value.length >= MAX) return;
    onChange([...value, nuevo()]);
  };

  return (
    <div className="space-y-3">
      {showErrors && value.length === 0 && (
        <div className="text-xs text-destructive font-medium">
          * Agrega al menos una parte de Vida Cristiana.
        </div>
      )}
      {value.map((p, idx) => {
        const tituloMissing = showErrors && !p.titulo.trim();
        const asignadoMissing = showErrors && !p.participante_id;
        return (
        <div key={p.id} className="border rounded-md p-3 space-y-3 bg-muted/30">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-primary">Parte {idx + 1}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => remove(idx)}
              disabled={disabled}
              className="h-7 w-7 text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className={`text-xs ${tituloMissing ? "text-destructive" : ""}`}>
                Título de la parte{tituloMissing && <span className="ml-1">*</span>}
              </Label>
              <Input
                value={p.titulo}
                onChange={(e) => {
                  const titulo = e.target.value;
                  const mins = p.duracion ?? extraerMinutosDeTitulo(titulo);
                  update(idx, { titulo, duracion: mins });
                }}
                disabled={disabled}
                placeholder="Ej: ¿Cómo dar buenos consejos?"
                className={tituloMissing ? "border-destructive focus-visible:ring-destructive" : ""}
              />
            </div>
            <div className="space-y-1">
              <Label className={`text-xs ${asignadoMissing ? "text-destructive" : ""}`}>
                Asignado{asignadoMissing && <span className="ml-1">*</span>}
              </Label>
              <ParticipanteSelector
                value={p.participante_id}
                onChange={(v) => update(idx, { participante_id: v })}
                filtro="anciano_o_sm"
                respetarSmHabilitado
                disabled={disabled}
                className={asignadoMissing ? "border-destructive ring-1 ring-destructive" : ""}
                categoria={esNecesidadesCongregacion(p.titulo) ? "necesidades_congregacion" : "vida_cristiana"}
                fechaPrograma={fechaPrograma}
              />
            </div>
          </div>
        </div>
        );
      })}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={add}
        disabled={disabled || value.length >= MAX}
        className="gap-1"
      >
        <Plus className="h-4 w-4" />
        Agregar parte ({value.length}/{MAX})
      </Button>
    </div>
  );
}
