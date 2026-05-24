import { useMemo, useState } from "react";
import { BarChart3, ChevronDown, Users, UserCheck, UserX } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  TIPOS_ASIGNACION_SERVICIO,
  type AsignacionServicio,
  type TipoAsignacionServicio,
} from "@/hooks/useAsignacionesServicio";

interface Participante {
  id: string;
  nombre: string;
  apellido: string;
  genero?: string | null;
  estado_aprobado?: boolean;
  activo?: boolean;
  responsabilidad?: string[] | null;
}

interface Props {
  asignaciones: AsignacionServicio[];
  participantes: Participante[];
}

const AUDIOVISUAL: TipoAsignacionServicio[] = ["audio", "video", "zoom", "plataforma", "pasillo_1", "pasillo_2"];
const ACOMODADORES: TipoAsignacionServicio[] = ["acomodador_auditorio", "acomodador_entrada_1", "acomodador_entrada_2"];

const RESP_AV = ["audio", "video", "zoom", "plataforma", "microfono_pasillo_1", "microfono_pasillo_2"];
const RESP_ACO = ["acomodador_auditorio", "acomodador_entrada_1", "acomodador_entrada_2"];

function categoriaDe(tipo: TipoAsignacionServicio): "Audiovisual" | "Acomodadores" | "Aseo / Hospitalidad" {
  if (AUDIOVISUAL.includes(tipo)) return "Audiovisual";
  if (ACOMODADORES.includes(tipo)) return "Acomodadores";
  return "Aseo / Hospitalidad";
}

function labelTipo(tipo: TipoAsignacionServicio): string {
  return TIPOS_ASIGNACION_SERVICIO.find((t) => t.value === tipo)?.label || tipo;
}

export function EstadisticasParticipacion({ asignaciones, participantes }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [openPanel, setOpenPanel] = useState<string | null>(null);

  const togglePanel = (key: string) => setOpenPanel((cur) => (cur === key ? null : key));

  const varonesAprobados = useMemo(
    () =>
      participantes.filter(
        (p) =>
          p.activo !== false &&
          p.estado_aprobado === true &&
          (p.genero ?? "M") !== "F",
      ),
    [participantes],
  );

  const { utilizados, noUtilizados, distribucion, distribucionListas, deptos } = useMemo(() => {
    const map = new Map<
      string,
      { total: number; categorias: Map<string, { count: number; tipos: Map<string, number> }> }
    >();
    // conteos por departamento
    const avCount = new Map<string, number>();
    const acoCount = new Map<string, number>();
    asignaciones.forEach((a) => {
      if (!a.participante_id) return;
      const cat = categoriaDe(a.tipo_asignacion);
      if (!map.has(a.participante_id)) map.set(a.participante_id, { total: 0, categorias: new Map() });
      const entry = map.get(a.participante_id)!;
      entry.total += 1;
      if (!entry.categorias.has(cat)) entry.categorias.set(cat, { count: 0, tipos: new Map() });
      const c = entry.categorias.get(cat)!;
      c.count += 1;
      const lbl = labelTipo(a.tipo_asignacion);
      c.tipos.set(lbl, (c.tipos.get(lbl) || 0) + 1);
      if (cat === "Audiovisual") avCount.set(a.participante_id, (avCount.get(a.participante_id) || 0) + 1);
      if (cat === "Acomodadores") acoCount.set(a.participante_id, (acoCount.get(a.participante_id) || 0) + 1);
    });

    const utilizados = varonesAprobados
      .filter((p) => map.has(p.id))
      .map((p) => {
        const v = map.get(p.id)!;
        return {
          id: p.id,
          nombre: `${p.nombre} ${p.apellido}`,
          total: v.total,
          categorias: Array.from(v.categorias.entries()).map(([cat, info]) => ({
            categoria: cat,
            count: info.count,
            tipos: Array.from(info.tipos.entries()).map(([t, n]) => ({ tipo: t, count: n })),
          })),
        };
      })
      .sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre));

    const noUtilizados = varonesAprobados
      .filter((p) => !map.has(p.id))
      .map((p) => ({ id: p.id, nombre: `${p.nombre} ${p.apellido}` }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));

    const distribucion: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
    const distribucionListas: Record<number, { id: string; nombre: string }[]> = { 1: [], 2: [], 3: [] };
    utilizados.forEach((u) => {
      if (u.total >= 1 && u.total <= 3) {
        distribucion[u.total] += 1;
        distribucionListas[u.total].push({ id: u.id, nombre: u.nombre });
      }
    });

    const buildDepto = (respList: string[], counts: Map<string, number>) => {
      const elegibles = varonesAprobados.filter((p) => {
        const r = Array.isArray(p.responsabilidad) ? p.responsabilidad : [];
        return r.some((x) => respList.includes(x));
      });
      const noUsados = elegibles
        .filter((p) => (counts.get(p.id) || 0) === 0)
        .map((p) => ({ id: p.id, nombre: `${p.nombre} ${p.apellido}` }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre));
      const repetidos = elegibles
        .filter((p) => (counts.get(p.id) || 0) > 1)
        .map((p) => ({ id: p.id, nombre: `${p.nombre} ${p.apellido}`, count: counts.get(p.id) || 0 }))
        .sort((a, b) => b.count - a.count || a.nombre.localeCompare(b.nombre));
      return { elegibles: elegibles.length, noUsados, repetidos };
    };

    const deptos = {
      av: buildDepto(RESP_AV, avCount),
      aco: buildDepto(RESP_ACO, acoCount),
    };

    return { utilizados, noUtilizados, distribucion, distribucionListas, deptos };
  }, [asignaciones, varonesAprobados]);

  if (varonesAprobados.length === 0 && utilizados.length === 0) return null;

  const distColors: Record<number, string> = {
    1: "bg-green-50/50 border-green-200/60 text-green-800 hover:bg-green-100/60 dark:bg-green-950/20 dark:border-green-900/40 dark:text-green-200",
    2: "bg-yellow-50/50 border-yellow-200/60 text-yellow-800 hover:bg-yellow-100/60 dark:bg-yellow-950/20 dark:border-yellow-900/40 dark:text-yellow-200",
    3: "bg-orange-50/50 border-orange-200/60 text-orange-800 hover:bg-orange-100/60 dark:bg-orange-950/20 dark:border-orange-900/40 dark:text-orange-200",
  };

  const renderListaBadges = (lista: { id: string; nombre: string; count?: number }[]) =>
    lista.length === 0 ? (
      <div className="text-xs text-muted-foreground italic">Sin participantes</div>
    ) : (
      <div className="flex flex-wrap gap-1.5">
        {lista.map((p) => (
          <Badge key={p.id} variant="outline" className="font-normal bg-background">
            {p.nombre}{typeof p.count === "number" ? ` ×${p.count}` : ""}
          </Badge>
        ))}
      </div>
    );

  const renderDeptoCard = (
    key: string,
    titulo: string,
    data: { noUsados: { id: string; nombre: string }[]; repetidos: { id: string; nombre: string; count: number }[] },
  ) => {
    const active = openPanel === key;
    return (
      <button
        type="button"
        onClick={() => togglePanel(key)}
        className={`rounded-md border p-3 text-left transition-colors bg-purple-50/50 border-purple-200/60 text-purple-900 hover:bg-purple-100/60 dark:bg-purple-950/20 dark:border-purple-900/40 dark:text-purple-100 ${active ? "ring-2 ring-purple-300/60" : ""}`}
      >
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="text-[10px] font-semibold uppercase opacity-80">{titulo}</div>
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${active ? "rotate-180" : ""}`} />
        </div>
        <div className="text-xs leading-tight">No utilizados: <span className="font-semibold">{data.noUsados.length}</span></div>
        <div className="text-xs leading-tight">Más de una vez: <span className="font-semibold">{data.repetidos.length}</span></div>
      </button>
    );
  };

  return (
    <Card className="print:hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          Estadísticas de Participación
          <Badge variant="secondary" className="ml-2">{varonesAprobados.length} varones aprobados</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Resumen: Total / Utilizados / No utilizados */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <div className="rounded-md border p-3 flex items-center gap-2 bg-blue-50/50 border-blue-200/60 text-blue-800 dark:bg-blue-950/20 dark:border-blue-900/40 dark:text-blue-200">
            <Users className="h-4 w-4" />
            <div>
              <div className="text-[10px] uppercase opacity-80">Total varones</div>
              <div className="text-lg font-semibold leading-tight">{varonesAprobados.length}</div>
            </div>
          </div>
          <div className="rounded-md border p-3 flex items-center gap-2 bg-green-50/50 border-green-200/60 text-green-800 dark:bg-green-950/20 dark:border-green-900/40 dark:text-green-200">
            <UserCheck className="h-4 w-4" />
            <div>
              <div className="text-[10px] uppercase opacity-80">Utilizados</div>
              <div className="text-lg font-semibold leading-tight">{utilizados.length}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => togglePanel("no-utilizados")}
            className={`rounded-md border p-3 flex items-center gap-2 text-left transition-colors col-span-2 sm:col-span-1 bg-red-50/50 border-red-200/60 text-red-800 hover:bg-red-100/60 dark:bg-red-950/20 dark:border-red-900/40 dark:text-red-200 ${openPanel === "no-utilizados" ? "ring-2 ring-red-300/60" : ""}`}
          >
            <UserX className="h-4 w-4" />
            <div className="flex-1">
              <div className="text-[10px] uppercase opacity-80">No utilizados</div>
              <div className="text-lg font-semibold leading-tight">{noUtilizados.length}</div>
            </div>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${openPanel === "no-utilizados" ? "rotate-180" : ""}`} />
          </button>
        </div>

        {openPanel === "no-utilizados" && (
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="text-xs font-semibold uppercase text-muted-foreground mb-2">No utilizados</div>
            {renderListaBadges(noUtilizados)}
          </div>
        )}

        {/* Distribución 1-3 veces */}
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map((n) => {
            const key = `dist-${n}`;
            const active = openPanel === key;
            return (
              <button
                key={n}
                type="button"
                onClick={() => togglePanel(key)}
                className={`rounded-md border p-2 text-center transition-colors ${distColors[n]} ${active ? "ring-2 ring-offset-1 ring-primary/40" : ""}`}
              >
                <div className="text-[10px] uppercase opacity-80">{n} {n === 1 ? "vez" : "veces"}</div>
                <div className="text-base font-semibold">{distribucion[n]}</div>
              </button>
            );
          })}
        </div>

        {openPanel?.startsWith("dist-") && (
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="text-xs font-semibold uppercase text-muted-foreground mb-2">
              Utilizados {openPanel.split("-")[1]} {openPanel === "dist-1" ? "vez" : "veces"}
            </div>
            {renderListaBadges(distribucionListas[Number(openPanel.split("-")[1])])}
          </div>
        )}

        {/* Tarjetas por departamento */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {renderDeptoCard("dep-av", "Audiovisual", deptos.av)}
          {renderDeptoCard("dep-aco", "Acomodación", deptos.aco)}
        </div>

        {(openPanel === "dep-av" || openPanel === "dep-aco") && (
          <div className="rounded-md border bg-muted/30 p-3 space-y-3">
            {(() => {
              const data = openPanel === "dep-av" ? deptos.av : deptos.aco;
              return (
                <>
                  <div>
                    <div className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                      No utilizados ({data.noUsados.length})
                    </div>
                    {renderListaBadges(data.noUsados)}
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                      Más de una vez ({data.repetidos.length})
                    </div>
                    {renderListaBadges(data.repetidos)}
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* Lista utilizados */}
        {utilizados.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-xs font-semibold uppercase text-muted-foreground">Utilizados</div>
            {utilizados.map((s) => (
              <Collapsible
                key={s.id}
                open={openId === s.id}
                onOpenChange={(o) => setOpenId(o ? s.id : null)}
              >
                <CollapsibleTrigger className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md border bg-muted/30 hover:bg-muted/60 transition-colors text-sm">
                  <span className="flex items-center gap-2">
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform ${openId === s.id ? "rotate-180" : ""}`}
                    />
                    <span className="font-medium">{s.nombre}</span>
                  </span>
                  <Badge>{s.total} {s.total === 1 ? "asignación" : "asignaciones"}</Badge>
                </CollapsibleTrigger>
                <CollapsibleContent className="pl-6 pr-3 py-2 space-y-2">
                  {s.categorias.map((c) => (
                    <div key={c.categoria}>
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
                        <span>{c.categoria}</span>
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5">{c.count}</Badge>
                      </div>
                      <ul className="ml-3 mt-1 text-xs space-y-0.5">
                        {c.tipos.map((t) => (
                          <li key={t.tipo} className="flex justify-between max-w-xs">
                            <span>• {t.tipo}</span>
                            <span className="text-muted-foreground">×{t.count}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
