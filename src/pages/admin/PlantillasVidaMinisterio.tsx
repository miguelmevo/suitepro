import { useState } from "react";
import { format, parseISO, startOfWeek } from "date-fns";
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
  useLogActualizacionesPlantillasVyM,
  useSyncPlantillasVymManual,
  type PlantillaVyMOficial,
} from "@/hooks/usePlantillaVidaMinisterioOficial";

const CAMPO_LABEL: Record<string, string> = {
  lectura_semana: "Lectura semanal",
  cantico_inicial: "Cántico inicial",
  cantico_intermedio: "Cántico intermedio",
  cantico_final: "Cántico final",
  tesoros: "Tesoros de la Biblia",
  perlas: "Perlas escondidas",
  lectura_biblica: "Lectura bíblica",
  maestros: "Seamos mejores maestros",
  vida_cristiana: "Nuestra vida cristiana",
  estudio_biblico: "Estudio bíblico de la congregación",
};

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
    case "parcial":
      return <Badge className="bg-amber-500">⚠️ Parcial</Badge>;
    default:
      return <Badge variant="destructive">❌ Error</Badge>;
  }
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
  const { data: logActualizaciones = [], isLoading: isLoadingLog } = useLogActualizacionesPlantillasVyM();
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
                {plantillas.map((p) => {
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
          {isLoadingLog ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : logActualizaciones.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Sin actualizaciones automáticas registradas todavía.
            </p>
          ) : (
            <div className="space-y-3">
              {logActualizaciones.map((log) => (
                <div key={log.id} className="border rounded-md p-3 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="font-medium text-sm">
                      Semana {format(parseISO(log.fecha_semana), "d MMM yyyy", { locale: es })}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {format(parseISO(log.fecha_ejecucion), "d MMM yyyy, HH:mm", { locale: es })}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {log.cambios.map((c, idx) => (
                      <div key={idx} className="text-xs bg-muted/50 rounded px-2 py-1.5">
                        <span className="font-medium">{CAMPO_LABEL[c.campo] ?? c.campo}</span>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mt-0.5">
                          <span className="text-muted-foreground line-through">{formatValorCambio(c.anterior)}</span>
                          <span className="text-muted-foreground">→</span>
                          <span>{formatValorCambio(c.nuevo)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
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
