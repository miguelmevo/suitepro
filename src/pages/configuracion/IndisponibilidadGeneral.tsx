import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarOff, Search, Loader2, Trash2, Filter, Plus, X, CalendarIcon, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  useIndisponibilidadParticipantes,
  TIPOS_RESPONSABILIDAD,
  IndisponibilidadParticipante,
} from "@/hooks/useIndisponibilidadParticipantes";
import { useParticipantes } from "@/hooks/useParticipantes";
import { cn } from "@/lib/utils";

export default function IndisponibilidadGeneral() {
  const { indisponibilidades, isLoading, crearIndisponibilidad, actualizarIndisponibilidad, eliminarIndisponibilidad } =
    useIndisponibilidadParticipantes();
  const { participantes, isLoading: loadingParticipantes } = useParticipantes();

  const [busqueda, setBusqueda] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  
  // Estado del modal de agregar/editar
  const [modalOpen, setModalOpen] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [participanteSeleccionado, setParticipanteSeleccionado] = useState("");
  const [fechaInicio, setFechaInicio] = useState<Date | undefined>();
  const [fechaFin, setFechaFin] = useState<Date | undefined>();
  const [esRango, setEsRango] = useState(false);
  const [tiposSeleccionados, setTiposSeleccionados] = useState<string[]>(["todas"]);
  const [motivo, setMotivo] = useState("");

  const resetForm = () => {
    setEditandoId(null);
    setParticipanteSeleccionado("");
    setFechaInicio(undefined);
    setFechaFin(undefined);
    setEsRango(false);
    setTiposSeleccionados(["todas"]);
    setMotivo("");
  };

  const handleEditar = (ind: IndisponibilidadParticipante) => {
    setEditandoId(ind.id);
    setParticipanteSeleccionado(ind.participante_id);
    setFechaInicio(new Date(ind.fecha_inicio + "T00:00:00"));
    setFechaFin(ind.fecha_fin ? new Date(ind.fecha_fin + "T00:00:00") : undefined);
    setEsRango(!!ind.fecha_fin);
    setTiposSeleccionados(ind.tipo_responsabilidad);
    setMotivo(ind.motivo || "");
    setModalOpen(true);
  };

  const handleGuardar = () => {
    if (!participanteSeleccionado || !fechaInicio) return;

    if (editandoId) {
      // Actualizar
      actualizarIndisponibilidad.mutate(
        {
          id: editandoId,
          fecha_inicio: format(fechaInicio, "yyyy-MM-dd"),
          fecha_fin: esRango && fechaFin ? format(fechaFin, "yyyy-MM-dd") : null,
          motivo: motivo || null,
          tipo_responsabilidad: tiposSeleccionados,
        },
        {
          onSuccess: () => {
            setModalOpen(false);
            resetForm();
          },
        }
      );
    } else {
      // Crear nuevo
      crearIndisponibilidad.mutate(
        {
          participante_id: participanteSeleccionado,
          fecha_inicio: format(fechaInicio, "yyyy-MM-dd"),
          fecha_fin: esRango && fechaFin ? format(fechaFin, "yyyy-MM-dd") : null,
          motivo: motivo || undefined,
          tipo_responsabilidad: tiposSeleccionados,
        },
        {
          onSuccess: () => {
            setModalOpen(false);
            resetForm();
          },
        }
      );
    }
  };

  const handleTipoToggle = (tipo: string) => {
    if (tipo === "todas") {
      setTiposSeleccionados(["todas"]);
    } else {
      const sinTodas = tiposSeleccionados.filter((t) => t !== "todas");
      if (sinTodas.includes(tipo)) {
        const nuevos = sinTodas.filter((t) => t !== tipo);
        setTiposSeleccionados(nuevos.length > 0 ? nuevos : ["todas"]);
      } else {
        setTiposSeleccionados([...sinTodas, tipo]);
      }
    }
  };

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <CalendarOff className="h-6 w-6" />
            Indisponibilidad de Participantes
          </h1>
          <p className="text-muted-foreground">
            Vista consolidada de todas las fechas de indisponibilidad
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Agregar
        </Button>
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
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => handleEditar(ind)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => eliminarIndisponibilidad.mutate(ind.id)}
                          disabled={eliminarIndisponibilidad.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
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

      {/* Modal Agregar/Editar Indisponibilidad */}
      <Dialog open={modalOpen} onOpenChange={(open) => {
        setModalOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarOff className="h-5 w-5" />
              {editandoId ? "Editar Indisponibilidad" : "Agregar Indisponibilidad"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Selector de Participante */}
            <div className="space-y-2">
              <Label>Participante *</Label>
              <Select
                value={participanteSeleccionado}
                onValueChange={setParticipanteSeleccionado}
                disabled={!!editandoId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar participante..." />
                </SelectTrigger>
                <SelectContent>
                  {participantes.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.apellido}, {p.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Toggle Rango */}
            <div className="flex items-center gap-2">
              <Switch
                checked={esRango}
                onCheckedChange={(checked) => {
                  setEsRango(checked);
                  if (!checked) setFechaFin(undefined);
                }}
              />
              <Label className="text-sm">Rango de fechas</Label>
            </div>

            {/* Fechas */}
            <div className={cn("grid gap-4", esRango ? "grid-cols-2" : "grid-cols-1")}>
              <div className="space-y-2">
                <Label>{esRango ? "Fecha inicio *" : "Fecha *"}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !fechaInicio && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {fechaInicio
                        ? format(fechaInicio, "d MMM yyyy", { locale: es })
                        : "Seleccionar..."}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={fechaInicio}
                      onSelect={setFechaInicio}
                      locale={es}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {esRango && (
                <div className="space-y-2">
                  <Label>Fecha fin</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !fechaFin && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {fechaFin
                          ? format(fechaFin, "d MMM yyyy", { locale: es })
                          : "Seleccionar..."}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={fechaFin}
                        onSelect={setFechaFin}
                        locale={es}
                        disabled={(date) => fechaInicio ? date < fechaInicio : false}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>

            {/* Tipos de responsabilidad */}
            <div className="space-y-2">
              <Label>Aplica para</Label>
              <div className="grid grid-cols-2 gap-2">
                {TIPOS_RESPONSABILIDAD.map((tipo) => (
                  <div key={tipo.value} className="flex items-center gap-2">
                    <Checkbox
                      id={`tipo-${tipo.value}`}
                      checked={tiposSeleccionados.includes(tipo.value)}
                      onCheckedChange={() => handleTipoToggle(tipo.value)}
                    />
                    <label
                      htmlFor={`tipo-${tipo.value}`}
                      className="text-sm cursor-pointer"
                    >
                      {tipo.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Motivo */}
            <div className="space-y-2">
              <Label>Motivo (opcional)</Label>
              <Textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ej: Vacaciones, viaje, enfermedad..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleGuardar}
              disabled={
                !participanteSeleccionado ||
                !fechaInicio ||
                crearIndisponibilidad.isPending ||
                actualizarIndisponibilidad.isPending
              }
            >
              {(crearIndisponibilidad.isPending || actualizarIndisponibilidad.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editandoId ? "Actualizar" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
