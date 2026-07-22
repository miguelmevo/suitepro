import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Loader2, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, SortableTableHead, TableRow } from "@/components/ui/table";
import { useProgramasReunionPublicaTodos, useReunionPublica } from "@/hooks/useReunionPublica";
import { useParticipantes } from "@/hooks/useParticipantes";
import { useTableSort } from "@/hooks/useTableSort";
import { usePermisos } from "@/hooks/usePermisos";
import { EditarParticipanteDialog } from "@/components/participantes/EditarParticipanteDialog";
import { CrearParticipanteRapidoModal } from "@/components/participantes/CrearParticipanteRapidoModal";
import { FiltroFechaPopover } from "@/components/programa/FiltroFechaPopover";
import { computeUltimasParticipacionesRP } from "@/lib/reunion-publica-historial";
import type { RpCategoria } from "@/lib/reunion-publica-historial";

// Elegibilidad por categoría (espejo de las opciones reales del programa):
// presidencia/orador → ancianos y siervos ministeriales; lector_atalaya → lista
// de lectores configurados en Ajustes (independiente de responsabilidad).
function esElegiblePresidenciaOrador(p: any): boolean {
  return Array.isArray(p.responsabilidad) && p.responsabilidad.some((r: string) => r === "anciano" || r === "siervo_ministerial");
}

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
  const { lectoresElegibles } = useReunionPublica();
  const { canEdit } = usePermisos();
  const puedeEditarParticipante = canEdit("configuracion_participantes");

  // "" = sin límite (sin filtro por ese extremo) — arranca mostrando todo el historial disponible.
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [editParticipanteId, setEditParticipanteId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const eliminarFiltroFecha = () => {
    setDesde("");
    setHasta("");
  };

  const lectoresElegiblesIds = useMemo(
    () => new Set((lectoresElegibles ?? []).map((l: any) => l.participante_id)),
    [lectoresElegibles]
  );

  const programasFiltrados = useMemo(
    () => (programas ?? []).filter((p) => (!desde || p.fecha >= desde) && (!hasta || p.fecha <= hasta)),
    [programas, desde, hasta]
  );

  const ultimasMap = useMemo(() => computeUltimasParticipacionesRP(programasFiltrados), [programasFiltrados]);

  // Solo participantes elegibles para al menos una de las 3 categorías (Presidencia/
  // Orador = anciano o SM; Lector Atalaya = lista configurada) — el resto de la
  // congregación (mujeres, publicadores no elegibles, etc.) no aplica a este historial
  // y no debe aparecer en la tabla.
  const rows = useMemo(() => {
    const base = (participantes ?? []).filter(
      (p: any) => p.activo && !p.es_publicador_inactivo && (esElegiblePresidenciaOrador(p) || lectoresElegiblesIds.has(p.id))
    );
    return base.map((p: any) => {
      const u = ultimasMap.get(p.id) ?? {};
      const row: any = { id: p.id, nombre: `${p.apellido}, ${p.nombre}` };
      for (const cat of CATEGORIAS) {
        row[cat] = u[cat]?.[0]?.fecha ?? null;
        row[`${cat}_prev`] = u[cat]?.[1]?.fecha ?? null;
      }
      row._elig_presidencia = esElegiblePresidenciaOrador(p);
      row._elig_orador = esElegiblePresidenciaOrador(p);
      row._elig_lector_atalaya = lectoresElegiblesIds.has(p.id);
      return row;
    });
  }, [participantes, ultimasMap, lectoresElegiblesIds]);

  const accessors = useMemo(() => {
    const a: Record<string, (r: any) => any> = { nombre: (r) => r.nombre.toLowerCase() };
    for (const cat of CATEGORIAS) a[cat] = (r) => r[cat] ?? "";
    return a;
  }, []);
  const { sortedData: baseSorted, sortConfig, requestSort } = useTableSort(
    rows,
    { key: "nombre", direction: "asc" },
    accessors
  );

  // Al ordenar por categoría: elegibles primero (ordenados por fecha), no
  // elegibles al final (grisados) — mismo comportamiento que Vida y Ministerio.
  const isCatSort = sortConfig.key && (CATEGORIAS as string[]).includes(sortConfig.key);
  const sortedRows = useMemo(() => {
    if (!isCatSort) return baseSorted;
    const cat = sortConfig.key as RpCategoria;
    const dir = sortConfig.direction === "desc" ? -1 : 1;
    const elig: any[] = [];
    const noElig: any[] = [];
    for (const r of rows) {
      (r[`_elig_${cat}`] ? elig : noElig).push(r);
    }
    elig.sort((a, b) => {
      const fa = a[cat] ?? "";
      const fb = b[cat] ?? "";
      if (!fa && !fb) return a.nombre.localeCompare(b.nombre);
      if (!fa) return 1;
      if (!fb) return -1;
      const cmp = fa.localeCompare(fb);
      return cmp === 0 ? a.nombre.localeCompare(b.nombre) : cmp * dir;
    });
    noElig.sort((a, b) => a.nombre.localeCompare(b.nombre));
    return [...elig, ...noElig];
  }, [baseSorted, rows, isCatSort, sortConfig]);

  const filteredRows = useMemo(() => {
    const q = normalize(busqueda);
    if (!q) return sortedRows;
    return sortedRows.filter((r: any) => normalize(r.nombre).includes(q));
  }, [sortedRows, busqueda]);

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
          <CardDescription>
            Última(s) fecha(s) en que cada participante tuvo Presidencia, Orador (cuando fue local) o
            Lector de la Atalaya. Haz clic en un nombre para editarlo; para cambiar una asignación,
            hazlo desde el programa mensual.
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
              {filteredRows.length} de {sortedRows.length} participante(s)
            </span>
            <div className="flex items-center gap-2 sm:ml-auto">
              <FiltroFechaPopover
                desde={desde}
                hasta={hasta}
                onChangeDesde={setDesde}
                onChangeHasta={setHasta}
                onEliminar={eliminarFiltroFecha}
              />
              {puedeEditarParticipante && (
                <Button type="button" variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Nuevo Participante
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredRows.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              {busqueda ? "Sin coincidencias para la búsqueda." : "Sin participantes."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted hover:bg-muted">
                    <TableHead className="sticky left-0 bg-muted z-20 w-6 px-1 text-center font-bold text-foreground">
                      #
                    </TableHead>
                    <SortableTableHead
                      sortKey="nombre"
                      currentSort={sortConfig}
                      onSort={requestSort}
                      className="sticky left-6 bg-muted z-20 min-w-[180px] font-bold text-foreground shadow-[2px_0_4px_-2px_hsl(var(--border))]"
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
                  {filteredRows.map((row: any, idx: number) => {
                    const sortedByCat = isCatSort ? (sortConfig.key as RpCategoria) : null;
                    const dimRow = sortedByCat ? !row[`_elig_${sortedByCat}`] : false;
                    return (
                    <TableRow key={row.id} className={dimRow ? "opacity-40" : undefined}>
                      <TableCell className="sticky left-0 bg-muted z-10 w-6 px-1 text-center text-xs text-foreground font-medium">
                        {idx + 1}.
                      </TableCell>
                      <TableCell className="sticky left-6 bg-background z-10 font-bold whitespace-nowrap shadow-[2px_0_4px_-2px_hsl(var(--border))]">
                        {puedeEditarParticipante ? (
                          <button
                            type="button"
                            onClick={() => setEditParticipanteId(row.id)}
                            className="text-left bg-transparent border-0 p-0 cursor-pointer hover:text-primary transition-colors"
                            title="Editar participante"
                          >
                            {row.nombre}
                          </button>
                        ) : (
                          row.nombre
                        )}
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
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <CrearParticipanteRapidoModal open={createOpen} onOpenChange={setCreateOpen} />

      <EditarParticipanteDialog
        participanteId={editParticipanteId}
        open={!!editParticipanteId}
        onOpenChange={(o) => { if (!o) setEditParticipanteId(null); }}
      />
    </div>
  );
}
