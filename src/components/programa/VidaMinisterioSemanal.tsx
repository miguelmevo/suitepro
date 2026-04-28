import { useState } from "react";
import { format, startOfWeek, endOfWeek, parseISO, addWeeks } from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, ChevronLeft, ChevronRight } from "lucide-react";
import { useProgramasVidaMinisterio } from "@/hooks/useProgramaVidaMinisterio";
import { useParticipantes } from "@/hooks/useParticipantes";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

// Colores por sección (estándar del Cuaderno de la Reunión)
const SECTION_COLORS = {
  tesoros: "#606a70",       // gris/azulado
  maestros: "#c18626",      // dorado/amber
  vida: "#961526",          // rojo oscuro
};

export function VidaMinisterioSemanal() {
  const [semanaOffset, setSemanaOffset] = useState(0);
  const hoy = new Date();
  const semanaBase = semanaOffset === 0 ? hoy : addWeeks(hoy, semanaOffset);
  const inicioSemana = startOfWeek(semanaBase, { weekStartsOn: 1 });
  const finSemana = endOfWeek(semanaBase, { weekStartsOn: 1 });
  const inicioStr = format(inicioSemana, "yyyy-MM-dd");

  const { data: programas, isLoading: loadingProgramas } = useProgramasVidaMinisterio();
  const { participantes, isLoading: loadingParticipantes } = useParticipantes();

  const isLoading = loadingProgramas || loadingParticipantes;

  const programa = programas?.find((p) => p.fecha_semana === inicioStr) || null;

  const getNombre = (id: string | null | undefined) => {
    if (!id) return null;
    const p = participantes.find((p) => p.id === id);
    return p ? `${p.apellido}, ${p.nombre}` : null;
  };

  const rangoLabel =
    inicioSemana.getMonth() === finSemana.getMonth()
      ? `${format(inicioSemana, "d")} – ${format(finSemana, "d 'de' MMMM", { locale: es })}`
      : `${format(inicioSemana, "d 'de' MMM", { locale: es })} – ${format(finSemana, "d 'de' MMM", { locale: es })}`;

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg uppercase">
            <GraduationCap className="h-5 w-5" />
            Vida y Ministerio
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  const SectionHeader = ({ color, children }: { color: string; children: React.ReactNode }) => (
    <div
      className="text-xs font-bold uppercase tracking-wide px-2 py-1 rounded-sm text-white"
      style={{ backgroundColor: color }}
    >
      {children}
    </div>
  );

  const Item = ({ num, label, value }: { num?: number; label: string; value: React.ReactNode }) => (
    <div className="flex flex-wrap items-baseline gap-x-1.5 text-xs">
      <span className="text-muted-foreground">
        {num !== undefined ? `${num}. ` : ""}{label}:
      </span>
      <span className="font-medium">{value}</span>
    </div>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg uppercase">
          <GraduationCap className="h-5 w-5 text-primary" />
          Vida y Ministerio
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Navegación semanal */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setSemanaOffset((prev) => prev - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <button
            className="text-sm font-medium capitalize hover:text-primary transition-colors"
            onClick={() => setSemanaOffset(0)}
            title="Volver a la semana actual"
          >
            {rangoLabel}
            {semanaOffset !== 0 && (
              <span className="ml-1.5 text-xs text-muted-foreground">(ir a hoy)</span>
            )}
          </button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setSemanaOffset((prev) => prev + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {!programa ? (
          <div className="text-sm text-center py-2 text-muted-foreground">
            Sin programa esta semana
          </div>
        ) : (
          <div className="border rounded-lg p-3 space-y-2.5">
            {/* Cabecera: Presidente y oración inicial */}
            <div className="space-y-1">
              <Item label="Presidente" value={getNombre(programa.presidente_id) || "—"} />
              <Item label="Oración inicial" value={getNombre(programa.oracion_inicial_id) || "—"} />
            </div>

            {/* TESOROS DE LA BIBLIA */}
            <div className="space-y-1.5">
              <SectionHeader color={SECTION_COLORS.tesoros}>
                Tesoros de la Bíblia
              </SectionHeader>
              <div className="space-y-1 pl-1">
                <Item
                  num={1}
                  label={programa.tesoros?.titulo || "Tesoros de la Bíblia"}
                  value={getNombre(programa.tesoros?.participante_id) || "—"}
                />
                <Item
                  num={2}
                  label="Busquemos perlas escondidas"
                  value={getNombre(programa.perlas_id) || "—"}
                />
                <Item
                  num={3}
                  label={`Lectura Bíblica${programa.lectura_biblica?.cita ? ` (${programa.lectura_biblica.cita})` : ""}`}
                  value={getNombre(programa.lectura_biblica?.participante_id) || "—"}
                />
              </div>
            </div>

            {/* SEAMOS MEJORES MAESTROS */}
            {programa.maestros && programa.maestros.length > 0 && (
              <div className="space-y-1.5">
                <SectionHeader color={SECTION_COLORS.maestros}>
                  Seamos Mejores Maestros
                </SectionHeader>
                <div className="space-y-1 pl-1">
                  {programa.maestros.map((m, idx) => {
                    const titular = getNombre(m.titular_id);
                    const ayudante = getNombre(m.ayudante_id);
                    const esDiscurso = m.tipo === "discurso";
                    return (
                      <Item
                        key={m.id}
                        num={4 + idx}
                        label={m.titulo || (esDiscurso ? "Discurso" : "Demostración")}
                        value={
                          <>
                            {titular || "—"}
                            {!esDiscurso && (
                              <>
                                {" / "}
                                {ayudante || "—"}
                              </>
                            )}
                          </>
                        }
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* NUESTRA VIDA CRISTIANA */}
            <div className="space-y-1.5">
              <SectionHeader color={SECTION_COLORS.vida}>
                Nuestra Vida Cristiana
              </SectionHeader>
              <div className="space-y-1 pl-1">
                {programa.vida_cristiana?.map((v, idx) => {
                  const startNum = 4 + (programa.maestros?.length || 0) + idx;
                  return (
                    <Item
                      key={v.id}
                      num={startNum}
                      label={v.titulo || "Parte de la Vida Cristiana"}
                      value={getNombre(v.participante_id) || "—"}
                    />
                  );
                })}
                {programa.estudio_biblico && (
                  <Item
                    num={4 + (programa.maestros?.length || 0) + (programa.vida_cristiana?.length || 0)}
                    label={
                      programa.estudio_biblico.visita_superintendente
                        ? programa.estudio_biblico.titulo_discurso || "Discurso del superintendente"
                        : programa.estudio_biblico.titulo || "Estudio bíblico de la congregación"
                    }
                    value={
                      programa.estudio_biblico.visita_superintendente ? (
                        <>{getNombre(programa.estudio_biblico.conductor_id) || "—"}</>
                      ) : (
                        <>
                          {getNombre(programa.estudio_biblico.conductor_id) || "—"}
                          {" / "}
                          {getNombre(programa.estudio_biblico.lector_id) || "—"}{" "}
                          <span className="text-muted-foreground">(lector)</span>
                        </>
                      )
                    }
                  />
                )}
              </div>
            </div>

            {/* Oración final */}
            {programa.oracion_final_id && (
              <div className="pt-1">
                <Item label="Oración final" value={getNombre(programa.oracion_final_id) || "—"} />
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
