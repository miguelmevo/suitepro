import { useMemo, useState } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { es } from "date-fns/locale";
import { UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useProgramasVidaMinisterio } from "@/hooks/useProgramaVidaMinisterio";
import { useParticipantes } from "@/hooks/useParticipantes";
import { cumpleFiltro } from "@/components/vida-ministerio/ParticipanteSelector";
import { computeUltimasParticipaciones, CATEGORIAS_ORDEN, CATEGORIA_LABEL } from "@/lib/vida-ministerio-historial";

const CATEGORIAS_NO_CUENTAN = new Set(["oracion_inicial", "oracion_final"]);
const LABEL_CATEGORIA_MODAL: Record<string, string> = {
  maestros: "SMM",
  necesidades_congregacion: "Necesidades C.",
  oracion_inicial: "Oración I.",
  oracion_final: "Oración F.",
};

/**
 * Botón + modal reutilizable: muestra qué Ancianos y Siervos Ministeriales
 * NO tienen ninguna asignación "real" en el mes indicado (la oración
 * inicial/final no cuenta como asignación). Se usa tanto en la vista de
 * "Todas las semanas" como en la de una semana individual — en ambos casos
 * el criterio es siempre el MES completo, no solo la semana que se esté viendo.
 */
export function AncianosSmSinAsignacionModal({ mesActual }: { mesActual: Date }) {
  const { data: programas } = useProgramasVidaMinisterio();
  const { participantes } = useParticipantes();
  const [open, setOpen] = useState(false);

  const programasDelMes = useMemo(() => {
    const lunesDelMes = eachDayOfInterval({
      start: startOfMonth(mesActual),
      end: endOfMonth(mesActual),
    }).filter((d) => d.getDay() === 1);
    const porLunes = new Map<string, (typeof programas)[number]>();
    (programas ?? []).forEach((p) => porLunes.set(p.fecha_semana, p));
    return lunesDelMes
      .map((lunes) => porLunes.get(format(lunes, "yyyy-MM-dd")))
      .filter((p): p is NonNullable<typeof p> => !!p);
  }, [mesActual, programas]);

  const { sinAsignacion, conAsignacion } = useMemo(() => {
    const ultimasMap = computeUltimasParticipaciones(programasDelMes);
    // computeUltimasParticipaciones marca "estudio_bc" tanto para el conductor
    // como para el lector (para el historial general de participación), pero
    // acá "Estudio BC" debe verse solo en quien conduce; el lector que no
    // conduce debe mostrar únicamente "Lector EBC".
    const conductoresEbc = new Set(
      programasDelMes.map((prog: any) => prog.estudio_biblico?.conductor_id).filter(Boolean)
    );
    const ordenAoSm = (a: any, b: any) => {
      const esA = (p: any) => (p.responsabilidad?.includes("anciano") ? 0 : 1);
      const diff = esA(a) - esA(b);
      if (diff !== 0) return diff;
      return `${a.apellido} ${a.nombre}`.localeCompare(`${b.apellido} ${b.nombre}`);
    };
    const ancianosYSm = (participantes ?? []).filter((p) => cumpleFiltro(p as any, "anciano_o_sm"));
    const sin: { p: (typeof ancianosYSm)[number]; categorias: string[] }[] = [];
    const con: { p: (typeof ancianosYSm)[number]; categorias: string[] }[] = [];
    ancianosYSm.forEach((p) => {
      const entry = ultimasMap.get(p.id);
      const categoriasConDato = CATEGORIAS_ORDEN.filter((cat) => entry?.[cat]?.length).filter(
        (cat) => cat !== "estudio_bc" || conductoresEbc.has(p.id)
      );
      const categoriasQueCuentan = categoriasConDato.filter((cat) => !CATEGORIAS_NO_CUENTAN.has(cat));
      const categorias = categoriasConDato.map((cat) => LABEL_CATEGORIA_MODAL[cat] ?? CATEGORIA_LABEL[cat]);
      if (categoriasQueCuentan.length > 0) {
        con.push({ p, categorias });
      } else {
        sin.push({ p, categorias });
      }
    });
    return {
      sinAsignacion: sin.sort((a, b) => ordenAoSm(a.p, b.p)),
      conAsignacion: con.sort((a, b) => ordenAoSm(a.p, b.p)),
    };
  }, [participantes, programasDelMes]);

  const nombreMes = format(mesActual, "MMMM yyyy", { locale: es });

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setOpen(true)}
            disabled={programasDelMes.length === 0}
            className="bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20 text-amber-600"
          >
            <UserX className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>A/SM sin asignación este mes</TooltipContent>
      </Tooltip>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="uppercase text-foreground font-bold">
              A/SM sin asignación — {nombreMes}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-y-auto space-y-8">
            {sinAsignacion.length > 0 ? (
              <ul className="space-y-1.5 text-sm">
                {sinAsignacion.map(({ p, categorias }) => (
                  <li key={p.id} className="flex items-center gap-2 border-b pb-1.5 last:border-0">
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {(p as any).responsabilidad?.includes("anciano") ? "A" : "SM"}
                    </Badge>
                    <span className="font-medium">{p.apellido}, {p.nombre}</span>
                    {categorias.length > 0 && (
                      <span className="ml-auto text-right text-primary shrink-0">
                        {categorias.join(", ")}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Todos los Ancianos y Siervos Ministeriales tienen al menos una asignación este mes.
              </p>
            )}

            {conAsignacion.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase text-foreground/70 mb-1.5">
                  Con asignación este mes
                </p>
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  {conAsignacion.map(({ p, categorias }) => (
                    <li key={p.id} className="flex items-center gap-2 border-b pb-1.5 last:border-0">
                      <Badge variant="outline" className="text-[10px] shrink-0 opacity-60">
                        {(p as any).responsabilidad?.includes("anciano") ? "A" : "SM"}
                      </Badge>
                      <span className="font-medium">{p.apellido}, {p.nombre}</span>
                      <span className="ml-auto text-right text-primary shrink-0">
                        {categorias.join(", ")}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
