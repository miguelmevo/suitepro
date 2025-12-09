import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { ExternalLink } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { HorarioSalida, ProgramaConDetalles } from "@/types/programa-predicacion";

interface ProgramaTableProps {
  programa: ProgramaConDetalles[];
  horarios: HorarioSalida[];
  fechas: string[];
}

export function ProgramaTable({ programa, horarios, fechas }: ProgramaTableProps) {
  // Separar horarios en mañana (antes de 12:00) y tarde (12:00 o después)
  const horarioManana = horarios.find((h) => {
    const hora = parseInt(h.hora.split(":")[0], 10);
    return hora < 12;
  });
  
  const horarioTarde = horarios.find((h) => {
    const hora = parseInt(h.hora.split(":")[0], 10);
    return hora >= 12;
  });

  const getEntrada = (fecha: string, horarioId: string | undefined) => {
    if (!horarioId) return undefined;
    return programa.find((p) => p.fecha === fecha && p.horario_id === horarioId);
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

  const renderCeldas = (entrada: ProgramaConDetalles | undefined, horario: HorarioSalida | undefined) => {
    if (!horario) {
      return (
        <>
          <TableCell className="border-r text-center text-sm">-</TableCell>
          <TableCell className="border-r text-sm">-</TableCell>
          <TableCell className="border-r text-sm">-</TableCell>
          <TableCell className="border-r text-center text-sm">-</TableCell>
          <TableCell className="text-center text-sm">-</TableCell>
        </>
      );
    }

    // Check for mensaje especial in this specific horario
    if (entrada?.es_mensaje_especial && !entrada?.colspan_completo) {
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
        <TableCell className="border-r text-sm">
          {entrada?.punto_encuentro?.nombre || "-"}
        </TableCell>
        <TableCell className="border-r text-sm">
          {entrada?.punto_encuentro?.direccion ? (
            <div className="flex items-center gap-1">
              <span className="truncate max-w-[150px]">{entrada.punto_encuentro.direccion}</span>
              {entrada.punto_encuentro.url_maps && (
                <a
                  href={entrada.punto_encuentro.url_maps}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline shrink-0"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          ) : (
            "-"
          )}
        </TableCell>
        <TableCell className="border-r text-center text-sm font-medium">
          {entrada?.territorio?.numero || "-"}
        </TableCell>
        <TableCell className="text-center text-sm">
          {entrada?.capitan ? `${entrada.capitan.nombre} ${entrada.capitan.apellido}` : "-"}
        </TableCell>
      </>
    );
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
                <TableRow key={fecha} className="bg-muted/50">
                  <TableCell className="border-r text-center">
                    <div className="font-medium capitalize text-xs">{diaSemana}</div>
                    <div className="text-lg font-bold">{diaNumero}</div>
                  </TableCell>
                  <TableCell colSpan={10} className="text-center italic text-muted-foreground">
                    {mensajeEspecial.mensaje_especial}
                  </TableCell>
                </TableRow>
              );
            }

            const entradaManana = getEntrada(fecha, horarioManana?.id);
            const entradaTarde = getEntrada(fecha, horarioTarde?.id);

            return (
              <TableRow key={fecha} className="hover:bg-muted/30">
                <TableCell className="border-r text-center">
                  <div className="font-medium capitalize text-xs">{diaSemana}</div>
                  <div className="text-lg font-bold">{diaNumero}</div>
                </TableCell>
                {renderCeldas(entradaManana, horarioManana)}
                {renderCeldas(entradaTarde, horarioTarde)}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
