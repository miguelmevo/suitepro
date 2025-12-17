import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { useState, ReactNode } from "react";
import { ExternalLink, Pencil, Trash2, Plus } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { HorarioSalida, ProgramaConDetalles, PuntoEncuentro, Territorio } from "@/types/programa-predicacion";
import { Participante } from "@/types/grupos-servicio";
import { EntradaCeldaForm } from "./EntradaCeldaForm";

interface CeldaEditableProps {
  entrada: ProgramaConDetalles;
  fecha: string;
  horario: HorarioSalida;
  puntos: PuntoEncuentro[];
  territorios: Territorio[];
  participantes: Participante[];
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
  puntos,
  territorios,
  participantes,
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
          puntos={puntos}
          territorios={territorios}
          participantes={participantes}
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
  onCrearEntrada: (data: {
    fecha: string;
    horario_id: string;
    punto_encuentro_id?: string;
    territorio_id?: string;
    capitan_id?: string;
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
          puntos={puntos}
          territorios={territorios}
          participantes={participantes}
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

interface ProgramaTableProps {
  programa: ProgramaConDetalles[];
  horarios: HorarioSalida[];
  fechas: string[];
  puntos: PuntoEncuentro[];
  territorios: Territorio[];
  participantes: Participante[];
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
}

export function ProgramaTable({ 
  programa, 
  horarios, 
  fechas, 
  puntos, 
  territorios, 
  participantes,
  onCrearEntrada,
  onActualizarEntrada,
  onEliminarEntrada,
  isCreating 
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
    return programa.find((p) => p.fecha === fecha && p.es_mensaje_especial && p.colspan_completo);
  };

  const formatDia = (fecha: string) => {
    const date = parseISO(fecha);
    return {
      diaSemana: format(date, "EEEE", { locale: es }),
      diaNumero: format(date, "d"),
    };
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
          puntos={puntos}
          territorios={territorios}
          participantes={participantes}
          onSubmit={onCrearEntrada}
          onUpdate={onActualizarEntrada}
          onDelete={onEliminarEntrada}
          isLoading={isCreating}
        />
      </TableCell>
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
            puntos={puntos}
            territorios={territorios}
            participantes={participantes}
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
            puntos={puntos}
            territorios={territorios}
            participantes={participantes}
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
            puntos={puntos}
            territorios={territorios}
            participantes={participantes}
            onCrearEntrada={onCrearEntrada}
            onActualizarEntrada={onActualizarEntrada}
            onEliminarEntrada={onEliminarEntrada}
            isCreating={isCreating}
          >
            <div className="px-2 py-3 w-full text-center">{entrada.territorio?.numero || "-"}</div>
          </CeldaEditable>
        </TableCell>
        <TableCell className="text-sm p-0">
          <CeldaEditable
            entrada={entrada}
            fecha={fecha}
            horario={horario}
            puntos={puntos}
            territorios={territorios}
            participantes={participantes}
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

            // Mensaje especial que ocupa toda la fila
            if (mensajeEspecial) {
              return (
                <TableRow key={fecha} className="bg-muted/50 group">
                  <TableCell className="border-r text-center">
                    <div className="font-medium capitalize text-xs">{diaSemana}</div>
                    <div className="text-lg font-bold">{diaNumero}</div>
                  </TableCell>
                  <TableCell colSpan={10} className="text-center italic text-muted-foreground relative">
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
                          onCrearEntrada={onCrearEntrada}
                          isCreating={isCreating}
                          tipo="tarde"
                        />
                      </div>
                    </TableCell>
                  )}
                  
                  {/* Celdas de mañana */}
                  {entradaManana ? (
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
                  {entradaTarde ? (
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
