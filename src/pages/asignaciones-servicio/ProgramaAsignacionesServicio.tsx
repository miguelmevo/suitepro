import { useMemo, useState, useRef } from "react";
import { format, addMonths, subMonths, addDays, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Wand2, Sparkles, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useReactToPrint } from "react-to-print";
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
import { useCongregacion } from "@/contexts/CongregacionContext";
import { ImpresionAsignacionesServicio } from "@/components/asignaciones-servicio/ImpresionAsignacionesServicio";

export default function ProgramaAsignacionesServicio() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const { configuraciones: cfgGeneral } = useConfiguracionSistema("general");
  const { configuraciones: cfgAsig } = useConfiguracionSistema("asignaciones");
  const { congregacionActual } = useCongregacion();

  const diasReunion = cfgGeneral?.find((c) => c.clave === "dias_reunion")?.valor as
    | { dia_entre_semana?: string; dia_fin_semana?: string }
    | undefined;
  const diaEntreSemana = diasReunion?.dia_entre_semana || "martes";
  const diaFinSemana = diasReunion?.dia_fin_semana || "domingo";

  const aseoGruposPorReunion =
    Number(cfgAsig?.find((c) => c.clave === "aseo_grupos_por_reunion")?.valor?.cantidad) || 2;
  const grupoInicialAseo =
    Number(cfgAsig?.find((c) => c.clave === "rotacion_grupo_inicial_aseo")?.valor?.numero) || 1;
  const grupoInicialHosp =
    Number(cfgAsig?.find((c) => c.clave === "rotacion_grupo_inicial_hospitalidad")?.valor?.numero) || 1;

  const { asignaciones, isLoading, upsert } = useAsignacionesServicio(year, month);
  const { participantes = [] } = useParticipantes();
  const { grupos = [] } = useGruposPredicacion();

  const { programa: reunionPub = [] } = useReunionPublica(month, year);
  const { data: programasVyM = [] } = useProgramasVidaMinisterio();

  const fechasReunion = useMemo(
    () => getMeetingDatesForMonth(year, month, diaEntreSemana, diaFinSemana),
    [year, month, diaEntreSemana, diaFinSemana]
  );

  const asigByKey = useMemo(() => {
    const m = new Map<string, AsignacionServicio>();
    asignaciones.forEach((a) => m.set(`${a.fecha}__${a.tipo_asignacion}`, a));
    return m;
  }, [asignaciones]);

  // Asignados por fecha (cross-modulo: VyM + Reunión Pública)
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

  // Asignados internos (mismo día, otro slot individual de servicio)
  const asignadosInternosPorFecha = useMemo(() => {
    const m = new Map<string, Set<string>>();
    asignaciones.forEach((a) => {
      if (!a.participante_id) return;
      if (!m.has(a.fecha)) m.set(a.fecha, new Set());
      m.get(a.fecha)!.add(a.participante_id);
    });
    return m;
  }, [asignaciones]);

  // Mapa fecha -> fecha de la reunión anterior (para regla "no 2 reuniones seguidas")
  const prevFechaMap = useMemo(() => {
    const m = new Map<string, string>();
    for (let i = 1; i < fechasReunion.length; i++) {
      m.set(fechasReunion[i].fecha, fechasReunion[i - 1].fecha);
    }
    return m;
  }, [fechasReunion]);

  const optionsParticipante = (tipo: TipoAsignacionServicio, fecha: string) => {
    const cfg = TIPOS_ASIGNACION_SERVICIO.find((t) => t.value === tipo);
    if (!cfg || cfg.tipoCampo !== "individual") return [];
    const ocupados = ocupadosPorFecha.get(fecha) || new Set<string>();
    const internos = asignadosInternosPorFecha.get(fecha) || new Set<string>();
    const prevFecha = prevFechaMap.get(fecha);
    const asignadosPrev = prevFecha ? (asignadosInternosPorFecha.get(prevFecha) || new Set<string>()) : new Set<string>();
    const yaEnEsteSlot = asigByKey.get(`${fecha}__${tipo}`)?.participante_id || null;
    return participantes.filter((p: any) => {
      if (!p.activo || !p.estado_aprobado || p.es_publicador_inactivo) return false;
      if (p.genero !== "M") return false;
      if (cfg.soloAncianos && !(Array.isArray(p.responsabilidad) && p.responsabilidad.includes("anciano"))) return false;
      if (ocupados.has(p.id)) return false;
      // bloquear si ya está en otro slot individual el mismo día (excepto este mismo slot)
      if (internos.has(p.id) && p.id !== yaEnEsteSlot) return false;
      // regla: no puede haber tenido asignación de servicio en la reunión inmediatamente anterior
      if (asignadosPrev.has(p.id) && p.id !== yaEnEsteSlot) return false;
      return true;
    });
  };

  const gruposOrdenados = useMemo(() => [...grupos].sort((a, b) => a.numero - b.numero), [grupos]);

  const handleAutoRotar = async () => {
    if (gruposOrdenados.length === 0) {
      toast.error("No hay grupos de predicación configurados");
      return;
    }
    const N = gruposOrdenados.length;
    const idxFromNumero = (num: number) => Math.max(0, ((num - 1) % N + N) % N);
    let cursorAseo = idxFromNumero(grupoInicialAseo);
    let cursorHosp = idxFromNumero(grupoInicialHosp);
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
      const aseoTipos: TipoAsignacionServicio[] = (["aseo_1", "aseo_2"] as TipoAsignacionServicio[]).slice(0, Math.min(aseoGruposPorReunion, 2));
      for (const tipo of aseoTipos) {
        // skip si coincide con hospitalidad
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

  const handleAutoGenerarTodo = async () => {
    if (fechasReunion.length === 0) {
      toast.error("No hay reuniones configuradas para este mes");
      return;
    }

    // Estado local mutable para respetar reglas durante la generación
    const localServicio = new Map<string, Set<string>>();
    asignaciones.forEach((a) => {
      if (!a.participante_id) return;
      if (!localServicio.has(a.fecha)) localServicio.set(a.fecha, new Set());
      localServicio.get(a.fecha)!.add(a.participante_id);
    });
    const counts = new Map<string, number>();
    asignaciones.forEach((a) => {
      if (a.participante_id) counts.set(a.participante_id, (counts.get(a.participante_id) || 0) + 1);
    });

    const ops: Promise<any>[] = [];
    const tiposIndividuales = tiposVisibles.filter((t) => t.tipoCampo === "individual");

    for (const dr of fechasReunion) {
      const ocupadosCross = ocupadosPorFecha.get(dr.fecha) || new Set<string>();
      const prevFecha = prevFechaMap.get(dr.fecha);
      const asignadosPrev = prevFecha ? (localServicio.get(prevFecha) || new Set<string>()) : new Set<string>();
      if (!localServicio.has(dr.fecha)) localServicio.set(dr.fecha, new Set());
      const usadosHoy = localServicio.get(dr.fecha)!;

      for (const cfg of tiposIndividuales) {
        const key = `${dr.fecha}__${cfg.value}`;
        const existing = asigByKey.get(key);
        if (existing?.participante_id) continue; // respetar asignaciones existentes

        const candidatos = (participantes as any[]).filter((p) => {
          if (!p.activo || !p.estado_aprobado || p.es_publicador_inactivo) return false;
          if (p.genero !== "M") return false;
          if (cfg.soloAncianos && !(Array.isArray(p.responsabilidad) && p.responsabilidad.includes("anciano"))) return false;
          if (cfg.respParticipante && !(Array.isArray(p.responsabilidad) && p.responsabilidad.includes(cfg.respParticipante))) return false;
          if (ocupadosCross.has(p.id)) return false;
          if (usadosHoy.has(p.id)) return false;
          if (asignadosPrev.has(p.id)) return false;
          return true;
        });

        if (candidatos.length === 0) continue;
        // Equilibrar: menor cantidad de asignaciones acumuladas, desempate aleatorio
        const minCount = Math.min(...candidatos.map((p) => counts.get(p.id) || 0));
        const pool = candidatos.filter((p) => (counts.get(p.id) || 0) === minCount);
        const elegido = pool[Math.floor(Math.random() * pool.length)];

        usadosHoy.add(elegido.id);
        counts.set(elegido.id, (counts.get(elegido.id) || 0) + 1);

        ops.push(
          upsert.mutateAsync({
            fecha: dr.fecha,
            dia_reunion: dr.dia_reunion,
            tipo_asignacion: cfg.value,
            participante_id: elegido.id,
          })
        );
      }
    }

    // También ejecutar rotación de Aseo + Hospitalidad
    if (gruposOrdenados.length > 0) {
      const N = gruposOrdenados.length;
      const idxFromNumero = (num: number) => Math.max(0, ((num - 1) % N + N) % N);
      let cursorAseo = idxFromNumero(grupoInicialAseo);
      let cursorHosp = idxFromNumero(grupoInicialHosp);
      const next = (c: number) => (c + 1) % N;
      for (const dr of fechasReunion) {
        let grupoHospId: string | null = null;
        if (dr.dia_reunion === "fin_semana") {
          grupoHospId = gruposOrdenados[cursorHosp].id;
          ops.push(upsert.mutateAsync({ fecha: dr.fecha, dia_reunion: dr.dia_reunion, tipo_asignacion: "hospitalidad", grupo_predicacion_id: grupoHospId }));
          cursorHosp = next(cursorHosp);
        }
        const aseoTipos: TipoAsignacionServicio[] = (["aseo_1", "aseo_2"] as TipoAsignacionServicio[]).slice(0, Math.min(aseoGruposPorReunion, 2));
        for (const tipo of aseoTipos) {
          while (grupoHospId && gruposOrdenados[cursorAseo].id === grupoHospId) cursorAseo = next(cursorAseo);
          ops.push(upsert.mutateAsync({ fecha: dr.fecha, dia_reunion: dr.dia_reunion, tipo_asignacion: tipo, grupo_predicacion_id: gruposOrdenados[cursorAseo].id }));
          cursorAseo = next(cursorAseo);
        }
      }
    }

    try {
      await Promise.all(ops);
      toast.success("Programa generado automáticamente");
    } catch (e: any) {
      toast.error(e.message || "Error al generar el programa");
    }
  };

  // Tipos visibles dependientes de aseo_grupos_por_reunion
  const tiposVisibles = useMemo(() => {
    return TIPOS_ASIGNACION_SERVICIO.filter((t) => {
      if (t.value.startsWith("aseo_")) {
        const n = Number(t.value.replace("aseo_", ""));
        return n <= aseoGruposPorReunion;
      }
      return true;
    });
  }, [aseoGruposPorReunion]);

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

  // Print
  const printRef = useRef<HTMLDivElement>(null);
  const mesAnio = format(new Date(year, month, 1), "MMMM yyyy", { locale: es });
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Asignaciones de Servicio - ${mesAnio}`,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight text-primary">
            Asignaciones de Servicio
          </h1>
          <p className="text-sm text-muted-foreground">Programa mensual de asignaciones del salón</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="icon" onClick={() => {
            const d = subMonths(new Date(year, month, 1), 1);
            setYear(d.getFullYear()); setMonth(d.getMonth());
          }}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-medium capitalize min-w-[160px] text-center">
            {mesAnio}
          </span>
          <Button variant="outline" size="icon" onClick={() => {
            const d = addMonths(new Date(year, month, 1), 1);
            setYear(d.getFullYear()); setMonth(d.getMonth());
          }}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button onClick={handleAutoRotar} variant="outline">
            <Wand2 className="h-4 w-4 mr-2" />
            Auto-rotar Aseo + Hospitalidad
          </Button>
          <Button onClick={() => handlePrint()}>
            <Printer className="h-4 w-4 mr-2" />
            Imprimir / PDF
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
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-sm text-muted-foreground">Cargando…</div>
          ) : fechasReunion.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">No hay reuniones configuradas para este mes</div>
          ) : (
            <div className="relative max-h-[70vh] w-full overflow-x-auto overflow-y-auto">
            <table className="min-w-max text-xs border-collapse">
              <thead className="bg-muted">
                <tr>
                  <th className="text-center p-2 sticky left-0 top-0 bg-muted z-[3] min-w-[110px] border-b border-r font-bold uppercase">Fecha</th>
                  {tiposVisibles.map((t) => (
                    <th key={t.value} className="text-center p-2 min-w-[140px] font-bold uppercase sticky top-0 bg-muted z-[2] border-b">
                      {t.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fechasReunion.map((dr) => (
                  <tr key={dr.fecha} className="border-t">
                    <td className="p-2 sticky left-0 min-w-[110px] bg-background z-[1] font-medium capitalize border-r">
                      <div>{format(parseISO(dr.fecha), "EEE d", { locale: es })}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {dr.dia_reunion === "fin_semana" ? "Fin de semana" : "Entre semana"}
                      </div>
                    </td>
                    {tiposVisibles.map((t) => (
                      <td key={t.value} className="p-1.5 align-middle">
                        {renderCelda(dr.fecha, dr.dia_reunion, t.value)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Componente oculto para impresión */}
      <div style={{ position: "absolute", left: "-99999px", top: 0 }}>
        <ImpresionAsignacionesServicio
          ref={printRef}
          fechasReunion={fechasReunion}
          tipos={tiposVisibles}
          asignaciones={asignaciones}
          participantes={participantes as any}
          grupos={gruposOrdenados as any}
          congregacionNombre={congregacionActual?.nombre || ""}
          mesAnio={mesAnio}
          colorTema={(congregacionActual as any)?.color_primario || "blue"}
        />
      </div>
    </div>
  );
}
