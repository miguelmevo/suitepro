import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ParticipanteSelector } from "./ParticipanteSelector";
import { TituloEditableModal } from "./TituloEditableModal";
import { extraerMinutosDeTitulo } from "./DuracionInput";
import { esNecesidadesCongregacion } from "@/lib/vida-ministerio-historial";
import type { VidaCristianaParte } from "@/types/vida-ministerio";

interface Props {
  value: VidaCristianaParte[];
  onChange: (next: VidaCristianaParte[]) => void;
  disabled?: boolean;
  showErrors?: boolean;
  fechaPrograma?: string;
  /** Número del primer punto de Vida Cristiana (depende de cuántas intervenciones
   * tenga Maestros esa semana: 4 + cantidad de Maestros). */
  numeroBase: number;
  /** Si true (vista "Todas las semanas"), mantiene el selector apilado debajo del título. */
  embedded?: boolean;
}

const MAX = 3;

function nuevo(): VidaCristianaParte {
  return { id: crypto.randomUUID(), titulo: "", participante_id: null };
}

export function VidaCristianaRepeater({ value, onChange, disabled, showErrors, fechaPrograma, numeroBase, embedded }: Props) {
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
          <div className={embedded ? "flex items-center justify-between gap-2" : "flex items-center gap-3 flex-wrap"}>
            <div className={embedded ? "" : "flex-1 min-w-[240px]"}>
              <TituloEditableModal
                prefijo={`${numeroBase + idx}.`}
                titulo={p.titulo}
                onTituloChange={(titulo) => {
                  const mins = p.duracion ?? extraerMinutosDeTitulo(titulo);
                  update(idx, { titulo, duracion: mins });
                }}
                tituloPlaceholder="Ej: ¿Cómo dar buenos consejos?"
                disabled={disabled}
                error={tituloMissing}
                modalTitle={`Editar — Parte ${idx + 1}`}
                minutos={p.duracion}
                onMinutosChange={(v) => update(idx, { duracion: v })}
                detalle={p.detalle}
                onDetalleChange={(v) => update(idx, { detalle: v })}
                notas={p.notas}
                onNotasChange={(v) => update(idx, { notas: v })}
              />
            </div>
            {!embedded && (
              <div className="w-72 shrink-0">
                <ParticipanteSelector
                  value={p.participante_id}
                  onChange={(v) => update(idx, { participante_id: v })}
                  filtro="anciano_o_sm"
                  respetarSmHabilitado
                  disabled={disabled}
                  placeholder="Asignado..."
                  className={asignadoMissing ? "border-destructive ring-1 ring-destructive" : ""}
                  categoria={esNecesidadesCongregacion(p.titulo) ? "necesidades_congregacion" : "vida_cristiana"}
                  fechaPrograma={fechaPrograma}
                />
              </div>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => remove(idx)}
              disabled={disabled}
              className="h-7 w-7 text-destructive shrink-0"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          {embedded && (
            <div className="space-y-1.5">
              <ParticipanteSelector
                value={p.participante_id}
                onChange={(v) => update(idx, { participante_id: v })}
                filtro="anciano_o_sm"
                respetarSmHabilitado
                disabled={disabled}
                placeholder="Asignado..."
                className={asignadoMissing ? "border-destructive ring-1 ring-destructive" : ""}
                categoria={esNecesidadesCongregacion(p.titulo) ? "necesidades_congregacion" : "vida_cristiana"}
                fechaPrograma={fechaPrograma}
              />
            </div>
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
        Agregar parte ({value.length}/{MAX})
      </Button>
    </div>
  );
}
