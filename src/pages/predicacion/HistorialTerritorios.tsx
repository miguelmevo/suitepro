import { useState, useMemo } from "react";
import { format } from "date-fns";
import { Loader2, MapPin, ChevronDown, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCongregacionId } from "@/contexts/CongregacionContext";
import { useCatalogos } from "@/hooks/useCatalogos";
import { useHistorialCiclosAdmin, CicloTerritorio } from "@/hooks/useCiclosTerritorios";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ManzanaTrabajada } from "@/hooks/useCiclosTerritorios";
import { useTableSort } from "@/hooks/useTableSort";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

// Helper: group manzanas by date and format as "A - B 20/02 | C - F 27/02"
function formatManzanasPorFecha(
  manzanas: { letra: string; fecha_trabajada: string }[]
): string {
  const byDate = new Map<string, string[]>();
  manzanas.forEach((m) => {
    const fecha = format(new Date(m.fecha_trabajada + "T12:00:00"), "dd/MM");
    if (!byDate.has(fecha)) byDate.set(fecha, []);
    byDate.get(fecha)!.push(m.letra);
  });
  return Array.from(byDate.entries())
    .map(([fecha, letras]) => `${letras.join(" - ")} ${fecha}`)
    .join("  |  ");
}

interface ManzanaDetalle extends ManzanaTrabajada {
  manzanas_territorio: { letra: string };
  profiles?: { nombre: string | null; apellido: string | null } | null;
}

export default function HistorialTerritorios() {
  const congregacionId = useCongregacionId();
  const { territorios: allTerritorios } = useCatalogos();
  // Filter: only territories with numeric "numero"
  const territorios = allTerritorios.filter((t) => /^\d+$/.test(t.numero.trim()));
  const { data: ciclos = [], isLoading } = useHistorialCiclosAdmin(congregacionId);
  const [expandedCiclo, setExpandedCiclo] = useState<string | null>(null);

  // Fetch all manzanas_territorio for the congregation (for progress display)
  const { data: todasManzanas = [] } = useQuery({
    queryKey: ["todas-manzanas-territorio", congregacionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("manzanas_territorio")
        .select("id, letra, territorio_id")
        .eq("congregacion_id", congregacionId!)
        .eq("activo", true)
        .order("letra");
      if (error) throw error;
      return data;
    },
    enabled: !!congregacionId,
  });

  // Fetch manzanas trabajadas for ALL active cycles (for inline progress)
  const activeCicloIds = ciclos.filter((c) => !c.completado).map((c) => c.id);
  const { data: manzanasActivas = [] } = useQuery({
    queryKey: ["manzanas-trabajadas-activas", activeCicloIds],
    queryFn: async () => {
      if (activeCicloIds.length === 0) return [];
      const { data, error } = await supabase
        .from("manzanas_trabajadas")
        .select("*, manzanas_territorio!inner(letra)")
        .in("ciclo_id", activeCicloIds)
        .order("fecha_trabajada");
      if (error) throw error;
      return data as (ManzanaTrabajada & { manzanas_territorio: { letra: string } })[];
    },
    enabled: activeCicloIds.length > 0,
  });

  // Fetch manzanas trabajadas for expanded completed cycle
  const { data: manzanasDetalle = [] } = useQuery({
    queryKey: ["manzanas-trabajadas-detalle", expandedCiclo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("manzanas_trabajadas")
        .select("*, manzanas_territorio!inner(letra)")
        .eq("ciclo_id", expandedCiclo!)
        .order("fecha_trabajada");
      if (error) throw error;
      return data as ManzanaDetalle[];
    },
    enabled: !!expandedCiclo,
  });

  // Fetch first/last marcado_por for ALL completed cycles (for inline badges)
  const completedCicloIds = ciclos.filter((c) => c.completado).map((c) => c.id);
  const { data: marcadoresPorCiclo = {} } = useQuery({
    queryKey: ["marcadores-completados", completedCicloIds],
    queryFn: async () => {
      if (completedCicloIds.length === 0) return {};
      // Get all manzanas_trabajadas for completed cycles
      const { data: allMt, error } = await supabase
        .from("manzanas_trabajadas")
        .select("ciclo_id, marcado_por, fecha_trabajada")
        .in("ciclo_id", completedCicloIds)
        .order("fecha_trabajada");
      if (error) throw error;

      // Group by ciclo, find first (oldest date) and last (newest date)
      const byCiclo = new Map<string, { firstUser: string; lastUser: string; firstDate: string; lastDate: string }>();
      (allMt || []).forEach((mt) => {
        if (!byCiclo.has(mt.ciclo_id)) {
          byCiclo.set(mt.ciclo_id, { firstUser: mt.marcado_por, lastUser: mt.marcado_por, firstDate: mt.fecha_trabajada, lastDate: mt.fecha_trabajada });
        } else {
          const entry = byCiclo.get(mt.ciclo_id)!;
          // Keep oldest as first, newest as last
          if (mt.fecha_trabajada < entry.firstDate) {
            entry.firstDate = mt.fecha_trabajada;
            entry.firstUser = mt.marcado_por;
          }
          if (mt.fecha_trabajada > entry.lastDate) {
            entry.lastDate = mt.fecha_trabajada;
            entry.lastUser = mt.marcado_por;
          }
        }
      });

      // Collect unique user_ids
      const userIds = new Set<string>();
      byCiclo.forEach((v) => { userIds.add(v.firstUser); userIds.add(v.lastUser); });

      const { data: participantes } = await supabase
        .from("participantes")
        .select("user_id, nombre, apellido")
        .in("user_id", [...userIds]);

      const nameMap: Record<string, string> = {};
      (participantes || []).forEach((p) => {
        if (p.user_id) nameMap[p.user_id] = `${p.nombre} ${p.apellido}`;
      });

      const result: Record<string, { inicio: string; fin: string; fechaInicio: string; fechaFin: string }> = {};
      byCiclo.forEach((v, cicloId) => {
        result[cicloId] = {
          inicio: nameMap[v.firstUser] || "—",
          fin: nameMap[v.lastUser] || "—",
          fechaInicio: v.firstDate,
          fechaFin: v.lastDate,
        };
      });
      return result;
    },
    enabled: completedCicloIds.length > 0,
  }) as { data: Record<string, { inicio: string; fin: string; fechaInicio: string; fechaFin: string }> };

  const getTerritorioInfo = (territorioId: string) => {
    return territorios.find((t) => t.id === territorioId);
  };

  const getManzanasTerritorio = (territorioId: string) => {
    return todasManzanas.filter((m) => m.territorio_id === territorioId);
  };

  // Group cycles by territory
  const ciclosPorTerritorio = new Map<string, CicloTerritorio[]>();
  ciclos.forEach((ciclo) => {
    if (!ciclosPorTerritorio.has(ciclo.territorio_id)) {
      ciclosPorTerritorio.set(ciclo.territorio_id, []);
    }
    ciclosPorTerritorio.get(ciclo.territorio_id)!.push(ciclo);
  });

  // Filter cycles to only numeric territories
  const numericTerritorioIds = new Set(territorios.map((t) => t.id));
  const activeCiclos = ciclos.filter((c) => !c.completado && numericTerritorioIds.has(c.territorio_id));
  const completedCiclos = ciclos.filter((c) => c.completado && numericTerritorioIds.has(c.territorio_id));

  // Territories without any cycle = "Sin iniciar"
  const territoriosSinCiclo = territorios.filter(
    (t) => t.activo && !ciclosPorTerritorio.has(t.id)
  );

  // Build sortable active rows (ciclos + sin iniciar)
  type ActiveRow = { territorioNumero: number; territorioLabel: string; ciclo: CicloTerritorio | null; territorioId: string };
  const activeRows = useMemo<ActiveRow[]>(() => {
    const rows: ActiveRow[] = activeCiclos.map((c) => {
      const terr = getTerritorioInfo(c.territorio_id);
      return { territorioNumero: parseInt(terr?.numero || "0"), territorioLabel: terr ? `${terr.numero}${terr.nombre ? ` - ${terr.nombre}` : ""}` : "—", ciclo: c, territorioId: c.territorio_id };
    });
    territoriosSinCiclo.forEach((terr) => {
      rows.push({ territorioNumero: parseInt(terr.numero || "0"), territorioLabel: `${terr.numero}${terr.nombre ? ` - ${terr.nombre}` : ""}`, ciclo: null, territorioId: terr.id });
    });
    return rows;
  }, [activeCiclos, territoriosSinCiclo, territorios]);

  // Default sort: "En progreso" first (status asc puts progreso=0 before sin iniciar=1), then by territory number
  const { sortedData: sortedActiveRows, sortConfig: activeSortConfig, requestSort: requestActiveSort } = useTableSort(
    activeRows,
    { key: "estado", direction: "asc" },
    {
      territorioNumero: (r) => r.territorioNumero,
      fecha_inicio: (r) => r.ciclo?.fecha_inicio || "9999",
      estado: (r) => {
        if (!r.ciclo) return 1; // Sin iniciar
        // Check if cycle has any worked blocks
        const worked = manzanasActivas.some((m) => m.ciclo_id === r.ciclo!.id);
        return worked ? 0 : 1; // En progreso = 0, Sin iniciar = 1
      },
    }
  );

  // Build sortable completed rows
  type CompletedRow = { territorioNumero: number; territorioLabel: string; ciclo: CicloTerritorio; fechaInicio: string; fechaFin: string };
  const completedRows = useMemo<CompletedRow[]>(() => {
    return completedCiclos.map((c) => {
      const terr = getTerritorioInfo(c.territorio_id);
      const marc = marcadoresPorCiclo[c.id];
      return {
        territorioNumero: parseInt(terr?.numero || "0"),
        territorioLabel: terr ? `${terr.numero}${terr.nombre ? ` - ${terr.nombre}` : ""}` : "—",
        ciclo: c,
        fechaInicio: marc?.fechaInicio || c.fecha_inicio,
        fechaFin: marc?.fechaFin || c.fecha_fin || c.fecha_inicio,
      };
    });
  }, [completedCiclos, territorios, marcadoresPorCiclo]);

  const { sortedData: sortedCompletedRows, sortConfig: completedSortConfig, requestSort: requestCompletedSort } = useTableSort(
    completedRows,
    { key: "territorioNumero", direction: "asc" },
    { territorioNumero: (r) => r.territorioNumero, fechaInicio: (r) => r.fechaInicio, fechaFin: (r) => r.fechaFin }
  );

  // Sortable header helper
  const SortableHead = ({ label, sortKey, config, onSort }: { label: string; sortKey: string; config: { key: string; direction: "asc" | "desc" | null }; onSort: (k: string) => void }) => (
    <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => onSort(sortKey)}>
      <span className="inline-flex items-center gap-1">
        {label}
        {config.key === sortKey ? (
          config.direction === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-30" />
        )}
      </span>
    </TableHead>
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Historial de Territorios</h1>
        <p className="text-muted-foreground">
          Ciclos de trabajo completados y en progreso
        </p>
      </div>

      {/* Active cycles + Sin iniciar */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Estado actual</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead label="Territorio" sortKey="territorioNumero" config={activeSortConfig} onSort={requestActiveSort} />
                  <TableHead>Ciclo</TableHead>
                  <SortableHead label="Inicio" sortKey="fecha_inicio" config={activeSortConfig} onSort={requestActiveSort} />
                  <TableHead>Estado</TableHead>
                  <TableHead className="hidden sm:table-cell">Progreso</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedActiveRows.map((row) => {
                  if (row.ciclo) {
                    const ciclo = row.ciclo;
                    const manzasTerr = getManzanasTerritorio(row.territorioId);
                    const trabajadasCiclo = manzanasActivas.filter((m) => m.ciclo_id === ciclo.id);
                    const noTrabajadas = manzasTerr.filter(
                      (m) => !trabajadasCiclo.some((t) => t.manzana_id === m.id)
                    );
                    const trabajadasStr = formatManzanasPorFecha(
                      trabajadasCiclo.map((m) => ({
                        letra: m.manzanas_territorio.letra,
                        fecha_trabajada: m.fecha_trabajada,
                      }))
                    );
                    const noTrabajadasStr = noTrabajadas.map((m) => m.letra).join(" - ");
                    const hasWorked = trabajadasCiclo.length > 0;

                    return (
                      <TableRow key={ciclo.id} className={!hasWorked ? "text-muted-foreground" : undefined}>
                        <TableCell className="font-medium">{row.territorioLabel}</TableCell>
                        <TableCell>{hasWorked ? `#${ciclo.ciclo_numero}` : "—"}</TableCell>
                        <TableCell>
                          {hasWorked ? format(new Date(ciclo.fecha_inicio + "T12:00:00"), "dd/MM/yyyy") : "—"}
                        </TableCell>
                        <TableCell>
                          {hasWorked ? (
                            <Badge variant="secondary" className="bg-amber-100 text-amber-800 whitespace-nowrap">
                              En progreso
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="whitespace-nowrap">
                              Sin iniciar
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {hasWorked ? (
                            <div className="text-xs text-muted-foreground space-y-0.5">
                              <p>
                                <span className="font-medium text-foreground">Trabajadas:</span>{" "}
                                {trabajadasStr}
                              </p>
                              {noTrabajadas.length > 0 && (
                                <p>
                                  <span className="font-medium text-foreground">Faltan:</span>{" "}
                                  {noTrabajadasStr}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs italic">
                              {manzasTerr.length} manzanas
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  }
                  // Sin iniciar
                  return (
                    <TableRow key={row.territorioId} className="text-muted-foreground">
                      <TableCell className="font-medium">{row.territorioLabel}</TableCell>
                      <TableCell>—</TableCell>
                      <TableCell>—</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="whitespace-nowrap">
                          Sin iniciar
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <span className="text-xs italic">
                          {getManzanasTerritorio(row.territorioId).length} manzanas
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}

                {sortedActiveRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No hay territorios configurados
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Completed cycles */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Ciclos completados</CardTitle>
        </CardHeader>
        <CardContent>
          {completedCiclos.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <MapPin className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p>No hay ciclos completados aún</p>
            </div>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <SortableHead label="Territorio" sortKey="territorioNumero" config={completedSortConfig} onSort={requestCompletedSort} />
                    <TableHead>Ciclo</TableHead>
                    <SortableHead label="Inicio" sortKey="fechaInicio" config={completedSortConfig} onSort={requestCompletedSort} />
                    <SortableHead label="Fin" sortKey="fechaFin" config={completedSortConfig} onSort={requestCompletedSort} />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedCompletedRows.map((row) => {
                    const ciclo = row.ciclo;
                    const isExpanded = expandedCiclo === ciclo.id;
                    const marcadores = marcadoresPorCiclo[ciclo.id];
                    return (
                      <Collapsible key={ciclo.id} asChild open={isExpanded}>
                        <>
                          <TableRow
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => setExpandedCiclo(isExpanded ? null : ciclo.id)}
                          >
                            <TableCell>
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </TableCell>
                            <TableCell className="font-medium">{row.territorioLabel}</TableCell>
                            <TableCell>#{ciclo.ciclo_numero}</TableCell>
                            <TableCell>
                              <span>{format(new Date(row.fechaInicio + "T12:00:00"), "dd/MM/yyyy")}</span>
                              {marcadores && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 ml-1.5 font-normal text-muted-foreground">
                                  {marcadores.inicio}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <span>{format(new Date(row.fechaFin + "T12:00:00"), "dd/MM/yyyy")}</span>
                              {marcadores && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 ml-1.5 font-normal text-muted-foreground">
                                  {marcadores.fin}
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                          <CollapsibleContent asChild>
                            <TableRow className="bg-muted/30">
                              <TableCell colSpan={5} className="py-3">
                                <div className="pl-8">
                                  {manzanasDetalle.length > 0 ? (
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <span className="text-xs font-medium text-foreground">Manzanas:</span>
                                      {(() => {
                                        const byDate = new Map<string, string[]>();
                                        manzanasDetalle.forEach((m) => {
                                          const fecha = format(new Date(m.fecha_trabajada + "T12:00:00"), "dd/MM");
                                          if (!byDate.has(fecha)) byDate.set(fecha, []);
                                          byDate.get(fecha)!.push(m.manzanas_territorio?.letra || "?");
                                        });
                                        return Array.from(byDate.entries()).map(([fecha, letras]) => (
                                          <Badge key={fecha} variant="outline" className="gap-1 text-xs">
                                            {letras.join(" - ")}
                                            <span className="text-[10px] text-muted-foreground">{fecha}</span>
                                          </Badge>
                                        ));
                                      })()}
                                    </div>
                                  ) : (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          </CollapsibleContent>
                        </>
                      </Collapsible>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
