import { forwardRef } from "react";
import { ImpresionAsignacionesServicio } from "./ImpresionAsignacionesServicio";
import { ImpresionAsignacionesServicioVertical } from "./ImpresionAsignacionesServicioVertical";
import type { AsignacionServicio, TipoAsignacionServicio } from "@/hooks/useAsignacionesServicio";

export type FormatoImpresionAsignaciones = "horizontal" | "vertical";

interface TipoCfg {
  value: TipoAsignacionServicio;
  label: string;
  tipoCampo: "individual" | "grupo";
  soloFinSemana?: boolean;
}

interface Props {
  formato: FormatoImpresionAsignaciones;
  fechasReunion: { fecha: string; dia_reunion: "entre_semana" | "fin_semana" }[];
  tipos: TipoCfg[];
  asignaciones: AsignacionServicio[];
  participantes: { id: string; nombre: string; apellido: string }[];
  grupos: { id: string; numero: number }[];
  congregacionNombre: string;
  mesAnio: string;
  colorTema?: string;
  diasEspeciales?: { fecha: string; mensaje: string; color: string }[];
  mensajesAdicionales?: { id: string; fecha: string; mensaje: string; color: string }[];
}

export const ImpresionAsignacionesServicioWrapper = forwardRef<HTMLDivElement, Props>(
  ({ formato, ...rest }, ref) => {
    if (formato === "vertical") {
      return <ImpresionAsignacionesServicioVertical ref={ref} {...rest} />;
    }
    return <ImpresionAsignacionesServicio ref={ref} {...rest} />;
  }
);

ImpresionAsignacionesServicioWrapper.displayName = "ImpresionAsignacionesServicioWrapper";
