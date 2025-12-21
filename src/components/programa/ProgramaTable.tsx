import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { useState, ReactNode } from "react";
import { ExternalLink, Pencil, Trash2, Plus, Star } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { HorarioSalida, ProgramaConDetalles, PuntoEncuentro, Territorio, AsignacionGrupo } from "@/types/programa-predicacion";
import { Participante } from "@/types/grupos-servicio";
import { EntradaCeldaForm } from "./EntradaCeldaForm";
import { GrupoPredicacion } from "@/hooks/useGruposPredicacion";

// Colores disponibles para mensajes adicionales
const COLORES_MENSAJE_ADICIONAL = [
  { value: "#1e3a5f", label: "Azul Oscuro", textColor: "white" },
  { value: "#4a5568", label: "Gris Oscuro", textColor: "white" },
  { value: "#3182ce", label: "Azul Claro", textColor: "white" },
  { value: "#48bb78", label: "Verde Claro", textColor: "white" },
];

interface DiaEspecial {
  id: string;
  nombre: string;
  fecha: string;
  bloqueo_tipo: string;
  color?: string;
}

interface MensajeAdicional {
  id: string;
  fecha: string;
  mensaje: string;
  color: string;
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
  mensajesAdicionales?: MensajeAdicional[];
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
  onCrearMensajeAdicional?: (data: { fecha: string; mensaje: string; color?: string }) => void;
  onEliminarMensajeAdicional?: (id: string) => void;
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
  mensajesAdicionales,
  onCrearEntrada,
  onActualizarEntrada,
  onEliminarEntrada,
  onCrearMensajeAdicional,
  onEliminarMensajeAdicional,
  isCreating,
  diasReunionConfig
}: ProgramaTableProps) {
  // Estado para el popover de mensaje adicional
  const [mensajeAdicionalOpen, setMensajeAdicionalOpen] = useState<string | null>(null);
  const [textoMensajeAdicional, setTextoMensajeAdicional] = useState("");
  const [colorMensajeAdicional, setColorMensajeAdicional] = useState("#1e3a5f");
  

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
    const dayOfWeek = date.getDay(); // 0 = domingo, 6 = sábado
    return {
      diaSemana: format(date, "EEEE", { locale: es }),
      diaSemanaKey: format(date, "EEEE", { locale: es }).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
      diaNumero: format(date, "d"),
      esFinDeSemana: dayOfWeek === 0 || dayOfWeek === 6,
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

  // Verificar si una fecha ya tiene mensaje adicional
  const getMensajeAdicionalExistente = (fecha: string) => {
    return mensajesAdicionales?.find(m => m.fecha === fecha);
  };

  // Handler para crear mensaje adicional
  const handleCrearMensajeAdicional = (fecha: string) => {
    if (!textoMensajeAdicional.trim() || !onCrearMensajeAdicional) return;
    
    onCrearMensajeAdicional({
      mensaje: textoMensajeAdicional.trim(),
      fecha,
      color: colorMensajeAdicional,
    });
    
    setTextoMensajeAdicional("");
    setColorMensajeAdicional("#1e3a5f");
    setMensajeAdicionalOpen(null);
  };

  const renderCeldasVacias = (fecha: string, horario: HorarioSalida | undefined) => {
    if (!horario) {
      return (
        <>
          <TableCell className="border-r text-center text-sm text-muted-foreground">-</TableCell>
          <TableCell className="border-r text-sm">-</TableCell>
          <TableCell className="border-r text-sm">-</TableCell>
          <TableCell className="border-r text-center text-sm">-</TableCell>
          <TableCell className="text-center text-sm border-r-2 border-muted-foreground/40">-</TableCell>
        </>
      );
    }

    return (
      <TableCell colSpan={5} className="p-0 border-r-2 border-muted-foreground/40 last:border-r-0">
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
    
    // Detectar si es "por grupo individual" (cada asignación tiene salida_index = 0 o undefined)
    const esPorGrupoIndividual = asignaciones.length > 0 && 
      asignaciones.every(a => a.salida_index === undefined || a.salida_index === 0);
    
    if (esPorGrupoIndividual) {
      // Modo "Por grupo individual": G1: 1 / G2: 10 / G3: 17...
      const asignacionesOrdenadas = asignaciones
        .map(asig => {
          const grupo = gruposPredicacion.find(g => g.id === asig.grupo_id);
          const territorio = asig.territorio_id 
            ? territorios.find(t => t.id === asig.territorio_id)
            : null;
          return {
            grupoNumero: grupo?.numero || 0,
            territorioNumero: territorio?.numero || null
          };
        })
        .sort((a, b) => a.grupoNumero - b.grupoNumero);

      return (
        <>
          <TableCell className="border-r text-center text-sm font-medium">
            {horario.hora.slice(0, 5)}
          </TableCell>
          {/* Punto de Encuentro + Dirección + Terr. agrupados */}
          <TableCell colSpan={3} className="border-r p-0">
            <Popover>
              <PopoverTrigger asChild>
                <button className="w-full h-full min-h-[40px] flex items-center hover:bg-primary/5 transition-colors cursor-pointer group relative px-3 py-2">
                  <div className="w-full text-sm">
                    {asignacionesOrdenadas.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-x-1">
                        {asignacionesOrdenadas.map((asig, idx) => (
                          <span key={idx} className="whitespace-nowrap">
                            {idx > 0 && <span className="text-muted-foreground mx-1">/</span>}
                            <span className="font-bold text-primary">G{asig.grupoNumero}</span>
                            <span className="text-foreground">: {asig.territorioNumero || "-"}</span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground italic">Sin asignaciones</span>
                    )}
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-background/70 transition-opacity print:hidden">
                    <Pencil className="h-4 w-4 text-primary" />
                  </div>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-96 bg-popover border shadow-lg z-50" align="start">
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
          {/* CAPITÁN - siempre "Superintendente de cada grupo" para modo individual */}
          <TableCell className="text-center text-sm border-r-2 border-muted-foreground/40">
            Superintendente de cada grupo
          </TableCell>
        </>
      );
    }

    // Modo "Por grupos de predicación": agrupar por salida_index
    const porSalida: Record<number, { grupoNums: string[]; territorioId: string | null; capitanId: string | null }> = {};
    
    asignaciones.forEach((asignacion) => {
      const salidaIdx = asignacion.salida_index ?? 0;
      const grupo = gruposPredicacion.find(g => g.id === asignacion.grupo_id);
      if (grupo) {
        if (!porSalida[salidaIdx]) {
          porSalida[salidaIdx] = { grupoNums: [], territorioId: null, capitanId: null };
        }
        porSalida[salidaIdx].grupoNums.push(grupo.numero.toString());
        if (asignacion.territorio_id) {
          porSalida[salidaIdx].territorioId = asignacion.territorio_id;
        }
        if (asignacion.capitan_id) {
          porSalida[salidaIdx].capitanId = asignacion.capitan_id;
        }
      }
    });

    // Construir las líneas de display ordenadas por salida_index
    const lineas = Object.entries(porSalida)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .map(([_, data]) => {
        const territorio = data.territorioId 
          ? territorios.find(t => t.id === data.territorioId)
          : null;
        const capitan = data.capitanId
          ? participantes.find(p => p.id === data.capitanId)
          : null;
        return {
          grupos: data.grupoNums.sort((a, b) => parseInt(a) - parseInt(b)),
          territorioNumero: territorio?.numero || null,
          capitanNombre: capitan ? `${capitan.nombre} ${capitan.apellido}` : null
        };
      });

    return (
      <>
        <TableCell className="border-r text-center text-sm font-medium">
          {horario.hora.slice(0, 5)}
        </TableCell>
        {/* Punto de Encuentro + Dirección + Terr. agrupados */}
        <TableCell colSpan={3} className="border-r p-0">
          <Popover>
            <PopoverTrigger asChild>
              <button className="w-full h-full min-h-[40px] flex items-center hover:bg-primary/5 transition-colors cursor-pointer group relative px-3 py-2">
                <div className="w-full text-sm">
                  {lineas.length > 0 ? (
                    <div className="flex flex-col gap-y-1">
                      {lineas.map((linea, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="font-semibold text-primary">
                            G{linea.grupos.join(" - ")}
                          </span>
                          {linea.territorioNumero && (
                            <span className="text-foreground">: {linea.territorioNumero}</span>
                          )}
                          {linea.capitanNombre && (
                            <span className="text-muted-foreground">- {linea.capitanNombre}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted-foreground italic">Sin asignaciones</span>
                  )}
                </div>
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-background/70 transition-opacity print:hidden">
                  <Pencil className="h-4 w-4 text-primary" />
                </div>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-96 bg-popover border shadow-lg z-50" align="start">
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
        {/* CAPITÁN */}
        <TableCell className="text-center text-sm text-muted-foreground border-r-2 border-muted-foreground/40">
          {lineas.length > 0 && lineas[0].capitanNombre ? lineas[0].capitanNombre : "-"}
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
        <TableCell className="text-sm p-0 border-r-2 border-muted-foreground/40">
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
      <Table className="min-w-[900px] text-xs sm:text-sm">
        <TableHeader>
          {/* Fila de grupos de horarios */}
          <TableRow className="bg-primary text-primary-foreground">
            <TableHead className="border-r border-primary-foreground/20" />
            <TableHead 
              colSpan={5} 
              className="text-center font-bold text-primary-foreground border-r-2 border-primary-foreground/50 text-xs sm:text-sm"
            >
              HORARIO MAÑANA
            </TableHead>
            <TableHead 
              colSpan={5} 
              className="text-center font-bold text-primary-foreground text-xs sm:text-sm"
            >
              HORARIO TARDE
            </TableHead>
          </TableRow>
          {/* Fila de columnas */}
          <TableRow className="bg-primary/80 text-primary-foreground">
            <TableHead className="font-semibold text-center border-r border-primary-foreground/20 text-primary-foreground w-[70px] sm:w-[90px] text-[10px] sm:text-xs px-1 sm:px-2">
              FECHA
            </TableHead>
            {/* Mañana */}
            <TableHead className="font-semibold text-center border-r border-primary-foreground/20 text-primary-foreground w-[45px] sm:w-[55px] text-[10px] sm:text-xs px-1">
              HORA
            </TableHead>
            <TableHead className="font-semibold text-center border-r border-primary-foreground/20 text-primary-foreground text-[10px] sm:text-xs px-1 sm:px-2 min-w-[80px]">
              P. ENCUENTRO
            </TableHead>
            <TableHead className="font-semibold text-center border-r border-primary-foreground/20 text-primary-foreground text-[10px] sm:text-xs px-1 sm:px-2 min-w-[80px]">
              DIRECCIÓN
            </TableHead>
            <TableHead className="font-semibold text-center border-r border-primary-foreground/20 text-primary-foreground w-[40px] sm:w-[50px] text-[10px] sm:text-xs px-1">
              TERR.
            </TableHead>
            <TableHead className="font-semibold text-center border-r-2 border-primary-foreground/50 text-primary-foreground w-[70px] sm:w-[100px] text-[10px] sm:text-xs px-1 sm:px-2">
              CAPITÁN
            </TableHead>
            {/* Tarde */}
            <TableHead className="font-semibold text-center border-r border-primary-foreground/20 text-primary-foreground w-[45px] sm:w-[55px] text-[10px] sm:text-xs px-1">
              HORA
            </TableHead>
            <TableHead className="font-semibold text-center border-r border-primary-foreground/20 text-primary-foreground text-[10px] sm:text-xs px-1 sm:px-2 min-w-[80px]">
              P. ENCUENTRO
            </TableHead>
            <TableHead className="font-semibold text-center border-r border-primary-foreground/20 text-primary-foreground text-[10px] sm:text-xs px-1 sm:px-2 min-w-[80px]">
              DIRECCIÓN
            </TableHead>
            <TableHead className="font-semibold text-center border-r border-primary-foreground/20 text-primary-foreground w-[40px] sm:w-[50px] text-[10px] sm:text-xs px-1">
              TERR.
            </TableHead>
            <TableHead className="font-semibold text-center text-primary-foreground w-[70px] sm:w-[100px] text-[10px] sm:text-xs px-1 sm:px-2">
              CAPITÁN
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
        {fechas.map((fecha) => {
            const mensajeAdicionalExistente = getMensajeAdicionalExistente(fecha);
            const { diaSemana, diaNumero, esFinDeSemana } = formatDia(fecha);
            const mensajeReunion = getMensajeReunion(fecha);

            const entradasManana = getEntradasPorTipo(fecha, "manana");
            const entradasTarde = getEntradasPorTipo(fecha, "tarde");
            const maxFilas = getMaxFilas(fecha);

            // Generar las filas para este día
            const rows = [];

            // Si hay mensaje adicional, agregar fila de encabezado con mensaje
            if (mensajeAdicionalExistente) {
              const bgColor = mensajeAdicionalExistente.color || "#1e3a5f";
              rows.push(
                <TableRow key={`${fecha}-mensaje`} className="group" style={{ backgroundColor: bgColor }}>
                  <TableCell colSpan={11} className="text-center font-bold text-white py-2 relative">
                    <span className="uppercase tracking-wide">{mensajeAdicionalExistente.mensaje}</span>
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity print:hidden">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-white/70 hover:text-white hover:bg-white/10"
                        onClick={() => onEliminarMensajeAdicional?.(mensajeAdicionalExistente.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            }

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
                      {/* Botones para agregar salidas adicionales y día especial */}
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
                        {/* Botón para agregar mensaje adicional - solo fines de semana */}
                        {onCrearMensajeAdicional && esFinDeSemana && !getMensajeAdicionalExistente(fecha) && (
                          <Popover 
                            open={mensajeAdicionalOpen === fecha} 
                            onOpenChange={(open) => {
                              setMensajeAdicionalOpen(open ? fecha : null);
                              if (!open) {
                                setTextoMensajeAdicional("");
                                setColorMensajeAdicional("#1e3a5f");
                              }
                            }}
                          >
                            <PopoverTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0 opacity-50 hover:opacity-100 text-amber-500 hover:text-amber-600"
                                title="Agregar mensaje adicional"
                              >
                                <Star className="h-4 w-4" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-72 bg-popover border shadow-lg z-50" align="start">
                              <div className="space-y-4">
                                <h4 className="font-medium text-sm">Agregar mensaje adicional</h4>
                                <div className="space-y-2">
                                  <Label htmlFor="texto-mensaje">Mensaje</Label>
                                  <Input
                                    id="texto-mensaje"
                                    placeholder="Ej: Asamblea Regional"
                                    value={textoMensajeAdicional}
                                    onChange={(e) => setTextoMensajeAdicional(e.target.value)}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Color de la franja</Label>
                                  <div className="flex gap-2">
                                    {COLORES_MENSAJE_ADICIONAL.map((color) => (
                                      <button
                                        key={color.value}
                                        type="button"
                                        className={`w-8 h-8 rounded-md border-2 transition-all ${
                                          colorMensajeAdicional === color.value 
                                            ? "border-primary ring-2 ring-primary/30 scale-110" 
                                            : "border-transparent hover:border-muted-foreground/50"
                                        }`}
                                        style={{ backgroundColor: color.value }}
                                        onClick={() => setColorMensajeAdicional(color.value)}
                                        title={color.label}
                                      />
                                    ))}
                                  </div>
                                </div>
                                <div className="flex justify-end gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setMensajeAdicionalOpen(null)}
                                  >
                                    Cancelar
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => handleCrearMensajeAdicional(fecha)}
                                    disabled={!textoMensajeAdicional.trim()}
                                  >
                                    Guardar
                                  </Button>
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>
                        )}
                        {/* Indicador y botón para eliminar mensaje adicional existente */}
                        {esFinDeSemana && getMensajeAdicionalExistente(fecha) && onEliminarMensajeAdicional && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 text-amber-500 hover:text-destructive"
                            title={`Mensaje: ${getMensajeAdicionalExistente(fecha)?.mensaje}. Clic para quitar`}
                            onClick={() => {
                              const mensaje = getMensajeAdicionalExistente(fecha);
                              if (mensaje) onEliminarMensajeAdicional(mensaje.id);
                            }}
                          >
                            <Star className="h-4 w-4 fill-current" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                  
                  {(mensajeReunion && mensajeReunion.bloqueoTipo === "manana" && esPrimeraFila) ? (
                    <TableCell colSpan={5} className="text-center font-semibold text-primary bg-primary/5 border-r-2 border-muted-foreground/40">
                      {mensajeReunion.mensaje}
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
                        <TableCell className="text-center text-sm text-muted-foreground border-r-2 border-muted-foreground/40">-</TableCell>
                      </>
                    )
                  )}
                  
                  {/* Celdas de tarde */}
                  {(mensajeReunion && mensajeReunion.bloqueoTipo === "tarde" && esPrimeraFila) ? (
                    <TableCell colSpan={5} className="text-center font-semibold text-primary bg-primary/5">
                      {mensajeReunion.mensaje}
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
