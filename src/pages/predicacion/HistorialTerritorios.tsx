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

export default function HistorialTerritorios() {
  const congregacionId = useCongregacionId();
  const { territorios } = useCatalogos();
  const { data: ciclos = [], isLoading } = useHistorialCiclosAdmin(congregacionId);
  const [expandedCiclo, setExpandedCiclo] = useState<string | null>(null);

  // Fetch manzanas trabajadas for expanded cycle
  const { data: manzanasDetalle = [] } = useQuery({
    queryKey: ["manzanas-trabajadas-detalle", expandedCiclo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("manzanas_trabajadas")
        .select("*, manzanas_territorio!inner(letra)")
        .eq("ciclo_id", expandedCiclo!)
        .order("fecha_trabajada");
      if (error) throw error;
      return data as (ManzanaTrabajada & { manzanas_territorio: { letra: string } })[];
    },
    enabled: !!expandedCiclo,
  });

  const getTerritorioInfo = (territorioId: string) => {
    return territorios.find((t) => t.id === territorioId);
  };

  // Group cycles by territory
  const ciclosPorTerritorio = ciclos.reduce((acc, ciclo) => {
    if (!acc[ciclo.territorio_id]) acc[ciclo.territorio_id] = [];
    acc[ciclo.territorio_id].push(ciclo);
    return acc;
  }, {} as Record<string, CicloTerritorio[]>);

  // Also add active (incomplete) cycles
  const activeCiclos = ciclos.filter((c) => !c.completado);
  const completedCiclos = ciclos.filter((c) => c.completado);

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

      {/* Active cycles */}
      {activeCiclos.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Ciclos en progreso</CardTitle>
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeCiclos.map((ciclo) => {
                    const terr = getTerritorioInfo(ciclo.territorio_id);
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
                          <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                            En progreso
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {completedCiclos.map((ciclo) => {
                    const terr = getTerritorioInfo(ciclo.territorio_id);
                    const isExpanded = expandedCiclo === ciclo.id;
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
                          </TableRow>
                          <CollapsibleContent asChild>
                            <TableRow className="bg-muted/30">
                              <TableCell colSpan={5} className="py-3">
                                <div className="pl-8 space-y-1">
                                  <p className="text-sm font-medium mb-2">Detalle de manzanas:</p>
                                  {manzanasDetalle.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                      {manzanasDetalle.map((mt) => (
                                        <Badge key={mt.id} variant="outline" className="gap-1">
                                          {mt.manzanas_territorio?.letra || "?"}
                                          <span className="text-[10px] text-muted-foreground">
                                            {format(new Date(mt.fecha_trabajada + "T12:00:00"), "dd/MM")}
                                          </span>
                                        </Badge>
                                      ))}
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
