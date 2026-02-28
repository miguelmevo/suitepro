import { useState } from "react";
import { format } from "date-fns";
import { Loader2, MapPin, ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCongregacionId } from "@/contexts/CongregacionContext";
import { useCatalogos } from "@/hooks/useCatalogos";
import { useHistorialCiclosAdmin, CicloTerritorio } from "@/hooks/useCiclosTerritorios";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ManzanaTrabajada } from "@/hooks/useCiclosTerritorios";
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

      // Group by ciclo, find first/last
      const byCiclo = new Map<string, { first: string; last: string }>();
      (allMt || []).forEach((mt) => {
        if (!byCiclo.has(mt.ciclo_id)) {
          byCiclo.set(mt.ciclo_id, { first: mt.marcado_por, last: mt.marcado_por });
        } else {
          byCiclo.get(mt.ciclo_id)!.last = mt.marcado_por;
        }
      });

      // Collect unique user_ids
      const userIds = new Set<string>();
      byCiclo.forEach((v) => { userIds.add(v.first); userIds.add(v.last); });

      const { data: participantes } = await supabase
        .from("participantes")
        .select("user_id, nombre, apellido")
        .in("user_id", [...userIds]);

      const nameMap: Record<string, string> = {};
      (participantes || []).forEach((p) => {
        if (p.user_id) nameMap[p.user_id] = `${p.nombre} ${p.apellido}`;
      });

      const result: Record<string, { inicio: string; fin: string }> = {};
      byCiclo.forEach((v, cicloId) => {
        result[cicloId] = {
          inicio: nameMap[v.first] || "—",
          fin: nameMap[v.last] || "—",
        };
      });
      return result;
    },
    enabled: completedCicloIds.length > 0,
  }) as { data: Record<string, { inicio: string; fin: string }> };

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
                  <TableHead>Territorio</TableHead>
                  <TableHead>Ciclo</TableHead>
                  <TableHead>Inicio</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="hidden sm:table-cell">Progreso</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeCiclos.map((ciclo) => {
                  const terr = getTerritorioInfo(ciclo.territorio_id);
                  const manzasTerr = getManzanasTerritorio(ciclo.territorio_id);
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

                  return (
                    <TableRow key={ciclo.id}>
                      <TableCell className="font-medium">
                        {terr ? `${terr.numero}${terr.nombre ? ` - ${terr.nombre}` : ""}` : "—"}
                      </TableCell>
                      <TableCell>#{ciclo.ciclo_numero}</TableCell>
                      <TableCell>
                        {format(new Date(ciclo.fecha_inicio + "T12:00:00"), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="bg-amber-100 text-amber-800 whitespace-nowrap">
                          En progreso
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <div className="text-xs text-muted-foreground space-y-0.5">
                          {trabajadasCiclo.length > 0 && (
                            <p>
                              <span className="font-medium text-foreground">Trabajadas:</span>{" "}
                              {trabajadasStr}
                            </p>
                          )}
                          {noTrabajadas.length > 0 && (
                            <p>
                              <span className="font-medium text-foreground">Faltan:</span>{" "}
                              {noTrabajadasStr}
                            </p>
                          )}
                          {trabajadasCiclo.length === 0 && (
                            <p className="italic">Sin manzanas registradas</p>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}

                {/* Territories without any cycle */}
                {territoriosSinCiclo.map((terr) => (
                  <TableRow key={terr.id} className="text-muted-foreground">
                    <TableCell className="font-medium">
                      {terr.numero}{terr.nombre ? ` - ${terr.nombre}` : ""}
                    </TableCell>
                    <TableCell>—</TableCell>
                    <TableCell>—</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="whitespace-nowrap">
                        Sin iniciar
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <span className="text-xs italic">
                        {getManzanasTerritorio(terr.id).length} manzanas
                      </span>
                    </TableCell>
                  </TableRow>
                ))}

                {activeCiclos.length === 0 && territoriosSinCiclo.length === 0 && (
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
                    <TableHead>Territorio</TableHead>
                    <TableHead>Ciclo</TableHead>
                    <TableHead>Inicio</TableHead>
                    <TableHead>Fin</TableHead>
                    <TableHead className="hidden sm:table-cell">Participantes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {completedCiclos.map((ciclo) => {
                    const terr = getTerritorioInfo(ciclo.territorio_id);
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
                            <TableCell className="font-medium">
                              {terr ? `${terr.numero}${terr.nombre ? ` - ${terr.nombre}` : ""}` : "—"}
                            </TableCell>
                            <TableCell>#{ciclo.ciclo_numero}</TableCell>
                            <TableCell>
                              {format(new Date(ciclo.fecha_inicio + "T12:00:00"), "dd/MM/yyyy")}
                            </TableCell>
                            <TableCell>
                              {ciclo.fecha_fin
                                ? format(new Date(ciclo.fecha_fin + "T12:00:00"), "dd/MM/yyyy")
                                : "—"}
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              {marcadores && (
                                <div className="flex flex-wrap gap-1">
                                  <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0">
                                    ▶ {marcadores.inicio}
                                  </Badge>
                                  <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0">
                                    ■ {marcadores.fin}
                                  </Badge>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                          <CollapsibleContent asChild>
                            <TableRow className="bg-muted/30">
                              <TableCell colSpan={6} className="py-3">
                                <div className="pl-8">
                                  {manzanasDetalle.length > 0 ? (
                                    <p className="text-xs text-muted-foreground">
                                      <span className="font-medium text-foreground">Manzanas:</span>{" "}
                                      {formatManzanasPorFecha(
                                        manzanasDetalle.map((m) => ({
                                          letra: m.manzanas_territorio?.letra || "?",
                                          fecha_trabajada: m.fecha_trabajada,
                                        }))
                                      )}
                                    </p>
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
