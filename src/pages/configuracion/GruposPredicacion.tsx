import { useEffect, useState } from "react";
import { Users, UserCheck, UserPlus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Grupos de Predicación</h1>
            <p className="text-muted-foreground">
              Gestiona los Superintendentes (SG) y Auxiliares (AG) de cada grupo
            </p>
          </div>
        </div>
        <Badge variant="secondary" className="text-sm">
          {numeroGruposConfig} grupos configurados
        </Badge>
      </div>

      {grupos && grupos.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              No hay grupos configurados. Ve a Ajustes del Sistema → General para configurar el número de grupos.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {grupos?.map((grupo) => (
            <Card key={grupo.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Grupo {grupo.numero}</CardTitle>
                  <Badge variant="outline">G{grupo.numero}</Badge>
                </div>
                <CardDescription>Líderes del grupo de predicación</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Superintendente de Grupo */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-sm font-medium">
                    <UserCheck className="h-4 w-4 text-primary" />
                    Superintendente (SG)
                  </Label>
                  <Select
                    value={grupo.superintendente_id || "none"}
                    onValueChange={(value) =>
                      handleUpdateGrupo(grupo.id, "superintendente", value === "none" ? null : value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar SG" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin asignar</SelectItem>
                      {participantes?.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nombre} {p.apellido}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {grupo.superintendente && (
                    <p className="text-xs text-muted-foreground">
                      Actual: {grupo.superintendente.nombre} {grupo.superintendente.apellido}
                    </p>
                  )}
                </div>

                {/* Auxiliar de Grupo */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-sm font-medium">
                    <UserPlus className="h-4 w-4 text-secondary-foreground" />
                    Auxiliar (AG)
                  </Label>
                  <Select
                    value={grupo.auxiliar_id || "none"}
                    onValueChange={(value) =>
                      handleUpdateGrupo(grupo.id, "auxiliar", value === "none" ? null : value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar AG" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin asignar</SelectItem>
                      {participantes?.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nombre} {p.apellido}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {grupo.auxiliar && (
                    <p className="text-xs text-muted-foreground">
                      Actual: {grupo.auxiliar.nombre} {grupo.auxiliar.apellido}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
