import { useMemo, useState } from "react";
import { format, parseISO, addDays } from "date-fns";
import { es } from "date-fns/locale";
import { Plus, Check, Loader2, Sparkles } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useProgramasReunionPublicaTodos, useReunionPublica } from "@/hooks/useReunionPublica";
import { useParticipantes } from "@/hooks/useParticipantes";
import { useConfiguracionSistema } from "@/hooks/useConfiguracionSistema";
import { usePermisos } from "@/hooks/usePermisos";
import type { RpCategoria, UltimaEntryRP } from "@/lib/reunion-publica-historial";
import { RP_CATEGORIA_LABEL } from "@/lib/reunion-publica-historial";
import { computeBloqueoRP, leerBloqueoConfigRP } from "@/lib/reunion-publica-bloqueos";

const NUM_SEMANAS = 8;

const DIA_SEMANA_MAP: Record<string, number> = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
};

// Solo las categorías con un slot único de columna directa (presidente_id/orador_id/
// lector_atalaya_id) — asignar "orador" aquí siempre lo deja como orador local.
const CAMPO: Record<RpCategoria, string> = {
  presidencia: "presidente_id",
  orador: "orador_id",
  lector_atalaya: "lector_atalaya_id",
};

interface Props {
  participanteId: string;
  participanteLabel: string;
  categoria: RpCategoria;
  children: React.ReactNode;
  ultimaEntry?: Partial<Record<RpCategoria, UltimaEntryRP[]>>;
}

export function AsignarPopoverRP({
  participanteId,
  participanteLabel,
  categoria,
  children,
  ultimaEntry,
}: Props) {
  const { canCreate, canEdit } = usePermisos();
  const { data: programas = [] } = useProgramasReunionPublicaTodos();
  const { participantes } = useParticipantes();
  const { configuraciones: configsRP } = useConfiguracionSistema("reunion_publica");
  const { configuraciones: configsGeneral } = useConfiguracionSistema("general");
  const { guardarPrograma } = useReunionPublica();
  const [open, setOpen] = useState(false);

  const canAsignar =
    canCreate("reunion_publica_programa") || canEdit("reunion_publica_programa");

  const campo = CAMPO[categoria];
  const today = format(new Date(), "yyyy-MM-dd");

  const diaReunion = useMemo(() => {
    const cfg = configsGeneral?.find((c) => c.clave === "dias_reunion");
    const diaStr = (cfg?.valor as any)?.dia_fin_semana as string | undefined;
    return DIA_SEMANA_MAP[diaStr ?? "domingo"] ?? 0;
  }, [configsGeneral]);

  // Mezcla fechas reales (BD, futuras) con fechas virtuales (sin crear) — siempre
  // NUM_SEMANAS ocurrencias del día de reunión configurado, hacia adelante.
  const semanas = useMemo(() => {
    const existentesMap = new Map<string, any>();
    (programas ?? []).forEach((p) => {
      if (p.fecha >= today) existentesMap.set(p.fecha, p);
    });

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const offsetHastaProximo = (diaReunion - hoy.getDay() + 7) % 7;
    const proximaFecha = addDays(hoy, offsetHastaProximo);

    const lista: any[] = [];
    for (let i = 0; i < NUM_SEMANAS; i++) {
      const fecha = format(addDays(proximaFecha, i * 7), "yyyy-MM-dd");
      const exist = existentesMap.get(fecha);
      lista.push(exist ? { ...exist, _virtual: false } : { fecha, _virtual: true });
    }
    return lista.sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [programas, today, diaReunion]);

  const nameOf = (id: string | null | undefined) => {
    if (!id) return null;
    const p = (participantes ?? []).find((x) => x.id === id);
    return p ? `${p.apellido}, ${p.nombre}` : "—";
  };

  const bloqueoCfg = useMemo(() => leerBloqueoConfigRP(configsRP), [configsRP]);

  const handleAsignar = async (semana: any) => {
    const occupant = semana[campo] as string | null | undefined;
    if (occupant === participanteId) {
      toast.info("Ya está asignado en esta fecha");
      return;
    }
    if (occupant) {
      const ok = window.confirm(
        `Esta fecha ya tiene a ${nameOf(occupant)} en "${RP_CATEGORIA_LABEL[categoria]}".\n¿Reemplazar?`
      );
      if (!ok) return;
    }
    try {
      await guardarPrograma.mutateAsync({ fecha: semana.fecha, [campo]: participanteId });
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
          title="Click para asignar a una fecha"
        >
          {children}
          <Plus className="h-3 w-3 absolute top-0.5 right-0.5 opacity-0 group-hover/asgn:opacity-70 text-primary" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="center">
        <div className="p-3 border-b bg-muted/40">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Asignar a
          </div>
          <div className="font-semibold text-sm leading-tight">{participanteLabel}</div>
          <div className="text-xs mt-1">
            como <strong>{RP_CATEGORIA_LABEL[categoria]}</strong>
          </div>
        </div>
        <div className="max-h-[340px] overflow-y-auto">
          {semanas.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">
              No hay fechas futuras disponibles.
            </div>
          ) : (
            <ul className="divide-y">
              {semanas.map((s) => {
                const bloqueo = computeBloqueoRP(ultimaEntry, categoria, s.fecha, bloqueoCfg);
                const occ = s[campo] as string | null | undefined;
                const isMe = occ === participanteId;
                const occName = nameOf(occ)?.split(",")[0];
                const bloqueadoParaAsignar = bloqueo.bloqueado && !isMe;
                return (
                  <li key={s.fecha} className="p-2 flex items-center justify-between gap-2">
                    <div className="text-xs font-medium flex items-center gap-1.5 flex-wrap">
                      <span>{format(parseISO(s.fecha), "d 'de' MMM yyyy", { locale: es })}</span>
                      {s._virtual && (
                        <Badge variant="outline" className="h-4 px-1 text-[9px] gap-0.5">
                          <Sparkles className="h-2.5 w-2.5" />
                          Sin crear
                        </Badge>
                      )}
                      {bloqueo.marcado && (
                        <Badge
                          variant="outline"
                          className={
                            bloqueo.bloqueado
                              ? "h-4 px-1 text-[9px] border-destructive/50 text-destructive"
                              : "h-4 px-1 text-[9px] border-amber-500/50 text-amber-600"
                          }
                          title={bloqueo.detalle}
                        >
                          {bloqueo.motivo === "rotacion" ? "ROT" : "DESC"}
                        </Badge>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant={isMe ? "secondary" : occ ? "outline" : "default"}
                      className="h-7 text-[11px] px-2 shrink-0"
                      disabled={guardarPrograma.isPending || bloqueadoParaAsignar}
                      title={bloqueadoParaAsignar ? bloqueo.detalle : undefined}
                      onClick={() => handleAsignar(s)}
                    >
                      {guardarPrograma.isPending ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : isMe ? (
                        <Check className="h-3 w-3 mr-1" />
                      ) : null}
                      Asignar
                      {occ && !isMe && <span className="ml-1 opacity-60 italic">({occName})</span>}
                    </Button>
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
