import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarOff, Search, Loader2, Trash2, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useIndisponibilidadParticipantes,
  TIPOS_RESPONSABILIDAD,
} from "@/hooks/useIndisponibilidadParticipantes";

export default function IndisponibilidadGeneral() {
  const { indisponibilidades, isLoading, eliminarIndisponibilidad } =
    useIndisponibilidadParticipantes();

  const [busqueda, setBusqueda] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");

  const formatFechaDisplay = (fechaInicio: string, fechaFin: string | null) => {
    const inicio = new Date(fechaInicio + "T00:00:00");
    if (fechaFin) {
      const fin = new Date(fechaFin + "T00:00:00");
      return `${format(inicio, "d MMM", { locale: es })} - ${format(fin, "d MMM yyyy", { locale: es })}`;
    }
    return format(inicio, "d MMMM yyyy", { locale: es });
  };

  const getTipoLabel = (tipos: string[]) => {
    if (tipos.includes("todas")) return "Todas";
    return tipos
      .map((t) => TIPOS_RESPONSABILIDAD.find((tr) => tr.value === t)?.label || t)
      .join(", ");
  };

  const indisponibilidadesFiltradas = indisponibilidades.filter((ind) => {
    const nombreCompleto = ind.participante
      ? `${ind.participante.nombre} ${ind.participante.apellido}`.toLowerCase()
      : "";
    const matchBusqueda =
      !busqueda || nombreCompleto.includes(busqueda.toLowerCase());
    const matchTipo =
      filtroTipo === "todos" ||
      ind.tipo_responsabilidad.includes("todas") ||
      ind.tipo_responsabilidad.includes(filtroTipo);
    return matchBusqueda && matchTipo;
  });

  // Agrupar por participante
  const porParticipante = indisponibilidadesFiltradas.reduce(
    (acc, ind) => {
      const key = ind.participante_id;
      if (!acc[key]) {
        acc[key] = {
          participante: ind.participante,
          indisponibilidades: [],
        };
      }
      acc[key].indisponibilidades.push(ind);
      return acc;
    },
    {} as Record<
      string,
      {
        participante: typeof indisponibilidades[0]["participante"];
        indisponibilidades: typeof indisponibilidades;
      }
    >
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
      <div>
        <h1 className="font-display text-2xl font-bold flex items-center gap-2">
          <CalendarOff className="h-6 w-6" />
          Indisponibilidad de Participantes
        </h1>
        <p className="text-muted-foreground">
          Vista consolidada de todas las fechas de indisponibilidad
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger className="w-[200px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filtrar por tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los tipos</SelectItem>
            {TIPOS_RESPONSABILIDAD.map((tipo) => (
              <SelectItem key={tipo.value} value={tipo.value}>
                {tipo.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabla */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Participante</TableHead>
              <TableHead>Fecha(s)</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead className="w-[80px]">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.keys(porParticipante).length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center text-muted-foreground py-8"
                >
                  No hay indisponibilidades registradas
                </TableCell>
              </TableRow>
            ) : (
              Object.entries(porParticipante).map(([key, data]) =>
                data.indisponibilidades.map((ind, idx) => (
                  <TableRow key={ind.id}>
                    {idx === 0 && (
                      <TableCell
                        rowSpan={data.indisponibilidades.length}
                        className="font-medium align-top"
                      >
                        {data.participante
                          ? `${data.participante.apellido}, ${data.participante.nombre}`
                          : "Participante desconocido"}
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <CalendarOff className="h-3 w-3 text-destructive" />
                        {formatFechaDisplay(ind.fecha_inicio, ind.fecha_fin)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {getTipoLabel(ind.tipo_responsabilidad)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {ind.motivo || "-"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => eliminarIndisponibilidad.mutate(ind.id)}
                        disabled={eliminarIndisponibilidad.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )
            )}
          </TableBody>
        </Table>
      </div>

      {/* Resumen */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>
          Total: {indisponibilidadesFiltradas.length} registro(s) de{" "}
          {Object.keys(porParticipante).length} participante(s)
        </span>
      </div>
    </div>
  );
}
