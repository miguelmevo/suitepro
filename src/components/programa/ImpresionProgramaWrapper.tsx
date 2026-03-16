import { forwardRef } from "react";
import { ImpresionPrograma } from "./ImpresionPrograma";
import { ImpresionProgramaCalendario } from "./ImpresionProgramaCalendario";
import { HorarioSalida, ProgramaConDetalles, PuntoEncuentro, Territorio } from "@/types/programa-predicacion";
import { Participante } from "@/types/grupos-servicio";
import { GrupoPredicacion } from "@/hooks/useGruposPredicacion";
import { CarritoData } from "@/hooks/useCarritos";

interface DiaEspecial {
  id: string;
  nombre: string;
  bloqueo_tipo: string;
}

interface MensajeAdicional {
  id: string;
  fecha: string;
  mensaje: string;
  color: string;
}

interface DireccionBloqueadaItem {
  id: string;
  territorio_id: string;
  direccion: string;
  motivo: string | null;
}

export type FormatoImpresion = "tabla" | "calendario";

interface ImpresionProgramaWrapperProps {
  formato: FormatoImpresion;
  programa: ProgramaConDetalles[];
  horarios: HorarioSalida[];
  fechas: string[];
  puntos: PuntoEncuentro[];
  territorios: Territorio[];
  participantes: Participante[];
  gruposPredicacion: GrupoPredicacion[];
  diasEspeciales?: DiaEspecial[];
  mensajesAdicionales?: MensajeAdicional[];
  diasReunionConfig?: {
    dia_entre_semana?: string;
    hora_entre_semana?: string;
    dia_fin_semana?: string;
    hora_fin_semana?: string;
  };
  direccionesBloqueadas?: DireccionBloqueadaItem[];
  carritos?: CarritoData[];
  mesAnio: string;
  colorTema?: string;
}

export const ImpresionProgramaWrapper = forwardRef<HTMLDivElement, ImpresionProgramaWrapperProps>(
  ({ formato, direccionesBloqueadas, carritos, ...props }, ref) => {
    if (formato === "calendario") {
      return <ImpresionProgramaCalendario ref={ref} {...props} carritos={carritos} />;
    }
    return <ImpresionPrograma ref={ref} {...props} direccionesBloqueadas={direccionesBloqueadas} />;
  }
);

ImpresionProgramaWrapper.displayName = "ImpresionProgramaWrapper";
