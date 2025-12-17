import { useEffect, useState } from "react";
import { Users, Save } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGruposPredicacion } from "@/hooks/useGruposPredicacion";
import { useParticipantes } from "@/hooks/useParticipantes";
import { useConfiguracionSistema } from "@/hooks/useConfiguracionSistema";

export default function GruposPredicacionPage() {
  const { grupos, isLoading: loadingGrupos, sincronizarGrupos, actualizarGrupo } = useGruposPredicacion();
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

  const handleUpdateGrupo = (
    grupoId: string,
    field: "superintendente" | "auxiliar",
    participanteId: string | null
  ) => {
    const grupo = grupos?.find((g) => g.id === grupoId);
    if (!grupo) return;

    actualizarGrupo.mutate({
      grupoId,
      superintendenteId: field === "superintendente" ? participanteId : grupo.superintendente_id,
      auxiliarId: field === "auxiliar" ? participanteId : grupo.auxiliar_id,
    });
  };

  const isLoading = loadingGrupos || loadingParticipantes || loadingConfig;

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
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-xl font-bold text-foreground">Grupos de Predicación</h1>
            <p className="text-sm text-muted-foreground">
              Configura los Superintendentes (SG) y Auxiliares (AG) para cada grupo
            </p>
          </div>
        </div>
        <Button className="gap-2">
          <Save className="h-4 w-4" />
          Guardar Todo
        </Button>
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
        <div className="space-y-4">
          {grupos?.map((grupo) => (
            <div 
              key={grupo.id} 
              className="bg-primary/5 rounded-xl p-5"
            >
              <h3 className="text-base font-bold text-primary mb-4">
                Grupo {grupo.numero}
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Superintendente de Grupo */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">
                    Superintendente de Grupo (SG)
                  </Label>
                  <Select
                    value={grupo.superintendente_id || "none"}
                    onValueChange={(value) =>
                      handleUpdateGrupo(grupo.id, "superintendente", value === "none" ? null : value)
                    }
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Seleccionar SG" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin asignar</SelectItem>
                      {participantes?.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.apellido}, {p.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Auxiliar de Grupo */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">
                    Auxiliar de Grupo (AG)
                  </Label>
                  <Select
                    value={grupo.auxiliar_id || "none"}
                    onValueChange={(value) =>
                      handleUpdateGrupo(grupo.id, "auxiliar", value === "none" ? null : value)
                    }
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Seleccionar AG" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin asignar</SelectItem>
                      {participantes?.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.apellido}, {p.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer button */}
      {grupos && grupos.length > 0 && (
        <div className="flex justify-end">
          <Button className="gap-2">
            <Save className="h-4 w-4" />
            Guardar Todo
          </Button>
        </div>
      )}
    </div>
  );
}