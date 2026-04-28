import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
      {value.map((m, idx) => {
        const esDiscurso = m.tipo === "discurso";
        return (
          <div key={m.id} className="border rounded-md p-3 space-y-3 bg-muted/30">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-primary">Discurso nro. {idx + 1}</span>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Label htmlFor={`tipo-${m.id}`} className="text-xs cursor-pointer">
                    Discurso
                  </Label>
                  <Switch
                    id={`tipo-${m.id}`}
                    checked={esDiscurso}
                    onCheckedChange={(checked) =>
                      update(idx, {
                        tipo: checked ? "discurso" : "demostracion",
                        ayudante_id: checked ? null : m.ayudante_id,
                      })
                    }
                    disabled={disabled}
                  />
                </div>
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
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Título / referencia</Label>
                <Input
                  value={m.titulo}
                  onChange={(e) => update(idx, { titulo: e.target.value })}
                  disabled={disabled}
                  placeholder="Ej: Empiece conversaciones — vea ayuda"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Titular</Label>
                <ParticipanteSelector
                  value={m.titular_id}
                  onChange={(v) => update(idx, { titular_id: v })}
                  filtro="publicador"
                  disabled={disabled}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{esDiscurso ? "Discursante" : "Ayudante"}</Label>
                {esDiscurso ? (
                  <Input value="" disabled placeholder="—" />
                ) : (
                  <ParticipanteSelector
                    value={m.ayudante_id}
                    onChange={(v) => update(idx, { ayudante_id: v })}
                    filtro="publicador"
                    disabled={disabled}
                  />
                )}
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
        Agregar discurso ({value.length}/{MAX})
      </Button>
    </div>
  );
}
