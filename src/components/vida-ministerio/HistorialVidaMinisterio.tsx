import { useEffect, useMemo, useRef, useState } from "react";
import { format, parseISO, isValid } from "date-fns";
import { es } from "date-fns/locale";
import * as XLSX from "xlsx";
import { Download, Upload, Loader2, AlertTriangle, Clock, Plus } from "lucide-react";
import { EditarParticipanteDialog } from "@/components/participantes/EditarParticipanteDialog";
import { usePermisos } from "@/hooks/usePermisos";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, SortableTableHead, TableRow,
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
import { useConfiguracionSistema } from "@/hooks/useConfiguracionSistema";
import { useCongregacionId } from "@/contexts/CongregacionContext";
import { useTableSort } from "@/hooks/useTableSort";
import { CrearParticipanteRapidoModal } from "@/components/participantes/CrearParticipanteRapidoModal";
import { FiltroFechaPopover } from "@/components/programa/FiltroFechaPopover";
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
  oracion_inicial: "aprobado",
  oracion_final: "aprobado",
  tesoros: "anciano_o_sm",
  perlas: "anciano_o_sm",
  lectura_biblica: "varon_publicador",
  maestros: "publicador",
  discurso: "anciano_o_sm_varon",
  vida_cristiana: "anciano_o_sm",
  necesidades_congregacion: "anciano",
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

// Acepta Date, "YYYY-MM-DD", "DD/MM/YYYY", "DD-MM-YYYY", "YYYY/MM/DD", Excel serial date (number)
function parseFechaFlexible(raw: any): string | null {
  if (raw == null || raw === "") return null;
  if (raw instanceof Date) {
    if (isValid(raw)) return format(raw, "yyyy-MM-dd");
    return null;
  }
  if (typeof raw === "number") {
    // Excel serial: días desde 1899-12-30
    const ms = Math.round((raw - 25569) * 86400 * 1000);
    const d = new Date(ms);
    if (isValid(d)) return format(d, "yyyy-MM-dd");
    return null;
  }
  const s = String(raw).trim();
  if (!s) return null;
  // ISO YYYY-MM-DD o YYYY/MM/DD
  const iso = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  }
  // DD/MM/YYYY o DD-MM-YYYY
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

function formatFechaCorta(fecha: string) {
  try {
    return format(parseISO(fecha), "d MMM yy", { locale: es });
  } catch {
    return fecha;
  }
}

// Columnas Excel: maestros separados en T y A; oracion separada en inicial/final;
// agregadas discurso y necesidades_congregacion.
const EXCEL_HEADERS = [
  "apellido",
  "nombre",
  "presidente",
  "oracion_inicial",
  "oracion_final",
  "tesoros",
  "perlas",
  "lectura_biblica",
  "maestros_t",
  "maestros_a",
  "discurso",
  "vida_cristiana",
  "necesidades_congregacion",
  "estudio_bc",
  "lector_ebc",
] as const;

interface NotFoundRow {
  key: string; // apellido+nombre normalizado
  apellido: string;
  nombre: string;
  // Datos del Excel a importar para esta persona
  entradas: Partial<Record<VymCategoria, UltimaEntry[]>>;
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
  const { canEdit } = usePermisos();
  const puedeEditarParticipante = canEdit("configuracion_participantes");
  const { getConfigValue } = useConfiguracionSistema("vida_ministerio");
  const ebcConductorIncluyeSm = (getConfigValue("ebc_conductor_incluye_sm") as any)?.habilitado === true;
  const catFiltro = useMemo<Record<VymCategoria, ParticipanteFiltro>>(
    () => ({ ...CAT_FILTRO, estudio_bc: ebcConductorIncluyeSm ? "anciano_o_sm" : "anciano" }),
    [ebcConductorIncluyeSm]
  );

  const hoy = useMemo(() => new Date(), []);
  const hoyStr = useMemo(() => format(hoy, "yyyy-MM-dd"), [hoy]);
  // "" = sin límite (sin filtro por ese extremo) — arranca mostrando todo el historial disponible.
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [importing, setImporting] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const eliminarFiltroFecha = () => {
    setDesde("");
    setHasta("");
  };


  // No encontrados + modal
  const [notFoundDialog, setNotFoundDialog] = useState<{ open: boolean; rows: NotFoundRow[] }>({
    open: false,
    rows: [],
  });
  const [createModal, setCreateModal] = useState<{ open: boolean; rowKey?: string }>({ open: false });
  const [editParticipanteId, setEditParticipanteId] = useState<string | null>(null);

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
    () => (programas ?? []).filter((p) => (!desde || p.fecha_semana >= desde) && (!hasta || p.fecha_semana <= hasta)),
    [programas, desde, hasta]
  );

  // Última participación por categoría = merge de programas + historial importado
  const ultimasMap = useMemo(() => {
    const map = computeUltimasParticipaciones(programasFiltrados);
    for (const h of historialImportado) {
      if ((desde && h.fecha_semana < desde) || (hasta && h.fecha_semana > hasta)) continue;
      // Compat: registros antiguos guardados como "oracion" se mapean a "oracion_inicial"
      let cat = h.parte as VymCategoria;
      if ((h.parte as string) === "oracion") cat = "oracion_inicial";
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
        row[`${cat}_prev`] = u[cat]?.[1]?.fecha ?? null;
        if (cat === "maestros") {
          row.maestros_rol = u[cat]?.[0]?.rol;
          row.maestros_rol_prev = u[cat]?.[1]?.rol;
        }
        row[`_elig_${cat}`] = cumpleFiltro(p, catFiltro[cat], [], lectoresEbcIds);
      }
      return row;
    });
  }, [participantes, ultimasMap, lectoresEbcIds, catFiltro]);

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

  const filteredRows = useMemo(() => {
    const q = normalize(busqueda);
    if (!q) return sortedRows;
    return sortedRows.filter((r: any) => normalize(r.nombre).includes(q));
  }, [sortedRows, busqueda]);



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
      ["3. En cada columna escriba la FECHA de la ÚLTIMA participación del participante en esa categoría (1 fecha por celda)."],
      ["4. Formato de fecha admitido: AAAA-MM-DD (ej. 2025-05-26), DD/MM/AAAA o DD-MM-AAAA (ej. 26/05/2025), o celda con formato fecha de Excel."],
      ["5. Si no aplica, deje la celda vacía."],
      [],
      ["Categorías:"],
      ["- presidente: Presidente de la reunión"],
      ["- oracion_inicial: Oración inicial"],
      ["- oracion_final: Oración final"],
      ["- tesoros: Discurso de 'Tesoros de la Biblia'"],
      ["- perlas: 'Busquemos perlas escondidas'"],
      ["- lectura_biblica: Lectura de la Biblia"],
      ["- maestros_t: 'Seamos mejores maestros' — última fecha como TITULAR (demostración)"],
      ["- maestros_a: 'Seamos mejores maestros' — última fecha como AYUDANTE (demostración)"],
      ["- discurso: 'Seamos mejores maestros' — última fecha asignado a una parte de tipo DISCURSO (nunca tiene ayudante)"],
      ["- vida_cristiana: Cualquier parte de 'Nuestra vida cristiana' (excepto 'Necesidades de la congregación')"],
      ["- necesidades_congregacion: Última fecha asignado al tema 'Necesidades de la congregación'"],
      ["- estudio_bc: Conductor o lector del 'Estudio bíblico de la congregación'"],
      ["- lector_ebc: Solo el lector del Estudio bíblico de la congregación"],
      [],
      ["Notas:"],
      ["- La búsqueda de participantes ignora mayúsculas/minúsculas y acentos."],
      ["- Si un nombre no existe en la congregación, al final del proceso se le mostrará una lista con 3 opciones: Vincular a uno existente, Crear nuevo, u Omitir."],
      ["- Puede reimportar el mismo archivo: cada (participante, categoría, fecha) se actualiza."],
    ];
    const wsInstr = XLSX.utils.aoa_to_sheet(instr);
    wsInstr["!cols"] = [{ wch: 110 }];
    XLSX.utils.book_append_sheet(wb, wsInstr, "Instrucciones");

    // Hoja 2: Datos (encabezados + 1 fila ejemplo)
    const ejemplo: Record<string, any> = {
      apellido: "Pérez",
      nombre: "Juan",
      presidente: "2025-03-10",
      oracion_inicial: "2025-04-21",
      oracion_final: "",
      tesoros: "",
      perlas: "2025-02-17",
      lectura_biblica: "",
      maestros_t: "2025-05-26",
      maestros_a: "2025-03-31",
      discurso: "",
      vida_cristiana: "2025-01-13",
      necesidades_congregacion: "",
      estudio_bc: "",
      lector_ebc: "",
    };
    const wsDatos = XLSX.utils.json_to_sheet([ejemplo], { header: [...EXCEL_HEADERS] });
    wsDatos["!cols"] = EXCEL_HEADERS.map((h) => ({ wch: h === "apellido" || h === "nombre" ? 18 : 18 }));
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

  const escribirHistorial = async (
    rows: { participante_id: string; entradas: Partial<Record<VymCategoria, UltimaEntry[]>> }[]
  ) => {
    if (!congregacionId) return 0;
    const payload: any[] = [];
    for (const r of rows) {
      for (const cat of CATEGORIAS_ORDEN) {
        const entries = r.entradas[cat];
        if (!entries) continue;
        for (const e of entries) {
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
    }
    if (payload.length === 0) return 0;
    // Deduplicar por clave única para evitar "ON CONFLICT DO UPDATE command cannot affect row a second time"
    const dedupMap = new Map<string, any>();
    for (const row of payload) {
      const key = `${row.congregacion_id}|${row.participante_id}|${row.fecha_semana}|${row.parte}`;
      const existing = dedupMap.get(key);
      if (existing) {
        // Si ya hay un titular (T) priorízalo sobre ayudante (A)
        if (existing.titulo_parte !== "T" && row.titulo_parte === "T") {
          dedupMap.set(key, row);
        }
      } else {
        dedupMap.set(key, row);
      }
    }
    const uniquePayload = Array.from(dedupMap.values());
    // upsert por (cong, participante, fecha, parte)
    const { error } = await supabase
      .from("historial_participacion_vym")
      .upsert(uniquePayload, { onConflict: "congregacion_id,participante_id,fecha_semana,parte" });
    if (error) throw error;
    return uniquePayload.length;
  };

  const handleImportar = async (file: File) => {
    if (!congregacionId) {
      toast.error("Sin congregación seleccionada");
      return;
    }
    setImporting(true);
    try {
      const buf = await file.arrayBuffer();
      // cellDates: true → fechas de Excel llegan como Date (la columna viene formateada como fecha)
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      // Buscar hoja "Datos" (insensitive) o tomar la primera no-Instrucciones
      const sheetName =
        wb.SheetNames.find((n) => n.toLowerCase() === "datos") ??
        wb.SheetNames.find((n) => n.toLowerCase() !== "instrucciones") ??
        wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<any>(ws, { defval: "", raw: true });

      const importarRows: { participante_id: string; entradas: Partial<Record<VymCategoria, UltimaEntry[]>> }[] = [];
      const notFound: NotFoundRow[] = [];

      const addEntry = (
        target: Partial<Record<VymCategoria, UltimaEntry[]>>,
        cat: VymCategoria,
        entry: UltimaEntry
      ) => {
        const arr = target[cat] ?? [];
        arr.push(entry);
        target[cat] = arr;
      };

      for (const row of rows) {
        const apellido = String(row.apellido ?? "").trim();
        const nombre = String(row.nombre ?? "").trim();
        if (!apellido && !nombre) continue;

        const entradas: Partial<Record<VymCategoria, UltimaEntry[]>> = {};
        // Categorías simples (1 fecha por celda)
        const simples: VymCategoria[] = [
          "presidente",
          "oracion_inicial",
          "oracion_final",
          "tesoros",
          "perlas",
          "lectura_biblica",
          "discurso",
          "vida_cristiana",
          "necesidades_congregacion",
          "estudio_bc",
          "lector_ebc",
        ];
        for (const cat of simples) {
          const f = parseFechaFlexible(row[cat]);
          if (f) addEntry(entradas, cat, { fecha: f });
        }
        // maestros_t / maestros_a → ambos van a cat "maestros" con rol distinto
        const fT = parseFechaFlexible(row["maestros_t"]);
        if (fT) addEntry(entradas, "maestros", { fecha: fT, rol: "T" });
        const fA = parseFechaFlexible(row["maestros_a"]);
        if (fA) addEntry(entradas, "maestros", { fecha: fA, rol: "A" });

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
      {/* Tabla de últimas participaciones */}
      <Card>
        <CardHeader className="pb-3">
          <CardDescription>
            Fecha de la última vez que cada participante tuvo asignación en cada categoría. En
            "Mejores Maestros": <strong>T</strong> = titular, <strong>A</strong> = ayudante. Haz
            clic en una columna para ordenar.
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
              {busqueda ? "Sin coincidencias para la búsqueda." : "Sin datos en el rango seleccionado."}
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
                    {CATEGORIAS_ORDEN.map((cat) => (
                      <SortableTableHead
                        key={cat}
                        sortKey={cat}
                        currentSort={sortConfig}
                        onSort={requestSort}
                        className="text-xs whitespace-nowrap font-bold"
                      >
                        {CATEGORIA_LABEL[cat].toUpperCase()}
                      </SortableTableHead>
                    ))}
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {filteredRows.map((row: any, idx: number) => {
                    const sortedByCat = isCatSort ? sortConfig.key : null;
                    const dimRow = sortedByCat && !row[`_elig_${sortedByCat}`];
                    return (
                      <TableRow key={row.id} className={dimRow ? "opacity-40" : undefined}>
                        <TableCell className="sticky left-0 bg-muted z-10 w-6 px-1 text-center text-xs text-foreground font-medium">
                          {idx + 1}.
                        </TableCell>
                        <TableCell className="sticky left-6 bg-muted z-10 font-bold whitespace-nowrap text-foreground shadow-[2px_0_4px_-2px_hsl(var(--border))]">
                          {puedeEditarParticipante ? (
                            <button
                              type="button"
                              onClick={() => setEditParticipanteId(row.id)}
                              className="text-left text-foreground bg-transparent border-0 p-0 cursor-pointer hover:text-primary transition-colors"
                              title="Editar participante"
                            >
                              {row.nombre}
                            </button>
                          ) : (
                            <span>{row.nombre}</span>
                          )}
                        </TableCell>

                        {CATEGORIAS_ORDEN.map((cat) => {
                          const fecha = row[cat];
                          const fechaPrev = row[`${cat}_prev`];
                          const isSimple = (SIMPLE_CATS as string[]).includes(cat);
                          const elig = row[`_elig_${cat}`];
                          const isFutura = fecha && fecha > hoyStr;
                          const isPrevFutura = fechaPrev && fechaPrev > hoyStr;
                          const content = !fecha ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <div className="flex flex-col items-center leading-tight">
                              <span
                                className={
                                  isFutura
                                    ? "text-primary font-semibold inline-flex items-center gap-0.5"
                                    : ""
                                }
                                title={isFutura ? "Asignación futura" : undefined}
                              >
                                {isFutura && <Clock className="h-3 w-3" />}
                                {formatFechaCorta(fecha)}
                                {cat === "maestros" && row.maestros_rol && (
                                  <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px] font-bold">
                                    {row.maestros_rol}
                                  </Badge>
                                )}
                              </span>
                              {fechaPrev && (
                                <span
                                  className={`text-[10px] opacity-60 ${
                                    isPrevFutura ? "text-primary" : "text-muted-foreground"
                                  }`}
                                  title="Participación anterior"
                                >
                                  {formatFechaCorta(fechaPrev)}
                                  {cat === "maestros" && row.maestros_rol_prev && ` ${row.maestros_rol_prev}`}
                                </span>
                              )}
                            </div>
                          );
                          const isComposite = !isSimple && elig;
                          return (
                            <TableCell key={cat} className="text-center text-xs whitespace-nowrap p-1">
                              {isSimple && elig ? (
                                <AsignarPopoverVym
                                  participanteId={row.id}
                                  participanteLabel={row.nombre}
                                  categoria={cat as any}
                                  ultimaEntry={ultimasMap.get(row.id)}
                                >
                                  {content}
                                </AsignarPopoverVym>
                              ) : isComposite ? (
                                <span
                                  className="block cursor-help"
                                  title="Esta asignación solo puede hacerse desde el editor semanal, ya que requiere elegir variables adicionales (número de parte, titular/ayudante, sala auxiliar, etc.)."
                                >
                                  {content}
                                </span>
                              ) : (
                                content
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
                            .filter((p) => !sug.some((s) => s.id === p.id))
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
        initialNombre={notFoundDialog.rows.find((r) => r.key === createModal.rowKey)?.nombre}
        initialApellido={notFoundDialog.rows.find((r) => r.key === createModal.rowKey)?.apellido}
        onCreated={(id) => {
          if (createModal.rowKey) handleCreadoNuevo(createModal.rowKey, id);
        }}
      />

      <CrearParticipanteRapidoModal open={createOpen} onOpenChange={setCreateOpen} />

      <EditarParticipanteDialog
        participanteId={editParticipanteId}
        open={!!editParticipanteId}
        onOpenChange={(o) => { if (!o) setEditParticipanteId(null); }}
      />
    </div>
  );
}
