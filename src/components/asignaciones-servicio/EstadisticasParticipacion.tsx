import { useMemo, useState } from "react";
import { BarChart3, ChevronDown } from "lucide-react";
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

  const stats = useMemo(() => {
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
    const arr = Array.from(map.entries()).map(([id, v]) => {
      const p = participantes.find((x) => x.id === id);
      return {
        id,
        nombre: p ? `${p.nombre} ${p.apellido}` : "—",
        total: v.total,
        categorias: Array.from(v.categorias.entries()).map(([cat, info]) => ({
          categoria: cat,
          count: info.count,
          tipos: Array.from(info.tipos.entries()).map(([t, n]) => ({ tipo: t, count: n })),
        })),
      };
    });
    arr.sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre));
    return arr;
  }, [asignaciones, participantes]);

  if (stats.length === 0) return null;

  return (
    <Card className="print:hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          Estadísticas de Participación
          <Badge variant="secondary" className="ml-2">{stats.length} participantes</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {stats.map((s) => (
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
      </CardContent>
    </Card>
  );
}
