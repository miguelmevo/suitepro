import { useEffect, useState } from "react";
import { Users, Plus, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useGruposPredicacion, GrupoPredicacion } from "@/hooks/useGruposPredicacion";
import { useParticipantes } from "@/hooks/useParticipantes";
import { useConfiguracionSistema } from "@/hooks/useConfiguracionSistema";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { AgregarParticipanteGrupoModal } from "@/components/grupos-predicacion/AgregarParticipanteGrupoModal";
import { cn } from "@/lib/utils";

const RESPONSABILIDAD_COLORS: Record<string, string> = {
  anciano: "bg-green-500 text-white",
  siervo_ministerial: "bg-orange-400 text-white",
  precursor_regular: "bg-yellow-400 text-black",
  publicador: "bg-sky-400 text-white",
};

const RESPONSABILIDAD_BORDER_COLORS: Record<string, string> = {
  anciano: "border-green-500 text-green-600",
  siervo_ministerial: "border-orange-400 text-orange-500",
  precursor_regular: "border-yellow-400 text-yellow-500",
};

const RESPONSABILIDAD_ABBR: Record<string, string> = {
  anciano: "A",
  siervo_ministerial: "SM",
  precursor_regular: "PR",
  publicador: "P",
};

const BADGES_TO_SHOW = ["anciano", "siervo_ministerial", "precursor_regular"];

function getResponsabilidadBadges(responsabilidades: string | string[]): string[] {
  const arr = Array.isArray(responsabilidades) ? responsabilidades : [responsabilidades];
  return BADGES_TO_SHOW.filter(r => arr.includes(r));
}

function contarResponsabilidades(miembros: any[]): Record<string, number> {
  const counts: Record<string, number> = { anciano: 0, siervo_ministerial: 0, precursor_regular: 0 };
  miembros.forEach(m => {
    if (m.es_publicador_inactivo) return;
    const resps = Array.isArray(m.responsabilidad) ? m.responsabilidad : [m.responsabilidad];
    BADGES_TO_SHOW.forEach(r => { if (resps.includes(r)) counts[r]++; });
  });
  return counts;
}

export default function GruposPredicacionPage() {
  const { grupos, isLoading: loadingGrupos, sincronizarGrupos } = useGruposPredicacion();
  const { participantes, isLoading: loadingParticipantes, actualizarParticipante } = useParticipantes();
  const { configuraciones, isLoading: loadingConfig } = useConfiguracionSistema("general");
  
  const [numeroGruposConfig, setNumeroGruposConfig] = useState<number>(10);
  const [modalAgregar, setModalAgregar] = useState<GrupoPredicacion | null>(null);
  const [confirmRemover, setConfirmRemover] = useState<{ id: string; nombre: string } | null>(null);

  useEffect(() => {
    if (configuraciones) {
      const gruposConfig = configuraciones.find(
        (c) => c.programa_tipo === "general" && c.clave === "numero_grupos"
      );
      if (gruposConfig?.valor?.cantidad) {
        setNumeroGruposConfig(gruposConfig.valor.cantidad);
      }
    }
  }, [configuraciones]);

  useEffect(() => {
    if (!loadingConfig && numeroGruposConfig > 0) {
      sincronizarGrupos.mutate(numeroGruposConfig);
    }
  }, [numeroGruposConfig, loadingConfig]);

  const isLoading = loadingGrupos || loadingParticipantes || loadingConfig;

  const getParticipantesPorGrupo = (grupoId: string) => {
    return participantes.filter(p => p.grupo_predicacion_id === grupoId);
  };

  const handleAsignar = (participanteId: string, grupoId: string) => {
    actualizarParticipante.mutate({ id: participanteId, grupo_predicacion_id: grupoId });
  };

  const handleRemover = () => {
    if (!confirmRemover) return;
    actualizarParticipante.mutate({ id: confirmRemover.id, grupo_predicacion_id: null });
    setConfirmRemover(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8" />
          <div>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64 mt-1" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Users className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-xl font-bold text-foreground">Grupos de Predicación</h1>
          <p className="text-sm text-muted-foreground">
            Vista de grupos con sus miembros asignados
          </p>
        </div>
      </div>

      {grupos && grupos.length === 0 ? (
        <div className="bg-primary/5 rounded-xl p-12 text-center">
          <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            No hay grupos configurados. Ve a Ajustes del Sistema → General para configurar el número de grupos.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {grupos?.map((grupo) => {
            const miembros = getParticipantesPorGrupo(grupo.id);
            const inactivosCount = miembros.filter(m => (m as any).es_publicador_inactivo).length;
            
            const sup = miembros.find(m => m.responsabilidad_adicional === "superintendente_grupo" && !(m as any).es_publicador_inactivo);
            const aux = miembros.find(m => m.responsabilidad_adicional === "auxiliar_grupo" && !(m as any).es_publicador_inactivo);
            const activos = miembros.filter(m => 
              m.responsabilidad_adicional !== "superintendente_grupo" && 
              m.responsabilidad_adicional !== "auxiliar_grupo" &&
              !(m as any).es_publicador_inactivo
            ).sort((a, b) => a.apellido.localeCompare(b.apellido));
            const inactivos = miembros.filter(m => (m as any).es_publicador_inactivo)
              .sort((a, b) => a.apellido.localeCompare(b.apellido));

            const listaOrdenada = [
              ...(sup ? [{ ...sup, rol: "SUP" as string | null }] : []),
              ...(aux ? [{ ...aux, rol: "AUX" as string | null }] : []),
              ...activos.map(m => ({ ...m, rol: null as string | null })),
              ...inactivos.map(m => ({ ...m, rol: null as string | null })),
            ];

            const counts = contarResponsabilidades(miembros);

            return (
              <div 
                key={grupo.id} 
                className="bg-card border rounded-xl overflow-hidden shadow-sm"
              >
                <div className="bg-sky-600 text-white px-3 py-2.5 flex items-center justify-between">
                  <h3 className="text-sm font-extrabold">
                    GRUPO NRO. {grupo.numero}
                  </h3>
                  <div className="flex gap-1.5 items-center">
                    {BADGES_TO_SHOW.map(resp => counts[resp] > 0 ? (
                      <span
                        key={resp}
                        className={cn(
                          "w-7 h-7 rounded-full border-2 flex items-center justify-center text-[10px] font-bold bg-white/90",
                          RESPONSABILIDAD_BORDER_COLORS[resp]
                        )}
                      >
                        {counts[resp]}
                      </span>
                    ) : null)}
                    {inactivosCount > 0 && (
                      <span className="w-7 h-7 rounded-full border-2 border-amber-400 text-amber-600 flex items-center justify-center text-[10px] font-bold bg-white/90">
                        {inactivosCount}
                      </span>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-white hover:bg-white/20 hover:text-white ml-1"
                      onClick={() => setModalAgregar(grupo)}
                      title="Agregar participante"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                <div className="divide-y divide-border">
                  {listaOrdenada.length === 0 ? (
                    <div className="p-3 text-center text-muted-foreground text-xs">
                      Sin miembros asignados
                    </div>
                  ) : (
                    listaOrdenada.map((miembro, idx) => {
                      const badges = getResponsabilidadBadges(miembro.responsabilidad);
                      const isLeader = miembro.rol === "SUP" || miembro.rol === "AUX";
                      const isInactivo = (miembro as any).es_publicador_inactivo;
                      
                      return (
                        <div 
                          key={miembro.id}
                          className={cn(
                            "flex items-center gap-2 px-3 py-1.5 group",
                            isLeader && "bg-green-50 dark:bg-green-950/30",
                            isInactivo && "bg-amber-50/50 dark:bg-amber-950/10 opacity-60"
                          )}
                        >
                          <span className="text-[11px] font-medium text-muted-foreground w-5">
                            {idx + 1}
                          </span>
                          
                          <div className="flex-1 min-w-0">
                            <span className={cn(
                              "text-[11px]",
                              isLeader && "font-bold",
                              isInactivo && "italic"
                            )}>
                              {miembro.apellido.toUpperCase()},
                            </span>
                            <span className={cn(
                              "text-[11px] ml-1",
                              isLeader && "font-bold",
                              isInactivo && "italic"
                            )}>
                              {miembro.nombre.toUpperCase()}
                              {miembro.rol && (
                                <span className="ml-1">({miembro.rol})</span>
                              )}
                            </span>
                            {isInactivo && (
                              <span className="ml-1.5 text-[9px] text-red-600 font-semibold">(INACTIVO)</span>
                            )}
                          </div>
                          
                          <div className="flex gap-0.5 items-center">
                            {!isInactivo && badges.map(badge => (
                              <span 
                                key={badge}
                                className={cn(
                                  "px-1.5 py-0.5 rounded text-[10px] font-bold min-w-[26px] text-center",
                                  RESPONSABILIDAD_COLORS[badge]
                                )}
                              >
                                {RESPONSABILIDAD_ABBR[badge]}
                              </span>
                            ))}
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10 ml-1"
                              onClick={() => setConfirmRemover({ id: miembro.id, nombre: `${miembro.apellido}, ${miembro.nombre}` })}
                              title="Remover del grupo"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal agregar participante */}
      {modalAgregar && grupos && (
        <AgregarParticipanteGrupoModal
          open={!!modalAgregar}
          onOpenChange={(v) => !v && setModalAgregar(null)}
          grupoDestino={modalAgregar}
          participantes={participantes}
          grupos={grupos}
          onAsignar={handleAsignar}
        />
      )}

      {/* Confirmación remover */}
      <ConfirmDeleteDialog
        open={!!confirmRemover}
        onOpenChange={(v) => !v && setConfirmRemover(null)}
        onConfirm={handleRemover}
        title="¿Remover del grupo?"
        description={`¿Estás seguro que deseas remover a "${confirmRemover?.nombre}" de este grupo? El participante quedará sin grupo asignado.`}
      />
    </div>
  );
}
