import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ParticipanteSelector } from "./ParticipanteSelector";
import type { MaestroDiscurso } from "@/types/vida-ministerio";

interface Props {
  value: MaestroDiscurso[];
  onChange: (next: MaestroDiscurso[]) => void;
  disabled?: boolean;
}

const MAX = 4;

function nuevo(): MaestroDiscurso {
  return {
    id: crypto.randomUUID(),
    titulo: "",
    tipo: "demostracion",
    titular_id: null,
    ayudante_id: null,
  };
}

export function MaestrosRepeater({ value, onChange, disabled }: Props) {
  const update = (idx: number, partial: Partial<MaestroDiscurso>) => {
    const next = value.map((m, i) => (i === idx ? { ...m, ...partial } : m));
    onChange(next);
  };
  const remove = (idx: number) => onChange(value.filter((_, i) => i !== idx));
  const add = () => {
    if (value.length >= MAX) return;
    onChange([...value, nuevo()]);
  };

  return (
    <div className="space-y-3">
      {value.map((m, idx) => (
        <div key={m.id} className="border rounded-md p-3 space-y-3 bg-muted/30">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-primary">Discurso {idx + 1}</span>
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2 space-y-1">
              <Label className="text-xs">Título / referencia</Label>
              <Input
                value={m.titulo}
                onChange={(e) => update(idx, { titulo: e.target.value })}
                disabled={disabled}
                placeholder="Ej: Empiece conversaciones — vea ayuda"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tipo</Label>
              <Select
                value={m.tipo}
                onValueChange={(v) =>
                  update(idx, {
                    tipo: v as MaestroDiscurso["tipo"],
                    ayudante_id: v === "discurso" ? null : m.ayudante_id,
                  })
                }
                disabled={disabled}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="demostracion">Demostración</SelectItem>
                  <SelectItem value="discurso">Discurso</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Titular</Label>
              <ParticipanteSelector
                value={m.titular_id}
                onChange={(v) => update(idx, { titular_id: v })}
                filtro="publicador"
                disabled={disabled}
              />
            </div>
            {m.tipo === "demostracion" && (
              <div className="space-y-1">
                <Label className="text-xs">Ayudante</Label>
                <ParticipanteSelector
                  value={m.ayudante_id}
                  onChange={(v) => update(idx, { ayudante_id: v })}
                  filtro="publicador"
                  disabled={disabled}
                />
              </div>
            )}
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
        Agregar discurso ({value.length}/{MAX})
      </Button>
    </div>
  );
}
