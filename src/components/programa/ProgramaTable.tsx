import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { MapPin, ExternalLink } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { HorarioSalida, ProgramaConDetalles } from "@/types/programa-predicacion";
import { cn } from "@/lib/utils";

interface ProgramaTableProps {
  programa: ProgramaConDetalles[];
  horarios: HorarioSalida[];
  fechas: string[];
}

export function ProgramaTable({ programa, horarios, fechas }: ProgramaTableProps) {
  const getEntrada = (fecha: string, horarioId: string) => {
    return programa.find((p) => p.fecha === fecha && p.horario_id === horarioId);
  };

  const getMensajeEspecial = (fecha: string) => {
    return programa.find((p) => p.fecha === fecha && p.es_mensaje_especial);
  };

  const formatDia = (fecha: string) => {
    const date = parseISO(fecha);
    return {
      diaSemana: format(date, "EEEE", { locale: es }),
      diaNumero: format(date, "d"),
    };
  };

  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-primary/10">
            <TableHead className="font-semibold text-center border-r w-[100px]">Fecha</TableHead>
            <TableHead className="font-semibold text-center border-r w-[80px]">Hora</TableHead>
            <TableHead className="font-semibold text-center border-r">Punto de encuentro</TableHead>
            <TableHead className="font-semibold text-center border-r w-[80px]">Terr.</TableHead>
            <TableHead className="font-semibold text-center w-[150px]">Capitán</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {fechas.map((fecha) => {
            const mensajeEspecial = getMensajeEspecial(fecha);
            const { diaSemana, diaNumero } = formatDia(fecha);

            if (mensajeEspecial?.colspan_completo) {
              return (
                <TableRow key={fecha} className="bg-muted/50">
                  <TableCell className="border-r text-center">
                    <div className="font-medium capitalize">{diaSemana}</div>
                    <div className="text-lg font-bold">{diaNumero}</div>
                  </TableCell>
                  <TableCell colSpan={4} className="text-center italic text-muted-foreground">
                    {mensajeEspecial.mensaje_especial}
                  </TableCell>
                </TableRow>
              );
            }

            return horarios.map((horario, idx) => {
              const entrada = getEntrada(fecha, horario.id);
              const horarioMensaje = programa.find(
                (p) => p.fecha === fecha && p.horario_id === horario.id && p.es_mensaje_especial
              );

              if (horarioMensaje) {
                return (
                  <TableRow key={`${fecha}-${horario.id}`} className={cn(idx === 0 && "border-t-2")}>
                    {idx === 0 && (
                      <TableCell rowSpan={horarios.length} className="border-r text-center align-top pt-3">
                        <div className="font-medium capitalize text-sm">{diaSemana}</div>
                        <div className="text-lg font-bold">{diaNumero}</div>
                      </TableCell>
                    )}
                    <TableCell className="border-r text-center text-sm font-medium">
                      {horario.hora.slice(0, 5)}
                    </TableCell>
                    <TableCell colSpan={3} className="text-center italic text-muted-foreground">
                      {horarioMensaje.mensaje_especial}
                    </TableCell>
                  </TableRow>
                );
              }

              return (
                <TableRow key={`${fecha}-${horario.id}`} className={cn(idx === 0 && "border-t-2")}>
                  {idx === 0 && (
                    <TableCell rowSpan={horarios.length} className="border-r text-center align-top pt-3">
                      <div className="font-medium capitalize text-sm">{diaSemana}</div>
                      <div className="text-lg font-bold">{diaNumero}</div>
                    </TableCell>
                  )}
                  <TableCell className="border-r text-center text-sm font-medium">
                    {horario.hora.slice(0, 5)}
                  </TableCell>
                  <TableCell className="border-r">
                    {entrada?.punto_encuentro && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm">{entrada.punto_encuentro.nombre}</span>
                        {entrada.punto_encuentro.url_maps && (
                          <a
                            href={entrada.punto_encuentro.url_maps}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="border-r text-center font-medium">
                    {entrada?.territorio?.numero}
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    {entrada?.capitan && `${entrada.capitan.nombre} ${entrada.capitan.apellido}`}
                  </TableCell>
                </TableRow>
              );
            });
          })}
        </TableBody>
      </Table>
    </div>
  );
}
