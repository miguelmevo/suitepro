import { useEffect, useState } from "react";
import { Users, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useGruposPredicacion } from "@/hooks/useGruposPredicacion";
import { useParticipantes } from "@/hooks/useParticipantes";
import { useConfiguracionSistema } from "@/hooks/useConfiguracionSistema";
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
    const resps = Array.isArray(m.responsabilidad) ? m.responsabilidad : [m.responsabilidad];
    BADGES_TO_SHOW.forEach(r => { if (resps.includes(r)) counts[r]++; });
  });
  return counts;
}

export default function GruposPredicacionPage() {
  const { grupos, isLoading: loadingGrupos, sincronizarGrupos } = useGruposPredicacion();
  const { participantes, isLoading: loadingParticipantes } = useParticipantes();
  const { configuraciones, isLoading: loadingConfig } = useConfiguracionSistema("general");
  
  const [numeroGruposConfig, setNumeroGruposConfig] = useState<number>(10);

  // Obtener número de grupos de la configuración
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

  // Sincronizar grupos cuando cambia la configuración
  useEffect(() => {
    if (!loadingConfig && numeroGruposConfig > 0) {
      sincronizarGrupos.mutate(numeroGruposConfig);
    }
  }, [numeroGruposConfig, loadingConfig]);

  const isLoading = loadingGrupos || loadingParticipantes || loadingConfig;

  // Organizar participantes por grupo
  const getParticipantesPorGrupo = (grupoId: string) => {
    return participantes.filter(p => p.grupo_predicacion_id === grupoId);
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
      {/* Header */}
      <div className="flex items-center gap-3">
        <Users className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-xl font-bold text-foreground">Grupos de Predicación</h1>
          <p className="text-sm text-muted-foreground">
            Vista de grupos con sus miembros asignados
          </p>
        </div>
      </div>

      {/* Lista de grupos */}
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
            
            // Separar SUP, AUX y resto
            const sup = miembros.find(m => m.responsabilidad_adicional === "superintendente_grupo");
            const aux = miembros.find(m => m.responsabilidad_adicional === "auxiliar_grupo");
            const otros = miembros.filter(m => 
              m.responsabilidad_adicional !== "superintendente_grupo" && 
              m.responsabilidad_adicional !== "auxiliar_grupo"
            ).sort((a, b) => a.apellido.localeCompare(b.apellido));

            // Construir lista ordenada: SUP, AUX, luego el resto
            const listaOrdenada = [
              ...(sup ? [{ ...sup, rol: "SUP" }] : []),
              ...(aux ? [{ ...aux, rol: "AUX" }] : []),
              ...otros.map(m => ({ ...m, rol: null }))
            ];

            const counts = contarResponsabilidades(miembros);

            return (
              <div 
                key={grupo.id} 
                className="bg-card border rounded-xl overflow-hidden shadow-sm"
              >
                {/* Header del grupo */}
                <div className="bg-sky-600 text-white px-3 py-2.5 flex items-center justify-between">
                  <h3 className="text-sm font-bold">
                    GRUPO NRO. {grupo.numero}
                  </h3>
                  <div className="flex gap-1.5">
                    {BADGES_TO_SHOW.map(resp => (
                      <span
                        key={resp}
                        className={cn(
                          "w-7 h-7 rounded-full border-2 flex items-center justify-center text-[10px] font-bold bg-white/90",
                          RESPONSABILIDAD_BORDER_COLORS[resp]
                        )}
                      >
                        {counts[resp]}
                      </span>
                    ))}
                  </div>
                </div>
                
                {/* Lista de miembros */}
                <div className="divide-y divide-border">
                  {listaOrdenada.length === 0 ? (
                    <div className="p-3 text-center text-muted-foreground text-xs">
                      Sin miembros asignados
                    </div>
                  ) : (
                    listaOrdenada.map((miembro, idx) => {
                      const badges = getResponsabilidadBadges(miembro.responsabilidad);
                      const isLeader = miembro.rol === "SUP" || miembro.rol === "AUX";
                      
                      return (
                        <div 
                          key={miembro.id}
                          className={cn(
                            "flex items-center gap-2 px-3 py-1.5",
                            isLeader && "bg-green-50 dark:bg-green-950/30"
                          )}
                        >
                          <span className="text-xs font-medium text-muted-foreground w-5">
                            {idx + 1}
                          </span>
                          
                          <div className="flex-1 min-w-0">
                            <span className={cn(
                              "text-xs",
                              isLeader && "font-bold"
                            )}>
                              {miembro.nombre.toUpperCase()}
                            </span>
                            <span className={cn(
                              "text-xs ml-1.5",
                              isLeader && "font-bold"
                            )}>
                              {miembro.apellido.toUpperCase()}
                              {miembro.rol && (
                                <span className="ml-1">({miembro.rol})</span>
                              )}
                            </span>
                          </div>
                          
                          <div className="flex gap-0.5">
                            {badges.map(badge => (
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
    </div>
  );
}
