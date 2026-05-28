import { useMemo, useRef, useState } from "react";
import { format, parseISO, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import * as XLSX from "xlsx";
import { Download, Upload, FileSpreadsheet, Loader2, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { useProgramasVidaMinisterio, useGuardarProgramaVidaMinisterio } from "@/hooks/useProgramaVidaMinisterio";
import { useParticipantes } from "@/hooks/useParticipantes";
import type { ProgramaVidaMinisterio } from "@/types/vida-ministerio";
import {
  computeUltimasParticipaciones,
  CATEGORIAS_ORDEN,
  CATEGORIA_LABEL,
  type VymCategoria,
} from "@/lib/vida-ministerio-historial";

const MAX_MAESTROS = 4;
const MAX_VIDA = 3;

const TEMPLATE_HEADERS = [
  "fecha_semana_lunes",
  "lectura_semana",
  "cantico_inicial",
  "cantico_intermedio",
  "cantico_final",
  "presidente",
  "oracion_inicial",
  "oracion_final",
  "tesoros_titulo",
  "tesoros_participante",
  "perlas_participante",
  "lectura_biblica_cita",
  "lectura_biblica_participante",
  ...Array.from({ length: MAX_MAESTROS }, (_, i) => [
    `maestro${i + 1}_titulo`,
    `maestro${i + 1}_tipo`,
    `maestro${i + 1}_titular`,
    `maestro${i + 1}_ayudante`,
  ]).flat(),
  ...Array.from({ length: MAX_VIDA }, (_, i) => [
    `vida_cristiana${i + 1}_titulo`,
    `vida_cristiana${i + 1}_participante`,
  ]).flat(),
  "estudio_biblico_titulo",
  "estudio_biblico_conductor",
  "estudio_biblico_lector",
  "notas",
];

function uid() {
  return Math.random().toString(36).slice(2, 11);
}

export function HistorialVidaMinisterio() {
  const { data: programas, isLoading } = useProgramasVidaMinisterio();
  const { participantes } = useParticipantes();
  const guardar = useGuardarProgramaVidaMinisterio();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hoy = useMemo(() => new Date(), []);
  const [desde, setDesde] = useState(format(subMonths(hoy, 12), "yyyy-MM-dd"));
  const [hasta, setHasta] = useState(format(hoy, "yyyy-MM-dd"));
  const [importing, setImporting] = useState(false);

  const programasFiltrados = useMemo(() => {
    return (programas ?? []).filter((p) => p.fecha_semana >= desde && p.fecha_semana <= hasta);
  }, [programas, desde, hasta]);

  const nombreById = useMemo(() => {
    const m = new Map<string, string>();
    (participantes ?? []).forEach((p) => m.set(p.id, `${p.nombre} ${p.apellido}`));
    return m;
  }, [participantes]);

  const idByNombre = useMemo(() => {
    const m = new Map<string, string>();
    (participantes ?? []).forEach((p) => m.set(`${p.nombre} ${p.apellido}`.trim().toLowerCase(), p.id));
    return m;
  }, [participantes]);

  // Estadísticas: conteo de partes por participante (para exportar a Excel)
  const stats = useMemo(() => {
    const counts = new Map<string, { total: number; categorias: Record<string, number> }>();
    const bump = (id: string | null | undefined, cat: string) => {
      if (!id) return;
      const cur = counts.get(id) ?? { total: 0, categorias: {} };
      cur.total += 1;
      cur.categorias[cat] = (cur.categorias[cat] ?? 0) + 1;
      counts.set(id, cur);
    };
    programasFiltrados.forEach((p) => {
      bump(p.presidente_id, "Presidente");
      bump(p.oracion_inicial_id, "Oración");
      bump(p.oracion_final_id, "Oración");
      bump(p.tesoros?.participante_id, "Tesoros");
      bump(p.perlas_id, "Perlas");
      bump(p.lectura_biblica?.participante_id, "Lectura bíblica");
      (p.maestros ?? []).forEach((m) => {
        bump(m.titular_id, "Maestros");
        bump(m.ayudante_id, "Maestros (ayudante)");
      });
      (p.vida_cristiana ?? []).forEach((v) => bump(v.participante_id, "Vida cristiana"));
      bump(p.estudio_biblico?.conductor_id, "EBC conductor");
      bump(p.estudio_biblico?.lector_id, "EBC lector");
    });
    return Array.from(counts.entries())
      .map(([id, v]) => ({ id, nombre: nombreById.get(id) ?? "—", ...v }))
      .sort((a, b) => b.total - a.total);
  }, [programasFiltrados, nombreById]);

  // Última participación por categoría (para la tabla principal de historial)
  const ultimasMap = useMemo(
    () => computeUltimasParticipaciones(programasFiltrados),
    [programasFiltrados]
  );

  const ultimasRows = useMemo(() => {
    const rows = (participantes ?? [])
      .filter((p) => ultimasMap.has(p.id))
      .map((p) => ({
        id: p.id,
        nombre: `${p.apellido}, ${p.nombre}`,
        ultimas: ultimasMap.get(p.id) ?? {},
      }));
    rows.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    return rows;
  }, [participantes, ultimasMap]);

  const formatFechaCorta = (fecha: string) => {
    try {
      return format(parseISO(fecha), "d MMM yy", { locale: es });
    } catch {
      return fecha;
    }
  };

  const programaToRow = (p: ProgramaVidaMinisterio): Record<string, any> => {
    const row: Record<string, any> = {
      fecha_semana_lunes: p.fecha_semana,
      lectura_semana: p.lectura_semana ?? "",
      cantico_inicial: p.cantico_inicial ?? "",
      cantico_intermedio: p.cantico_intermedio ?? "",
      cantico_final: p.cantico_final ?? "",
      presidente: nombreById.get(p.presidente_id ?? "") ?? "",
      oracion_inicial: nombreById.get(p.oracion_inicial_id ?? "") ?? "",
      oracion_final: nombreById.get(p.oracion_final_id ?? "") ?? "",
      tesoros_titulo: p.tesoros?.titulo ?? "",
      tesoros_participante: nombreById.get(p.tesoros?.participante_id ?? "") ?? "",
      perlas_participante: nombreById.get(p.perlas_id ?? "") ?? "",
      lectura_biblica_cita: p.lectura_biblica?.cita ?? "",
      lectura_biblica_participante: nombreById.get(p.lectura_biblica?.participante_id ?? "") ?? "",
      estudio_biblico_titulo: p.estudio_biblico?.titulo ?? "",
      estudio_biblico_conductor: nombreById.get(p.estudio_biblico?.conductor_id ?? "") ?? "",
      estudio_biblico_lector: nombreById.get(p.estudio_biblico?.lector_id ?? "") ?? "",
      notas: p.notas ?? "",
    };
    for (let i = 0; i < MAX_MAESTROS; i++) {
      const m = p.maestros?.[i];
      row[`maestro${i + 1}_titulo`] = m?.titulo ?? "";
      row[`maestro${i + 1}_tipo`] = m?.tipo ?? "";
      row[`maestro${i + 1}_titular`] = nombreById.get(m?.titular_id ?? "") ?? "";
      row[`maestro${i + 1}_ayudante`] = nombreById.get(m?.ayudante_id ?? "") ?? "";
    }
    for (let i = 0; i < MAX_VIDA; i++) {
      const v = p.vida_cristiana?.[i];
      row[`vida_cristiana${i + 1}_titulo`] = v?.titulo ?? "";
      row[`vida_cristiana${i + 1}_participante`] = nombreById.get(v?.participante_id ?? "") ?? "";
    }
    return row;
  };

  const handleDescargarPlantilla = () => {
    const emptyRow: Record<string, any> = {};
    TEMPLATE_HEADERS.forEach((h) => (emptyRow[h] = ""));
    emptyRow.fecha_semana_lunes = "2026-01-05";
    const ws = XLSX.utils.json_to_sheet([emptyRow], { header: TEMPLATE_HEADERS });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Plantilla");
    XLSX.writeFile(wb, "plantilla_vida_ministerio.xlsx");
    toast.success("Plantilla descargada");
  };

  const handleExportar = () => {
    if (programasFiltrados.length === 0) {
      toast.info("No hay programas en el rango seleccionado");
      return;
    }
    const rows = programasFiltrados
      .slice()
      .sort((a, b) => a.fecha_semana.localeCompare(b.fecha_semana))
      .map(programaToRow);
    const ws = XLSX.utils.json_to_sheet(rows, { header: TEMPLATE_HEADERS });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Historial");

    // Hoja de estadísticas
    const statRows = stats.map((s) => ({
      Participante: s.nombre,
      Total: s.total,
      ...s.categorias,
    }));
    const wsStats = XLSX.utils.json_to_sheet(statRows);
    XLSX.utils.book_append_sheet(wb, wsStats, "Estadísticas");

    XLSX.writeFile(wb, `historial_vida_ministerio_${desde}_${hasta}.xlsx`);
    toast.success(`Exportadas ${rows.length} semanas`);
  };

  const resolveParticipante = (nombre: string | undefined): string | null => {
    if (!nombre) return null;
    const key = String(nombre).trim().toLowerCase();
    if (!key) return null;
    return idByNombre.get(key) ?? null;
  };

  const handleImportar = async (file: File) => {
    setImporting(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<any>(ws, { defval: "" });

      let ok = 0;
      let errores: string[] = [];
      const advertenciasNombres = new Set<string>();

      for (const row of rows) {
        const fecha = String(row.fecha_semana_lunes ?? "").trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
          errores.push(`Fila omitida: fecha_semana_lunes inválida "${fecha}"`);
          continue;
        }

        const lookup = (n: string) => {
          const id = resolveParticipante(n);
          if (n && !id) advertenciasNombres.add(n);
          return id;
        };

        const maestros = [];
        for (let i = 0; i < MAX_MAESTROS; i++) {
          const titulo = String(row[`maestro${i + 1}_titulo`] ?? "").trim();
          if (!titulo) continue;
          const tipoRaw = String(row[`maestro${i + 1}_tipo`] ?? "demostracion").trim().toLowerCase();
          maestros.push({
            id: uid(),
            titulo,
            tipo: tipoRaw === "discurso" ? "discurso" : "demostracion",
            titular_id: lookup(row[`maestro${i + 1}_titular`]),
            ayudante_id: lookup(row[`maestro${i + 1}_ayudante`]),
          });
        }

        const vida_cristiana = [];
        for (let i = 0; i < MAX_VIDA; i++) {
          const titulo = String(row[`vida_cristiana${i + 1}_titulo`] ?? "").trim();
          if (!titulo) continue;
          vida_cristiana.push({
            id: uid(),
            titulo,
            participante_id: lookup(row[`vida_cristiana${i + 1}_participante`]),
          });
        }

        const payload: any = {
          fecha_semana: fecha,
          lectura_semana: String(row.lectura_semana ?? "") || null,
          cantico_inicial: row.cantico_inicial ? Number(row.cantico_inicial) : null,
          cantico_intermedio: row.cantico_intermedio ? Number(row.cantico_intermedio) : null,
          cantico_final: row.cantico_final ? Number(row.cantico_final) : null,
          presidente_id: lookup(row.presidente),
          oracion_inicial_id: lookup(row.oracion_inicial),
          oracion_final_id: lookup(row.oracion_final),
          tesoros: {
            titulo: String(row.tesoros_titulo ?? ""),
            participante_id: lookup(row.tesoros_participante),
          },
          perlas_id: lookup(row.perlas_participante),
          lectura_biblica: {
            cita: String(row.lectura_biblica_cita ?? ""),
            participante_id: lookup(row.lectura_biblica_participante),
          },
          maestros,
          vida_cristiana,
          estudio_biblico: {
            titulo: String(row.estudio_biblico_titulo ?? ""),
            conductor_id: lookup(row.estudio_biblico_conductor),
            lector_id: lookup(row.estudio_biblico_lector),
          },
          notas: String(row.notas ?? "") || null,
          estado: "completo",
          activo: true,
        };

        try {
          await guardar.mutateAsync(payload);
          ok += 1;
        } catch (e: any) {
          errores.push(`${fecha}: ${e.message ?? "error"}`);
        }
      }

      if (advertenciasNombres.size > 0) {
        toast.warning(
          `${advertenciasNombres.size} nombre(s) no encontrados — se importaron como vacíos: ${Array.from(
            advertenciasNombres
          )
            .slice(0, 5)
            .join(", ")}${advertenciasNombres.size > 5 ? "…" : ""}`,
          { duration: 6000 }
        );
      }
      if (errores.length > 0) {
        console.warn("Errores de importación:", errores);
        toast.error(`Importadas ${ok}, con ${errores.length} error(es). Ver consola.`);
      } else {
        toast.success(`Importadas ${ok} semana(s) correctamente`);
      }
    } catch (e: any) {
      console.error("Error importando Excel:", e);
      toast.error(e.message ?? "Error leyendo el archivo");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
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
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="text-primary text-lg flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" /> Historial e Importación
              </CardTitle>
              <CardDescription>
                Consulta programas pasados, descarga la plantilla Excel, exporta o haz backfill de semanas históricas.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
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
                {programasFiltrados.length} semana(s)
              </Badge>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2 border-t">
            <Button variant="outline" onClick={handleDescargarPlantilla}>
              <Download className="h-4 w-4 mr-2" /> Descargar plantilla
            </Button>
            <Button variant="outline" onClick={handleExportar} disabled={programasFiltrados.length === 0}>
              <Download className="h-4 w-4 mr-2" /> Exportar Excel
            </Button>
            <Button onClick={() => fileInputRef.current?.click()} disabled={importing}>
              {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              Importar / Backfill
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

          <Alert>
            <AlertDescription className="text-xs">
              Los participantes se identifican por <strong>"Nombre Apellido"</strong> (mayúsculas/minúsculas indiferentes).
              Si un nombre no existe, ese campo se importa vacío y se mostrará una advertencia. La importación hace upsert
              por <code>fecha_semana</code>, así que puedes re-subir el mismo archivo sin duplicar.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-primary text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5" /> Estadísticas de participación
          </CardTitle>
          <CardDescription>Conteo total de partes por participante en el rango seleccionado.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {stats.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Sin datos en el rango seleccionado.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Participante</TableHead>
                  <TableHead className="text-center w-[100px]">Total</TableHead>
                  <TableHead>Desglose</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.nombre}</TableCell>
                    <TableCell className="text-center">
                      <Badge>{s.total}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {Object.entries(s.categorias)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(" · ")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-primary text-lg">Programas en el rango</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {programasFiltrados.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Sin programas.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Semana (lunes)</TableHead>
                  <TableHead>Lectura semana</TableHead>
                  <TableHead>Presidente</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {programasFiltrados
                  .slice()
                  .sort((a, b) => b.fecha_semana.localeCompare(a.fecha_semana))
                  .map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">
                        {format(parseISO(p.fecha_semana), "d MMM yyyy", { locale: es })}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.lectura_semana ?? "—"}</TableCell>
                      <TableCell>{nombreById.get(p.presidente_id ?? "") ?? "—"}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={p.estado === "completo" ? "default" : "secondary"}>
                          {p.estado === "completo" ? "Completo" : "Borrador"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
