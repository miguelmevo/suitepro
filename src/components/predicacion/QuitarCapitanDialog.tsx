import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCongregacionId } from "@/contexts/CongregacionContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CapitanAutorizado, Reemplazo } from "@/hooks/useCapitanesAutorizados";

const SIN_ASIGNAR = "__none__";
// Listas vacías estables: un `= []` por defecto crea un arreglo nuevo en cada
// render mientras la consulta carga y dispara un ciclo infinito de efectos.
const SALIDAS_VACIAS: SalidaFutura[] = [];
const FIJAS_VACIAS: FijaActiva[] = [];
const INDISP_VACIAS: Indisp[] = [];
const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

interface SalidaFutura {
  id: string;
  fecha: string;
  capitan_id: string | null;
  asignaciones_grupos: { capitan_id?: string }[] | null;
  horarios_salida: { hora: string } | null;
}

interface FijaActiva {
  id: string;
  dia_semana: number;
  capitan_id: string;
  horarios_salida: { hora: string } | null;
}

interface Indisp {
  participante_id: string;
  fecha_inicio: string;
  fecha_fin: string | null;
  tipo_responsabilidad: string[];
}

interface Props {
  capitan: CapitanAutorizado | null;
  capitanes: CapitanAutorizado[];
  isPending: boolean;
  onCancel: () => void;
  onConfirm: (reemplazos: Reemplazo[]) => void;
}

const capitanesDeSalida = (s: SalidaFutura): string[] => [
  ...(s.capitan_id ? [s.capitan_id] : []),
  ...((s.asignaciones_grupos ?? []).map((a) => a.capitan_id).filter((x): x is string => !!x)),
];

/**
 * Antes de quitar a alguien de capitanes, lista cada salida futura (y cada
 * capitanía fija) que tenga asignada y propone un reemplazo: entre los demás
 * capitanes, sin indisponibilidad ese día, que no dirijan otra salida ese
 * mismo día y con menos salidas asignadas. Cada propuesta se puede cambiar.
 */
export function QuitarCapitanDialog({ capitan, capitanes, isPending, onCancel, onConfirm }: Props) {
  const congregacionId = useCongregacionId();
  const abierto = !!capitan;
  const hoy = format(new Date(), "yyyy-MM-dd");

  const { data: salidasData, isLoading: cargandoSalidas } = useQuery({
    queryKey: ["capitanes-futuras", congregacionId, "salidas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("programa_predicacion")
        .select("id, fecha, capitan_id, asignaciones_grupos, horarios_salida(hora)")
        .eq("congregacion_id", congregacionId as string)
        .eq("activo", true)
        .gte("fecha", hoy)
        .order("fecha");
      if (error) throw error;
      return (data ?? []) as unknown as SalidaFutura[];
    },
    enabled: abierto && !!congregacionId,
  });

  const { data: fijasData, isLoading: cargandoFijas } = useQuery({
    queryKey: ["capitanes-futuras", congregacionId, "fijas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asignaciones_capitan_fijas")
        .select("id, dia_semana, capitan_id, horarios_salida(hora)")
        .eq("congregacion_id", congregacionId as string)
        .eq("activo", true);
      if (error) throw error;
      return (data ?? []) as unknown as FijaActiva[];
    },
    enabled: abierto && !!congregacionId,
  });

  const { data: indispData } = useQuery({
    queryKey: ["capitanes-futuras", congregacionId, "indisp"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("indisponibilidad_participantes")
        .select("participante_id, fecha_inicio, fecha_fin, tipo_responsabilidad")
        .eq("congregacion_id", congregacionId as string)
        .eq("activo", true);
      if (error) throw error;
      return (data ?? []) as Indisp[];
    },
    enabled: abierto && !!congregacionId,
  });

  const salidas = salidasData ?? SALIDAS_VACIAS;
  const fijas = fijasData ?? FIJAS_VACIAS;
  const indisponibilidades = indispData ?? INDISP_VACIAS;

  const otros = useMemo(
    () => capitanes.filter((c) => c.participante_id !== capitan?.participante_id),
    [capitanes, capitan],
  );

  const salidasAfectadas = useMemo(
    () => (capitan ? salidas.filter((s) => capitanesDeSalida(s).includes(capitan.participante_id)) : []),
    [salidas, capitan],
  );
  const fijasAfectadas = useMemo(
    () => (capitan ? fijas.filter((f) => f.capitan_id === capitan.participante_id) : []),
    [fijas, capitan],
  );

  const estaIndisponible = (participanteId: string, fecha: string) =>
    indisponibilidades.some(
      (i) =>
        i.participante_id === participanteId &&
        i.fecha_inicio <= fecha &&
        ((i.fecha_fin ?? i.fecha_inicio) >= fecha) &&
        (i.tipo_responsabilidad.includes("todas") || i.tipo_responsabilidad.includes("predicacion")),
    );

  // Propuesta inicial: una pasada por fecha, repartiendo por carga.
  const propuesta = useMemo(() => {
    const carga = new Map<string, number>();
    otros.forEach((c) => carga.set(c.participante_id, 0));
    salidas.forEach((s) =>
      capitanesDeSalida(s).forEach((id) => carga.has(id) && carga.set(id, (carga.get(id) ?? 0) + 1)),
    );
    fijas.forEach((f) => carga.has(f.capitan_id) && carga.set(f.capitan_id, (carga.get(f.capitan_id) ?? 0) + 1));

    const eleccion: Record<string, string> = {};
    const propuestoPorFecha = new Map<string, Set<string>>();

    for (const s of salidasAfectadas) {
      const ocupadosEseDia = new Set<string>(propuestoPorFecha.get(s.fecha) ?? []);
      salidas.filter((o) => o.fecha === s.fecha && o.id !== s.id).forEach((o) => capitanesDeSalida(o).forEach((id) => ocupadosEseDia.add(id)));

      const candidatos = otros
        .filter((c) => !ocupadosEseDia.has(c.participante_id) && !estaIndisponible(c.participante_id, s.fecha))
        .sort(
          (a, b) =>
            (carga.get(a.participante_id) ?? 0) - (carga.get(b.participante_id) ?? 0) ||
            `${a.apellido} ${a.nombre}`.localeCompare(`${b.apellido} ${b.nombre}`),
        );

      const elegido = candidatos[0];
      eleccion[`programa:${s.id}`] = elegido ? elegido.participante_id : SIN_ASIGNAR;
      if (elegido) {
        carga.set(elegido.participante_id, (carga.get(elegido.participante_id) ?? 0) + 1);
        if (!propuestoPorFecha.has(s.fecha)) propuestoPorFecha.set(s.fecha, new Set());
        propuestoPorFecha.get(s.fecha)!.add(elegido.participante_id);
      }
    }

    for (const f of fijasAfectadas) {
      const elegido = [...otros].sort(
        (a, b) =>
          (carga.get(a.participante_id) ?? 0) - (carga.get(b.participante_id) ?? 0) ||
          `${a.apellido} ${a.nombre}`.localeCompare(`${b.apellido} ${b.nombre}`),
      )[0];
      eleccion[`fija:${f.id}`] = elegido ? elegido.participante_id : SIN_ASIGNAR;
      if (elegido) carga.set(elegido.participante_id, (carga.get(elegido.participante_id) ?? 0) + 1);
    }
    return eleccion;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salidas, fijas, indisponibilidades, otros, salidasAfectadas, fijasAfectadas]);

  const [elecciones, setElecciones] = useState<Record<string, string>>({});
  const propuestaKey = JSON.stringify(propuesta);
  useEffect(() => {
    setElecciones(propuesta);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propuestaKey]);

  const cargando = cargandoSalidas || cargandoFijas;
  const totalAfectadas = salidasAfectadas.length + fijasAfectadas.length;

  const confirmar = () => {
    const reemplazos: Reemplazo[] = [
      ...salidasAfectadas.map((s) => ({
        tipo: "programa" as const,
        id: s.id,
        nuevo_capitan_id: (elecciones[`programa:${s.id}`] ?? SIN_ASIGNAR) === SIN_ASIGNAR ? null : elecciones[`programa:${s.id}`],
      })),
      ...fijasAfectadas.map((f) => ({
        tipo: "fija" as const,
        id: f.id,
        nuevo_capitan_id: (elecciones[`fija:${f.id}`] ?? SIN_ASIGNAR) === SIN_ASIGNAR ? null : elecciones[`fija:${f.id}`],
      })),
    ];
    onConfirm(reemplazos);
  };

  const selector = (clave: string, fecha?: string) => (
    <Select value={elecciones[clave] ?? SIN_ASIGNAR} onValueChange={(v) => setElecciones((p) => ({ ...p, [clave]: v }))}>
      <SelectTrigger className="h-8 w-[220px] text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={SIN_ASIGNAR}>— Sin asignar —</SelectItem>
        {otros.map((c) => {
          const noDisp = fecha ? estaIndisponible(c.participante_id, fecha) : false;
          return (
            <SelectItem key={c.participante_id} value={c.participante_id} disabled={noDisp}>
              {c.apellido}, {c.nombre}
              {noDisp && <span className="ml-2 text-[10px] text-destructive">No disponible</span>}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );

  return (
    <Dialog open={abierto} onOpenChange={(v) => !v && !isPending && onCancel()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Quitar a {capitan?.apellido}, {capitan?.nombre} de capitanes</DialogTitle>
          <DialogDescription>
            Se desmarcará "Capitán de Grupo" en su ficha de participante.
          </DialogDescription>
        </DialogHeader>

        {cargando ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : totalAfectadas === 0 ? (
          <p className="text-sm text-muted-foreground">No tiene salidas futuras asignadas como capitán.</p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-500" />
              <span>
                Tiene <strong>{totalAfectadas}</strong> {totalAfectadas === 1 ? "capitanía asignada" : "capitanías asignadas"}.
                Te propongo un reemplazo para cada una; puedes cambiarlo antes de confirmar.
              </span>
            </div>

            <div className="max-h-[45vh] overflow-y-auto space-y-2 pr-1">
              {salidasAfectadas.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 border-b pb-2">
                  <span className="text-sm capitalize">
                    {format(parseISO(s.fecha), "EEEE d MMM", { locale: es })}
                    {s.horarios_salida?.hora ? ` · ${s.horarios_salida.hora.slice(0, 5)}` : ""}
                  </span>
                  {selector(`programa:${s.id}`, s.fecha)}
                </div>
              ))}
              {fijasAfectadas.map((f) => (
                <div key={f.id} className="flex items-center justify-between gap-3 border-b pb-2">
                  <span className="text-sm">
                    Capitanía fija · {DIAS[f.dia_semana] ?? `día ${f.dia_semana}`}
                    {f.horarios_salida?.hora ? ` · ${f.horarios_salida.hora.slice(0, 5)}` : ""}
                  </span>
                  {selector(`fija:${f.id}`)}
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isPending}>Cancelar</Button>
          <Button variant="destructive" onClick={confirmar} disabled={cargando || isPending}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {totalAfectadas > 0 ? "Reasignar y quitar capitán" : "Quitar capitán"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
