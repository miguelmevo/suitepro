import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Save, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useConfiguracionSistema } from "@/hooks/useConfiguracionSistema";

const SALAS_OPTIONS = [
  { value: "0", label: "Sin salas auxiliares" },
  { value: "1", label: "1 sala auxiliar (Sala B)" },
  { value: "2", label: "2 salas auxiliares (Sala B y C)" },
];

export function VidaMinisterioSettings() {
  const { configuraciones, actualizarConfiguracion, isLoading } = useConfiguracionSistema("vida_ministerio");
  const [cantidadSalas, setCantidadSalas] = useState<string>("0");

  useEffect(() => {
    if (!configuraciones) return;
    const cfg = configuraciones.find((c) => c.clave === "salas_auxiliares");
    if (cfg?.valor && typeof cfg.valor === "object") {
      const v = (cfg.valor as { cantidad?: number }).cantidad;
      if (typeof v === "number") setCantidadSalas(String(v));
    }
  }, [configuraciones]);

  const handleGuardar = () => {
    actualizarConfiguracion.mutate({
      programaTipo: "vida_ministerio",
      clave: "salas_auxiliares",
      valor: { cantidad: parseInt(cantidadSalas, 10) },
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-primary text-lg">Reunión Vida y Ministerio Cristiano</CardTitle>
        <CardDescription>Configuración global para el programa de entre semana</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Salas auxiliares (por defecto)</Label>
          <Select value={cantidadSalas} onValueChange={setCantidadSalas} disabled={isLoading}>
            <SelectTrigger className="max-w-md">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SALAS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Este es el valor por defecto que se usará en cada semana. Puedes cambiarlo
              puntualmente en cada programa semanal si en una semana específica varía
              el número de salas.
            </AlertDescription>
          </Alert>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleGuardar} disabled={actualizarConfiguracion.isPending}>
            <Save className="h-4 w-4 mr-2" />
            Guardar cambios
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
