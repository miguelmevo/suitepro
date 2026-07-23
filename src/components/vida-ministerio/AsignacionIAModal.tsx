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
import { GeneracionAutomaticaOverlay } from "@/components/ui/GeneracionAutomaticaOverlay";

export type AsignacionModo = "auto" | "reasignar";

interface SlotPreview {
  key: string;
  titulo: string;
  seccion?: string;
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

const SECCION_LABEL: Record<string, string> = {
  cabecera: "Presidencia y oraciones",
  tesoros: "Tesoros de la Biblia",
  maestros: "Seamos mejores maestros",
  vida_cristiana: "Nuestra vida cristiana",
  estudio_biblico: "Estudio bíblico de la congregación",
};
const SECCION_ORDEN = ["cabecera", "tesoros", "maestros", "vida_cristiana", "estudio_biblico"];

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
  // Se muestra la fila si: (a) el slot está vacío actualmente (con o sin
  // sugerencia — incluye el caso en que la validación de género/pareja
  // rechazó la sugerencia de la IA y la dejó en null, que de otra forma
  // se vería idéntico a "sin cambio" y desaparecería), o (b) la IA propuso
  // reemplazar algo que ya tenía un participante distinto.
  const cambios = useMemo(
    () =>
      slots.filter((s) => {
        const actual = s.asignado_actual ?? null;
        if (actual === null) return true;
        return s.asignado_sugerido !== undefined && (s.asignado_sugerido ?? null) !== actual;
      }),
    [slots]
  );

  // Si ningún slot en la vista tiene una asignación previa, la columna "actual"
  // sería puros guiones — se oculta por completo en vez de mostrar esa columna vacía.
  const hayAlgunActual = useMemo(() => cambios.some((s) => !!s.asignado_actual), [cambios]);

  // Agrupa titular/ayudante de una misma demostración (misma "maestros.N") para
  // que se vean como una sola intervención de 2 líneas, sin línea divisoria entre
  // ellas — la línea divisoria solo separa una intervención de la siguiente.
  const grupoInternoKey = (s: SlotPreview) => {
    const m = s.key.match(/^maestros\.(\d+)\./);
    return m ? `maestros.${m[1]}` : s.key;
  };

  const gruposCambios = useMemo(() => {
    const porSeccion = new Map<string, SlotPreview[]>();
    for (const s of cambios) {
      const sec = s.seccion ?? "otra";
      const arr = porSeccion.get(sec) ?? [];
      arr.push(s);
      porSeccion.set(sec, arr);
    }
    const claves = [...porSeccion.keys()].sort(
      (a, b) => SECCION_ORDEN.indexOf(a) - SECCION_ORDEN.indexOf(b)
    );
    return claves.map((key) => {
      const items = porSeccion.get(key)!;
      const subgrupos: SlotPreview[][] = [];
      for (const s of items) {
        const gKey = grupoInternoKey(s);
        const ultimo = subgrupos[subgrupos.length - 1];
        if (ultimo && grupoInternoKey(ultimo[0]) === gKey) {
          ultimo.push(s);
        } else {
          subgrupos.push([s]);
        }
      }
      return { key, label: SECCION_LABEL[key] ?? key, subgrupos };
    });
  }, [cambios]);

  return (
    <>
      <GeneracionAutomaticaOverlay open={cargando} mensaje="Asignando con IA…" />
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
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
          <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1">
            {cambios.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                La IA no pudo proponer cambios para esta semana.
              </p>
            ) : (
              gruposCambios.map((grupo) => (
                <div key={grupo.key}>
                  <div className="text-xs font-semibold uppercase text-primary tracking-wide mb-1 pb-1 border-b">
                    {grupo.label}
                  </div>
                  <table className="w-full text-sm">
                    <tbody>
                      {grupo.subgrupos.map((sub, si) =>
                        sub.map((s, idx) => (
                          <tr
                            key={s.key}
                            className={
                              idx === sub.length - 1 && si !== grupo.subgrupos.length - 1
                                ? "border-b"
                                : ""
                            }
                          >
                            <td className={`${idx === 0 ? "pt-1.5" : "pt-0"} ${idx === sub.length - 1 ? "pb-1.5" : "pb-0"} pr-2 font-medium ${hayAlgunActual ? "w-[40%]" : "w-[60%]"}`}>
                              {s.titulo}
                            </td>
                            {hayAlgunActual && (
                              <td className={`${idx === 0 ? "pt-1.5" : "pt-0"} ${idx === sub.length - 1 ? "pb-1.5" : "pb-0"} pr-2 text-muted-foreground w-[30%]`}>
                                {s.asignado_actual ? getNombre(s.asignado_actual) : "—"}
                              </td>
                            )}
                            <td className={`${idx === 0 ? "pt-1.5" : "pt-0"} ${idx === sub.length - 1 ? "pb-1.5" : "pb-0"} ${hayAlgunActual ? "w-[30%]" : "w-[40%]"}`}>
                              {s.asignado_sugerido ? (
                                <span className="font-medium text-primary">
                                  {getNombre(s.asignado_sugerido)}
                                </span>
                              ) : (
                                <span className="text-muted-foreground italic">sin sugerencia</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              ))
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
            <Button onClick={onAplicar} disabled={cambios.filter((c) => c.asignado_sugerido).length === 0}>
              Aplicar {cambios.filter((c) => c.asignado_sugerido).length > 0 ? `(${cambios.filter((c) => c.asignado_sugerido).length})` : ""}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
