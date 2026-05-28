import { useEffect, useMemo, useRef, useState } from "react";
import { format, parseISO, subMonths, isValid } from "date-fns";
import { es } from "date-fns/locale";
import * as XLSX from "xlsx";
import { Download, Upload, Loader2, BarChart3, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table, TableBody, TableCell, TableHeader, SortableTableHead, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useProgramasVidaMinisterio } from "@/hooks/useProgramaVidaMinisterio";
import { useParticipantes } from "@/hooks/useParticipantes";
import { useCongregacionId } from "@/contexts/CongregacionContext";
import { useTableSort } from "@/hooks/useTableSort";
import { CrearParticipanteRapidoModal } from "@/components/participantes/CrearParticipanteRapidoModal";
import {
  computeUltimasParticipaciones,
  CATEGORIAS_ORDEN,
  CATEGORIA_LABEL,
  type VymCategoria,
  type UltimaEntry,
} from "@/lib/vida-ministerio-historial";
import { AsignarPopoverVym, SIMPLE_CATS } from "./AsignarPopoverVym";
import { cumpleFiltro } from "./ParticipanteSelector";
import type { ParticipanteFiltro } from "@/types/vida-ministerio";

// Filtro de elegibilidad por categoría (espejo de los slots reales del editor)
const CAT_FILTRO: Record<VymCategoria, ParticipanteFiltro> = {
  presidente: "anciano",
  oracion: "aprobado",
  tesoros: "anciano_o_sm",
  perlas: "anciano_o_sm",
  lectura_biblica: "varon_publicador",
  maestros: "publicador",
  vida_cristiana: "anciano_o_sm",
  estudio_bc: "anciano_o_sm",
  lector_ebc: "lector_ebc",
};

// ---------- Helpers ----------
function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[] = Array(n + 1).fill(0).map((_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1]
        ? prev
        : Math.min(prev, dp[j], dp[j - 1]) + 1;
      prev = tmp;
    }
  }
  return dp[n];
}

// Acepta "YYYY-MM-DD", "DD/MM/YYYY", "DD-MM-YYYY", Excel serial date (number)
function parseFechaFlexible(raw: any): string | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number") {
    // Excel serial: días desde 1899-12-30
    const ms = Math.round((raw - 25569) * 86400 * 1000);
    const d = new Date(ms);
    if (isValid(d)) return format(d, "yyyy-MM-dd");
    return null;
  }
  const s = String(raw).trim();
  if (!s) return null;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return s;
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (dmy) {
    const dd = dmy[1].padStart(2, "0");
    const mm = dmy[2].padStart(2, "0");
    let yyyy = dmy[3];
    if (yyyy.length === 2) yyyy = "20" + yyyy;
    return `${yyyy}-${mm}-${dd}`;
  }
  return null;
}

function parseFechaConRol(raw: any): { fecha: string; rol?: "T" | "A" } | null {
  if (raw == null || raw === "") return null;
  const s = String(raw).trim();
  // Acepta "2025-05-26 T" o "26/05/2025 A"
  const partes = s.split(/\s+/);
  const fecha = parseFechaFlexible(partes[0]);
  if (!fecha) return null;
  const rolRaw = (partes[1] ?? "").toUpperCase();
  const rol = rolRaw === "T" || rolRaw === "A" ? rolRaw : undefined;
  return { fecha, rol };
}

function formatFechaCorta(fecha: string) {
  try {
    return format(parseISO(fecha), "d MMM yy", { locale: es });
  } catch {
    return fecha;
  }
}

// Columnas Excel
const COL_CATEGORIAS: VymCategoria[] = CATEGORIAS_ORDEN;

const EXCEL_HEADERS = ["apellido", "nombre", ...COL_CATEGORIAS] as const;

interface NotFoundRow {
  key: string; // apellido+nombre normalizado
  apellido: string;
  nombre: string;
  // Datos del Excel a importar para esta persona
  entradas: Partial<Record<VymCategoria, UltimaEntry>>;
  // Selección del usuario
  accion: "pendiente" | "omitir" | "crear" | "vincular";
  vinculadoA?: string; // id del participante existente
}

// ---------- Componente ----------
export function HistorialVidaMinisterio() {
  const congregacionId = useCongregacionId();
  const queryClient = useQueryClient();
  const { data: programas, isLoading } = useProgramasVidaMinisterio();
  const { participantes, todosParticipantes } = useParticipantes();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hoy = useMemo(() => new Date(), []);
  const [desde, setDesde] = useState(format(subMonths(hoy, 24), "yyyy-MM-dd"));
  const [hasta, setHasta] = useState(format(hoy, "yyyy-MM-dd"));
  const [importing, setImporting] = useState(false);

  // No encontrados + modal
  const [notFoundDialog, setNotFoundDialog] = useState<{ open: boolean; rows: NotFoundRow[] }>({
    open: false,
    rows: [],
  });
  const [createModal, setCreateModal] = useState<{ open: boolean; rowKey?: string }>({ open: false });

  // Historial importado (tabla)
  const { data: historialImportado = [] } = useQuery({
    queryKey: ["historial_participacion_vym", congregacionId],
    enabled: !!congregacionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("historial_participacion_vym")
        .select("participante_id, fecha_semana, parte, titulo_parte")
        .eq("congregacion_id", congregacionId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  const programasFiltrados = useMemo(
    () => (programas ?? []).filter((p) => p.fecha_semana >= desde && p.fecha_semana <= hasta),
    [programas, desde, hasta]
  );

  // Última participación por categoría = merge de programas + historial importado
  const ultimasMap = useMemo(() => {
    const map = computeUltimasParticipaciones(programasFiltrados);
    for (const h of historialImportado) {
      if (h.fecha_semana < desde || h.fecha_semana > hasta) continue;
      const cat = h.parte as VymCategoria;
      if (!CATEGORIAS_ORDEN.includes(cat)) continue;
      const cur = map.get(h.participante_id) ?? {};
      const arr = cur[cat] ?? [];
      const rol = cat === "maestros" && (h.titulo_parte === "T" || h.titulo_parte === "A")
        ? (h.titulo_parte as "T" | "A")
        : undefined;
      const newEntry = rol ? { fecha: h.fecha_semana, rol } : { fecha: h.fecha_semana };
      // Insertar ordenado DESC y mantener máx 2
      const merged = [...arr, newEntry]
        .filter((e, i, a) => a.findIndex((x) => x.fecha === e.fecha && x.rol === e.rol) === i)
        .sort((a, b) => b.fecha.localeCompare(a.fecha))
        .slice(0, 2);
      cur[cat] = merged;
      map.set(h.participante_id, cur);
    }

    return map;
  }, [programasFiltrados, historialImportado, desde, hasta]);

  // Lectores EBC elegibles (para el filtro de la columna lector_ebc)
  const { data: lectoresEbcIds = [] } = useQuery({
    queryKey: ["lectores-ebc-elegibles-ids", congregacionId],
    enabled: !!congregacionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lectores_ebc_elegibles")
        .select("participante_id")
        .eq("congregacion_id", congregacionId!)
        .eq("activo", true);
      if (error) throw error;
      return (data ?? []).map((d) => d.participante_id);
    },
  });

  const ultimasRows = useMemo(() => {
    // Incluir TODOS los participantes activos (no sólo los que ya tienen historial),
    // para que al ordenar por una categoría se vean también los elegibles sin participación.
    const base = (participantes ?? []).filter(
      (p: any) => p.activo && !p.es_publicador_inactivo
    );
    return base.map((p: any) => {
      const u = ultimasMap.get(p.id) ?? {};
      const row: any = {
        id: p.id,
        nombre: `${p.apellido}, ${p.nombre}`,
        _p: p,
      };
      for (const cat of CATEGORIAS_ORDEN) {
        row[cat] = u[cat]?.[0]?.fecha ?? null;
        if (cat === "maestros") row.maestros_rol = u[cat]?.[0]?.rol;
        row[`_elig_${cat}`] = cumpleFiltro(p, CAT_FILTRO[cat], [], lectoresEbcIds);
      }
      return row;
    });
  }, [participantes, ultimasMap, lectoresEbcIds]);

  // Sort: por nombre usamos useTableSort; por categoría hacemos partición
  // (elegibles primero, ordenados por fecha; no elegibles al final, grisados).
  const accessors = useMemo(() => {
    const a: Record<string, (r: any) => any> = {
      nombre: (r) => r.nombre.toLowerCase(),
    };
    for (const cat of CATEGORIAS_ORDEN) {
      a[cat] = (r) => r[cat] ?? "";
    }
    return a;
  }, []);
  const { sortedData: baseSorted, sortConfig, requestSort } = useTableSort(
    ultimasRows,
    { key: "nombre", direction: "asc" },
    accessors
  );

  const isCatSort = sortConfig.key && (CATEGORIAS_ORDEN as string[]).includes(sortConfig.key);
  const sortedRows = useMemo(() => {
    if (!isCatSort) return baseSorted;
    const cat = sortConfig.key;
    const dir = sortConfig.direction === "desc" ? -1 : 1;
    const elig: any[] = [];
    const noElig: any[] = [];
    for (const r of ultimasRows) {
      (r[`_elig_${cat}`] ? elig : noElig).push(r);
    }
    elig.sort((a, b) => {
      const fa = a[cat] ?? "";
      const fb = b[cat] ?? "";
      // Sin fecha: al final del grupo de elegibles (independiente de dir)
      if (!fa && !fb) return a.nombre.localeCompare(b.nombre);
      if (!fa) return 1;
      if (!fb) return -1;
      const cmp = fa.localeCompare(fb);
      return cmp === 0 ? a.nombre.localeCompare(b.nombre) : cmp * dir;
    });
    noElig.sort((a, b) => a.nombre.localeCompare(b.nombre));
    return [...elig, ...noElig];
  }, [baseSorted, ultimasRows, isCatSort, sortConfig]);

  // ---------- Excel template ----------
  const handleDescargarPlantilla = () => {
    const wb = XLSX.utils.book_new();

    // Hoja 1: Instrucciones
    const instr: any[][] = [
      ["Importación de historial de participaciones — Vida y Ministerio"],
      [],
      ["Cómo usar esta plantilla:"],
      ["1. Vaya a la hoja 'Datos'."],
      ["2. Una fila por participante. Complete 'apellido' y 'nombre' tal como existen en la congregación."],
      ["3. En cada columna escriba la FECHA de la ÚLTIMA participación del participante en esa categoría."],
      ["4. Formato de fecha admitido: AAAA-MM-DD (ej. 2025-05-26) o DD/MM/AAAA (ej. 26/05/2025)."],
      ["5. Si no aplica, deje la celda vacía."],
      [],
      ["Categorías:"],
      ["- presidente: Presidente de la reunión"],
      ["- oracion: Oración inicial o final"],
      ["- tesoros: Discurso de 'Tesoros de la Biblia'"],
      ["- perlas: 'Busquemos perlas escondidas'"],
      ["- lectura_biblica: Lectura de la Biblia"],
      ["- maestros: 'Seamos mejores maestros' (titular o ayudante). Indique rol al final: '2025-05-26 T' (titular) o '2025-05-26 A' (ayudante)."],
      ["- vida_cristiana: Cualquier parte de 'Nuestra vida cristiana'"],
      ["- estudio_bc: Conductor o lector del 'Estudio bíblico de la congregación'"],
      ["- lector_ebc: Solo el lector del Estudio bíblico de la congregación"],
      [],
      ["Notas:"],
      ["- La búsqueda de participantes ignora mayúsculas/minúsculas y acentos."],
      ["- Si un nombre no existe en la congregación, al final del proceso se le mostrará una lista con 3 opciones: Vincular a uno existente, Crear nuevo, u Omitir."],
      ["- Puede reimportar el mismo archivo: cada (participante, categoría) se actualiza con la fecha más reciente."],
    ];
    const wsInstr = XLSX.utils.aoa_to_sheet(instr);
    wsInstr["!cols"] = [{ wch: 110 }];
    XLSX.utils.book_append_sheet(wb, wsInstr, "Instrucciones");

    // Hoja 2: Datos (encabezados + 1 fila ejemplo)
    const ejemplo: Record<string, any> = {
      apellido: "Pérez",
      nombre: "Juan",
      presidente: "2025-03-10",
      oracion: "2025-04-21",
      tesoros: "",
      perlas: "2025-02-17",
      lectura_biblica: "",
      maestros: "2025-05-26 T",
      vida_cristiana: "2025-01-13",
      estudio_bc: "",
      lector_ebc: "",
    };
    const wsDatos = XLSX.utils.json_to_sheet([ejemplo], { header: [...EXCEL_HEADERS] });
    wsDatos["!cols"] = EXCEL_HEADERS.map((h) => ({ wch: h === "apellido" || h === "nombre" ? 18 : 16 }));
    XLSX.utils.book_append_sheet(wb, wsDatos, "Datos");

    XLSX.writeFile(wb, "plantilla_historial_vida_ministerio.xlsx");
    toast.success("Plantilla descargada");
  };

  // ---------- Importación ----------
  // Índice de participantes por "apellido nombre" normalizado
  const idxParticipantes = useMemo(() => {
    const m = new Map<string, string>();
    (todosParticipantes ?? []).forEach((p) => {
      m.set(normalize(`${p.apellido} ${p.nombre}`), p.id);
    });
    return m;
  }, [todosParticipantes]);

  const sugerenciasParecidas = (apellido: string, nombre: string): { id: string; label: string; dist: number }[] => {
    const target = normalize(`${apellido} ${nombre}`);
    const out: { id: string; label: string; dist: number }[] = [];
    (todosParticipantes ?? []).forEach((p) => {
      const cand = normalize(`${p.apellido} ${p.nombre}`);
      const d = levenshtein(target, cand);
      if (d > 0 && d <= 2) {
        out.push({ id: p.id, label: `${p.apellido}, ${p.nombre}${p.activo ? "" : " (inactivo)"}`, dist: d });
      }
    });
    return out.sort((a, b) => a.dist - b.dist).slice(0, 5);
  };

  const escribirHistorial = async (rows: { participante_id: string; entradas: Partial<Record<VymCategoria, UltimaEntry>> }[]) => {
    if (!congregacionId) return 0;
    const payload: any[] = [];
    for (const r of rows) {
      for (const cat of CATEGORIAS_ORDEN) {
        const e = r.entradas[cat];
        if (!e) continue;
        payload.push({
          congregacion_id: congregacionId,
          participante_id: r.participante_id,
          fecha_semana: e.fecha,
          parte: cat,
          titulo_parte: cat === "maestros" && e.rol ? e.rol : null,
          origen: "import_historial",
        });
      }
    }
    if (payload.length === 0) return 0;
    // upsert por (cong, participante, fecha, parte)
    const { error } = await supabase
      .from("historial_participacion_vym")
      .upsert(payload, { onConflict: "congregacion_id,participante_id,fecha_semana,parte" });
    if (error) throw error;
    return payload.length;
  };

  const handleImportar = async (file: File) => {
    if (!congregacionId) {
      toast.error("Sin congregación seleccionada");
      return;
    }
    setImporting(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: false });
      // Buscar hoja "Datos" (insensitive) o tomar la primera no-Instrucciones
      const sheetName =
        wb.SheetNames.find((n) => n.toLowerCase() === "datos") ??
        wb.SheetNames.find((n) => n.toLowerCase() !== "instrucciones") ??
        wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<any>(ws, { defval: "" });

      const importarRows: { participante_id: string; entradas: Partial<Record<VymCategoria, UltimaEntry>> }[] = [];
      const notFound: NotFoundRow[] = [];

      for (const row of rows) {
        const apellido = String(row.apellido ?? "").trim();
        const nombre = String(row.nombre ?? "").trim();
        if (!apellido && !nombre) continue;

        const entradas: Partial<Record<VymCategoria, UltimaEntry>> = {};
        for (const cat of CATEGORIAS_ORDEN) {
          if (cat === "maestros") {
            const v = parseFechaConRol(row[cat]);
            if (v) entradas[cat] = v.rol ? { fecha: v.fecha, rol: v.rol } : { fecha: v.fecha };
          } else {
            const f = parseFechaFlexible(row[cat]);
            if (f) entradas[cat] = { fecha: f };
          }
        }
        if (Object.keys(entradas).length === 0) continue;

        const key = normalize(`${apellido} ${nombre}`);
        const id = idxParticipantes.get(key);
        if (id) {
          importarRows.push({ participante_id: id, entradas });
        } else {
          notFound.push({
            key,
            apellido,
            nombre,
            entradas,
            accion: "pendiente",
          });
        }
      }

      // Escribir los encontrados
      let importados = 0;
      if (importarRows.length > 0) {
        importados = await escribirHistorial(importarRows);
      }
      await queryClient.invalidateQueries({ queryKey: ["historial_participacion_vym", congregacionId] });

      if (notFound.length === 0) {
        toast.success(`Importadas ${importados} entrada(s) para ${importarRows.length} participante(s).`);
      } else {
        toast.warning(`Importadas ${importados} entrada(s). ${notFound.length} participante(s) no encontrados.`);
        setNotFoundDialog({ open: true, rows: notFound });
      }
    } catch (e: any) {
      console.error("Import error:", e);
      toast.error(e.message ?? "Error leyendo el archivo");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Acciones del modal de no encontrados
  const setRowAccion = (key: string, accion: NotFoundRow["accion"], vinculadoA?: string) => {
    setNotFoundDialog((d) => ({
      ...d,
      rows: d.rows.map((r) => (r.key === key ? { ...r, accion, vinculadoA } : r)),
    }));
  };

  const handleCreadoNuevo = async (rowKey: string, nuevoId: string) => {
    setRowAccion(rowKey, "vincular", nuevoId);
    setCreateModal({ open: false });
  };

  const handleResolverNotFound = async () => {
    if (!congregacionId) return;
    const pendientes = notFoundDialog.rows.filter((r) => r.accion === "pendiente");
    if (pendientes.length > 0) {
      toast.error(`Faltan ${pendientes.length} decisión(es). Marca cada fila como Vincular, Crear o Omitir.`);
      return;
    }
    const aImportar = notFoundDialog.rows
      .filter((r) => (r.accion === "vincular" || r.accion === "crear") && r.vinculadoA)
      .map((r) => ({ participante_id: r.vinculadoA!, entradas: r.entradas }));
    try {
      const n = aImportar.length > 0 ? await escribirHistorial(aImportar) : 0;
      await queryClient.invalidateQueries({ queryKey: ["historial_participacion_vym", congregacionId] });
      toast.success(`${n} entrada(s) adicional(es) importadas.`);
      setNotFoundDialog({ open: false, rows: [] });
    } catch (e: any) {
      toast.error(e.message ?? "Error al importar");
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filtro */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-primary text-base">Filtro por fecha</CardTitle>
          <CardDescription>Filtra la tabla por rango de fechas (no afecta la importación).</CardDescription>
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
                {sortedRows.length} participante(s)
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de últimas participaciones */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-primary text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5" /> Última participación por categoría
          </CardTitle>
          <CardDescription>
            Fecha de la última vez que cada participante tuvo asignación en cada categoría. En
            "Mejores Maestros": <strong>T</strong> = titular, <strong>A</strong> = ayudante. Haz
            clic en una columna para ordenar.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {sortedRows.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Sin datos en el rango seleccionado.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableTableHead
                      sortKey="nombre"
                      currentSort={sortConfig}
                      onSort={requestSort}
                      className="sticky left-0 bg-background z-10 min-w-[180px]"
                    >
                      Participante
                    </SortableTableHead>
                    {CATEGORIAS_ORDEN.map((cat) => (
                      <SortableTableHead
                        key={cat}
                        sortKey={cat}
                        currentSort={sortConfig}
                        onSort={requestSort}
                        className="text-xs whitespace-nowrap"
                      >
                        {CATEGORIA_LABEL[cat].toUpperCase()}
                      </SortableTableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRows.map((row: any) => {
                    const sortedByCat = isCatSort ? sortConfig.key : null;
                    const dimRow = sortedByCat && !row[`_elig_${sortedByCat}`];
                    return (
                      <TableRow key={row.id} className={dimRow ? "opacity-40" : undefined}>
                        <TableCell className="sticky left-0 bg-background font-medium whitespace-nowrap">
                          {row.nombre}
                        </TableCell>
                        {CATEGORIAS_ORDEN.map((cat) => {
                          const fecha = row[cat];
                          const isSimple = (SIMPLE_CATS as string[]).includes(cat);
                          const elig = row[`_elig_${cat}`];
                          const content = !fecha ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <>
                              {formatFechaCorta(fecha)}
                              {cat === "maestros" && row.maestros_rol && (
                                <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px] font-bold">
                                  {row.maestros_rol}
                                </Badge>
                              )}
                            </>
                          );
                          return (
                            <TableCell key={cat} className="text-center text-xs whitespace-nowrap p-1">
                              {isSimple && elig ? (
                                <AsignarPopoverVym
                                  participanteId={row.id}
                                  participanteLabel={row.nombre}
                                  categoria={cat as any}
                                >
                                  {content}
                                </AsignarPopoverVym>
                              ) : (
                                content
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

      {/* Importación (pequeño, al final) */}
      <Card className="opacity-90">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
            <Upload className="h-4 w-4" /> Importar historial de participaciones
          </CardTitle>
          <CardDescription className="text-xs">
            Acción única para cargar fechas históricas desde Excel (por ejemplo, al implementar la app en una congregación nueva).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={handleDescargarPlantilla}>
              <Download className="h-4 w-4 mr-2" /> Descargar plantilla
            </Button>
            <Button size="sm" variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={importing}>
              {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              Importar Excel
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImportar(f);
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Modal de "no encontrados" */}
      <Dialog
        open={notFoundDialog.open}
        onOpenChange={(o) => !o && setNotFoundDialog({ open: false, rows: [] })}
      >
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Participantes no encontrados
            </DialogTitle>
            <DialogDescription>
              Para cada nombre del Excel que no coincide con un participante existente, elige una acción:
              vincular a un participante existente (útil si hay una pequeña variación de escritura),
              crear un nuevo participante, u omitir.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {notFoundDialog.rows.map((r) => {
              const sug = sugerenciasParecidas(r.apellido, r.nombre);
              const numEntradas = Object.keys(r.entradas).length;
              return (
                <div
                  key={r.key}
                  className="border rounded-md p-3 space-y-2 bg-muted/30"
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="text-sm">
                      <strong>{r.apellido}, {r.nombre}</strong>
                      <span className="text-muted-foreground ml-2">({numEntradas} fecha{numEntradas !== 1 ? "s" : ""})</span>
                    </div>
                    <Badge
                      variant={r.accion === "pendiente" ? "outline" : "default"}
                      className="text-xs"
                    >
                      {r.accion === "pendiente" && "Pendiente"}
                      {r.accion === "vincular" && "✓ Vincular"}
                      {r.accion === "crear" && "✓ Crear"}
                      {r.accion === "omitir" && "✗ Omitir"}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2 items-end">
                    <div className="space-y-1">
                      <Label className="text-xs">Vincular a participante existente</Label>
                      <Select
                        value={r.vinculadoA ?? ""}
                        onValueChange={(v) => setRowAccion(r.key, "vincular", v)}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder={
                            sug.length > 0
                              ? `Sugerencias: ${sug.length} parecida(s)…`
                              : "Buscar participante…"
                          } />
                        </SelectTrigger>
                        <SelectContent className="max-h-[280px]">
                          {sug.length > 0 && (
                            <>
                              <div className="px-2 py-1 text-[10px] uppercase text-muted-foreground">Sugerencias</div>
                              {sug.map((s) => (
                                <SelectItem key={s.id} value={s.id}>
                                  {s.label}
                                </SelectItem>
                              ))}
                              <div className="px-2 py-1 text-[10px] uppercase text-muted-foreground border-t mt-1">Todos</div>
                            </>
                          )}
                          {(todosParticipantes ?? [])
                            .slice()
                            .sort((a, b) =>
                              `${a.apellido} ${a.nombre}`.localeCompare(`${b.apellido} ${b.nombre}`, "es")
                            )
                            .map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.apellido}, {p.nombre}{!p.activo ? " (inactivo)" : ""}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setCreateModal({ open: true, rowKey: r.key })}
                    >
                      Crear nuevo
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setRowAccion(r.key, "omitir")}
                    >
                      Omitir
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotFoundDialog({ open: false, rows: [] })}>
              Cancelar
            </Button>
            <Button onClick={handleResolverNotFound}>
              Aplicar decisiones
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CrearParticipanteRapidoModal
        open={createModal.open}
        onOpenChange={(o) => setCreateModal({ open: o, rowKey: createModal.rowKey })}
        onCreated={(id) => {
          if (createModal.rowKey) handleCreadoNuevo(createModal.rowKey, id);
        }}
      />
    </div>
  );
}
