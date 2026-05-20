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
  type PlantillaVyMOficial,
} from "@/hooks/usePlantillaVidaMinisterioOficial";

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
      </div>
      <div>
        <strong>Perlas:</strong> {p.perlas?.titulo} ({p.perlas?.duracion ?? "?"} min)
      </div>
      <div>
        <strong>Lectura bíblica:</strong> {p.lectura_biblica?.cita} ({p.lectura_biblica?.duracion ?? "?"} min)
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
            </li>
          ))}
        </ul>
      </div>
      <div>
        <strong>Estudio bíblico:</strong> {p.estudio_biblico?.duracion ?? "?"} min
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
  const [resultados, setResultados] = useState<
    Array<{ url: string; fecha_semana: string | null; estado: string; mensaje: string }>
  >([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<PlantillaVyMOficial | null>(null);
  const [confirmReemplazo, setConfirmReemplazo] = useState<{
    items: Array<{ url: string; fecha_semana: string | null }>;
    conflictos: string[];
    sinFecha: number;
  } | null>(null);

  const importar = useImportarPlantillasVyM();
  const eliminar = useEliminarPlantillaVyM();
  const { data: plantillas = [], isLoading } = useListadoPlantillasVyMOficial();

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

  const ejecutarImportacion = async (items: Array<{ url: string; fecha_semana: string | null }>) => {
    try {
      const res = await importar.mutateAsync(items);
      setResultados(res.resultados);
      const ok = res.resultados.filter((r) => r.estado === "creada" || r.estado === "actualizada").length;
      const parcial = res.resultados.filter((r) => r.estado === "parcial").length;
      const err = res.resultados.filter((r) => r.estado === "error").length;
      toast.success(`Importación: ${ok} ok, ${parcial} parcial, ${err} con errores`);
    } catch (e) {
      // ya manejado en hook
    }
  };

  const handleImportar = async () => {
    const items = filas
      .filter((f) => f.url.trim().length > 0)
      .map((f) => ({
        url: f.url.trim(),
        fecha_semana: f.fecha ? fechaAYmdLunes(f.fecha) : null,
      }));
    if (items.length === 0) {
      toast.error("Agrega al menos una URL");
      return;
    }

    // Detectar conflictos con plantillas ya existentes (solo para items con fecha manual)
    const fechasExistentes = new Set(plantillas.map((p) => p.fecha_semana));
    const conflictos = items
      .filter((it) => it.fecha_semana && fechasExistentes.has(it.fecha_semana))
      .map((it) => it.fecha_semana as string);
    const sinFecha = items.filter((it) => !it.fecha_semana).length;

    if (conflictos.length > 0 || sinFecha > 0) {
      setConfirmReemplazo({ items, conflictos, sinFecha });
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
                  <Popover>
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
                        onSelect={(d) => actualizarFila(i, { fecha: d ?? null })}
                        initialFocus
                        weekStartsOn={1}
                        locale={es}
                        className={cn("p-3 pointer-events-auto")}
                      />
                      {fila.fecha && (
                        <div className="p-2 border-t flex justify-end">
                          <Button variant="ghost" size="sm" onClick={() => actualizarFila(i, { fecha: null })}>
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
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plantillas.map((p) => (
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
                        <TableCell colSpan={6}>
                          <PreviewPlantilla p={p} />
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
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
                {confirmReemplazo && confirmReemplazo.sinFecha > 0 && (
                  <p>
                    Hay <strong>{confirmReemplazo.sinFecha}</strong> URL(s) sin fecha manual: si su semana ya existe,
                    también será reemplazada al detectarla.
                  </p>
                )}
                <p className="text-muted-foreground">
                  Esta acción no afecta los borradores ya guardados por las congregaciones.
                </p>
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
    </div>
  );
}
