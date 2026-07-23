import { useMemo, useState, type CSSProperties } from "react";
import { subMonths, isAfter, parseISO } from "date-fns";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Pie, PieChart, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useProgramasReunionPublicaTodos, useReunionPublica } from "@/hooks/useReunionPublica";
import { useParticipantes } from "@/hooks/useParticipantes";

const COLOR_PRESIDENCIA = "hsl(var(--primary))";
const COLOR_LECTOR = "hsl(var(--accent))";
const COLOR_ORADOR = "hsl(280 65% 60%)";
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
const TOOLTIP_LABEL_STYLE: CSSProperties = { color: "hsl(var(--popover-foreground))", fontSize: 12 };
const TOOLTIP_ITEM_STYLE: CSSProperties = { color: "hsl(var(--popover-foreground))", fontSize: 12 };

type Periodo = "3" | "6" | "12";

export function EstadisticasReunionPublica() {
  const [periodo, setPeriodo] = useState<Periodo>("6");
  const [drillDown, setDrillDown] = useState<"presidencia" | "lector" | "orador" | null>(null);

  const { data: historial } = useProgramasReunionPublicaTodos();
  const { participantes } = useParticipantes();
  const { lectoresElegibles } = useReunionPublica();

  const elegiblesPresidencia = useMemo(
    () =>
      (participantes || []).filter(
        (p) => p.activo && p.responsabilidad?.some((r) => r === "anciano" || r === "siervo_ministerial"),
      ),
    [participantes],
  );

  const lectoresElegiblesIds = useMemo(() => new Set((lectoresElegibles || []).map((l) => l.participante_id)), [
    lectoresElegibles,
  ]);
  const elegiblesLector = useMemo(
    () => (participantes || []).filter((p) => p.activo && lectoresElegiblesIds.has(p.id)),
    [participantes, lectoresElegiblesIds],
  );

  const desde = useMemo(() => subMonths(new Date(), parseInt(periodo, 10)), [periodo]);

  const historialPeriodo = useMemo(
    () =>
      (historial || []).filter((p) => {
        try {
          return isAfter(parseISO(p.fecha), desde);
        } catch {
          return false;
        }
      }),
    [historial, desde],
  );

  const usadosPresidencia = useMemo(
    () => new Set(historialPeriodo.map((p) => p.presidente_id).filter((id): id is string => !!id)),
    [historialPeriodo],
  );
  const usadosLector = useMemo(
    () => new Set(historialPeriodo.map((p) => p.lector_atalaya_id).filter((id): id is string => !!id)),
    [historialPeriodo],
  );
  const usadosOrador = useMemo(
    () => new Set(historialPeriodo.map((p) => p.orador_id).filter((id): id is string => !!id)),
    [historialPeriodo],
  );

  const noUtilizadosPresidencia = elegiblesPresidencia.filter((p) => !usadosPresidencia.has(p.id));
  const noUtilizadosLector = elegiblesLector.filter((p) => !usadosLector.has(p.id));
  const noUtilizadosOrador = elegiblesPresidencia.filter((p) => !usadosOrador.has(p.id));

  const pctPresidencia = elegiblesPresidencia.length
    ? Math.round(
        (elegiblesPresidencia.filter((p) => usadosPresidencia.has(p.id)).length / elegiblesPresidencia.length) * 100,
      )
    : 0;
  const pctLector = elegiblesLector.length
    ? Math.round((elegiblesLector.filter((p) => usadosLector.has(p.id)).length / elegiblesLector.length) * 100)
    : 0;
  const pctOrador = elegiblesPresidencia.length
    ? Math.round(
        (elegiblesPresidencia.filter((p) => usadosOrador.has(p.id)).length / elegiblesPresidencia.length) * 100,
      )
    : 0;

  const datosBarra = [
    { categoria: "Presidencia", "% utilización": pctPresidencia },
    { categoria: "Lector de la Atalaya", "% utilización": pctLector },
    { categoria: "Orador (local)", "% utilización": pctOrador },
  ];

  const datosTortaPresidencia = [
    { name: "Utilizados", value: elegiblesPresidencia.length - noUtilizadosPresidencia.length, key: "presidencia" },
    { name: "No utilizados", value: noUtilizadosPresidencia.length, key: "presidencia" },
  ];
  const datosTortaLector = [
    { name: "Utilizados", value: elegiblesLector.length - noUtilizadosLector.length, key: "lector" },
    { name: "No utilizados", value: noUtilizadosLector.length, key: "lector" },
  ];
  const datosTortaOrador = [
    { name: "Utilizados", value: elegiblesPresidencia.length - noUtilizadosOrador.length, key: "orador" },
    { name: "No utilizados", value: noUtilizadosOrador.length, key: "orador" },
  ];

  const listaDrillDown =
    drillDown === "presidencia"
      ? noUtilizadosPresidencia
      : drillDown === "lector"
        ? noUtilizadosLector
        : drillDown === "orador"
          ? noUtilizadosOrador
          : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-muted-foreground">
          % de varones elegibles utilizados en Presidencia, Lector de la Atalaya y Orador (local)
        </p>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">% de utilización</CardTitle>
            <CardDescription>Porcentaje de elegibles usados al menos una vez en el período</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
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
                    <Cell
                      key={d.categoria}
                      fill={
                        d.categoria === "Presidencia"
                          ? COLOR_PRESIDENCIA
                          : d.categoria === "Lector de la Atalaya"
                            ? COLOR_LECTOR
                            : COLOR_ORADOR
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Utilizados vs. no utilizados</CardTitle>
            <CardDescription>Haz clic en "No utilizados" para ver la lista de participantes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(
                [
                  { titulo: "Presidencia", datos: datosTortaPresidencia, key: "presidencia" as const, colorUtilizado: COLOR_PRESIDENCIA, pctNoUtilizado: 100 - pctPresidencia },
                  { titulo: "Lector de la Atalaya", datos: datosTortaLector, key: "lector" as const, colorUtilizado: COLOR_LECTOR, pctNoUtilizado: 100 - pctLector },
                  { titulo: "Orador (local)", datos: datosTortaOrador, key: "orador" as const, colorUtilizado: COLOR_ORADOR, pctNoUtilizado: 100 - pctOrador },
                ] as const
              ).map(({ titulo, datos, key, colorUtilizado, pctNoUtilizado }) => (
                <div key={key} className="space-y-1">
                  <p className="text-xs text-center font-medium text-muted-foreground">{titulo}</p>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-0 z-0 flex flex-col items-center justify-center">
                      <span className="text-sm font-semibold">{pctNoUtilizado}%</span>
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
                              if (entry?.name === "No utilizados") setDrillDown((prev) => (prev === key ? null : key));
                            }}
                          >
                            {datos.map((d) => (
                              <Cell key={d.name} fill={d.name === "Utilizados" ? colorUtilizado : COLOR_NO_UTILIZADO} />
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
                      <span className="h-2 w-2 rounded-full inline-block" style={{ background: colorUtilizado }} />
                      Utilizados
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full inline-block" style={{ background: COLOR_NO_UTILIZADO }} />
                      No utilizados
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {drillDown && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              No utilizados en{" "}
              {drillDown === "presidencia" ? "Presidencia" : drillDown === "lector" ? "Lector de la Atalaya" : "Orador (local)"}{" "}
              (últimos {periodo} meses)
            </CardTitle>
            <CardDescription>{listaDrillDown.length} participante(s)</CardDescription>
          </CardHeader>
          <CardContent>
            {listaDrillDown.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todos los elegibles fueron utilizados en este período.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {listaDrillDown.map((p) => (
                  <Badge key={p.id} variant="secondary">
                    {p.nombre} {p.apellido}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
