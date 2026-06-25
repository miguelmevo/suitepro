import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GeneracionAutomaticaOverlay } from "@/components/ui/GeneracionAutomaticaOverlay";

export type AsignacionModo = "auto" | "reasignar";

interface SlotPreview {
  key: string;
  titulo: string;
  asignado_actual?: string | null;
  asignado_sugerido?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fase: "elegir" | "preview";
  modo: AsignacionModo;
  setModo: (m: AsignacionModo) => void;
  hayAsignacionesPrevias: boolean;
  cargando: boolean;
  slots: SlotPreview[];
  getNombre: (id: string | null | undefined) => string;
  onSolicitar: () => void;
  onAplicar: () => void;
}

export function AsignacionIAModal({
  open,
  onOpenChange,
  fase,
  modo,
  setModo,
  hayAsignacionesPrevias,
  cargando,
  slots,
  getNombre,
  onSolicitar,
  onAplicar,
}: Props) {
  const cambios = useMemo(
    () =>
      slots.filter(
        (s) =>
          (s.asignado_sugerido ?? null) !== (s.asignado_actual ?? null) &&
          s.asignado_sugerido !== undefined
      ),
    [slots]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            Asignación automática con IA
          </DialogTitle>
          <DialogDescription>
            {fase === "elegir"
              ? "Elige cómo quieres que la IA asigne participantes a este programa."
              : "Revisa las sugerencias antes de aplicarlas. Sólo se modificarán los slots indicados."}
          </DialogDescription>
        </DialogHeader>

        {fase === "elegir" && (
          <div className="space-y-4 py-2">
            <RadioGroup value={modo} onValueChange={(v) => setModo(v as AsignacionModo)}>
              <div className="flex items-start space-x-2 rounded-md border p-3">
                <RadioGroupItem value="auto" id="modo-auto" className="mt-1" />
                <div className="space-y-0.5">
                  <Label htmlFor="modo-auto" className="font-medium cursor-pointer">
                    Solo completar vacíos
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Mantiene a los participantes ya asignados y solo completa las partes vacías.
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-2 rounded-md border p-3">
                <RadioGroupItem value="reasignar" id="modo-reasignar" className="mt-1" />
                <div className="space-y-0.5">
                  <Label htmlFor="modo-reasignar" className="font-medium cursor-pointer">
                    Reasignar todo
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    La IA propondrá una asignación nueva para todas las partes (incluso las ya
                    asignadas).
                  </p>
                </div>
              </div>
            </RadioGroup>
            {!hayAsignacionesPrevias && (
              <p className="text-xs text-muted-foreground">
                Aún no hay nadie asignado; ambas opciones producirán el mismo resultado.
              </p>
            )}
          </div>
        )}

        {fase === "preview" && (
          <div className="space-y-2">
            {cambios.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                La IA no pudo proponer cambios para esta semana.
              </p>
            ) : (
              <ScrollArea className="max-h-[420px] pr-3">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground border-b">
                    <tr>
                      <th className="text-left py-1.5 pr-2">Parte</th>
                      <th className="text-left py-1.5 pr-2">Actual</th>
                      <th className="text-left py-1.5">Propuesto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cambios.map((s) => (
                      <tr key={s.key} className="border-b last:border-0">
                        <td className="py-1.5 pr-2 font-medium">{s.titulo}</td>
                        <td className="py-1.5 pr-2 text-muted-foreground">
                          {s.asignado_actual ? getNombre(s.asignado_actual) : "—"}
                        </td>
                        <td className="py-1.5">
                          {s.asignado_sugerido ? (
                            <span className="font-medium text-primary">
                              {getNombre(s.asignado_sugerido)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground italic">sin sugerencia</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={cargando}>
            Cancelar
          </Button>
          {fase === "elegir" ? (
            <Button onClick={onSolicitar} disabled={cargando}>
              {cargando ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Consultando IA…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generar sugerencias
                </>
              )}
            </Button>
          ) : (
            <Button onClick={onAplicar} disabled={cambios.length === 0}>
              Aplicar {cambios.length > 0 ? `(${cambios.length})` : ""}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
