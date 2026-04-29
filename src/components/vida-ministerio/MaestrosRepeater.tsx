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
  /** 0 = solo Sala Principal, 1 = + Sala B, 2 = + Sala B y C */
  salasAuxiliares?: number;
}

const MAX = 4;

function nuevo(): MaestroDiscurso {
  return {
    id: crypto.randomUUID(),
    titulo: "",
    tipo: "demostracion",
    titular_id: null,
    ayudante_id: null,
    titular_sala_b_id: null,
    ayudante_sala_b_id: null,
    titular_sala_c_id: null,
    ayudante_sala_c_id: null,
  };
}

export function MaestrosRepeater({ value, onChange, disabled, salasAuxiliares = 0 }: Props) {
  const update = (idx: number, partial: Partial<MaestroDiscurso>) => {
    const next = value.map((m, i) => (i === idx ? { ...m, ...partial } : m));
    onChange(next);
  };
  const remove = (idx: number) => onChange(value.filter((_, i) => i !== idx));
  const add = () => {
    if (value.length >= MAX) return;
    onChange([...value, nuevo()]);
  };

  const renderSalaRow = (
    m: MaestroDiscurso,
    idx: number,
    sala: "principal" | "b" | "c",
    showLabel: boolean
  ) => {
    const esDiscurso = m.tipo === "discurso";
    const labels = {
      principal: "SALA PRINCIPAL",
      b: "SALA AUXILIAR B",
      c: "SALA AUXILIAR C",
    };
    const titularKey =
      sala === "principal" ? "titular_id" : sala === "b" ? "titular_sala_b_id" : "titular_sala_c_id";
    const ayudanteKey =
      sala === "principal" ? "ayudante_id" : sala === "b" ? "ayudante_sala_b_id" : "ayudante_sala_c_id";

    return (
      <div>
        {showLabel && (
          <div className="text-xs font-semibold text-primary mb-2">{labels[sala]}</div>
        )}
        <div className={`grid grid-cols-1 ${esDiscurso ? "md:grid-cols-1" : "md:grid-cols-2"} gap-3`}>
          <div className="space-y-1">
            <Label className="text-xs">{esDiscurso ? "Discursante" : "Estudiante"}</Label>
            <ParticipanteSelector
              value={(m as any)[titularKey] ?? null}
              onChange={(v) => update(idx, { [titularKey]: v } as any)}
              filtro="publicador"
              disabled={disabled}
            />
          </div>
          {!esDiscurso && (
            <div className="space-y-1">
              <Label className="text-xs">Ayudante</Label>
              <ParticipanteSelector
                value={(m as any)[ayudanteKey] ?? null}
                onChange={(v) => update(idx, { [ayudanteKey]: v } as any)}
                filtro="publicador"
                disabled={disabled}
              />
            </div>
          )}
        </div>
      </div>
    );
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
                        ayudante_sala_b_id: checked ? null : m.ayudante_sala_b_id,
                        ayudante_sala_c_id: checked ? null : m.ayudante_sala_c_id,
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

            <div className="space-y-1">
              <Label className="text-xs">Título / referencia</Label>
              <Input
                value={m.titulo}
                onChange={(e) => update(idx, { titulo: e.target.value })}
                disabled={disabled}
                placeholder="Ej: Empiece conversaciones — vea ayuda"
              />
            </div>

            {salasAuxiliares >= 1 ? (
              <div className={`grid grid-cols-1 ${salasAuxiliares >= 2 ? "md:grid-cols-3" : "md:grid-cols-2"} gap-4`}>
                <div className="md:border-r md:pr-4">
                  {renderSalaRow(m, idx, "principal", true)}
                </div>
                <div className={salasAuxiliares >= 2 ? "md:border-r md:pr-4" : ""}>
                  {renderSalaRow(m, idx, "b", true)}
                </div>
                {salasAuxiliares >= 2 && (
                  <div>{renderSalaRow(m, idx, "c", true)}</div>
                )}
              </div>
            ) : (
              renderSalaRow(m, idx, "principal", false)
            )}
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
