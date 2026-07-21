import { useMemo, useState } from "react";
import { format, parseISO, startOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, addMonths } from "date-fns";
import { es } from "date-fns/locale";
import {
  Loader2,
  Trash2,
  Download,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Plus,
  X,
  CalendarIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuthContext } from "@/contexts/AuthProvider";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  useImportarPlantillasVyM,
  useListadoPlantillasVyMOficial,
  useEliminarPlantillaVyM,
  useEjecucionesSyncPlantillasVym,
  useLogPorEjecucion,
  useSyncPlantillasVymManual,
  type PlantillaVyMOficial,
  type EjecucionSyncPlantillasVym,
} from "@/hooks/usePlantillaVidaMinisterioOficial";

function formatValorCambio(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string" || typeof v === "number") return String(v);
  return JSON.stringify(v);
}

function estadoBadge(estado: string) {
  switch (estado) {
    case "creada":
      return <Badge className="bg-emerald-600">✅ Creada</Badge>;
    case "actualizada":
      return <Badge className="bg-blue-600">🔄 Actualizada</Badge>;
    case "sin_cambios":
      return <Badge variant="secondary">Sin cambios</Badge>;
    case "parcial":
      return <Badge className="bg-amber-500">⚠️ Parcial</Badge>;
    case "conflicto_fecha":
      return <Badge className="bg-amber-500">⚠️ Fecha no coincide</Badge>;
    default:
      return <Badge variant="destructive">❌ Error</Badge>;
  }
}

function EjecucionRow({ ejecucion }: { ejecucion: EjecucionSyncPlantillasVym }) {
  const [open, setOpen] = useState(false);
  const { data: semanas = [], isLoading } = useLogPorEjecucion(open ? ejecucion.id : null);
  const totalCambios = ejecucion.semanas_actualizadas;

  return (
    <div className="border rounded-md">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 flex-wrap p-3 text-left hover:bg-muted/40 rounded-md"
      >
        <div className="flex items-center gap-2 flex-wrap">
          {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
          <Badge
            className={
              ejecucion.origen === "cron"
                ? "bg-violet-500/10 border-violet-500/30 text-violet-600 dark:text-violet-400"
                : "bg-sky-500/10 border-sky-500/30 text-sky-600 dark:text-sky-400"
            }
          >
            {ejecucion.origen === "cron" ? "🤖 Automática" : "🖐️ Manual"}
          </Badge>
          <span className="text-sm font-medium">
            {format(parseISO(ejecucion.fecha_ejecucion), "d MMM yyyy, HH:mm", { locale: es })}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Badge className="bg-primary/10 border-primary/30 text-primary">
            Semanas importadas: {ejecucion.semanas_procesadas}
          </Badge>
          <Badge className="bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400">
            Cambios: {totalCambios}
          </Badge>
          {ejecucion.semanas_error > 0 && (
            <Badge className="bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400">
              Errores: {ejecucion.semanas_error}
            </Badge>
          )}
        </div>
      </button>
      {open && (
        <div className="border-t p-3 space-y-2">
          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : semanas.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">Sin detalle disponible para esta ejecución.</p>
          ) : (
            semanas.map((s) => <SemanaRow key={s.id} semana={s} />)
          )}
          {ejecucion.detenido_en && (
            <p className="text-xs text-muted-foreground pt-1">
              Se detuvo en {format(parseISO(ejecucion.detenido_en), "d MMM yyyy", { locale: es })} (wol.jw.org todavía no tiene esa semana publicada).
            </p>
          )}
          {!ejecucion.detenido_en && ejecucion.semanas_procesadas >= 8 && (
            <p className="text-xs text-amber-600 dark:text-amber-400 pt-1">
              Puede que hayan quedado más semanas pendientes — ejecuta la sincronización de nuevo para seguir avanzando.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function SemanaRow({
  semana,
}: {
  semana: {
    id: string;
    fecha_semana: string;
    estado: string | null;
    mensaje: string | null;
    cambios: Array<{ campo: string; anterior: unknown; nuevo: unknown }>;
  };
}) {
  const [open, setOpen] = useState(false);
  const tieneCambios = semana.cambios.length > 0;
  const esErrorLike = ["error", "conflicto_fecha", "parcial"].includes(semana.estado ?? "");
  const tieneDetalle = tieneCambios || (esErrorLike && !!semana.mensaje);

  return (
    <div className="border rounded-md bg-muted/20">
      <button
        type="button"
        onClick={() => tieneDetalle && setOpen((o) => !o)}
        className={`w-full flex items-center justify-between gap-2 p-2 text-left ${tieneDetalle ? "hover:bg-muted/50 cursor-pointer" : "cursor-default"}`}
      >
        <div className="flex items-center gap-2">
          {tieneDetalle ? (
            open ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <span className="w-3.5" />
          )}
          <span className="text-sm">Semana {format(parseISO(semana.fecha_semana), "d MMM yyyy", { locale: es })}</span>
        </div>
        {estadoBadge(semana.estado ?? "")}
      </button>
      {open && tieneCambios && (
        <div className="px-2 pb-2 space-y-1">
          {semana.cambios.map((c, idx) => (
            <div key={idx} className="text-xs bg-background rounded px-2 py-1.5 border">
              <span className="font-medium">{c.campo}</span>
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mt-0.5">
                <span className="text-muted-foreground line-through">{formatValorCambio(c.anterior)}</span>
                <span className="text-muted-foreground">→</span>
                <span>{formatValorCambio(c.nuevo)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      {open && !tieneCambios && esErrorLike && semana.mensaje && (
        <div className="px-2 pb-2">
          <div className="text-xs bg-background rounded px-2 py-1.5 border text-red-600 dark:text-red-400">
            {semana.mensaje}
          </div>
        </div>
      )}
    </div>
  );
}

function mondaysInMonth(year: number, monthIndex: number): number {
  const dias = eachDayOfInterval({
    start: startOfMonth(new Date(year, monthIndex, 1)),
    end: endOfMonth(new Date(year, monthIndex, 1)),
  });
  return dias.filter((d) => d.getDay() === 1).length;
}

interface GrupoMes {
  key: string;
  label: string;
  total: number;
  cargadas: PlantillaVyMOficial[];
  actualizadas: number;
  faltan: number;
}

function agruparPorMes(plantillas: PlantillaVyMOficial[]): GrupoMes[] {
  if (plantillas.length === 0) return [];
  const porMes = new Map<string, PlantillaVyMOficial[]>();
  for (const p of plantillas) {
    const key = format(parseISO(p.fecha_semana), "yyyy-MM");
    const arr = porMes.get(key) ?? [];
    arr.push(p);
    porMes.set(key, arr);
  }
  const claves = [...porMes.keys()].sort();
  const primera = parseISO(`${claves[0]}-01`);
  const ultima = parseISO(`${claves[claves.length - 1]}-01`);

  const grupos: GrupoMes[] = [];
  let cursor = primera;
  while (cursor <= ultima) {
    const key = format(cursor, "yyyy-MM");
    const cargadas = (porMes.get(key) ?? []).sort((a, b) => a.fecha_semana.localeCompare(b.fecha_semana));
    const total = mondaysInMonth(cursor.getFullYear(), cursor.getMonth());
    const actualizadas = cargadas.filter(
      (p) =>
        !!p.updated_at &&
        !!p.created_at &&
        Math.abs(new Date(p.updated_at).getTime() - new Date(p.created_at).getTime()) > 2000
    ).length;
    grupos.push({
      key,
      label: format(cursor, "MMMM yyyy", { locale: es }),
      total,
      cargadas,
      actualizadas,
      faltan: Math.max(0, total - cargadas.length),
    });
    cursor = addMonths(cursor, 1);
  }
  return grupos.reverse(); // más reciente primero
}

function MesRow({
  grupo,
  expandedId,
  setExpandedId,
  setToDelete,
}: {
  grupo: GrupoMes;
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
  setToDelete: (p: PlantillaVyMOficial) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border rounded-md">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 flex-wrap p-3 text-left hover:bg-muted/40 rounded-md"
      >
        <div className="flex items-center gap-2">
          {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
          <span className="text-sm font-medium capitalize">{grupo.label}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Badge className="bg-primary/10 border-primary/30 text-primary">{grupo.total} semanas</Badge>
          <Badge className="bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400">
            {grupo.actualizadas} actualizadas
          </Badge>
          {grupo.faltan > 0 && (
            <Badge className="bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400">
              Faltan {grupo.faltan} semana{grupo.faltan === 1 ? "" : "s"}
            </Badge>
          )}
        </div>
      </button>
      {open && (
        <div className="border-t">
          {grupo.cargadas.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Sin plantillas cargadas este mes.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Semana</TableHead>
                  <TableHead>Lectura</TableHead>
                  <TableHead>Importada</TableHead>
                  <TableHead className="w-20">URL</TableHead>
                  <TableHead className="w-12 text-center">Estado</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grupo.cargadas.map((p) => {
                  const fueActualizada =
                    !!p.updated_at &&
                    !!p.created_at &&
                    Math.abs(new Date(p.updated_at).getTime() - new Date(p.created_at).getTime()) > 2000;
                  return (
                    <>
                      <TableRow key={p.id}>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                          >
                            {expandedId === p.id ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell className="font-medium whitespace-nowrap">
                          {format(parseISO(p.fecha_semana), "d MMM yyyy", { locale: es })}
                        </TableCell>
                        <TableCell className="text-xs">{p.lectura_semana ?? "—"}</TableCell>
                        <TableCell className="text-xs">
                          {format(parseISO(p.created_at), "d MMM yyyy", { locale: es })}
                        </TableCell>
                        <TableCell>
                          {p.url_origen && (
                            <a
                              href={p.url_origen}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary inline-flex items-center text-xs"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <span
                            className="text-base"
                            title={
                              fueActualizada
                                ? `Actualizada el ${format(parseISO(p.updated_at), "d MMM yyyy HH:mm", { locale: es })}`
                                : "Importación única"
                            }
                          >
                            {fueActualizada ? "🔄" : "✅"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => setToDelete(p)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                      {expandedId === p.id && (
                        <TableRow key={p.id + "-prev"}>
                          <TableCell colSpan={7}>
                            <PreviewPlantilla p={p} />
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      )}
    </div>
  );
}

function PreviewPlantilla({ p }: { p: PlantillaVyMOficial }) {
  return (
    <div className="bg-muted/40 rounded-md p-4 text-sm space-y-2">
      <div>
        <strong>Lectura semana:</strong> {p.lectura_semana ?? "—"}
      </div>
      <div>
        <strong>Cánticos:</strong> {p.cantico_inicial ?? "?"} / {p.cantico_intermedio ?? "?"} / {p.cantico_final ?? "?"}
      </div>
      <div>
        <strong>Tesoros:</strong> {p.tesoros?.titulo} ({p.tesoros?.duracion ?? "?"} min)
        {p.tesoros?.detalle && (
          <div className="ml-4 text-xs text-muted-foreground">{p.tesoros.detalle}</div>
        )}
      </div>
      <div>
        <strong>Perlas:</strong> {p.perlas?.titulo} ({p.perlas?.duracion ?? "?"} min)
        {p.perlas?.cita && (
          <div className="ml-4 text-xs text-muted-foreground">{p.perlas.cita}</div>
        )}
      </div>
      <div>
        <strong>Lectura bíblica:</strong> {p.lectura_biblica?.cita} ({p.lectura_biblica?.duracion ?? "?"} min)
        {p.lectura_biblica?.leccion && (
          <span className="text-xs text-muted-foreground"> — {p.lectura_biblica.leccion}</span>
        )}
      </div>
      <div>
        <strong>Maestros:</strong>
        <ul className="ml-4 list-disc">
          {p.maestros?.map((m, i) => (
            <li key={i}>
              {m.titulo}{" "}
              <span className="text-muted-foreground">
                ({m.tipo}, {m.duracion ?? "?"} min)
              </span>
              {(m.detalle || m.leccion) && (
                <div className="text-xs text-muted-foreground">
                  {m.detalle}
                  {m.detalle && m.leccion ? " — " : ""}
                  {m.leccion}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <strong>Vida cristiana:</strong>
        <ul className="ml-4 list-disc">
          {p.vida_cristiana?.map((v, i) => (
            <li key={i}>
              {v.titulo} <span className="text-muted-foreground">({v.duracion ?? "?"} min)</span>
              {v.detalle && (
                <div className="text-xs text-muted-foreground">{v.detalle}</div>
              )}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <strong>Estudio bíblico:</strong> {p.estudio_biblico?.duracion ?? "?"} min
        {p.estudio_biblico?.tema && (
          <div className="ml-4 text-xs text-muted-foreground">{p.estudio_biblico.tema}</div>
        )}
      </div>
    </div>
  );
}

interface FilaImportar {
  url: string;
  fecha: Date | null;
}

function fechaAYmdLunes(d: Date): string {
  const lunes = startOfWeek(d, { weekStartsOn: 1 });
  const y = lunes.getFullYear();
  const m = String(lunes.getMonth() + 1).padStart(2, "0");
  const day = String(lunes.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function PlantillasVidaMinisterio() {
  const { roles } = useAuthContext();
  const isSuperAdmin = roles.includes("super_admin");

  const [filas, setFilas] = useState<FilaImportar[]>([{ url: "", fecha: null }]);
  const [fechaAbiertaIdx, setFechaAbiertaIdx] = useState<number | null>(null);
  const [resultados, setResultados] = useState<
    Array<{ url: string; fecha_semana: string | null; estado: string; mensaje: string; fecha_manual?: string | null; fecha_jw?: string | null }>
  >([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<PlantillaVyMOficial | null>(null);
  const [confirmReemplazo, setConfirmReemplazo] = useState<{
    items: Array<{ url: string; fecha_semana: string | null; forzar_fecha_url?: boolean }>;
    conflictos: string[];
  } | null>(null);
  const [confirmConflictoFecha, setConfirmConflictoFecha] = useState<Array<{
    url: string;
    fecha_manual: string | null;
    fecha_jw: string | null;
  }> | null>(null);



  const importar = useImportarPlantillasVyM();
  const eliminar = useEliminarPlantillaVyM();
  const { data: plantillas = [], isLoading } = useListadoPlantillasVyMOficial();
  const gruposPorMes = useMemo(() => agruparPorMes(plantillas), [plantillas]);
  const { data: ejecuciones = [], isLoading: isLoadingEjecuciones } = useEjecucionesSyncPlantillasVym();
  const syncManual = useSyncPlantillasVymManual();

  if (!isSuperAdmin) return <Navigate to="/" replace />;

  const actualizarFila = (i: number, patch: Partial<FilaImportar>) => {
    setFilas((prev) => prev.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  };

  const handleUrlChange = (i: number, value: string) => {
    // Si pegan múltiples URLs separadas por nueva línea, expandir filas
    const lineas = value
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (lineas.length > 1) {
      setFilas((prev) => {
        const copia = [...prev];
        copia[i] = { ...copia[i], url: lineas[0] };
        const nuevas = lineas.slice(1).map((u) => ({ url: u, fecha: null as Date | null }));
        copia.splice(i + 1, 0, ...nuevas);
        return copia;
      });
    } else {
      actualizarFila(i, { url: value });
    }
  };

  const agregarFila = () => setFilas((prev) => [...prev, { url: "", fecha: null }]);
  const quitarFila = (i: number) =>
    setFilas((prev) => (prev.length === 1 ? [{ url: "", fecha: null }] : prev.filter((_, idx) => idx !== i)));

  const ejecutarImportacion = async (
    items: Array<{ url: string; fecha_semana: string | null; forzar_fecha_url?: boolean }>,
  ) => {
    try {
      const res = await importar.mutateAsync(items);
      setResultados(res.resultados);
      const ok = res.resultados.filter((r) => r.estado === "creada" || r.estado === "actualizada").length;
      const parcial = res.resultados.filter((r) => r.estado === "parcial").length;
      const err = res.resultados.filter((r) => r.estado === "error").length;
      const conflictos = res.resultados.filter((r) => r.estado === "conflicto_fecha");

      if (conflictos.length > 0) {
        setConfirmConflictoFecha(
          conflictos.map((r) => ({
            url: r.url,
            fecha_manual: r.fecha_manual ?? null,
            fecha_jw: r.fecha_jw ?? r.fecha_semana ?? null,
          })),
        );
      }

      toast.success(
        `Importación: ${ok} ok, ${parcial} parcial, ${err} con errores${conflictos.length > 0 ? `, ${conflictos.length} con conflicto de fecha` : ""}`,
      );
    } catch (e) {
      // ya manejado en hook
    }
  };

  const handleImportar = async () => {
    // Mapas para detección: fecha→existe y url→fecha asociada en BD
    const fechasExistentes = new Set(plantillas.map((p) => p.fecha_semana));
    const urlAFecha = new Map(
      plantillas.filter((p) => p.url_origen).map((p) => [p.url_origen as string, p.fecha_semana]),
    );

    // Construir items: si la URL ya existe en BD, IGNORAR la fecha manual y forzar
    // la fecha de la BD (que debería coincidir con la de JW.ORG).
    const items = filas
      .filter((f) => f.url.trim().length > 0)
      .map((f) => {
        const url = f.url.trim();
        const fechaBd = urlAFecha.get(url);
        if (fechaBd) {
          return { url, fecha_semana: fechaBd, forzar_fecha_url: true };
        }
        return {
          url,
          fecha_semana: f.fecha ? fechaAYmdLunes(f.fecha) : null,
        };
      });

    if (items.length === 0) {
      toast.error("Agrega al menos una URL");
      return;
    }

    const conflictosSet = new Set<string>();
    for (const it of items) {
      if (it.fecha_semana && fechasExistentes.has(it.fecha_semana)) {
        conflictosSet.add(it.fecha_semana);
      } else if (!it.fecha_semana && urlAFecha.has(it.url)) {
        conflictosSet.add(urlAFecha.get(it.url) as string);
      }
    }
    const conflictos = Array.from(conflictosSet).sort();

    if (conflictos.length > 0) {
      setConfirmReemplazo({ items, conflictos });
      return;
    }

    await ejecutarImportacion(items);
  };


  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">Plantillas oficiales de Vida y Ministerio</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Pega URLs de <strong>wol.jw.org</strong>. La fecha de la semana se intenta detectar automáticamente; si no
          aparece en la página, indícala manualmente (cualquier día dentro de esa semana).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Importar desde JW.ORG</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            {filas.map((fila, i) => (
              <div key={i} className="flex flex-col md:flex-row gap-2 items-start md:items-end">
                <div className="flex-1 w-full">
                  {i === 0 && <Label className="text-xs text-muted-foreground">URL de la semana</Label>}
                  <Input
                    value={fila.url}
                    onChange={(e) => handleUrlChange(i, e.target.value)}
                    placeholder="https://wol.jw.org/es/wol/d/r4/lp-s/2026..."
                    className="font-mono text-xs"
                  />
                </div>
                <div className="w-full md:w-56">
                  {i === 0 && <Label className="text-xs text-muted-foreground">Fecha (opcional)</Label>}
                  <Popover open={fechaAbiertaIdx === i} onOpenChange={(o) => setFechaAbiertaIdx(o ? i : null)}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !fila.fecha && "text-muted-foreground",
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {fila.fecha ? format(fila.fecha, "d MMM yyyy", { locale: es }) : "Auto-detectar"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={fila.fecha ?? undefined}
                        onSelect={(d) => {
                          actualizarFila(i, { fecha: d ?? null });
                          setFechaAbiertaIdx(null);
                        }}
                        initialFocus
                        weekStartsOn={1}
                        locale={es}
                        className={cn("p-3 pointer-events-auto")}
                      />
                      {fila.fecha && (
                        <div className="p-2 border-t flex justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              actualizarFila(i, { fecha: null });
                              setFechaAbiertaIdx(null);
                            }}
                          >
                            Limpiar
                          </Button>
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>

                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => quitarFila(i)}
                  className="text-muted-foreground"
                  aria-label="Quitar fila"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex justify-between">
            <Button variant="outline" size="sm" onClick={agregarFila}>
              <Plus className="w-4 h-4 mr-2" /> Agregar otra semana
            </Button>
            <Button onClick={handleImportar} disabled={importar.isPending}>
              {importar.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Importando…
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" /> Importar
                </>
              )}
            </Button>
          </div>

          {resultados.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold mb-2">Resultados</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>URL</TableHead>
                    <TableHead>Semana</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Mensaje</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resultados.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="max-w-[200px] truncate text-xs">
                        <a href={r.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                          {r.url}
                        </a>
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {r.fecha_semana ? format(parseISO(r.fecha_semana), "d MMM yyyy", { locale: es }) : "—"}
                      </TableCell>
                      <TableCell>{estadoBadge(r.estado)}</TableCell>
                      <TableCell className="text-xs">{r.mensaje}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Plantillas guardadas</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-6">
              <Loader2 className="animate-spin" />
            </div>
          ) : plantillas.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Aún no hay plantillas guardadas.</p>
          ) : (
            <div className="space-y-2">
              {gruposPorMes.map((g) => (
                <MesRow
                  key={g.key}
                  grupo={g}
                  expandedId={expandedId}
                  setExpandedId={setExpandedId}
                  setToDelete={setToDelete}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-lg">Actualizaciones automáticas</CardTitle>
              <p className="text-sm text-muted-foreground">
                Registro de las semanas que el cron sobrescribió porque detectó un cambio real de contenido en wol.jw.org (no incluye creaciones nuevas ni corridas sin cambios).
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => syncManual.mutate()}
              disabled={syncManual.isPending}
              className="shrink-0"
            >
              {syncManual.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Ejecutar sincronización ahora
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingEjecuciones ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : ejecuciones.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Sin ejecuciones registradas todavía.
            </p>
          ) : (
            <div className="space-y-2">
              {ejecuciones.map((ej) => (
                <EjecucionRow key={ej.id} ejecucion={ej} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDeleteDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        onConfirm={async () => {
          if (toDelete) await eliminar.mutateAsync(toDelete.id);
          setToDelete(null);
        }}
        title="¿Eliminar plantilla?"
        description={`Se eliminará la plantilla de la semana ${toDelete ? format(parseISO(toDelete.fecha_semana), "d MMM yyyy", { locale: es }) : ""}. Las congregaciones dejarán de verla.`}
      />

      <AlertDialog open={!!confirmReemplazo} onOpenChange={(o) => !o && setConfirmReemplazo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>⚠️ Ya existen plantillas para esa(s) semana(s)</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                {confirmReemplazo && confirmReemplazo.conflictos.length > 0 && (
                  <div>
                    <p>
                      Las siguientes semanas ya están guardadas y se <strong>reemplazarán</strong> con los datos nuevos:
                    </p>
                    <ul className="list-disc ml-5 mt-1">
                      {confirmReemplazo.conflictos.map((f) => (
                        <li key={f}>{format(parseISO(f), "d MMM yyyy", { locale: es })}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <p className="font-medium">¿Está seguro que desea reemplazar los datos?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                const items = confirmReemplazo?.items ?? [];
                setConfirmReemplazo(null);
                await ejecutarImportacion(items);
              }}
            >
              Continuar y reemplazar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!confirmConflictoFecha}
        onOpenChange={(o) => !o && setConfirmConflictoFecha(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>⚠️ La fecha ingresada no coincide con JW.ORG</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  Las siguientes URL tienen una fecha manual distinta a la del programa en JW.ORG:
                </p>
                <ul className="list-disc ml-5 mt-1 space-y-1">
                  {confirmConflictoFecha?.map((c) => (
                    <li key={c.url}>
                      <div className="font-mono text-xs truncate">{c.url}</div>
                      <div>
                        Fecha manual:{" "}
                        <strong>
                          {c.fecha_manual
                            ? format(parseISO(c.fecha_manual), "d MMM yyyy", { locale: es })
                            : "—"}
                        </strong>{" "}
                        · Fecha en JW.ORG:{" "}
                        <strong>
                          {c.fecha_jw
                            ? format(parseISO(c.fecha_jw), "d MMM yyyy", { locale: es })
                            : "—"}
                        </strong>
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="font-medium">
                  ¿Desea continuar usando la fecha de JW.ORG?
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                const pendientes = confirmConflictoFecha ?? [];
                setConfirmConflictoFecha(null);
                const items = pendientes.map((c) => ({
                  url: c.url,
                  fecha_semana: null,
                  forzar_fecha_url: true,
                }));
                if (items.length > 0) await ejecutarImportacion(items);
              }}
            >
              Continuar con fecha de JW.ORG
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
