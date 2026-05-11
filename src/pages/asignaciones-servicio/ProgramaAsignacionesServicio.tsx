import { useMemo, useState } from "react";
import { format, addMonths, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Wand2, Trash2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  TIPOS_ASIGNACION_SERVICIO,
  getMeetingDatesForMonth,
  useAsignacionesServicio,
  type TipoAsignacionServicio,
  type AsignacionServicio,
} from "@/hooks/useAsignacionesServicio";
import { useParticipantes } from "@/hooks/useParticipantes";
import { useGruposPredicacion } from "@/hooks/useGruposPredicacion";
import { useConfiguracionSistema } from "@/hooks/useConfiguracionSistema";
import { useReunionPublica } from "@/hooks/useReunionPublica";
import { useProgramasVidaMinisterio } from "@/hooks/useProgramaVidaMinisterio";
import { addDays, parseISO } from "date-fns";

const ASEO_GRUPOS_POR_REUNION = 2;

export default function ProgramaAsignacionesServicio() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const { configuraciones } = useConfiguracionSistema("general");
  const diasReunion = configuraciones?.find((c) => c.clave === "dias_reunion")?.valor as
    | { dia_entre_semana?: string; dia_fin_semana?: string }
    | undefined;
  const diaEntreSemana = diasReunion?.dia_entre_semana || "martes";
  const diaFinSemana = diasReunion?.dia_fin_semana || "domingo";

  const { asignaciones, isLoading, upsert, eliminar } = useAsignacionesServicio(year, month);
  const { participantes = [] } = useParticipantes();
  const { grupos = [] } = useGruposPredicacion();

  // Cross-exclusion data
  const { programa: reunionPub = [] } = useReunionPublica(month, year);
  const { data: programasVyM = [] } = useProgramasVidaMinisterio();

  const fechasReunion = useMemo(
    () => getMeetingDatesForMonth(year, month, diaEntreSemana, diaFinSemana),
    [year, month, diaEntreSemana, diaFinSemana]
  );

  // Index existing assignments
  const asigByKey = useMemo(() => {
    const m = new Map<string, AsignacionServicio>();
    asignaciones.forEach((a) => m.set(`${a.fecha}__${a.tipo_asignacion}`, a));
    return m;
  }, [asignaciones]);

  // Build excluded participant IDs by date (busy in V&M / Reunión Pública)
  const ocupadosPorFecha = useMemo(() => {
    const m = new Map<string, Set<string>>();
    const add = (fecha: string, id?: string | null) => {
      if (!id) return;
      if (!m.has(fecha)) m.set(fecha, new Set());
      m.get(fecha)!.add(id);
    };
    reunionPub.forEach((r: any) => {
      ["presidente_id", "orador_id", "orador_suplente_id", "orador_saliente_id", "conductor_atalaya_id", "lector_atalaya_id"].forEach((c) => add(r.fecha, r[c]));
    });
    programasVyM.forEach((p: any) => {
      if (!p.fecha_semana) return;
      const fechaReunion = format(addDays(parseISO(p.fecha_semana), 1), "yyyy-MM-dd");
      [p.presidente_id, p.oracion_inicial_id, p.oracion_final_id, p.perlas_id, p.encargado_sala_b_id, p.encargado_sala_c_id, p.tesoros?.participante_id, p.lectura_biblica?.participante_id, p.estudio_biblico?.conductor_id, p.estudio_biblico?.lector_id].forEach((id) => add(fechaReunion, id));
      (p.maestros || []).forEach((mm: any) => {
        [mm.titular_id, mm.ayudante_id, mm.titular_sala_b_id, mm.ayudante_sala_b_id, mm.titular_sala_c_id, mm.ayudante_sala_c_id].forEach((id: any) => add(fechaReunion, id));
      });
      (p.vida_cristiana || []).forEach((v: any) => add(fechaReunion, v.participante_id));
    });
    return m;
  }, [reunionPub, programasVyM]);

  // Helpers para opciones de selects
  const optionsParticipante = (tipo: TipoAsignacionServicio, fecha: string) => {
    const cfg = TIPOS_ASIGNACION_SERVICIO.find((t) => t.value === tipo);
    if (!cfg || cfg.tipoCampo !== "individual") return [];
    const ocupados = ocupadosPorFecha.get(fecha) || new Set<string>();
    return participantes.filter((p: any) => {
      if (!p.activo || !p.estado_aprobado || p.es_publicador_inactivo) return false;
      if (p.genero !== "M") return false;
      if (cfg.soloAncianos && !(Array.isArray(p.responsabilidad) && p.responsabilidad.includes("anciano"))) return false;
      if (ocupados.has(p.id)) return false;
      return true;
    });
  };

  const gruposOrdenados = useMemo(() => [...grupos].sort((a, b) => a.numero - b.numero), [grupos]);

  // Auto-rotar Aseo y Hospitalidad
  const handleAutoRotar = async () => {
    if (gruposOrdenados.length === 0) {
      toast.error("No hay grupos de predicación configurados");
      return;
    }
    const N = gruposOrdenados.length;
    // Cursor independiente por categoría: arranca en grupo 1
    let cursorAseo = 0;
    let cursorHosp = 0;
    const next = (c: number) => (c + 1) % N;

    const ops: Promise<any>[] = [];
    for (const dr of fechasReunion) {
      let grupoHospId: string | null = null;
      if (dr.dia_reunion === "fin_semana") {
        grupoHospId = gruposOrdenados[cursorHosp].id;
        ops.push(
          upsert.mutateAsync({
            fecha: dr.fecha,
            dia_reunion: dr.dia_reunion,
            tipo_asignacion: "hospitalidad",
            grupo_predicacion_id: grupoHospId,
          })
        );
        cursorHosp = next(cursorHosp);
      }
      // Aseo: 2 grupos consecutivos saltando hospitalidad si coincide
      const aseoTipos: TipoAsignacionServicio[] = ["aseo_1", "aseo_2"];
      for (const tipo of aseoTipos) {
        // saltar si coincide con hospitalidad de ese día
        while (grupoHospId && gruposOrdenados[cursorAseo].id === grupoHospId) {
          cursorAseo = next(cursorAseo);
        }
        const grupoAseoId = gruposOrdenados[cursorAseo].id;
        ops.push(
          upsert.mutateAsync({
            fecha: dr.fecha,
            dia_reunion: dr.dia_reunion,
            tipo_asignacion: tipo,
            grupo_predicacion_id: grupoAseoId,
          })
        );
        cursorAseo = next(cursorAseo);
      }
    }
    await Promise.all(ops);
    toast.success("Rotación de Aseo y Hospitalidad generada");
  };

  const renderCelda = (fecha: string, dr: "entre_semana" | "fin_semana", tipo: TipoAsignacionServicio) => {
    const cfg = TIPOS_ASIGNACION_SERVICIO.find((t) => t.value === tipo)!;
    if (cfg.soloFinSemana && dr !== "fin_semana") {
      return <div className="text-xs text-muted-foreground/40 italic">—</div>;
    }
    const key = `${fecha}__${tipo}`;
    const existing = asigByKey.get(key);

    if (cfg.tipoCampo === "individual") {
      const opts = optionsParticipante(tipo, fecha);
      return (
        <Select
          value={existing?.participante_id || "none"}
          onValueChange={(v) =>
            upsert.mutate({
              fecha,
              dia_reunion: dr,
              tipo_asignacion: tipo,
              participante_id: v === "none" ? null : v,
            })
          }
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="—" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">— Sin asignar —</SelectItem>
            {opts.map((p: any) => (
              <SelectItem key={p.id} value={p.id}>
                {p.nombre} {p.apellido}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    // grupo
    return (
      <Select
        value={existing?.grupo_predicacion_id || "none"}
        onValueChange={(v) =>
          upsert.mutate({
            fecha,
            dia_reunion: dr,
            tipo_asignacion: tipo,
            grupo_predicacion_id: v === "none" ? null : v,
          })
        }
      >
        <SelectTrigger className="h-8 text-xs">
          <SelectValue placeholder="—" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">— Sin asignar —</SelectItem>
          {gruposOrdenados.map((g) => (
            <SelectItem key={g.id} value={g.id}>
              Grupo {g.numero}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight text-primary">
            Asignaciones de Servicio
          </h1>
          <p className="text-sm text-muted-foreground">Programa mensual de asignaciones del salón</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => {
            const d = subMonths(new Date(year, month, 1), 1);
            setYear(d.getFullYear()); setMonth(d.getMonth());
          }}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-medium capitalize min-w-[160px] text-center">
            {format(new Date(year, month, 1), "MMMM yyyy", { locale: es })}
          </span>
          <Button variant="outline" size="icon" onClick={() => {
            const d = addMonths(new Date(year, month, 1), 1);
            setYear(d.getFullYear()); setMonth(d.getMonth());
          }}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button onClick={handleAutoRotar} className="ml-2">
            <Wand2 className="h-4 w-4 mr-2" />
            Auto-rotar Aseo + Hospitalidad
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            {fechasReunion.length} reuniones en el mes
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {isLoading ? (
            <div className="p-6 text-sm text-muted-foreground">Cargando…</div>
          ) : fechasReunion.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">No hay reuniones configuradas para este mes</div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-2 sticky left-0 bg-muted/50 z-10 min-w-[110px]">Fecha</th>
                  {TIPOS_ASIGNACION_SERVICIO.map((t) => (
                    <th key={t.value} className="text-left p-2 min-w-[140px] font-medium">
                      {t.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fechasReunion.map((dr) => (
                  <tr key={dr.fecha} className="border-t">
                    <td className="p-2 sticky left-0 bg-background z-10 font-medium capitalize">
                      <div>{format(parseISO(dr.fecha), "EEE d", { locale: es })}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {dr.dia_reunion === "fin_semana" ? "Fin de semana" : "Entre semana"}
                      </div>
                    </td>
                    {TIPOS_ASIGNACION_SERVICIO.map((t) => (
                      <td key={t.value} className="p-1.5 align-middle">
                        {renderCelda(dr.fecha, dr.dia_reunion, t.value)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
