import { useProgramasPublicados } from "@/hooks/useProgramasPublicados";
import { useParticipantes } from "@/hooks/useParticipantes";
import { useDiasEspeciales } from "@/hooks/useDiasEspeciales";
import { useMensajesAdicionales } from "@/hooks/useMensajesAdicionales";
import { useConfiguracionSistema } from "@/hooks/useConfiguracionSistema";
import { useGruposPredicacion } from "@/hooks/useGruposPredicacion";
import { useCarritosActivos } from "@/hooks/useCarritos";
import { useCongregacion } from "@/contexts/CongregacionContext";
import { useProgramasVidaMinisterio } from "@/hooks/useProgramaVidaMinisterio";
import type { FormatoImpresionAsignaciones } from "@/components/asignaciones-servicio/ImpresionAsignacionesServicioWrapper";
import { CardProgramaPredicacion } from "@/components/programa/CardProgramaPredicacion";
import { CardProgramaReunionPublica } from "@/components/programa/CardProgramaReunionPublica";
import { CardProgramaAsignaciones } from "@/components/programa/CardProgramaAsignaciones";
import { CardProgramaVidaMinisterio } from "@/components/programa/CardProgramaVidaMinisterio";
import { debeMostrarMesSiguiente } from "@/lib/publicacion-anticipada";
import type { ProgramaPublicado } from "@/hooks/useProgramasPublicados";

const ProgramasDelMes = () => {
  const { congregacionActual } = useCongregacion();
  const carritos = useCarritosActivos();

  // Publicados por tipo (mes actual + mes siguiente)
  const { programaMesActual: programaPredicacion, programaMesSiguiente: programaPredicacionSig } =
    useProgramasPublicados("predicacion");
  const { programaMesActual: programaReunion, programaMesSiguiente: programaReunionSig } =
    useProgramasPublicados("reunion_publica");
  const {
    programaMesActual: programaAsignaciones,
    programaMesSiguiente: programaAsignacionesSig,
    isLoading: loadingAsignacionesPublicadas,
  } = useProgramasPublicados("asignaciones_servicio");
  const {
    programaMesActual: programaVyM,
    programaMesSiguiente: programaVyMSig,
    isLoading: loadingVyMPublicado,
  } = useProgramasPublicados("vida_ministerio");

  const { data: programasVyM } = useProgramasVidaMinisterio();
  const { participantes, isLoading: loadingParticipantes } = useParticipantes();
  const { diasEspeciales } = useDiasEspeciales();
  const { mensajesAdicionales } = useMensajesAdicionales();
  const { configuraciones, isLoading: loadingConfig } = useConfiguracionSistema("general");
  const { grupos: gruposPredicacion, isLoading: loadingGrupos } = useGruposPredicacion();

  const { configuraciones: configsVyM } = useConfiguracionSistema("vida_ministerio");
  const { configuraciones: configsAsig } = useConfiguracionSistema("asignaciones");
  const { configuraciones: configsPred } = useConfiguracionSistema("predicacion");
  const { configuraciones: configsRp } = useConfiguracionSistema("reunion_publica");

  const formatoAsignaciones: FormatoImpresionAsignaciones =
    (configsAsig?.find((c) => c.clave === "formato_impresion")?.valor?.formato as FormatoImpresionAsignaciones) ||
    "horizontal";
  const colorTemaAsig =
    (configsAsig?.find((c) => c.clave === "color_tema")?.valor?.color as string) ||
    congregacionActual?.color_primario ||
    "blue";

  const diasReunionConfig = configuraciones?.find((c) => c.programa_tipo === "general" && c.clave === "dias_reunion")
    ?.valor as
    | { dia_entre_semana?: string; hora_entre_semana?: string; dia_fin_semana?: string; hora_fin_semana?: string }
    | undefined;

  const colorTema = congregacionActual?.color_primario || "blue";
  const congregacionNombre = congregacionActual?.nombre || "";
  const consejoMaestrosMins =
    (configsVyM?.find((c) => c.clave === "consejo_presidente_maestros")?.valor as { minutos?: number } | undefined)
      ?.minutos ?? 0;

  const publAnticipadaAsig = configsAsig?.find((c) => c.clave === "publicacion_anticipada")?.valor as
    | { activo: boolean; dia: number }
    | undefined;
  const publAnticipadaPred = configsPred?.find((c) => c.clave === "publicacion_anticipada")?.valor as
    | { activo: boolean; dia: number }
    | undefined;
  const publAnticipadaRp = configsRp?.find((c) => c.clave === "publicacion_anticipada")?.valor as
    | { activo: boolean; dia: number }
    | undefined;
  const publAnticipadaVym = configsVyM?.find((c) => c.clave === "publicacion_anticipada")?.valor as
    | { activo: boolean; dia: number }
    | undefined;

  const mostrarPredicacionSig = debeMostrarMesSiguiente(publAnticipadaPred) && !!programaPredicacionSig;
  const mostrarReunionSig = debeMostrarMesSiguiente(publAnticipadaRp) && !!programaReunionSig;
  const mostrarAsignacionesSig = debeMostrarMesSiguiente(publAnticipadaAsig) && !!programaAsignacionesSig;
  const mostrarVyMSig = debeMostrarMesSiguiente(publAnticipadaVym) && !!programaVyMSig;

  const handleShare = async (programa: { pdf_url: string; periodo: string }, tipo: string) => {
    const shareData = {
      title: `${tipo} - ${programa.periodo}`,
      text: `${tipo} para ${programa.periodo}`,
      url: programa.pdf_url,
    };
    if (navigator.share && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
      } catch {}
    } else {
      await navigator.clipboard.writeText(programa.pdf_url);
      alert("Enlace copiado al portapapeles");
    }
  };

  const loadingBasePredicacion = loadingParticipantes || loadingConfig || loadingGrupos;

  return (
    <div className="space-y-6">
      <div className="text-center space-y-0.5 md:space-y-2">
        <h1 className="font-display text-xl md:text-3xl font-bold tracking-tight text-primary">Programas del Mes</h1>
        <p className="text-sm md:text-base text-muted-foreground">Consulta los programas publicados del mes en curso</p>
      </div>

      <div className="flex justify-center">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 max-w-7xl w-full">
          <CardProgramaPredicacion
            programa={programaPredicacion}
            participantes={participantes || []}
            gruposPredicacion={gruposPredicacion || []}
            diasEspeciales={diasEspeciales}
            mensajesAdicionales={mensajesAdicionales}
            diasReunionConfig={diasReunionConfig}
            carritos={carritos}
            onShare={handleShare}
          />
          {mostrarPredicacionSig && (
            <CardProgramaPredicacion
              programa={programaPredicacionSig as ProgramaPublicado}
              etiqueta="próximo mes"
              participantes={participantes || []}
              gruposPredicacion={gruposPredicacion || []}
              diasEspeciales={diasEspeciales}
              mensajesAdicionales={mensajesAdicionales}
              diasReunionConfig={diasReunionConfig}
              carritos={carritos}
              onShare={handleShare}
            />
          )}

          <CardProgramaReunionPublica
            programa={programaReunion}
            participantes={participantes || []}
            congregacionNombre={congregacionNombre}
            colorTema={colorTema}
            diaFinSemanaStr={(diasReunionConfig as any)?.dia_fin_semana ?? "domingo"}
            onShare={handleShare}
          />
          {mostrarReunionSig && (
            <CardProgramaReunionPublica
              programa={programaReunionSig as ProgramaPublicado}
              etiqueta="próximo mes"
              participantes={participantes || []}
              congregacionNombre={congregacionNombre}
              colorTema={colorTema}
              diaFinSemanaStr={(diasReunionConfig as any)?.dia_fin_semana ?? "domingo"}
              onShare={handleShare}
            />
          )}

          <CardProgramaAsignaciones
            programa={programaAsignaciones}
            loadingPublicado={loadingAsignacionesPublicadas}
            participantes={participantes || []}
            gruposPredicacion={gruposPredicacion || []}
            congregacionNombre={congregacionNombre}
            colorTema={colorTemaAsig}
            formato={formatoAsignaciones}
            diaEntreSemana={(diasReunionConfig as any)?.dia_entre_semana || "martes"}
            diaFinSemana={(diasReunionConfig as any)?.dia_fin_semana || "domingo"}
            loadingBase={loadingBasePredicacion}
            onShare={handleShare}
          />
          {mostrarAsignacionesSig && (
            <CardProgramaAsignaciones
              programa={programaAsignacionesSig as ProgramaPublicado}
              etiqueta="próximo mes"
              participantes={participantes || []}
              gruposPredicacion={gruposPredicacion || []}
              congregacionNombre={congregacionNombre}
              colorTema={colorTemaAsig}
              formato={formatoAsignaciones}
              diaEntreSemana={(diasReunionConfig as any)?.dia_entre_semana || "martes"}
              diaFinSemana={(diasReunionConfig as any)?.dia_fin_semana || "domingo"}
              loadingBase={loadingBasePredicacion}
              onShare={handleShare}
            />
          )}

          <CardProgramaVidaMinisterio
            programa={programaVyM}
            loadingPublicado={loadingVyMPublicado}
            programasVyM={programasVyM || []}
            participantes={participantes || []}
            congregacionNombre={congregacionNombre}
            diaEntreSemana={(diasReunionConfig as any)?.dia_entre_semana || "martes"}
            horaInicio={(diasReunionConfig as any)?.hora_entre_semana || "19:30"}
            consejoMaestrosMins={consejoMaestrosMins}
            onShare={handleShare}
          />
          {mostrarVyMSig && (
            <CardProgramaVidaMinisterio
              programa={programaVyMSig as ProgramaPublicado}
              etiqueta="próximo mes"
              programasVyM={programasVyM || []}
              participantes={participantes || []}
              congregacionNombre={congregacionNombre}
              diaEntreSemana={(diasReunionConfig as any)?.dia_entre_semana || "martes"}
              horaInicio={(diasReunionConfig as any)?.hora_entre_semana || "19:30"}
              consejoMaestrosMins={consejoMaestrosMins}
              onShare={handleShare}
            />
          )}
        </div>
      </div>

      <div className="text-center text-sm text-muted-foreground">
        <p>Los programas publicados por los administradores aparecerán aquí para su consulta.</p>
      </div>
    </div>
  );
};

export default ProgramasDelMes;
