import { useState, useMemo } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Loader2, MapPin, ChevronDown, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, RotateCcw, Trash2, X, Plus, Send, CalendarIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCongregacionId } from "@/contexts/CongregacionContext";
import { useCatalogos } from "@/hooks/useCatalogos";
import { useHistorialCiclosAdmin, CicloTerritorio } from "@/hooks/useCiclosTerritorios";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ManzanaTrabajada } from "@/hooks/useCiclosTerritorios";
import { useTableSort } from "@/hooks/useTableSort";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { cn } from "@/lib/utils";
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
  const { toast } = useToast();
  const queryClient = useQueryClient();
  // Filter: only territories with numeric "numero"
  const territorios = allTerritorios.filter((t) => /^\d+$/.test(t.numero.trim()));
  const { data: ciclos = [], isLoading } = useHistorialCiclosAdmin(congregacionId);
  const [expandedCiclo, setExpandedCiclo] = useState<string | null>(null);
  const [expandedActiveRow, setExpandedActiveRow] = useState<string | null>(null);
  const [manzanasParaMarcar, setManzanasParaMarcar] = useState<Set<string>>(new Set());
  const [enviandoMarcar, setEnviandoMarcar] = useState(false);
  const [fechaMarcar, setFechaMarcar] = useState<Date>(new Date());
  const [openCalendarId, setOpenCalendarId] = useState<string | null>(null);
  const [editandoFecha, setEditandoFecha] = useState<{ id: string; letra: string; fecha: Date } | null>(null);
  const [resetDialog, setResetDialog] = useState<{ open: boolean; cicloId: string | null; territorioLabel: string }>({
    open: false, cicloId: null, territorioLabel: ""
  });
  const [desmarcarDialog, setDesmarcarDialog] = useState<{ open: boolean; manzanaId: string | null; letra: string }>({
    open: false, manzanaId: null, letra: ""
  });

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

  // Fetch worked blocks for ALL active cycles (for inline progress)
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
      const { data: allMt, error } = await supabase
        .from("manzanas_trabajadas")
        .select("ciclo_id, marcado_por, fecha_trabajada")
        .in("ciclo_id", completedCicloIds)
        .order("fecha_trabajada");
      if (error) throw error;

      const byCiclo = new Map<string, { firstUser: string; lastUser: string; firstDate: string; lastDate: string }>();
      (allMt || []).forEach((mt) => {
        if (!byCiclo.has(mt.ciclo_id)) {
          byCiclo.set(mt.ciclo_id, { firstUser: mt.marcado_por, lastUser: mt.marcado_por, firstDate: mt.fecha_trabajada, lastDate: mt.fecha_trabajada });
        } else {
          const entry = byCiclo.get(mt.ciclo_id)!;
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

  // Mutation: Reset cycle (delete worked blocks + delete cycle)
  const resetCiclo = useMutation({
    mutationFn: async (cicloId: string) => {
      // Delete all manzanas_trabajadas for this cycle
      const { error: errMt } = await supabase
        .from("manzanas_trabajadas")
        .delete()
        .eq("ciclo_id", cicloId);
      if (errMt) throw errMt;
      // Delete the cycle itself
      const { error: errCiclo } = await supabase
        .from("ciclos_territorio")
        .delete()
        .eq("id", cicloId);
      if (errCiclo) throw errCiclo;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["historial-ciclos-admin"] });
      queryClient.invalidateQueries({ queryKey: ["manzanas-trabajadas-activas"] });
      queryClient.invalidateQueries({ queryKey: ["ciclo-activo"] });
      queryClient.invalidateQueries({ queryKey: ["manzanas-trabajadas"] });
      toast({ title: "Ciclo reseteado", description: "El territorio volvió a estado Sin iniciar" });
      setResetDialog({ open: false, cicloId: null, territorioLabel: "" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Mutation: Unmark a single manzana
  const desmarcarManzana = useMutation({
    mutationFn: async (manzanaTrabajadaId: string) => {
      const { error } = await supabase.rpc("desmarcar_manzana_trabajada", {
        _manzana_trabajada_id: manzanaTrabajadaId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["historial-ciclos-admin"] });
      queryClient.invalidateQueries({ queryKey: ["manzanas-trabajadas-activas"] });
      queryClient.invalidateQueries({ queryKey: ["manzanas-trabajadas-detalle"] });
      queryClient.invalidateQueries({ queryKey: ["ciclo-activo"] });
      queryClient.invalidateQueries({ queryKey: ["manzanas-trabajadas"] });
      toast({ title: "Manzana desmarcada" });
      setDesmarcarDialog({ open: false, manzanaId: null, letra: "" });
    },
    onError: (error: any) => {
      const msg = error.message?.includes("cycle_already_completed")
        ? "No se puede desmarcar en un ciclo completado"
        : error.message;
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  // Mutation: Mark manzanas as worked (from historial admin)
  const marcarManzanaAdmin = useMutation({
    mutationFn: async ({ territorioId, congregacionId, manzanaId, fecha }: { territorioId: string; congregacionId: string; manzanaId: string; fecha: string }) => {
      const { error } = await supabase.rpc("marcar_manzana_trabajada", {
        _territorio_id: territorioId,
        _congregacion_id: congregacionId,
        _manzana_id: manzanaId,
        _fecha_trabajada: fecha,
      });
      if (error) throw error;
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Mutation: Update fecha_trabajada of an existing record
  const actualizarFechaManzana = useMutation({
    mutationFn: async ({ id, fecha }: { id: string; fecha: string }) => {
      const { error } = await supabase
        .from("manzanas_trabajadas")
        .update({ fecha_trabajada: fecha })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["historial-ciclos-admin"] });
      queryClient.invalidateQueries({ queryKey: ["manzanas-trabajadas-activas"] });
      queryClient.invalidateQueries({ queryKey: ["manzanas-trabajadas-detalle"] });
      queryClient.invalidateQueries({ queryKey: ["ciclo-activo"] });
      queryClient.invalidateQueries({ queryKey: ["manzanas-trabajadas"] });
      toast({ title: "Fecha actualizada" });
      setEditandoFecha(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleMarcarSeleccionadas = async (territorioId: string) => {
    if (manzanasParaMarcar.size === 0) return;
    setEnviandoMarcar(true);
    const fecha = format(fechaMarcar, "yyyy-MM-dd");
    try {
      for (const manzanaId of manzanasParaMarcar) {
        await marcarManzanaAdmin.mutateAsync({ territorioId, congregacionId: congregacionId!, manzanaId, fecha });
      }
      queryClient.invalidateQueries({ queryKey: ["historial-ciclos-admin"] });
      queryClient.invalidateQueries({ queryKey: ["manzanas-trabajadas-activas"] });
      queryClient.invalidateQueries({ queryKey: ["ciclo-activo"] });
      queryClient.invalidateQueries({ queryKey: ["manzanas-trabajadas"] });
      toast({ title: "Manzanas registradas" });
      setManzanasParaMarcar(new Set());
    } catch {
      // error handled by mutation
    } finally {
      setEnviandoMarcar(false);
    }
  };

  const toggleManzanaParaMarcar = (id: string) => {
    setManzanasParaMarcar((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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

  // Default sort: "En progreso" first
  const { sortedData: sortedActiveRows, sortConfig: activeSortConfig, requestSort: requestActiveSort } = useTableSort(
    activeRows,
    { key: "estado", direction: "asc" },
    {
      territorioNumero: (r) => r.territorioNumero,
      fecha_inicio: (r) => r.ciclo?.fecha_inicio || "9999",
      estado: (r) => {
        if (!r.ciclo) return 1;
        const worked = manzanasActivas.some((m) => m.ciclo_id === r.ciclo!.id);
        return worked ? 0 : 1;
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
                  <TableHead className="w-8"></TableHead>
                  <SortableHead label="Territorio" sortKey="territorioNumero" config={activeSortConfig} onSort={requestActiveSort} />
                  <TableHead>Ciclo</TableHead>
                  <SortableHead label="Inicio" sortKey="fecha_inicio" config={activeSortConfig} onSort={requestActiveSort} />
                  <TableHead>Estado</TableHead>
                  <TableHead className="hidden sm:table-cell">Progreso</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedActiveRows.map((row) => {
                  const rowKey = row.ciclo?.id || row.territorioId;
                  const isActiveExpanded = expandedActiveRow === rowKey;

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
                      <Collapsible key={ciclo.id} asChild open={isActiveExpanded}>
                        <>
                          <TableRow
                            className={`cursor-pointer hover:bg-muted/50 ${!hasWorked ? "text-muted-foreground" : ""}`}
                            onClick={() => {
                              setExpandedActiveRow(isActiveExpanded ? null : rowKey);
                              setManzanasParaMarcar(new Set());
                            }}
                          >
                            <TableCell>
                              {isActiveExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </TableCell>
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
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              {hasWorked && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  title="Resetear progreso"
                                  onClick={() => setResetDialog({
                                    open: true,
                                    cicloId: ciclo.id,
                                    territorioLabel: row.territorioLabel,
                                  })}
                                >
                                  <RotateCcw className="h-4 w-4" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                            <CollapsibleContent asChild>
                              <TableRow className="bg-muted/30">
                                <TableCell colSpan={8} className="py-3">
                                   <div className="pl-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                     {/* Worked blocks - click to edit date or unmark */}
                                     <div>
                                       <p className="text-xs font-medium mb-1.5">Trabajadas <span className="font-normal text-muted-foreground">(clic para cambiar fecha)</span></p>
                                       {trabajadasCiclo.length > 0 ? (
                                         <div className="flex flex-wrap gap-1.5">
                                           {trabajadasCiclo.map((mt) => (
                                            <Popover key={mt.id} open={openCalendarId === `edit-${mt.id}`} onOpenChange={(o) => setOpenCalendarId(o ? `edit-${mt.id}` : null)}>
                                              <PopoverTrigger asChild>
                                                <Button
                                                  variant="default"
                                                  size="sm"
                                                  className="h-8 min-w-8 px-1.5 text-xs font-bold bg-green-600 hover:bg-green-700 text-white gap-0.5"
                                                  title={`${mt.manzanas_territorio.letra} - ${format(new Date(mt.fecha_trabajada + "T12:00:00"), "dd/MM/yyyy")}`}
                                                >
                                                  {mt.manzanas_territorio.letra}
                                                  <span className="text-[9px] font-normal opacity-80">{format(new Date(mt.fecha_trabajada + "T12:00:00"), "dd/MM")}</span>
                                                </Button>
                                              </PopoverTrigger>
                                              <PopoverContent className="w-auto p-0" align="start">
                                                <div className="p-2 space-y-2">
                                                  <p className="text-xs font-medium px-1">Manzana {mt.manzanas_territorio.letra}</p>
                                                  <Calendar
                                                    mode="single"
                                                    selected={new Date(mt.fecha_trabajada + "T12:00:00")}
                                                    onSelect={(date) => {
                                                      if (date) {
                                                        actualizarFechaManzana.mutate({ id: mt.id, fecha: format(date, "yyyy-MM-dd") });
                                                        setOpenCalendarId(null);
                                                      }
                                                    }}
                                                    locale={es}
                                                    initialFocus
                                                    className={cn("p-3 pointer-events-auto")}
                                                  />
                                                 <Button
                                                   variant="destructive"
                                                   size="sm"
                                                   className="w-full gap-1"
                                                   onClick={() => setDesmarcarDialog({ open: true, manzanaId: mt.id, letra: mt.manzanas_territorio.letra })}
                                                 >
                                                   <Trash2 className="h-3 w-3" />
                                                   Desmarcar
                                                 </Button>
                                               </div>
                                             </PopoverContent>
                                           </Popover>
                                         ))}
                                       </div>
                                       ) : (
                                         <p className="text-xs text-muted-foreground italic">Ninguna aún</p>
                                       )}
                                     </div>
                                     {/* Missing blocks - select to mark */}
                                     <div>
                                       <p className="text-xs font-medium mb-1.5">Faltantes <span className="font-normal text-muted-foreground">(selecciona para agregar)</span></p>
                                       {noTrabajadas.length > 0 ? (
                                         <div className="flex flex-wrap gap-2 items-start">
                                           <div className="flex flex-wrap gap-1.5">
                                             {noTrabajadas.map((m) => (
                                               <Button
                                                 key={m.id}
                                                 variant={manzanasParaMarcar.has(m.id) ? "default" : "outline"}
                                                 size="sm"
                                                 className={`h-8 w-8 p-0 text-xs font-bold ${manzanasParaMarcar.has(m.id) ? "bg-green-600 hover:bg-green-700 text-white border-green-600" : ""}`}
                                                 onClick={() => toggleManzanaParaMarcar(m.id)}
                                                 disabled={enviandoMarcar}
                                               >
                                                 {m.letra}
                                               </Button>
                                             ))}
                                           </div>
                                           {manzanasParaMarcar.size > 0 && (
                                             <div className="flex items-center gap-1.5">
                                                <Popover open={openCalendarId === "fecha-marcar"} onOpenChange={(o) => setOpenCalendarId(o ? "fecha-marcar" : null)}>
                                                  <PopoverTrigger asChild>
                                                    <Button variant="outline" size="sm" className="gap-1 h-8 text-xs">
                                                      <CalendarIcon className="h-3 w-3" />
                                                      {format(fechaMarcar, "dd/MM/yyyy")}
                                                    </Button>
                                                  </PopoverTrigger>
                                                  <PopoverContent className="w-auto p-0" align="start">
                                                    <Calendar
                                                      mode="single"
                                                      selected={fechaMarcar}
                                                      onSelect={(d) => { if (d) { setFechaMarcar(d); setOpenCalendarId(null); } }}
                                                      locale={es}
                                                      initialFocus
                                                      className={cn("p-3 pointer-events-auto")}
                                                    />
                                                  </PopoverContent>
                                                </Popover>
                                               <Button
                                                 size="sm"
                                                 className="gap-1.5 h-8"
                                                 onClick={() => handleMarcarSeleccionadas(row.territorioId)}
                                                 disabled={enviandoMarcar}
                                               >
                                                 {enviandoMarcar ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                                                 Enviar
                                               </Button>
                                             </div>
                                           )}
                                         </div>
                                       ) : (
                                         <p className="text-xs text-muted-foreground italic">Todas completadas</p>
                                       )}
                                     </div>
                                   </div>
                                </TableCell>
                              </TableRow>
                            </CollapsibleContent>
                        </>
                      </Collapsible>
                    );
                  }
                  // Sin iniciar - expandable to add blocks
                  const manzasTerr2 = getManzanasTerritorio(row.territorioId);
                  return (
                    <Collapsible key={row.territorioId} asChild open={isActiveExpanded}>
                      <>
                        <TableRow
                          className="cursor-pointer text-muted-foreground hover:bg-muted/50"
                          onClick={() => {
                            setExpandedActiveRow(isActiveExpanded ? null : rowKey);
                            setManzanasParaMarcar(new Set());
                          }}
                        >
                          <TableCell>
                            {isActiveExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </TableCell>
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
                              {manzasTerr2.length} manzanas
                            </span>
                          </TableCell>
                          <TableCell></TableCell>
                        </TableRow>
                        <CollapsibleContent asChild>
                          <TableRow className="bg-muted/30">
                            <TableCell colSpan={8} className="py-3">
                              <div className="pl-4">
                                <div>
                                  <p className="text-xs font-medium mb-1.5">Selecciona manzanas para iniciar el territorio</p>
                                  {manzasTerr2.length > 0 ? (
                                    <div className="flex flex-wrap gap-2 items-start">
                                      <div className="flex flex-wrap gap-1.5">
                                        {manzasTerr2.map((m) => (
                                          <Button
                                            key={m.id}
                                            variant={manzanasParaMarcar.has(m.id) ? "default" : "outline"}
                                            size="sm"
                                            className={`h-8 w-8 p-0 text-xs font-bold ${manzanasParaMarcar.has(m.id) ? "bg-green-600 hover:bg-green-700 text-white border-green-600" : ""}`}
                                            onClick={() => toggleManzanaParaMarcar(m.id)}
                                            disabled={enviandoMarcar}
                                          >
                                            {m.letra}
                                          </Button>
                                        ))}
                                      </div>
                                      {manzanasParaMarcar.size > 0 && (
                                        <div className="flex items-center gap-1.5">
                                          <Popover open={openCalendarId === "fecha-marcar-sin"} onOpenChange={(o) => setOpenCalendarId(o ? "fecha-marcar-sin" : null)}>
                                            <PopoverTrigger asChild>
                                              <Button variant="outline" size="sm" className="gap-1 h-8 text-xs">
                                                <CalendarIcon className="h-3 w-3" />
                                                {format(fechaMarcar, "dd/MM/yyyy")}
                                              </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                              <Calendar
                                                mode="single"
                                                selected={fechaMarcar}
                                                onSelect={(d) => { if (d) { setFechaMarcar(d); setOpenCalendarId(null); } }}
                                                locale={es}
                                                initialFocus
                                                className={cn("p-3 pointer-events-auto")}
                                              />
                                            </PopoverContent>
                                          </Popover>
                                          <Button
                                            size="sm"
                                            className="gap-1.5 h-8"
                                            onClick={() => handleMarcarSeleccionadas(row.territorioId)}
                                            disabled={enviandoMarcar}
                                          >
                                            {enviandoMarcar ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                                            Enviar
                                          </Button>
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <p className="text-xs text-muted-foreground italic">No hay manzanas configuradas</p>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        </CollapsibleContent>
                      </>
                    </Collapsible>
                  );
                })}

                {sortedActiveRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
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

      {/* Reset confirmation dialog */}
      <ConfirmDeleteDialog
        open={resetDialog.open}
        onOpenChange={(open) => setResetDialog((prev) => ({ ...prev, open }))}
        onConfirm={() => resetDialog.cicloId && resetCiclo.mutate(resetDialog.cicloId)}
        title="Resetear progreso"
        description={`¿Estás seguro que deseas resetear el progreso del territorio "${resetDialog.territorioLabel}"? Se eliminarán todas las manzanas trabajadas y el territorio volverá a estado "Sin iniciar". Esta acción no se puede deshacer.`}
      />

      {/* Desmarcar manzana confirmation dialog */}
      <ConfirmDeleteDialog
        open={desmarcarDialog.open}
        onOpenChange={(open) => setDesmarcarDialog((prev) => ({ ...prev, open }))}
        onConfirm={() => desmarcarDialog.manzanaId && desmarcarManzana.mutate(desmarcarDialog.manzanaId)}
        title="Desmarcar manzana"
        description={`¿Estás seguro que deseas desmarcar la manzana "${desmarcarDialog.letra}"?`}
      />
    </div>
  );
}
