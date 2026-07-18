import { useMemo, useState } from "react";
import { format, parseISO, subMonths, addMonths } from "date-fns";
import { es } from "date-fns/locale";
import { BarChart3, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHeader, SortableTableHead, TableRow } from "@/components/ui/table";
import { useProgramasReunionPublicaTodos } from "@/hooks/useReunionPublica";
import { useParticipantes } from "@/hooks/useParticipantes";
import { useTableSort } from "@/hooks/useTableSort";
import { computeUltimasParticipacionesRP } from "@/lib/reunion-publica-historial";
import type { RpCategoria } from "@/lib/reunion-publica-historial";

const CATEGORIAS: RpCategoria[] = ["presidencia", "orador", "lector_atalaya"];
const CATEGORIA_LABEL_COL: Record<RpCategoria, string> = {
  presidencia: "Presidente",
  orador: "Orador (local)",
  lector_atalaya: "Lector Atalaya",
};

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function formatFechaCorta(fecha: string) {
  try {
    return format(parseISO(fecha), "d MMM yy", { locale: es });
  } catch {
    return fecha;
  }
}

export function HistorialReunionPublica() {
  const { data: programas, isLoading } = useProgramasReunionPublicaTodos();
  const { participantes } = useParticipantes();

  const hoy = useMemo(() => new Date(), []);
  const [desde, setDesde] = useState(format(subMonths(hoy, 24), "yyyy-MM-dd"));
  const [hasta, setHasta] = useState(format(addMonths(hoy, 6), "yyyy-MM-dd"));
  const [busqueda, setBusqueda] = useState("");

  const programasFiltrados = useMemo(
    () => (programas ?? []).filter((p) => p.fecha >= desde && p.fecha <= hasta),
    [programas, desde, hasta]
  );

  const ultimasMap = useMemo(() => computeUltimasParticipacionesRP(programasFiltrados), [programasFiltrados]);

  const rows = useMemo(() => {
    const base = (participantes ?? []).filter((p: any) => p.activo && !p.es_publicador_inactivo);
    return base.map((p: any) => {
      const u = ultimasMap.get(p.id) ?? {};
      const row: any = { id: p.id, nombre: `${p.apellido}, ${p.nombre}` };
      for (const cat of CATEGORIAS) {
        row[cat] = u[cat]?.[0]?.fecha ?? null;
        row[`${cat}_prev`] = u[cat]?.[1]?.fecha ?? null;
      }
      return row;
    });
  }, [participantes, ultimasMap]);

  // Solo participantes con al menos una fecha en alguna categoría, o que coincidan la búsqueda
  const rowsConHistorial = useMemo(
    () => rows.filter((r) => CATEGORIAS.some((cat) => r[cat])),
    [rows]
  );

  const accessors = useMemo(() => {
    const a: Record<string, (r: any) => any> = { nombre: (r) => r.nombre.toLowerCase() };
    for (const cat of CATEGORIAS) a[cat] = (r) => r[cat] ?? "";
    return a;
  }, []);
  const { sortedData, sortConfig, requestSort } = useTableSort(
    rowsConHistorial,
    { key: "nombre", direction: "asc" },
    accessors
  );

  const filteredRows = useMemo(() => {
    const q = normalize(busqueda);
    if (!q) return sortedData;
    return sortedData.filter((r: any) => normalize(r.nombre).includes(q));
  }, [sortedData, busqueda]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-primary text-base">Filtro por fecha</CardTitle>
          <CardDescription>Filtra la tabla por rango de fechas.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Desde</Label>
              <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Hasta</Label>
              <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Badge variant="secondary" className="h-9 px-3 flex items-center">
                {sortedData.length} participante(s) con historial
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-primary text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5" /> Historial de privilegios — Reunión Pública
          </CardTitle>
          <CardDescription>
            Última(s) fecha(s) en que cada participante tuvo Presidencia, Orador (cuando fue local) o
            Lector de la Atalaya. Solo lectura — para editar, hazlo desde el programa semanal.
          </CardDescription>
          <div className="pt-2 flex flex-col sm:flex-row sm:items-center gap-2">
            <Input
              type="search"
              placeholder="Buscar participante…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="sm:max-w-xs"
            />
            <span className="text-xs text-muted-foreground">
              {filteredRows.length} de {sortedData.length} participante(s)
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredRows.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              {busqueda ? "Sin coincidencias para la búsqueda." : "Sin historial en el rango seleccionado."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted hover:bg-muted">
                    <SortableTableHead
                      sortKey="nombre"
                      currentSort={sortConfig}
                      onSort={requestSort}
                      className="sticky left-0 bg-muted z-20 min-w-[180px] font-bold text-foreground"
                    >
                      PARTICIPANTE
                    </SortableTableHead>
                    {CATEGORIAS.map((cat) => (
                      <SortableTableHead
                        key={cat}
                        sortKey={cat}
                        currentSort={sortConfig}
                        onSort={requestSort}
                        className="text-xs whitespace-nowrap font-bold"
                      >
                        {CATEGORIA_LABEL_COL[cat].toUpperCase()}
                      </SortableTableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.map((row: any) => (
                    <TableRow key={row.id}>
                      <TableCell className="sticky left-0 bg-background z-10 font-bold whitespace-nowrap">
                        {row.nombre}
                      </TableCell>
                      {CATEGORIAS.map((cat) => {
                        const fecha = row[cat];
                        const fechaPrev = row[`${cat}_prev`];
                        return (
                          <TableCell key={cat} className="text-center text-xs whitespace-nowrap p-1">
                            {!fecha ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              <div className="flex flex-col items-center leading-tight">
                                <span>{formatFechaCorta(fecha)}</span>
                                {fechaPrev && (
                                  <span className="text-[10px] opacity-60 text-muted-foreground" title="Participación anterior">
                                    {formatFechaCorta(fechaPrev)}
                                  </span>
                                )}
                              </div>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
