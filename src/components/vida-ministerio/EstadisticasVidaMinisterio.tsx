import { useMemo, useState, type CSSProperties } from "react";
import { subMonths, isAfter, parseISO } from "date-fns";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Pie, PieChart, Cell, ResponsiveContainer, Tooltip, LabelList } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useProgramasVidaMinisterio } from "@/hooks/useProgramaVidaMinisterio";
import { useParticipantes, type Participante } from "@/hooks/useParticipantes";
import { useConfiguracionSistema } from "@/hooks/useConfiguracionSistema";
import { useLectoresEbc } from "@/hooks/useLectoresEbc";

const COLOR_1 = "hsl(var(--primary))";
const COLOR_2 = "hsl(162 73% 36%)";
const COLOR_3 = "hsl(280 65% 60%)";
const COLOR_4 = "hsl(28 90% 55%)";
const COLOR_VARONES = "hsl(210 80% 55%)";
const COLOR_MUJERES = "hsl(330 75% 60%)";
const COLOR_NO_UTILIZADO = "hsl(var(--muted-foreground))";

const AXIS_TICK_STYLE = { fontSize: 11 };

const TOOLTIP_CONTENT_STYLE: CSSProperties = {
  backgroundColor: "hsl(var(--muted))",
  borderColor: "hsl(var(--border))",
  borderRadius: 8,
  color: "hsl(var(--popover-foreground))",
  fontSize: 12,
  padding: "6px 10px",
};
const TOOLTIP_LABEL_STYLE: CSSProperties = { color: "hsl(var(--primary))", fontSize: 12, fontWeight: 600 };
const TOOLTIP_ITEM_STYLE: CSSProperties = { color: "hsl(var(--popover-foreground))", fontSize: 12, padding: "1px 0" };

type Periodo = "3" | "6" | "12";

interface Categoria {
  key: string;
  nombre: string;
  color: string;
  elegibles: Participante[];
  usadosIds: Set<string>;
}

function nombreCompleto(p: Participante) {
  return `${p.nombre} ${p.apellido}`;
}

function pctUtilizacion(cat: Categoria): number {
  if (cat.elegibles.length === 0) return 0;
  return Math.round((cat.elegibles.filter((p) => cat.usadosIds.has(p.id)).length / cat.elegibles.length) * 100);
}

function noUtilizados(cat: Categoria): Participante[] {
  return cat.elegibles.filter((p) => !cat.usadosIds.has(p.id));
}

export function EstadisticasVidaMinisterio() {
  const [periodo, setPeriodo] = useState<Periodo>("6");
  const [drillDown, setDrillDown] = useState<string | null>(null);

  const { data: programas } = useProgramasVidaMinisterio();
  const { participantes } = useParticipantes();
  const { configuraciones } = useConfiguracionSistema("vida_ministerio");
  const { lectoresElegibles: lectoresEbc } = useLectoresEbc();

  const smHabilitadoVidaCristiana =
    (configuraciones?.find((c) => c.clave === "sm_habilitado_maestros")?.valor as { habilitado?: boolean } | undefined)
      ?.habilitado ?? true;
  const ebcConductorIncluyeSm =
    (configuraciones?.find((c) => c.clave === "ebc_conductor_incluye_sm")?.valor as { habilitado?: boolean } | undefined)
      ?.habilitado ?? false;

  const activos = useMemo(() => (participantes || []).filter((p) => p.activo), [participantes]);
  const ancianos = useMemo(() => activos.filter((p) => p.responsabilidad?.includes("anciano")), [activos]);
  const ancianosYSm = useMemo(
    () => activos.filter((p) => p.responsabilidad?.includes("anciano") || p.responsabilidad?.includes("siervo_ministerial")),
    [activos],
  );
  const smmVaronesExclA = useMemo(
    () => activos.filter((p) => p.inscrito_emc && p.genero === "M" && !p.responsabilidad?.includes("anciano")),
    [activos],
  );
  const smmVaronesExclAySm = useMemo(
    () =>
      activos.filter(
        (p) =>
          p.inscrito_emc &&
          p.genero === "M" &&
          !p.responsabilidad?.includes("anciano") &&
          !p.responsabilidad?.includes("siervo_ministerial"),
      ),
    [activos],
  );
  const smmMujeres = useMemo(() => activos.filter((p) => p.inscrito_emc && p.genero === "F"), [activos]);
  const smmTotalExclA = useMemo(() => {
    const map = new Map<string, Participante>();
    for (const p of smmVaronesExclA) map.set(p.id, p);
    for (const p of smmMujeres) map.set(p.id, p);
    return Array.from(map.values());
  }, [smmVaronesExclA, smmMujeres]);
  const elegiblesVidaCristiana = useMemo(
    () => (smHabilitadoVidaCristiana ? ancianosYSm : ancianos),
    [smHabilitadoVidaCristiana, ancianos, ancianosYSm],
  );
  const elegiblesConductorEbc = useMemo(
    () => (ebcConductorIncluyeSm ? ancianosYSm : ancianos),
    [ebcConductorIncluyeSm, ancianos, ancianosYSm],
  );
  const lectoresEbcIds = useMemo(() => new Set((lectoresEbc || []).map((l) => l.participante_id)), [lectoresEbc]);
  const elegiblesLectorEbc = useMemo(() => activos.filter((p) => lectoresEbcIds.has(p.id)), [activos, lectoresEbcIds]);

  const desde = useMemo(() => subMonths(new Date(), parseInt(periodo, 10)), [periodo]);
  const programasPeriodo = useMemo(
    () =>
      (programas || []).filter((p) => {
        if (p.sin_reunion) return false;
        try {
          return isAfter(parseISO(p.fecha_semana), desde);
        } catch {
          return false;
        }
      }),
    [programas, desde],
  );

  // --- Conjuntos de "utilizados" por rol, dentro del período ---
  const usadosPresidente = useMemo(
    () => new Set(programasPeriodo.map((p) => p.presidente_id).filter((id): id is string => !!id)),
    [programasPeriodo],
  );
  const usadosTesoros = useMemo(
    () => new Set(programasPeriodo.map((p) => p.tesoros?.participante_id).filter((id): id is string => !!id)),
    [programasPeriodo],
  );
  const usadosPerlas = useMemo(
    () => new Set(programasPeriodo.map((p) => p.perlas_id).filter((id): id is string => !!id)),
    [programasPeriodo],
  );
  const usadosLecturaBiblica = useMemo(
    () => new Set(programasPeriodo.map((p) => p.lectura_biblica?.participante_id).filter((id): id is string => !!id)),
    [programasPeriodo],
  );

  const idsPorTipoMaestro = (tipo: "demostracion" | "discurso") => {
    const ids: string[] = [];
    for (const p of programasPeriodo) {
      for (const m of p.maestros || []) {
        if (m.tipo !== tipo) continue;
        ids.push(m.titular_id, m.ayudante_id, m.titular_sala_b_id, m.ayudante_sala_b_id, m.titular_sala_c_id, m.ayudante_sala_c_id);
      }
    }
    return ids.filter((id): id is string => !!id);
  };
  const idsDemostraciones = useMemo(() => idsPorTipoMaestro("demostracion"), [programasPeriodo]);
  const idsDiscurso = useMemo(() => idsPorTipoMaestro("discurso"), [programasPeriodo]);
  const usadosDemostraciones = useMemo(() => new Set(idsDemostraciones), [idsDemostraciones]);
  const usadosDiscurso = useMemo(() => new Set(idsDiscurso), [idsDiscurso]);

  const usadosVidaCristiana = useMemo(() => {
    const ids: string[] = [];
    for (const p of programasPeriodo) {
      for (const parte of p.vida_cristiana || []) {
        if (parte.participante_id) ids.push(parte.participante_id);
      }
    }
    return new Set(ids);
  }, [programasPeriodo]);

  const usadosConductorEbc = useMemo(
    () =>
      new Set(
        programasPeriodo
          .filter((p) => !p.estudio_biblico?.visita_superintendente)
          .map((p) => p.estudio_biblico?.conductor_id)
          .filter((id): id is string => !!id),
      ),
    [programasPeriodo],
  );
  const usadosLectorEbc = useMemo(
    () =>
      new Set(
        programasPeriodo
          .filter((p) => !p.estudio_biblico?.visita_superintendente)
          .map((p) => p.estudio_biblico?.lector_id)
          .filter((id): id is string => !!id),
      ),
    [programasPeriodo],
  );

  // --- Categorías (pool elegible + usados) ---
  const catPresidente: Categoria = { key: "presidente", nombre: "Presidente", color: COLOR_1, elegibles: ancianos, usadosIds: usadosPresidente };
  const catTesoros: Categoria = { key: "tesoros", nombre: "Tesoros", color: COLOR_2, elegibles: ancianosYSm, usadosIds: usadosTesoros };
  const catPerlas: Categoria = { key: "perlas", nombre: "Perlas", color: COLOR_3, elegibles: ancianosYSm, usadosIds: usadosPerlas };

  const catLecturaBiblica: Categoria = {
    key: "lectura_biblica",
    nombre: "Lectura Bíblica",
    color: COLOR_1,
    elegibles: smmVaronesExclAySm,
    usadosIds: usadosLecturaBiblica,
  };
  const catDemostraciones: Categoria = {
    key: "demostraciones",
    nombre: "Demostraciones",
    color: COLOR_2,
    elegibles: smmTotalExclA,
    usadosIds: usadosDemostraciones,
  };
  const catDiscurso: Categoria = {
    key: "discurso",
    nombre: "Discurso",
    color: COLOR_3,
    elegibles: smmVaronesExclA,
    usadosIds: usadosDiscurso,
  };

  const catVidaCristiana: Categoria = {
    key: "vida_cristiana",
    nombre: "Nuestra Vida Cristiana",
    color: COLOR_1,
    elegibles: elegiblesVidaCristiana,
    usadosIds: usadosVidaCristiana,
  };

  const catConductorEbc: Categoria = {
    key: "conductor_ebc",
    nombre: "Conductor",
    color: COLOR_1,
    elegibles: elegiblesConductorEbc,
    usadosIds: usadosConductorEbc,
  };
  const catLectorEbc: Categoria = {
    key: "lector_ebc",
    nombre: "Lector",
    color: COLOR_2,
    elegibles: elegiblesLectorEbc,
    usadosIds: usadosLectorEbc,
  };

  const seccionTesoros = [catPresidente, catTesoros, catPerlas];
  const seccionSmm = [catLecturaBiblica, catDiscurso];
  const seccionVidaCristiana = [catVidaCristiana];
  const seccionEbc = [catConductorEbc, catLectorEbc];

  const catDrillDown = [
    catPresidente,
    catTesoros,
    catPerlas,
    catLecturaBiblica,
    catDemostraciones,
    catDiscurso,
    catVidaCristiana,
    catConductorEbc,
    catLectorEbc,
  ].find((c) => c.key === drillDown);

  // --- "Más utilizados" (roster completo, todas las categorías) ---
  const TODAS_CATEGORIAS = [
    catPresidente,
    catTesoros,
    catPerlas,
    catLecturaBiblica,
    catDemostraciones,
    catDiscurso,
    catVidaCristiana,
    catConductorEbc,
    catLectorEbc,
  ];

  const datosMasUtilizados = useMemo(() => {
    const roster = new Map<string, Participante>();
    for (const cat of TODAS_CATEGORIAS) {
      for (const p of cat.elegibles) roster.set(p.id, p);
    }
    return Array.from(roster.values())
      .map((p) => {
        const conteos: Record<string, number> = {};
        let total = 0;
        for (const cat of TODAS_CATEGORIAS) {
          if (!cat.elegibles.some((e) => e.id === p.id)) continue;
          const c = cat.usadosIds.has(p.id) ? contarOcurrencias(p.id, cat.key, programasPeriodo) : 0;
          if (c > 0) {
            conteos[cat.nombre] = (conteos[cat.nombre] || 0) + c;
            total += c;
          }
        }
        return { nombre: nombreCompleto(p), total, ...conteos };
      })
      .sort((a, b) => b.total - a.total);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programasPeriodo, ancianos, ancianosYSm, smmVaronesExclA, smmVaronesExclAySm, smmMujeres, elegiblesVidaCristiana, elegiblesConductorEbc, elegiblesLectorEbc]);

  function contarOcurrencias(participanteId: string, catKey: string, prog: typeof programasPeriodo): number {
    switch (catKey) {
      case "presidente":
        return prog.filter((p) => p.presidente_id === participanteId).length;
      case "tesoros":
        return prog.filter((p) => p.tesoros?.participante_id === participanteId).length;
      case "perlas":
        return prog.filter((p) => p.perlas_id === participanteId).length;
      case "lectura_biblica":
        return prog.filter((p) => p.lectura_biblica?.participante_id === participanteId).length;
      case "demostraciones":
        return idsDemostraciones.filter((id) => id === participanteId).length;
      case "discurso":
        return idsDiscurso.filter((id) => id === participanteId).length;
      case "vida_cristiana":
        return prog.reduce(
          (acc, p) => acc + (p.vida_cristiana || []).filter((v) => v.participante_id === participanteId).length,
          0,
        );
      case "conductor_ebc":
        return prog.filter((p) => !p.estudio_biblico?.visita_superintendente && p.estudio_biblico?.conductor_id === participanteId)
          .length;
      case "lector_ebc":
        return prog.filter((p) => !p.estudio_biblico?.visita_superintendente && p.estudio_biblico?.lector_id === participanteId)
          .length;
      default:
        return 0;
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-muted-foreground">% de utilización por sección del programa de Vida y Ministerio</p>
        <Select value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="3">Últimos 3 meses</SelectItem>
            <SelectItem value="6">Últimos 6 meses</SelectItem>
            <SelectItem value="12">Últimos 12 meses</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <SeccionEstadisticas
        titulo="TESOROS DE LA BIBLIA"
        categorias={seccionTesoros}
        drillDown={drillDown}
        setDrillDown={setDrillDown}
      />

      <SeccionSmm
        catLecturaBiblica={catLecturaBiblica}
        catDemostraciones={catDemostraciones}
        catDiscurso={catDiscurso}
        drillDown={drillDown}
        setDrillDown={setDrillDown}
      />

      <SeccionEstadisticas
        titulo="NUESTRA VIDA CRISTIANA"
        categorias={seccionVidaCristiana}
        drillDown={drillDown}
        setDrillDown={setDrillDown}
      />

      <SeccionEstadisticas
        titulo="ESTUDIO BÍBLICO DE LA CONGREGACIÓN"
        subtitulo="Incluye Conductor y Lector"
        categorias={seccionEbc}
        drillDown={drillDown}
        setDrillDown={setDrillDown}
      />

      {catDrillDown && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              No utilizados en {catDrillDown.nombre} (últimos {periodo} meses)
            </CardTitle>
            <CardDescription>{noUtilizados(catDrillDown).length} participante(s)</CardDescription>
          </CardHeader>
          <CardContent>
            {noUtilizados(catDrillDown).length === 0 ? (
              <p className="text-sm text-muted-foreground">Todos los elegibles fueron utilizados en este período.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {noUtilizados(catDrillDown).map((p) => (
                  <Badge key={p.id} variant="secondary">
                    {nombreCompleto(p)}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <MasUtilizados datos={datosMasUtilizados} categorias={TODAS_CATEGORIAS} periodo={periodo} />
    </div>
  );
}

// --- Sección genérica: barra "% de utilización" + tortas "Utilizados vs. no utilizados" ---
function SeccionEstadisticas({
  titulo,
  subtitulo,
  categorias,
  drillDown,
  setDrillDown,
}: {
  titulo: string;
  subtitulo?: string;
  categorias: Categoria[];
  drillDown: string | null;
  setDrillDown: (v: string | null | ((prev: string | null) => string | null)) => void;
}) {
  const datosBarra = categorias.map((c) => ({ categoria: c.nombre, "% utilización": pctUtilizacion(c), color: c.color }));

  return (
    <div className="space-y-2">
      <div>
        <h3 className="text-sm font-semibold">{titulo}</h3>
        {subtitulo && <p className="text-xs text-muted-foreground">{subtitulo}</p>}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">% de utilización</CardTitle>
            <CardDescription>Porcentaje de elegibles usados al menos una vez en el período</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={datosBarra}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.35} />
                <XAxis dataKey="categoria" tick={AXIS_TICK_STYLE} />
                <YAxis unit="%" domain={[0, 100]} tick={AXIS_TICK_STYLE} />
                <Tooltip
                  cursor={{ fill: "hsl(var(--foreground))", fillOpacity: 0.015, radius: 4 }}
                  contentStyle={TOOLTIP_CONTENT_STYLE}
                  labelStyle={TOOLTIP_LABEL_STYLE}
                  itemStyle={TOOLTIP_ITEM_STYLE}
                  formatter={(value: number) => `${value}%`}
                />
                <Bar dataKey="% utilización" radius={[4, 4, 0, 0]}>
                  {datosBarra.map((d) => (
                    <Cell key={d.categoria} fill={d.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Utilizados vs. no utilizados</CardTitle>
            <CardDescription>Haz clic en "No utilizados" para ver la lista de participantes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {categorias.map((cat) => {
                const pct = pctUtilizacion(cat);
                const datos = [
                  { name: "Utilizados", value: cat.elegibles.length - noUtilizados(cat).length },
                  { name: "No utilizados", value: noUtilizados(cat).length },
                ];
                return (
                  <div key={cat.key} className="space-y-1">
                    <p className="text-xs text-center font-medium text-muted-foreground">{cat.nombre}</p>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-0 z-0 flex flex-col items-center justify-center">
                        <span className="text-sm font-semibold">{100 - pct}%</span>
                        <span className="text-[9px] text-muted-foreground">no utilizados</span>
                      </div>
                      <div className="relative z-10">
                        <ResponsiveContainer width="100%" height={180}>
                          <PieChart>
                            <Pie
                              data={datos}
                              dataKey="value"
                              nameKey="name"
                              innerRadius={35}
                              outerRadius={65}
                              stroke="none"
                              cursor="pointer"
                              onClick={(entry) => {
                                if (entry?.name === "No utilizados") setDrillDown((prev) => (prev === cat.key ? null : cat.key));
                              }}
                            >
                              {datos.map((d) => (
                                <Cell key={d.name} fill={d.name === "Utilizados" ? cat.color : COLOR_NO_UTILIZADO} />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={TOOLTIP_CONTENT_STYLE}
                              labelStyle={TOOLTIP_LABEL_STYLE}
                              itemStyle={TOOLTIP_ITEM_STYLE}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <div className="flex justify-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full inline-block" style={{ background: cat.color }} />
                        Utilizados
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full inline-block" style={{ background: COLOR_NO_UTILIZADO }} />
                        No utilizados
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// --- Sección SMM: igual que la genérica, pero Demostraciones reparte su % total entre varones/mujeres
// según la composición de los utilizados (no dos pools independientes) ---
function SeccionSmm({
  catLecturaBiblica,
  catDemostraciones,
  catDiscurso,
  drillDown,
  setDrillDown,
}: {
  catLecturaBiblica: Categoria;
  catDemostraciones: Categoria;
  catDiscurso: Categoria;
  drillDown: string | null;
  setDrillDown: (v: string | null | ((prev: string | null) => string | null)) => void;
}) {
  const pctDemostraciones = pctUtilizacion(catDemostraciones);
  const utilizadosDemostraciones = catDemostraciones.elegibles.filter((p) => catDemostraciones.usadosIds.has(p.id));
  const utilizadosVarones = utilizadosDemostraciones.filter((p) => p.genero === "M").length;
  const utilizadosMujeres = utilizadosDemostraciones.filter((p) => p.genero === "F").length;
  const totalUtilizados = utilizadosVarones + utilizadosMujeres;
  const pctDemostracionesVarones = totalUtilizados > 0 ? Math.round((pctDemostraciones * utilizadosVarones) / totalUtilizados) : 0;
  const pctDemostracionesMujeres = totalUtilizados > 0 ? pctDemostraciones - pctDemostracionesVarones : 0;

  const datosBarra = [
    { categoria: "Lectura Bíblica", total: pctUtilizacion(catLecturaBiblica), color: catLecturaBiblica.color },
    { categoria: "Demostraciones", varones: pctDemostracionesVarones, mujeres: pctDemostracionesMujeres },
    { categoria: "Discurso", total: pctUtilizacion(catDiscurso), color: catDiscurso.color },
  ];

  const categoriasTorta = [catLecturaBiblica, catDemostraciones, catDiscurso];

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">SMM (Escuela del Ministerio)</h3>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">% de utilización</CardTitle>
            <CardDescription>En Demostraciones, el % total se divide entre varones y mujeres según cuántos de cada uno fueron utilizados</CardDescription>
            <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full inline-block" style={{ background: COLOR_VARONES }} />
                Varones
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full inline-block" style={{ background: COLOR_MUJERES }} />
                Mujeres
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={datosBarra}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.35} />
                <XAxis dataKey="categoria" tick={AXIS_TICK_STYLE} />
                <YAxis unit="%" domain={[0, 100]} tick={AXIS_TICK_STYLE} />
                <Tooltip
                  cursor={{ fill: "hsl(var(--foreground))", fillOpacity: 0.015, radius: 4 }}
                  contentStyle={TOOLTIP_CONTENT_STYLE}
                  labelStyle={TOOLTIP_LABEL_STYLE}
                  itemStyle={TOOLTIP_ITEM_STYLE}
                  formatter={(value: number) => `${value}%`}
                />
                <Bar dataKey="total" stackId="s" radius={[4, 4, 0, 0]}>
                  {datosBarra.map((d) => (
                    <Cell key={d.categoria} fill={d.color || "transparent"} />
                  ))}
                </Bar>
                <Bar dataKey="mujeres" stackId="s" fill={COLOR_MUJERES} />
                <Bar dataKey="varones" stackId="s" fill={COLOR_VARONES} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Utilizados vs. no utilizados</CardTitle>
            <CardDescription>Haz clic en "No utilizados" para ver la lista de participantes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2">
              {categoriasTorta.map((cat) => {
                const pct = pctUtilizacion(cat);
                const datos = [
                  { name: "Utilizados", value: cat.elegibles.length - noUtilizados(cat).length },
                  { name: "No utilizados", value: noUtilizados(cat).length },
                ];
                return (
                  <div key={cat.key} className="space-y-1">
                    <p className="text-xs text-center font-medium text-muted-foreground">{cat.nombre}</p>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-0 z-0 flex flex-col items-center justify-center">
                        <span className="text-sm font-semibold">{100 - pct}%</span>
                        <span className="text-[9px] text-muted-foreground">no utilizados</span>
                      </div>
                      <div className="relative z-10">
                        <ResponsiveContainer width="100%" height={160}>
                          <PieChart>
                            <Pie
                              data={datos}
                              dataKey="value"
                              nameKey="name"
                              innerRadius={30}
                              outerRadius={58}
                              stroke="none"
                              cursor="pointer"
                              onClick={(entry) => {
                                if (entry?.name === "No utilizados") setDrillDown((prev) => (prev === cat.key ? null : cat.key));
                              }}
                            >
                              {datos.map((d) => (
                                <Cell key={d.name} fill={d.name === "Utilizados" ? cat.color : COLOR_NO_UTILIZADO} />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={TOOLTIP_CONTENT_STYLE}
                              labelStyle={TOOLTIP_LABEL_STYLE}
                              itemStyle={TOOLTIP_ITEM_STYLE}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// --- "Más utilizados": barra vertical de ancho completo, todos los elegibles, responsiva con scroll ---
function MasUtilizados({
  datos,
  categorias,
  periodo,
}: {
  datos: Array<Record<string, any>>;
  categorias: Categoria[];
  periodo: Periodo;
}) {
  const nombresCategorias = Array.from(new Set(categorias.map((c) => c.nombre)));
  const colorPorNombre = new Map(categorias.map((c) => [c.nombre, c.color]));

  function segmentoSuperior(payload: Record<string, number>): string | null {
    for (let i = nombresCategorias.length - 1; i >= 0; i--) {
      if ((payload[nombresCategorias[i]] || 0) > 0) return nombresCategorias[i];
    }
    return null;
  }

  function barraApiladaRedondeada(categoria: string) {
    return (props: any) => {
      const { x, y, width, height, fill, payload } = props;
      if (height <= 0) return <g />;
      const r = segmentoSuperior(payload) === categoria ? 4 : 0;
      const path = `M${x},${y + height} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + width - r},${y} Q${x + width},${y} ${x + width},${y + r} L${x + width},${y + height} Z`;
      return <path d={path} fill={fill} />;
    };
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Más utilizados</CardTitle>
        <CardDescription>
          Cantidad de veces que cada elegible fue asignado en cada sección del programa en el período seleccionado
        </CardDescription>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground pt-1">
          {nombresCategorias.map((nombre) => (
            <span key={nombre} className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full inline-block" style={{ background: colorPorNombre.get(nombre) }} />
              {nombre}
            </span>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {datos.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay elegibles configurados.</p>
        ) : (
          <div className="overflow-x-auto">
            <div style={{ minWidth: Math.max(datos.length * 30, 600), width: "100%", height: 340 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={datos} margin={{ bottom: 70 }} barCategoryGap="15%" maxBarSize={18}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.35} />
                  <XAxis dataKey="nombre" tick={AXIS_TICK_STYLE} interval={0} angle={-45} textAnchor="end" />
                  <YAxis allowDecimals={false} tick={AXIS_TICK_STYLE} />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--foreground))", fillOpacity: 0.015, radius: 4 }}
                    contentStyle={TOOLTIP_CONTENT_STYLE}
                    labelStyle={TOOLTIP_LABEL_STYLE}
                    itemStyle={TOOLTIP_ITEM_STYLE}
                  />
                  {nombresCategorias.map((nombre) => (
                    <Bar key={nombre} dataKey={nombre} stackId="a" fill={colorPorNombre.get(nombre)} shape={barraApiladaRedondeada(nombre)}>
                      <LabelList
                        dataKey={nombre}
                        position="inside"
                        style={{ fontSize: 10, fill: "#fff" }}
                        formatter={(v: number) => (v > 0 ? v : "")}
                      />
                    </Bar>
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
