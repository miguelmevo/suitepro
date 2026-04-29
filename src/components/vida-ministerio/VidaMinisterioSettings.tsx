import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const [consejoMins, setConsejoMins] = useState<string>("0");

  useEffect(() => {
    if (!configuraciones) return;
    const cfg = configuraciones.find((c) => c.clave === "salas_auxiliares");
    if (cfg?.valor && typeof cfg.valor === "object") {
      const v = (cfg.valor as { cantidad?: number }).cantidad;
      if (typeof v === "number") setCantidadSalas(String(v));
    }
    const cfgConsejo = configuraciones.find((c) => c.clave === "consejo_presidente_maestros");
    if (cfgConsejo?.valor && typeof cfgConsejo.valor === "object") {
      const v = (cfgConsejo.valor as { minutos?: number }).minutos;
      if (typeof v === "number") setConsejoMins(String(v));
    }
  }, [configuraciones]);

  const handleGuardar = () => {
    actualizarConfiguracion.mutate({
      programaTipo: "vida_ministerio",
      clave: "salas_auxiliares",
      valor: { cantidad: parseInt(cantidadSalas, 10) },
    });
    let n = parseInt(consejoMins, 10);
    if (isNaN(n) || n < 0) n = 0;
    if (n > 5) n = 5;
    actualizarConfiguracion.mutate({
      programaTipo: "vida_ministerio",
      clave: "consejo_presidente_maestros",
      valor: { minutos: n },
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

        <div className="space-y-2">
          <Label>Minutos de consejo del presidente (Seamos Mejores Maestros)</Label>
          <Input
            type="number"
            min={0}
            max={5}
            step={1}
            value={consejoMins}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === "") return setConsejoMins("0");
              let n = parseInt(raw, 10);
              if (isNaN(n)) return;
              if (n < 0) n = 0;
              if (n > 5) n = 5;
              setConsejoMins(String(n));
            }}
            disabled={isLoading}
            className="max-w-[120px]"
          />
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Minutos adicionales (0 a 5) que el presidente usa para dar consejo después de cada
              parte de <strong>Seamos Mejores Maestros</strong>. No se muestran en el PDF, pero se
              suman al cálculo de la hora de inicio de las siguientes intervenciones.
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
