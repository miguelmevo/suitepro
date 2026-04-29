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
  const [consejoTexto, setConsejoTexto] = useState<string>("0:00");

  // Convierte "M:SS" o "M" a minutos decimales (ej. "1:30" -> 1.5)
  const parseConsejo = (s: string): number => {
    const trimmed = (s || "").trim();
    if (!trimmed) return 0;
    if (trimmed.includes(":")) {
      const [mStr, sStr = "0"] = trimmed.split(":");
      const m = parseInt(mStr, 10);
      const sec = parseInt(sStr, 10);
      if (isNaN(m) || isNaN(sec) || sec < 0 || sec > 59) return 0;
      return Math.max(0, Math.min(5, m + sec / 60));
    }
    const m = parseFloat(trimmed.replace(",", "."));
    if (isNaN(m)) return 0;
    return Math.max(0, Math.min(5, m));
  };

  // Convierte minutos decimales a "M:SS" (ej. 1.5 -> "1:30")
  const formatConsejo = (mins: number): string => {
    const totalSeg = Math.round(mins * 60);
    const m = Math.floor(totalSeg / 60);
    const s = totalSeg % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

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
      if (typeof v === "number") setConsejoTexto(formatConsejo(v));
    }
  }, [configuraciones]);

  const handleGuardar = () => {
    actualizarConfiguracion.mutate({
      programaTipo: "vida_ministerio",
      clave: "salas_auxiliares",
      valor: { cantidad: parseInt(cantidadSalas, 10) },
    });
    const minutosDecimal = parseConsejo(consejoTexto);
    actualizarConfiguracion.mutate({
      programaTipo: "vida_ministerio",
      clave: "consejo_presidente_maestros",
      valor: { minutos: minutosDecimal },
    });
    // Normalizar la visualización tras guardar
    setConsejoTexto(formatConsejo(minutosDecimal));
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
          <Label>Consejo del presidente — Seamos Mejores Maestros (M:SS)</Label>
          <Input
            type="text"
            inputMode="text"
            placeholder="0:00"
            value={consejoTexto}
            onChange={(e) => setConsejoTexto(e.target.value)}
            onBlur={() => setConsejoTexto(formatConsejo(parseConsejo(consejoTexto)))}
            disabled={isLoading}
            className="max-w-[120px]"
          />
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Tiempo adicional (de <strong>0:00</strong> hasta <strong>5:00</strong>, en formato
              <code className="mx-1">M:SS</code>) que el presidente usa para dar consejo después de
              cada parte de <strong>Seamos Mejores Maestros</strong>. No se muestra en el PDF, pero
              se suma al cálculo de la hora de inicio de las siguientes intervenciones.
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
