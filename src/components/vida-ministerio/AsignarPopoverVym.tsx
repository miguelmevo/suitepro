import { useMemo, useState } from "react";
import { format, parseISO, addWeeks } from "date-fns";
import { es } from "date-fns/locale";
import { Plus, Check, Loader2, Sparkles } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  useProgramasVidaMinisterio,
  useGuardarProgramaVidaMinisterio,
} from "@/hooks/useProgramaVidaMinisterio";
import { useParticipantes } from "@/hooks/useParticipantes";
import { useCongregacionId } from "@/contexts/CongregacionContext";
import { useConfiguracionSistema } from "@/hooks/useConfiguracionSistema";
import { usePermisos } from "@/hooks/usePermisos";
import type { VymCategoria } from "@/lib/vida-ministerio-historial";
import { CATEGORIA_LABEL, computeUltimasParticipaciones } from "@/lib/vida-ministerio-historial";
import { computeBloqueo, leerBloqueoConfig } from "@/lib/vida-ministerio-bloqueos";

function getMonday(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  return d;
}

export type SimpleCat = Exclude<
  VymCategoria,
  "maestros" | "vida_cristiana" | "discurso" | "necesidades_congregacion"
>;

export const SIMPLE_CATS: SimpleCat[] = [
  "presidente",
  "oracion_inicial",
  "oracion_final",
  "tesoros",
  "perlas",
  "lectura_biblica",
  "estudio_bc",
  "lector_ebc",
];

interface SlotDef {
  path: string[];
  label: string;
}

const SLOTS: Record<SimpleCat, SlotDef[]> = {
  presidente: [{ path: ["presidente_id"], label: "Presidente" }],
  oracion_inicial: [{ path: ["oracion_inicial_id"], label: "Oración inicial" }],
  oracion_final: [{ path: ["oracion_final_id"], label: "Oración final" }],
  tesoros: [{ path: ["tesoros", "participante_id"], label: "Tesoros" }],
  perlas: [{ path: ["perlas_id"], label: "Perlas" }],
  lectura_biblica: [{ path: ["lectura_biblica", "participante_id"], label: "Lectura Biblia" }],
  estudio_bc: [{ path: ["estudio_biblico", "conductor_id"], label: "Conductor EBC" }],
  lector_ebc: [{ path: ["estudio_biblico", "lector_id"], label: "Lector EBC" }],
};

function getPath(obj: any, path: string[]) {
  return path.reduce((o, k) => (o == null ? null : o[k]), obj);
}

interface Props {
  participanteId: string;
  participanteLabel: string;
  categoria: SimpleCat;
  children: React.ReactNode;
}

export function AsignarPopoverVym({
  participanteId,
  participanteLabel,
  categoria,
  children,
}: Props) {
  const congregacionId = useCongregacionId();
  const { canCreate, canEdit } = usePermisos();
  const { data: programas = [] } = useProgramasVidaMinisterio();
  const { participantes } = useParticipantes();
  const { configuraciones: configsVyM } = useConfiguracionSistema("vida_ministerio");
  const guardar = useGuardarProgramaVidaMinisterio();
  const [open, setOpen] = useState(false);

  const canAsignar =
    !!congregacionId &&
    (
      canCreate("vym_historial") ||
      canEdit("vym_historial") ||
      canCreate("vym_programa") ||
      canEdit("vym_programa")
    );

  const slots = SLOTS[categoria];
  const today = format(new Date(), "yyyy-MM-dd");

  const numSemanas = useMemo(() => {
    const cfg = configsVyM?.find((c) => c.clave === "ventana_asignacion_historial_semanas");
    const v = (cfg?.valor as any)?.semanas;
    const n = typeof v === "number" ? v : parseInt(v, 10);
    return isNaN(n) || n < 1 || n > 52 ? 8 : n;
  }, [configsVyM]);

  // Mezcla semanas existentes (BD) con semanas virtuales (sin crear) — siempre N semanas hacia adelante
  const semanas = useMemo(() => {
    const existentesMap = new Map<string, any>();
    (programas ?? []).forEach((p) => {
      if (p.fecha_semana >= today) existentesMap.set(p.fecha_semana, p);
    });

    const baseLunes = getMonday(new Date());
    const lista: any[] = [];
    for (let i = 0; i < numSemanas; i++) {
      const lunes = format(addWeeks(baseLunes, i), "yyyy-MM-dd");
      const exist = existentesMap.get(lunes);
      if (exist) {
        if (!exist.sin_reunion) lista.push({ ...exist, _virtual: false });
      } else {
        lista.push({
          _virtual: true,
          fecha_semana: lunes,
          tesoros: { titulo: "", participante_id: null },
          lectura_biblica: { cita: "", participante_id: null },
          estudio_biblico: { titulo: "", conductor_id: null, lector_id: null },
        });
      }
    }
    return lista.sort((a, b) => a.fecha_semana.localeCompare(b.fecha_semana));
  }, [programas, today, numSemanas]);

  const nameOf = (id: string | null | undefined) => {
    if (!id) return null;
    const p = (participantes ?? []).find((x) => x.id === id);
    return p ? `${p.apellido}, ${p.nombre}` : "—";
  };

  // Reglas de bloqueo (rotación / descanso global) — respetan los toggles activo/desactivado.
  const bloqueoCfg = useMemo(() => leerBloqueoConfig(configsVyM), [configsVyM]);
  const ultimaEntry = useMemo(
    () => computeUltimasParticipaciones(programas ?? []).get(participanteId),
    [programas, participanteId]
  );

  const handleAsignar = async (semana: any, slot: SlotDef) => {
    const occupant = getPath(semana, slot.path);
    if (occupant === participanteId) {
      toast.info("Ya está asignado en esta semana");
      return;
    }
    if (occupant) {
      const ok = window.confirm(
        `Esta semana ya tiene a ${nameOf(occupant)} en "${slot.label}".\n¿Reemplazar?`
      );
      if (!ok) return;
    }
    // Excluir flag interno antes del upsert
    const { _virtual, ...rest } = semana;
    const payload: any = { ...rest };
    if (slot.path.length === 1) {
      payload[slot.path[0]] = participanteId;
    } else {
      const [parent, child] = slot.path;
      payload[parent] = { ...(rest[parent] ?? {}), [child]: participanteId };
    }
    try {
      await guardar.mutateAsync(payload);
      setOpen(false);
    } catch {
      /* toast ya mostrado por el hook */
    }
  };

  if (!canAsignar) return <>{children}</>;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="group/asgn relative w-full h-full cursor-pointer hover:bg-accent/40 rounded transition-colors px-1 py-0.5"
          title="Click para asignar a una semana"
        >
          {children}
          <Plus className="h-3 w-3 absolute top-0.5 right-0.5 opacity-0 group-hover/asgn:opacity-70 text-primary" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[340px] p-0" align="center">
        <div className="p-3 border-b bg-muted/40">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Asignar a
          </div>
          <div className="font-semibold text-sm leading-tight">{participanteLabel}</div>
          <div className="text-xs mt-1">
            como <strong>{CATEGORIA_LABEL[categoria]}</strong>
          </div>
        </div>
        <div className="max-h-[340px] overflow-y-auto">
          {semanas.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">
              No hay semanas futuras disponibles.
            </div>
          ) : (
            <ul className="divide-y">
              {semanas.map((s) => {
                const bloqueo = computeBloqueo(ultimaEntry, categoria, s.fecha_semana, bloqueoCfg);
                return (
                <li key={s.id ?? s.fecha_semana} className="p-2">
                  <div className="text-xs font-medium mb-1.5 flex items-center gap-1.5 flex-wrap">
                    <span>
                      Semana del{" "}
                      {format(parseISO(s.fecha_semana), "d 'de' MMM yyyy", { locale: es })}
                    </span>
                    {s._virtual && (
                      <Badge variant="outline" className="h-4 px-1 text-[9px] gap-0.5">
                        <Sparkles className="h-2.5 w-2.5" />
                        Sin crear
                      </Badge>
                    )}
                    {bloqueo.bloqueado && (
                      <Badge
                        variant="outline"
                        className="h-4 px-1 text-[9px] border-amber-500/50 text-amber-600"
                        title={bloqueo.detalle}
                      >
                        {bloqueo.motivo === "rotacion" ? "ROT" : "DESC"}
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {slots.map((slot) => {
                      const occ = getPath(s, slot.path);
                      const isMe = occ === participanteId;
                      const occName = nameOf(occ)?.split(",")[0];
                      const bloqueadoParaAsignar = bloqueo.bloqueado && !isMe;
                      return (
                        <Button
                          key={slot.path.join(".")}
                          size="sm"
                          variant={isMe ? "secondary" : occ ? "outline" : "default"}
                          className="h-7 text-[11px] px-2"
                          disabled={guardar.isPending || bloqueadoParaAsignar}
                          title={bloqueadoParaAsignar ? bloqueo.detalle : undefined}
                          onClick={() => handleAsignar(s, slot)}
                        >
                          {guardar.isPending ? (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          ) : isMe ? (
                            <Check className="h-3 w-3 mr-1" />
                          ) : null}
                          {slots.length > 1 ? slot.label : "Asignar"}
                          {occ && !isMe && (
                            <span className="ml-1 opacity-60 italic">({occName})</span>
                          )}
                        </Button>
                      );
                    })}
                  </div>
                </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
