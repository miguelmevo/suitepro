import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ParticipanteSelector } from "./ParticipanteSelector";
import { DuracionInput, extraerMinutosDeTitulo } from "./DuracionInput";
import type { VidaCristianaParte } from "@/types/vida-ministerio";

interface Props {
  value: VidaCristianaParte[];
  onChange: (next: VidaCristianaParte[]) => void;
  disabled?: boolean;
}

const MAX = 3;

function nuevo(): VidaCristianaParte {
  return { id: crypto.randomUUID(), titulo: "", participante_id: null };
}

export function VidaCristianaRepeater({ value, onChange, disabled }: Props) {
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
      {value.map((p, idx) => (
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

          <div className="grid grid-cols-1 md:grid-cols-[1fr_80px_minmax(0,1fr)] gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Título de la parte</Label>
              <Input
                value={p.titulo}
                onChange={(e) => {
                  const titulo = e.target.value;
                  const mins = p.duracion ?? extraerMinutosDeTitulo(titulo);
                  update(idx, { titulo, duracion: mins });
                }}
                disabled={disabled}
                placeholder="Ej: ¿Cómo dar buenos consejos?"
              />
            </div>
            <DuracionInput
              value={p.duracion}
              onChange={(v) => update(idx, { duracion: v })}
              disabled={disabled}
            />
            <div className="space-y-1">
              <Label className="text-xs">Asignado</Label>
              <ParticipanteSelector
                value={p.participante_id}
                onChange={(v) => update(idx, { participante_id: v })}
                filtro="anciano_o_sm"
                disabled={disabled}
              />
            </div>
          </div>
        </div>
      ))}

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
