import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { useState, ReactNode } from "react";
import { ExternalLink, Pencil, Trash2, Plus } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { HorarioSalida, ProgramaConDetalles, PuntoEncuentro, Territorio, AsignacionGrupo } from "@/types/programa-predicacion";
import { Participante } from "@/types/grupos-servicio";
import { EntradaCeldaForm } from "./EntradaCeldaForm";
import { GrupoPredicacion } from "@/hooks/useGruposPredicacion";

interface DiaEspecial {
  id: string;
  nombre: string;
  fecha: string;
  bloqueo_tipo: string;
}

interface CeldaEditableProps {
  entrada: ProgramaConDetalles;
  fecha: string;
  horario: HorarioSalida;
  horarios: HorarioSalida[];
  puntos: PuntoEncuentro[];
  territorios: Territorio[];
  participantes: Participante[];
  gruposPredicacion: GrupoPredicacion[];
  diasEspeciales?: DiaEspecial[];
  onCrearEntrada: (data: {
    fecha: string;
    horario_id: string;
    punto_encuentro_id?: string;
    territorio_id?: string;
    capitan_id?: string;
  }) => void;
  onActualizarEntrada?: (id: string, data: {
    punto_encuentro_id?: string;
    territorio_id?: string;
    capitan_id?: string;
  }) => void;
  onEliminarEntrada?: (id: string) => void;
  isCreating?: boolean;
  children: ReactNode;
}

function CeldaEditable({
  entrada,
  fecha,
  horario,
  horarios,
  puntos,
  territorios,
  participantes,
  gruposPredicacion,
  diasEspeciales,
  onCrearEntrada,
  onActualizarEntrada,
  onEliminarEntrada,
  isCreating,
  children,
}: CeldaEditableProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="w-full h-full min-h-[48px] flex items-center hover:bg-primary/5 transition-colors cursor-pointer group relative">
          {children}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-background/70 transition-opacity">
            <Pencil className="h-4 w-4 text-primary" />
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 bg-popover border shadow-lg z-50" align="start">
        <EntradaCeldaForm
          fecha={fecha}
          horario={horario}
          horarios={horarios}
          puntos={puntos}
          territorios={territorios}
          participantes={participantes}
          gruposPredicacion={gruposPredicacion}
          diasEspeciales={diasEspeciales}
          entrada={entrada}
          onSubmit={onCrearEntrada}
          onUpdate={(id, data) => {
            onActualizarEntrada?.(id, data);
            setOpen(false);
          }}
          onDelete={(id) => {
            onEliminarEntrada?.(id);
            setOpen(false);
          }}
          isLoading={isCreating}
          isInline
        />
      </PopoverContent>
    </Popover>
  );
}

// Botón para agregar fila adicional
interface BotonAgregarFilaProps {
  fecha: string;
  horarios: HorarioSalida[];
  puntos: PuntoEncuentro[];
  territorios: Territorio[];
  participantes: Participante[];
  gruposPredicacion: GrupoPredicacion[];
  diasEspeciales?: DiaEspecial[];
  onCrearEntrada: (data: {
    fecha: string;
    horario_id: string;
    punto_encuentro_id?: string;
    territorio_id?: string;
    capitan_id?: string;
    es_mensaje_especial?: boolean;
    mensaje_especial?: string;
    colspan_completo?: boolean;
  }) => void;
  isCreating?: boolean;
  tipo: "manana" | "tarde";
}

function BotonAgregarFila({
  fecha,
  horarios,
  puntos,
  territorios,
  participantes,
  gruposPredicacion,
  diasEspeciales,
  onCrearEntrada,
  isCreating,
  tipo,
}: BotonAgregarFilaProps) {
  const [open, setOpen] = useState(false);
  
  // Filtrar horarios según el tipo
  const horariosDisponibles = horarios.filter((h) => {
    const hora = parseInt(h.hora.split(":")[0], 10);
    return tipo === "manana" ? hora < 12 : hora >= 12;
  });

  if (horariosDisponibles.length === 0) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0 opacity-50 hover:opacity-100"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 bg-popover border shadow-lg z-50" align="start">
        <EntradaCeldaForm
          fecha={fecha}
          horario={horariosDisponibles[0]}
          horarios={horariosDisponibles}
          puntos={puntos}
          territorios={territorios}
          participantes={participantes}
          gruposPredicacion={gruposPredicacion}
          diasEspeciales={diasEspeciales}
          onSubmit={(data) => {
            onCrearEntrada(data);
            setOpen(false);
          }}
          isLoading={isCreating}
          isInline
        />
      </PopoverContent>
    </Popover>
  );
}

interface DiasReunionConfig {
  dia_entre_semana?: string;
  hora_entre_semana?: string;
  dia_fin_semana?: string;
  hora_fin_semana?: string;
}

interface ProgramaTableProps {
  programa: ProgramaConDetalles[];
  horarios: HorarioSalida[];
  fechas: string[];
  puntos: PuntoEncuentro[];
  territorios: Territorio[];
  participantes: Participante[];
  gruposPredicacion: GrupoPredicacion[];
  diasEspeciales?: DiaEspecial[];
  onCrearEntrada: (data: {
    fecha: string;
    horario_id: string;
    punto_encuentro_id?: string;
    territorio_id?: string;
    capitan_id?: string;
    es_mensaje_especial?: boolean;
    mensaje_especial?: string;
    colspan_completo?: boolean;
    es_por_grupos?: boolean;
    asignaciones_grupos?: AsignacionGrupo[];
  }) => void;
  onActualizarEntrada?: (id: string, data: {
    punto_encuentro_id?: string;
    territorio_id?: string;
    capitan_id?: string;
    es_por_grupos?: boolean;
    asignaciones_grupos?: AsignacionGrupo[];
  }) => void;
  onEliminarEntrada?: (id: string) => void;
  isCreating?: boolean;
  diasReunionConfig?: DiasReunionConfig;
}

export function ProgramaTable({ 
  programa, 
  horarios, 
  fechas, 
  puntos, 
  territorios, 
  participantes,
  gruposPredicacion,
  diasEspeciales,
  onCrearEntrada,
  onActualizarEntrada,
  onEliminarEntrada,
  isCreating,
  diasReunionConfig
}: ProgramaTableProps) {
  // Separar horarios en mañana y tarde
  const horariosManana = horarios.filter((h) => {
    const hora = parseInt(h.hora.split(":")[0], 10);
    return hora < 12;
  });
  
  const horariosTarde = horarios.filter((h) => {
    const hora = parseInt(h.hora.split(":")[0], 10);
    return hora >= 12;
  });

  // Obtener el primer horario de cada tipo (para celdas vacías/por defecto)
  const horarioManana = horariosManana[0];
  const horarioTarde = horariosTarde[0];

  // Obtener todas las entradas de un día para un tipo de horario
  const getEntradasPorTipo = (fecha: string, tipo: "manana" | "tarde") => {
    const horariosDelTipo = tipo === "manana" ? horariosManana : horariosTarde;
    const horarioIds = horariosDelTipo.map(h => h.id);
    return programa.filter((p) => 
      p.fecha === fecha && 
      p.horario_id && 
      horarioIds.includes(p.horario_id) &&
      !p.es_mensaje_especial
    );
  };

  const getMensajeEspecial = (fecha: string) => {
    const entrada = programa.find((p) => p.fecha === fecha && p.es_mensaje_especial && p.colspan_completo);
    if (!entrada) return null;
    
    // Buscar el bloqueo_tipo en diasEspeciales por nombre o fecha
    const diaEspecial = diasEspeciales?.find(
      (d) => d.nombre === entrada.mensaje_especial || d.fecha === fecha
    );
    
    return {
      ...entrada,
      bloqueo_tipo: diaEspecial?.bloqueo_tipo || "completo"
    };
  };

  const formatDia = (fecha: string) => {
    const date = parseISO(fecha);
    return {
      diaSemana: format(date, "EEEE", { locale: es }),
      diaSemanaKey: format(date, "EEEE", { locale: es }).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
      diaNumero: format(date, "d"),
    };
  };

  // Función para verificar si es día de reunión y en qué horario
  const getMensajeReunion = (fecha: string): { mensaje: string; bloqueoTipo: "manana" | "tarde" } | null => {
    if (!diasReunionConfig) return null;
    
    const { diaSemanaKey } = formatDia(fecha);
    
    // Normalizar el día configurado para comparación
    const normalizar = (dia: string) => dia?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") || "";
    
    const diaEntreSemana = normalizar(diasReunionConfig.dia_entre_semana || "");
    const diaFinSemana = normalizar(diasReunionConfig.dia_fin_semana || "");
    
    if (diaSemanaKey === diaEntreSemana) {
      const hora = diasReunionConfig.hora_entre_semana || "19:00";
      const horaNum = parseInt(hora.split(":")[0], 10);
      return {
        mensaje: `REUNIÓN VIDA Y MINISTERIO CRISTIANO ${hora}`,
        bloqueoTipo: horaNum < 12 ? "manana" : "tarde"
      };
    }
    
    if (diaSemanaKey === diaFinSemana) {
      const hora = diasReunionConfig.hora_fin_semana || "10:00";
      const horaNum = parseInt(hora.split(":")[0], 10);
      return {
        mensaje: `REUNIÓN PÚBLICA - ${hora}`,
        bloqueoTipo: horaNum < 12 ? "manana" : "tarde"
      };
    }
    
    return null;
  };

  const renderCeldasVacias = (fecha: string, horario: HorarioSalida | undefined) => {
    if (!horario) {
      return (
        <>
          <TableCell className="border-r text-center text-sm text-muted-foreground">-</TableCell>
          <TableCell className="border-r text-sm">-</TableCell>
          <TableCell className="border-r text-sm">-</TableCell>
          <TableCell className="border-r text-center text-sm">-</TableCell>
          <TableCell className="text-center text-sm">-</TableCell>
        </>
      );
    }

    return (
      <TableCell colSpan={5} className="p-0 border-r last:border-r-0">
        <EntradaCeldaForm
          fecha={fecha}
          horario={horario}
          horarios={horarios}
          puntos={puntos}
          territorios={territorios}
          participantes={participantes}
          gruposPredicacion={gruposPredicacion}
          diasEspeciales={diasEspeciales}
          onSubmit={onCrearEntrada}
          onUpdate={onActualizarEntrada}
          onDelete={onEliminarEntrada}
          isLoading={isCreating}
        />
      </TableCell>
    );
  };

  const renderGruposGrid = (entrada: ProgramaConDetalles, horario: HorarioSalida, fecha: string) => {
    const asignaciones = entrada.asignaciones_grupos || [];
    
    return (
      <>
        <TableCell className="border-r text-center text-sm font-medium">
          {horario.hora.slice(0, 5)}
        </TableCell>
        <TableCell colSpan={4} className="p-0">
          <Popover>
            <PopoverTrigger asChild>
              <button className="w-full h-full min-h-[56px] flex items-center hover:bg-primary/5 transition-colors cursor-pointer group relative p-3">
                <div className="grid grid-cols-5 gap-2 w-full print:grid-cols-5">
                  {gruposPredicacion.map((grupo) => {
                    const asignacion = asignaciones.find(a => a.grupo_id === grupo.id);
                    const territorio = asignacion?.territorio_id 
                      ? territorios.find(t => t.id === asignacion.territorio_id)
                      : null;
                    
                    return (
                      <div 
                        key={grupo.id} 
                        className="bg-muted/50 rounded-md px-3 py-2 text-sm border whitespace-nowrap text-center"
                      >
                        <span className="font-bold text-primary">G{grupo.numero}:</span>{" "}
                        <span className="text-foreground">
                          {territorio ? `Terr. ${territorio.numero}` : "-"}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-background/70 transition-opacity print:hidden">
                  <Pencil className="h-4 w-4 text-primary" />
                </div>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-80 bg-popover border shadow-lg z-50" align="start">
              <EntradaCeldaForm
                fecha={fecha}
                horario={horario}
                horarios={horarios}
                puntos={puntos}
                territorios={territorios}
                participantes={participantes}
                gruposPredicacion={gruposPredicacion}
                diasEspeciales={diasEspeciales}
                entrada={entrada}
                onSubmit={onCrearEntrada}
                onUpdate={(id, data) => {
                  onActualizarEntrada?.(id, data);
                }}
                onDelete={(id) => {
                  onEliminarEntrada?.(id);
                }}
                isLoading={isCreating}
                isInline
              />
            </PopoverContent>
          </Popover>
        </TableCell>
      </>
    );
  };

  const renderCeldasEntrada = (fecha: string, entrada: ProgramaConDetalles, horario: HorarioSalida) => {
    // Check for mensaje especial in this specific horario
    if (entrada.es_mensaje_especial && !entrada.colspan_completo) {
      return (
        <>
          <TableCell className="border-r text-center text-sm font-medium">
            {horario.hora.slice(0, 5)}
          </TableCell>
          <TableCell colSpan={4} className="text-center italic text-muted-foreground text-sm">
            {entrada.mensaje_especial}
          </TableCell>
        </>
      );
    }

    // Renderizar cuadrícula de grupos si es por grupos
    if (entrada.es_por_grupos) {
      return renderGruposGrid(entrada, horario, fecha);
    }

    return (
      <>
        <TableCell className="border-r text-center text-sm font-medium">
          {horario.hora.slice(0, 5)}
        </TableCell>
        <TableCell className="border-r text-sm p-0">
          <CeldaEditable
            entrada={entrada}
            fecha={fecha}
            horario={horario}
            horarios={horarios}
            puntos={puntos}
            territorios={territorios}
            participantes={participantes}
            gruposPredicacion={gruposPredicacion}
            diasEspeciales={diasEspeciales}
            onCrearEntrada={onCrearEntrada}
            onActualizarEntrada={onActualizarEntrada}
            onEliminarEntrada={onEliminarEntrada}
            isCreating={isCreating}
          >
            <div className="px-2 py-3">{entrada.punto_encuentro?.nombre || "-"}</div>
          </CeldaEditable>
        </TableCell>
        <TableCell className="border-r text-sm p-0">
          <CeldaEditable
            entrada={entrada}
            fecha={fecha}
            horario={horario}
            horarios={horarios}
            puntos={puntos}
            territorios={territorios}
            participantes={participantes}
            gruposPredicacion={gruposPredicacion}
            diasEspeciales={diasEspeciales}
            onCrearEntrada={onCrearEntrada}
            onActualizarEntrada={onActualizarEntrada}
            onEliminarEntrada={onEliminarEntrada}
            isCreating={isCreating}
          >
            <div className="px-2 py-3">
              {entrada.punto_encuentro?.direccion ? (
                <div className="flex items-center gap-1">
                  <span className="truncate max-w-[150px]">{entrada.punto_encuentro.direccion}</span>
                  {entrada.punto_encuentro.url_maps && (
                    <a
                      href={entrada.punto_encuentro.url_maps}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              ) : (
                "-"
              )}
            </div>
          </CeldaEditable>
        </TableCell>
        <TableCell className="border-r text-sm p-0">
          <CeldaEditable
            entrada={entrada}
            fecha={fecha}
            horario={horario}
            horarios={horarios}
            puntos={puntos}
            territorios={territorios}
            participantes={participantes}
            gruposPredicacion={gruposPredicacion}
            diasEspeciales={diasEspeciales}
            onCrearEntrada={onCrearEntrada}
            onActualizarEntrada={onActualizarEntrada}
            onEliminarEntrada={onEliminarEntrada}
            isCreating={isCreating}
          >
            <div className="px-2 py-3 w-full text-center">
              {(() => {
                // Mostrar múltiples territorios si existen
                const ids = entrada.territorio_ids?.length > 0 
                  ? entrada.territorio_ids 
                  : (entrada.territorio_id ? [entrada.territorio_id] : []);
                if (ids.length === 0) return "-";
                const nums = ids.map(id => territorios.find(t => t.id === id)?.numero).filter(Boolean);
                return nums.length > 0 ? nums.join(", ") : "-";
              })()}
            </div>
          </CeldaEditable>
        </TableCell>
        <TableCell className="text-sm p-0">
          <CeldaEditable
            entrada={entrada}
            fecha={fecha}
            horario={horario}
            horarios={horarios}
            puntos={puntos}
            territorios={territorios}
            participantes={participantes}
            gruposPredicacion={gruposPredicacion}
            diasEspeciales={diasEspeciales}
            onCrearEntrada={onCrearEntrada}
            onActualizarEntrada={onActualizarEntrada}
            onEliminarEntrada={onEliminarEntrada}
            isCreating={isCreating}
          >
            <div className="px-2 py-3">{entrada.capitan ? `${entrada.capitan.nombre} ${entrada.capitan.apellido}` : "-"}</div>
          </CeldaEditable>
        </TableCell>
      </>
    );
  };

  // Calcular el número máximo de filas para cada fecha
  const getMaxFilas = (fecha: string) => {
    const entradasManana = getEntradasPorTipo(fecha, "manana");
    const entradasTarde = getEntradasPorTipo(fecha, "tarde");
    return Math.max(1, entradasManana.length, entradasTarde.length);
  };

  return (
    <div className="overflow-x-auto rounded-lg border bg-card print:border-0 print:rounded-none">
      <Table>
        <TableHeader>
          {/* Fila de grupos de horarios */}
          <TableRow className="bg-primary text-primary-foreground">
            <TableHead className="border-r border-primary-foreground/20" />
            <TableHead 
              colSpan={5} 
              className="text-center font-bold text-primary-foreground border-r border-primary-foreground/20"
            >
              HORARIO MAÑANA
            </TableHead>
            <TableHead 
              colSpan={5} 
              className="text-center font-bold text-primary-foreground"
            >
              HORARIO TARDE
            </TableHead>
          </TableRow>
          {/* Fila de columnas */}
          <TableRow className="bg-primary/80 text-primary-foreground">
            <TableHead className="font-semibold text-center border-r border-primary-foreground/20 text-primary-foreground w-[100px]">
              FECHA
            </TableHead>
            {/* Mañana */}
            <TableHead className="font-semibold text-center border-r border-primary-foreground/20 text-primary-foreground w-[60px]">
              HORA
            </TableHead>
            <TableHead className="font-semibold text-center border-r border-primary-foreground/20 text-primary-foreground">
              PUNTO ENCUENTRO
            </TableHead>
            <TableHead className="font-semibold text-center border-r border-primary-foreground/20 text-primary-foreground">
              DIRECCIÓN
            </TableHead>
            <TableHead className="font-semibold text-center border-r border-primary-foreground/20 text-primary-foreground w-[60px]">
              TERR.
            </TableHead>
            <TableHead className="font-semibold text-center border-r border-primary-foreground/20 text-primary-foreground w-[120px]">
              CAPITÁN
            </TableHead>
            {/* Tarde */}
            <TableHead className="font-semibold text-center border-r border-primary-foreground/20 text-primary-foreground w-[60px]">
              HORA
            </TableHead>
            <TableHead className="font-semibold text-center border-r border-primary-foreground/20 text-primary-foreground">
              PUNTO ENCUENTRO
            </TableHead>
            <TableHead className="font-semibold text-center border-r border-primary-foreground/20 text-primary-foreground">
              DIRECCIÓN
            </TableHead>
            <TableHead className="font-semibold text-center border-r border-primary-foreground/20 text-primary-foreground w-[60px]">
              TERR.
            </TableHead>
            <TableHead className="font-semibold text-center text-primary-foreground w-[120px]">
              CAPITÁN
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {fechas.map((fecha) => {
            const mensajeEspecial = getMensajeEspecial(fecha);
            const { diaSemana, diaNumero } = formatDia(fecha);
            const mensajeReunion = getMensajeReunion(fecha);

            // Mensaje especial que ocupa toda la fila (solo si es bloqueo completo)
            if (mensajeEspecial && mensajeEspecial.bloqueo_tipo === "completo") {
              return (
                <TableRow key={fecha} className="bg-muted/50 group">
                  <TableCell className="border-r text-center">
                    <div className="font-medium capitalize text-xs">{diaSemana}</div>
                    <div className="text-lg font-bold">{diaNumero}</div>
                  </TableCell>
                  <TableCell colSpan={10} className="text-center font-semibold text-primary bg-primary/5 relative">
                    <span>{mensajeEspecial.mensaje_especial}</span>
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => onEliminarEntrada?.(mensajeEspecial.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            }


            const entradasManana = getEntradasPorTipo(fecha, "manana");
            const entradasTarde = getEntradasPorTipo(fecha, "tarde");
            const maxFilas = getMaxFilas(fecha);

            // Generar las filas para este día
            const rows = [];
            for (let i = 0; i < maxFilas; i++) {
              const entradaManana = entradasManana[i];
              const entradaTarde = entradasTarde[i];
              const esPrimeraFila = i === 0;
              const esUltimaFila = i === maxFilas - 1;

              rows.push(
                <TableRow key={`${fecha}-${i}`} className="hover:bg-muted/30">
                  {/* Celda de fecha (solo en primera fila, con rowSpan) */}
                  {esPrimeraFila && (
                    <TableCell 
                      className="border-r text-center align-middle" 
                      rowSpan={maxFilas}
                    >
                      <div className="font-medium capitalize text-xs">{diaSemana}</div>
                      <div className="text-lg font-bold">{diaNumero}</div>
                      {/* Botones para agregar salidas adicionales */}
                      <div className="flex justify-center gap-1 mt-2 print:hidden">
                        <BotonAgregarFila
                          fecha={fecha}
                          horarios={horarios}
                          puntos={puntos}
                          territorios={territorios}
                          participantes={participantes}
                          gruposPredicacion={gruposPredicacion}
                          diasEspeciales={diasEspeciales}
                          onCrearEntrada={onCrearEntrada}
                          isCreating={isCreating}
                          tipo="manana"
                        />
                        <BotonAgregarFila
                          fecha={fecha}
                          horarios={horarios}
                          puntos={puntos}
                          territorios={territorios}
                          participantes={participantes}
                          gruposPredicacion={gruposPredicacion}
                          diasEspeciales={diasEspeciales}
                          onCrearEntrada={onCrearEntrada}
                          isCreating={isCreating}
                          tipo="tarde"
                        />
                      </div>
                    </TableCell>
                  )}
                  
                  {/* Celdas de mañana */}
                  {(mensajeReunion && mensajeReunion.bloqueoTipo === "manana" && esPrimeraFila) ? (
                    <TableCell colSpan={5} className="text-center font-semibold text-primary bg-primary/5 border-r">
                      {mensajeReunion.mensaje}
                    </TableCell>
                  ) : (mensajeEspecial && mensajeEspecial.bloqueo_tipo === "manana" && esPrimeraFila) ? (
                    <TableCell colSpan={5} className="text-center font-semibold text-primary bg-primary/5 border-r relative group">
                      <span>{mensajeEspecial.mensaje_especial}</span>
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity print:hidden">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => onEliminarEntrada?.(mensajeEspecial.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  ) : entradaManana ? (
                    renderCeldasEntrada(fecha, entradaManana, 
                      horarios.find(h => h.id === entradaManana.horario_id) || horarioManana)
                  ) : (
                    esPrimeraFila ? renderCeldasVacias(fecha, horarioManana) : (
                      <>
                        <TableCell className="border-r text-center text-sm text-muted-foreground">-</TableCell>
                        <TableCell className="border-r text-sm text-muted-foreground">-</TableCell>
                        <TableCell className="border-r text-sm text-muted-foreground">-</TableCell>
                        <TableCell className="border-r text-center text-sm text-muted-foreground">-</TableCell>
                        <TableCell className="text-center text-sm text-muted-foreground border-r">-</TableCell>
                      </>
                    )
                  )}
                  
                  {/* Celdas de tarde */}
                  {(mensajeReunion && mensajeReunion.bloqueoTipo === "tarde" && esPrimeraFila) ? (
                    <TableCell colSpan={5} className="text-center font-semibold text-primary bg-primary/5">
                      {mensajeReunion.mensaje}
                    </TableCell>
                  ) : (mensajeEspecial && mensajeEspecial.bloqueo_tipo === "tarde" && esPrimeraFila) ? (
                    <TableCell colSpan={5} className="text-center font-semibold text-primary bg-primary/5 relative group">
                      <span>{mensajeEspecial.mensaje_especial}</span>
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity print:hidden">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => onEliminarEntrada?.(mensajeEspecial.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  ) : entradaTarde ? (
                    renderCeldasEntrada(fecha, entradaTarde,
                      horarios.find(h => h.id === entradaTarde.horario_id) || horarioTarde)
                  ) : (
                    esPrimeraFila ? renderCeldasVacias(fecha, horarioTarde) : (
                      <>
                        <TableCell className="border-r text-center text-sm text-muted-foreground">-</TableCell>
                        <TableCell className="border-r text-sm text-muted-foreground">-</TableCell>
                        <TableCell className="border-r text-sm text-muted-foreground">-</TableCell>
                        <TableCell className="border-r text-center text-sm text-muted-foreground">-</TableCell>
                        <TableCell className="text-center text-sm text-muted-foreground">-</TableCell>
                      </>
                    )
                  )}
                </TableRow>
              );
            }

            return rows;
          })}
        </TableBody>
      </Table>
    </div>
  );
}
