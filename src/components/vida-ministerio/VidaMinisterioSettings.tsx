import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Save, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useConfiguracionSistema } from "@/hooks/useConfiguracionSistema";

const SALAS_OPTIONS = [
  { value: "0", label: "Sin salas auxiliares" },
  { value: "1", label: "1 sala auxiliar (Sala B)" },
  { value: "2", label: "2 salas auxiliares (Sala B y C)" },
];

const PALABRAS_FAMILIA_DEFAULT = "esposo, esposa, hijo, hija, hermano, hermana, padre, madre, familia, matrimonio, pareja";

export function VidaMinisterioSettings() {
  const { configuraciones, actualizarConfiguracion, isLoading } = useConfiguracionSistema("vida_ministerio");
  const [cantidadSalas, setCantidadSalas] = useState<string>("0");
  const [consejoTexto, setConsejoTexto] = useState<string>("0:00");
  const [durCanticos, setDurCanticos] = useState<string>("5");
  const [durPalabrasIniciales, setDurPalabrasIniciales] = useState<string>("1");
  const [durPalabrasConclusion, setDurPalabrasConclusion] = useState<string>("3");
  const [smHabilitadoMaestros, setSmHabilitadoMaestros] = useState<boolean>(true);
  const [ebcConductorIncluyeSm, setEbcConductorIncluyeSm] = useState<boolean>(false);
  const [ventanaRotacionSemanas, setVentanaRotacionSemanas] = useState<string>("8");
  const [ventanaDescansoGlobal, setVentanaDescansoGlobal] = useState<string>("0");
  const [umbralRelajacion, setUmbralRelajacion] = useState<string>("5");
  const [ventanaAsignacionHistorial, setVentanaAsignacionHistorial] = useState<string>("8");
  const [palabrasFamilia, setPalabrasFamilia] = useState<string>(PALABRAS_FAMILIA_DEFAULT);

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
    const cfgC = configuraciones.find((c) => c.clave === "duracion_canticos");
    if (cfgC?.valor && typeof (cfgC.valor as any).minutos === "number") setDurCanticos(String((cfgC.valor as any).minutos));
    const cfgPI = configuraciones.find((c) => c.clave === "duracion_palabras_iniciales");
    if (cfgPI?.valor && typeof (cfgPI.valor as any).minutos === "number") setDurPalabrasIniciales(String((cfgPI.valor as any).minutos));
    const cfgPC = configuraciones.find((c) => c.clave === "duracion_palabras_conclusion");
    if (cfgPC?.valor && typeof (cfgPC.valor as any).minutos === "number") setDurPalabrasConclusion(String((cfgPC.valor as any).minutos));
    const cfgSM = configuraciones.find((c) => c.clave === "sm_habilitado_maestros");
    if (cfgSM?.valor && typeof (cfgSM.valor as any).habilitado === "boolean") setSmHabilitadoMaestros((cfgSM.valor as any).habilitado);
    const cfgEbcSm = configuraciones.find((c) => c.clave === "ebc_conductor_incluye_sm");
    if (cfgEbcSm?.valor && typeof (cfgEbcSm.valor as any).habilitado === "boolean") setEbcConductorIncluyeSm((cfgEbcSm.valor as any).habilitado);
    const cfgVR = configuraciones.find((c) => c.clave === "ventana_rotacion_semanas");
    if (cfgVR?.valor && typeof (cfgVR.valor as any).semanas === "number") setVentanaRotacionSemanas(String((cfgVR.valor as any).semanas));
    const cfgVDG = configuraciones.find((c) => c.clave === "ventana_descanso_global_semanas");
    if (cfgVDG?.valor && typeof (cfgVDG.valor as any).semanas === "number") setVentanaDescansoGlobal(String((cfgVDG.valor as any).semanas));
    const cfgUmb = configuraciones.find((c) => c.clave === "umbral_relajacion_seleccion");
    if (cfgUmb?.valor && typeof (cfgUmb.valor as any).cantidad === "number") setUmbralRelajacion(String((cfgUmb.valor as any).cantidad));
    const cfgVAH = configuraciones.find((c) => c.clave === "ventana_asignacion_historial_semanas");
    if (cfgVAH?.valor && typeof (cfgVAH.valor as any).semanas === "number") setVentanaAsignacionHistorial(String((cfgVAH.valor as any).semanas));
    const cfgPF = configuraciones.find((c) => c.clave === "palabras_clave_familia");
    if (cfgPF?.valor && typeof (cfgPF.valor as any).palabras === "string") setPalabrasFamilia((cfgPF.valor as any).palabras);
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
    const parseInt2 = (s: string, def: number) => {
      const n = parseInt(s, 10);
      return isNaN(n) || n < 1 || n > 90 ? def : n;
    };
    actualizarConfiguracion.mutate({
      programaTipo: "vida_ministerio",
      clave: "duracion_canticos",
      valor: { minutos: parseInt2(durCanticos, 5) },
    });
    actualizarConfiguracion.mutate({
      programaTipo: "vida_ministerio",
      clave: "duracion_palabras_iniciales",
      valor: { minutos: parseInt2(durPalabrasIniciales, 1) },
    });
    actualizarConfiguracion.mutate({
      programaTipo: "vida_ministerio",
      clave: "duracion_palabras_conclusion",
      valor: { minutos: parseInt2(durPalabrasConclusion, 3) },
    });
    actualizarConfiguracion.mutate({
      programaTipo: "vida_ministerio",
      clave: "sm_habilitado_maestros",
      valor: { habilitado: smHabilitadoMaestros },
    });
    const semanas = (() => {
      const n = parseInt(ventanaRotacionSemanas, 10);
      return isNaN(n) || n < 1 || n > 52 ? 8 : n;
    })();
    actualizarConfiguracion.mutate({
      programaTipo: "vida_ministerio",
      clave: "ventana_rotacion_semanas",
      valor: { semanas },
    });
    const semanasDescanso = (() => {
      const n = parseInt(ventanaDescansoGlobal, 10);
      return isNaN(n) || n < 0 || n > 52 ? 0 : n;
    })();
    actualizarConfiguracion.mutate({
      programaTipo: "vida_ministerio",
      clave: "ventana_descanso_global_semanas",
      valor: { semanas: semanasDescanso },
    });
    const umbral = (() => {
      const n = parseInt(umbralRelajacion, 10);
      return isNaN(n) || n < 1 || n > 50 ? 5 : n;
    })();
    actualizarConfiguracion.mutate({
      programaTipo: "vida_ministerio",
      clave: "umbral_relajacion_seleccion",
      valor: { cantidad: umbral },
    });
    const semanasHistorial = (() => {
      const n = parseInt(ventanaAsignacionHistorial, 10);
      return isNaN(n) || n < 1 || n > 52 ? 8 : n;
    })();
    actualizarConfiguracion.mutate({
      programaTipo: "vida_ministerio",
      clave: "ventana_asignacion_historial_semanas",
      valor: { semanas: semanasHistorial },
    });
    actualizarConfiguracion.mutate({
      programaTipo: "vida_ministerio",
      clave: "palabras_clave_familia",
      valor: { palabras: palabrasFamilia.trim() || PALABRAS_FAMILIA_DEFAULT },
    });
    // Normalizar la visualización tras guardar
    setConsejoTexto(formatConsejo(minutosDecimal));
    setVentanaRotacionSemanas(String(semanas));
    setVentanaDescansoGlobal(String(semanasDescanso));
    setUmbralRelajacion(String(umbral));
    setVentanaAsignacionHistorial(String(semanasHistorial));
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

        <div className="space-y-3 border-t pt-4">
          <Label className="text-base">Duraciones por defecto (minutos)</Label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl">
            <div className="space-y-1">
              <Label className="text-xs">Cánticos</Label>
              <Input
                type="number"
                min={1}
                max={90}
                value={durCanticos}
                onChange={(e) => setDurCanticos(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Palabras iniciales del presidente</Label>
              <Input
                type="number"
                min={1}
                max={90}
                value={durPalabrasIniciales}
                onChange={(e) => setDurPalabrasIniciales(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Palabras de conclusión del presidente</Label>
              <Input
                type="number"
                min={1}
                max={90}
                value={durPalabrasConclusion}
                onChange={(e) => setDurPalabrasConclusion(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Valores por defecto que se aplicarán al abrir un programa nuevo o al limpiarlo.
              Siempre podrás ajustarlos manualmente en cada programa semanal.
            </AlertDescription>
          </Alert>
        </div>

        <div className="space-y-4 border-t pt-4">
          <Label className="text-base">Reglas de asignación automática</Label>

          <div className="flex items-start justify-between gap-4 rounded-md border p-3">
            <div className="space-y-1">
              <Label htmlFor="sm-maestros" className="text-sm font-medium">
                Siervos ministeriales pueden recibir partes de Nuestra Vida Cristiana
              </Label>
              <p className="text-xs text-muted-foreground">
                Si se desactiva, solo se asignarán ancianos a las partes de Nuestra Vida Cristiana (excepto el Estudio Bíblico de la Congregación).
              </p>
            </div>
            <Switch
              id="sm-maestros"
              checked={smHabilitadoMaestros}
              onCheckedChange={setSmHabilitadoMaestros}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-1 max-w-md">
            <Label className="text-xs">Ventana de rotación por categoría (semanas)</Label>
            <Input
              type="number"
              min={1}
              max={52}
              value={ventanaRotacionSemanas}
              onChange={(e) => setVentanaRotacionSemanas(e.target.value)}
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              Mínimo de semanas entre dos asignaciones <strong>de la misma categoría</strong> (Tesoros, Lectura, Maestros, etc.). Aplica tanto a la asignación automática (IA) como al selector manual.
            </p>
          </div>

          <div className="space-y-1 max-w-md">
            <Label className="text-xs">Descanso global entre asignaciones (semanas)</Label>
            <Input
              type="number"
              min={0}
              max={52}
              value={ventanaDescansoGlobal}
              onChange={(e) => setVentanaDescansoGlobal(e.target.value)}
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              Mínimo de semanas entre <strong>cualquier</strong> participación del mismo publicador (sin importar la categoría). <strong>Las oraciones inicial/final están exentas</strong> y no cuentan. Usa <code>0</code> para desactivar esta regla.
            </p>
          </div>

          <div className="space-y-1 max-w-md">
            <Label className="text-xs">Umbral de relajación del selector</Label>
            <Input
              type="number"
              min={1}
              max={50}
              value={umbralRelajacion}
              onChange={(e) => setUmbralRelajacion(e.target.value)}
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              Cuando hay <strong>al menos esta cantidad</strong> de participantes disponibles que cumplen ambas reglas, los bloqueados quedan no seleccionables. Si hay menos, se permiten con un aviso visual (badge ⚠).
            </p>
          </div>

          <div className="space-y-1 max-w-md">
            <Label className="text-xs">Semanas visibles en asignación rápida desde Historial</Label>
            <Input
              type="number"
              min={1}
              max={52}
              value={ventanaAsignacionHistorial}
              onChange={(e) => setVentanaAsignacionHistorial(e.target.value)}
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              Cantidad de semanas hacia adelante que aparecen en el popover de asignación rápida (tabla "Última participación por categoría"). Las semanas sin programa creado se crearán automáticamente al asignar.
            </p>
          </div>


          <div className="space-y-1">
            <Label className="text-xs">Palabras clave para detectar partes familiares</Label>
            <Textarea
              value={palabrasFamilia}
              onChange={(e) => setPalabrasFamilia(e.target.value)}
              disabled={isLoading}
              rows={2}
              placeholder={PALABRAS_FAMILIA_DEFAULT}
            />
            <p className="text-xs text-muted-foreground">
              Separadas por coma. Cuando el título de una parte contenga alguna de estas palabras, la asignación automática
              preferirá emparejar familiares (cónyuges, padres con hijos, hermanos).
            </p>
          </div>
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
