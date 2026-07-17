import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ParticipanteSelector } from "./ParticipanteSelector";
import { TituloEditableModal } from "./TituloEditableModal";
import { extraerMinutosDeTitulo } from "./DuracionInput";
import type { MaestroDiscurso } from "@/types/vida-ministerio";

interface Props {
  value: MaestroDiscurso[];
  onChange: (next: MaestroDiscurso[]) => void;
  disabled?: boolean;
  /** 0 = solo Sala Principal, 1 = + Sala B, 2 = + Sala B y C */
  salasAuxiliares?: number;
  showErrors?: boolean;
  fechaPrograma?: string;
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

export function MaestrosRepeater({ value, onChange, disabled, salasAuxiliares = 0, showErrors, fechaPrograma }: Props) {
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

    const titularValue = (m as any)[titularKey] ?? null;
    const titularMissing = showErrors && sala === "principal" && !titularValue;
    return (
      <div>
        {showLabel && (
          <div className="text-xs font-semibold text-primary mb-2">{labels[sala]}</div>
        )}
        <div className="space-y-2">
          <ParticipanteSelector
            value={titularValue}
            onChange={(v) => update(idx, { [titularKey]: v } as any)}
            filtro={esDiscurso ? "varon_emc" : "publicador"}
            disabled={disabled}
            placeholder="Estudiante..."
            className={titularMissing ? "border-destructive ring-1 ring-destructive" : ""}
            categoria={esDiscurso ? "discurso" : "maestros"}
            fechaPrograma={fechaPrograma}
          />
          {!esDiscurso && (
            <ParticipanteSelector
              value={(m as any)[ayudanteKey] ?? null}
              onChange={(v) => update(idx, { [ayudanteKey]: v } as any)}
              filtro="publicador"
              disabled={disabled}
              placeholder="Ayudante..."
              categoria="maestros"
              fechaPrograma={fechaPrograma}
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {showErrors && value.length === 0 && (
        <div className="text-xs text-destructive font-medium">
          * Agrega al menos un discurso de Seamos Mejores Maestros.
        </div>
      )}
      {value.map((m, idx) => {
        const esDiscurso = m.tipo === "discurso";
        const tituloMissing = showErrors && !m.titulo.trim();
        return (
          <div key={m.id} className="border rounded-md p-3 space-y-3 bg-muted/30">
            <div className="flex items-center justify-between gap-2">
              <TituloEditableModal
                prefijo={`${4 + idx}.`}
                titulo={m.titulo}
                onTituloChange={(titulo) => {
                  const mins = m.duracion ?? extraerMinutosDeTitulo(titulo);
                  update(idx, { titulo, duracion: mins });
                }}
                tituloPlaceholder="Ej: Empiece conversaciones — vea ayuda"
                disabled={disabled}
                error={tituloMissing}
                modalTitle={`Editar — ${esDiscurso ? "Discurso" : "Asignación"} nro. ${idx + 1}`}
                minutos={m.duracion}
                onMinutosChange={(v) => update(idx, { duracion: v })}
                leccion={m.leccion}
                onLeccionChange={(v) => update(idx, { leccion: v })}
                detalle={m.detalle}
                onDetalleChange={(v) => update(idx, { detalle: v })}
                notas={m.notas}
                onNotasChange={(v) => update(idx, { notas: v })}
              />
              <div className="flex items-center gap-3 shrink-0">
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

            {salasAuxiliares >= 1 ? (
              <div className="space-y-3">
                <div className="pt-2 border-t">{renderSalaRow(m, idx, "principal", true)}</div>
                <div className="pt-2 border-t">{renderSalaRow(m, idx, "b", true)}</div>
                {salasAuxiliares >= 2 && (
                  <div className="pt-2 border-t">{renderSalaRow(m, idx, "c", true)}</div>
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
