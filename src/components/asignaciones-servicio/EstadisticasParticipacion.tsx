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
}

interface Props {
  asignaciones: AsignacionServicio[];
  participantes: Participante[];
}

const AUDIOVISUAL: TipoAsignacionServicio[] = ["audio", "video", "zoom", "plataforma", "pasillo_1", "pasillo_2"];
const ACOMODADORES: TipoAsignacionServicio[] = ["acomodador_auditorio", "acomodador_entrada_1", "acomodador_entrada_2"];

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

  const { utilizados, noUtilizados, distribucion } = useMemo(() => {
    const map = new Map<
      string,
      { total: number; categorias: Map<string, { count: number; tipos: Map<string, number> }> }
    >();
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

    const distribucion: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    utilizados.forEach((u) => {
      if (u.total >= 1 && u.total <= 4) distribucion[u.total] += 1;
    });

    return { utilizados, noUtilizados, distribucion };
  }, [asignaciones, varonesAprobados]);

  if (varonesAprobados.length === 0 && utilizados.length === 0) return null;

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
        {/* Resumen */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <div className="rounded-md border bg-muted/30 p-3 flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-primary" />
            <div>
              <div className="text-[10px] uppercase text-muted-foreground">Utilizados</div>
              <div className="text-lg font-semibold leading-tight">{utilizados.length}</div>
            </div>
          </div>
          <div className="rounded-md border bg-muted/30 p-3 flex items-center gap-2">
            <UserX className="h-4 w-4 text-destructive" />
            <div>
              <div className="text-[10px] uppercase text-muted-foreground">No utilizados</div>
              <div className="text-lg font-semibold leading-tight">{noUtilizados.length}</div>
            </div>
          </div>
          <div className="rounded-md border bg-muted/30 p-3 flex items-center gap-2 col-span-2 sm:col-span-1">
            <Users className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-[10px] uppercase text-muted-foreground">Total varones</div>
              <div className="text-lg font-semibold leading-tight">{varonesAprobados.length}</div>
            </div>
          </div>
        </div>

        {/* Distribución por número de asignaciones */}
        <div className="grid grid-cols-4 gap-2">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="rounded-md border bg-muted/30 p-2 text-center">
              <div className="text-[10px] uppercase text-muted-foreground">{n} {n === 1 ? "vez" : "veces"}</div>
              <div className="text-base font-semibold">{distribucion[n]}</div>
            </div>
          ))}
        </div>

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

        {/* No utilizados */}
        {noUtilizados.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-xs font-semibold uppercase text-muted-foreground">No utilizados</div>
            <div className="flex flex-wrap gap-1.5">
              {noUtilizados.map((p) => (
                <Badge key={p.id} variant="outline" className="font-normal">
                  {p.nombre}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
