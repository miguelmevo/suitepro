import { useState } from "react";
import { format, parseISO, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { Loader2, Trash2, Download, ExternalLink, ChevronDown, ChevronRight, Plus, X, CalendarIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
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
      <div><strong>Lectura semana:</strong> {p.lectura_semana ?? "—"}</div>
      <div><strong>Cánticos:</strong> {p.cantico_inicial ?? "?"} / {p.cantico_intermedio ?? "?"} / {p.cantico_final ?? "?"}</div>
      <div><strong>Tesoros:</strong> {p.tesoros?.titulo} ({p.tesoros?.duracion ?? "?"} min)</div>
      <div><strong>Perlas:</strong> {p.perlas?.titulo} ({p.perlas?.duracion ?? "?"} min)</div>
      <div><strong>Lectura bíblica:</strong> {p.lectura_biblica?.cita} ({p.lectura_biblica?.duracion ?? "?"} min)</div>
      <div>
        <strong>Maestros:</strong>
        <ul className="ml-4 list-disc">
          {p.maestros?.map((m, i) => (
            <li key={i}>{m.titulo} <span className="text-muted-foreground">({m.tipo}, {m.duracion ?? "?"} min)</span></li>
          ))}
        </ul>
      </div>
      <div>
        <strong>Vida cristiana:</strong>
        <ul className="ml-4 list-disc">
          {p.vida_cristiana?.map((v, i) => (
            <li key={i}>{v.titulo} <span className="text-muted-foreground">({v.duracion ?? "?"} min)</span></li>
          ))}
        </ul>
      </div>
      <div><strong>Estudio bíblico:</strong> {p.estudio_biblico?.duracion ?? "?"} min</div>
    </div>
  );
}

export default function PlantillasVidaMinisterio() {
  const { roles } = useAuthContext();
  const isSuperAdmin = roles.includes("super_admin");

  const [urlsInput, setUrlsInput] = useState("");
  const [resultados, setResultados] = useState<Array<{ url: string; fecha_semana: string | null; estado: string; mensaje: string }>>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<PlantillaVyMOficial | null>(null);

  const importar = useImportarPlantillasVyM();
  const eliminar = useEliminarPlantillaVyM();
  const { data: plantillas = [], isLoading } = useListadoPlantillasVyMOficial();

  if (!isSuperAdmin) return <Navigate to="/" replace />;

  const handleImportar = async () => {
    const urls = urlsInput
      .split(/\r?\n/)
      .map((u) => u.trim())
      .filter((u) => u.length > 0);
    if (urls.length === 0) {
      toast.error("Pega al menos una URL");
      return;
    }
    try {
      const res = await importar.mutateAsync(urls);
      setResultados(res.resultados);
      const ok = res.resultados.filter((r) => r.estado === "creada" || r.estado === "actualizada").length;
      const parcial = res.resultados.filter((r) => r.estado === "parcial").length;
      const err = res.resultados.filter((r) => r.estado === "error").length;
      toast.success(`Importación: ${ok} ok, ${parcial} parcial, ${err} con errores`);
    } catch (e) {
      // ya manejado en hook
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">Plantillas oficiales de Vida y Ministerio</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Pega una o varias URLs de <strong>wol.jw.org</strong> (una por línea). Las plantillas importadas
          se mostrarán automáticamente a todas las congregaciones al abrir esa semana.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Importar desde JW.org</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={urlsInput}
            onChange={(e) => setUrlsInput(e.target.value)}
            rows={6}
            placeholder={"https://wol.jw.org/es/wol/d/r4/lp-s/202026163\nhttps://wol.jw.org/es/wol/d/r4/lp-s/202026164"}
            className="font-mono text-sm"
          />
          <div className="flex justify-end">
            <Button onClick={handleImportar} disabled={importar.isPending}>
              {importar.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Importando…</>
              ) : (
                <><Download className="w-4 h-4 mr-2" /> Importar</>
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
            <div className="flex justify-center p-6"><Loader2 className="animate-spin" /></div>
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
                        <Button variant="ghost" size="icon" className="h-6 w-6"
                          onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}>
                          {expandedId === p.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
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
                          <a href={p.url_origen} target="_blank" rel="noreferrer" className="text-primary inline-flex items-center text-xs">
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                          onClick={() => setToDelete(p)}>
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
    </div>
  );
}
