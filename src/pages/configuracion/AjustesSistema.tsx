import { useState, useEffect } from "react";
import { Settings, Save, Info } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useConfiguracionSistema } from "@/hooks/useConfiguracionSistema";

const DIAS_SEMANA = [
  { value: "lunes", label: "Lunes" },
  { value: "martes", label: "Martes" },
  { value: "miercoles", label: "Miércoles" },
  { value: "jueves", label: "Jueves" },
  { value: "viernes", label: "Viernes" },
  { value: "sabado", label: "Sábado" },
  { value: "domingo", label: "Domingo" },
];

const GRUPOS_OPTIONS = Array.from({ length: 20 }, (_, i) => ({
  value: String(i + 1),
  label: `${i + 1} grupo${i + 1 > 1 ? "s" : ""}`,
}));

export default function AjustesSistema() {
  const { configuraciones, isLoading, actualizarConfiguracion } = useConfiguracionSistema();
  
  // Estado para Predicación
  const [predicacionDiaEntreSemana, setPredicacionDiaEntreSemana] = useState("martes");
  const [predicacionDiaFinSemana, setPredicacionDiaFinSemana] = useState("domingo");
  const [numeroGrupos, setNumeroGrupos] = useState("10");

  // Estado para Asignaciones
  const [asignacionesDiaEntreSemana, setAsignacionesDiaEntreSemana] = useState("martes");
  const [asignacionesDiaFinSemana, setAsignacionesDiaFinSemana] = useState("domingo");
  const [validacionConsecutiva, setValidacionConsecutiva] = useState(true);
  const [mostrarNota, setMostrarNota] = useState(true);
  const [textoNota, setTextoNota] = useState("");

  // Cargar valores existentes
  useEffect(() => {
    if (configuraciones) {
      // Predicación
      const predicacionDias = configuraciones.find(
        (c) => c.programa_tipo === "predicacion" && c.clave === "dias_reunion"
      );
      if (predicacionDias?.valor) {
        setPredicacionDiaEntreSemana(predicacionDias.valor.dia_entre_semana || "martes");
        setPredicacionDiaFinSemana(predicacionDias.valor.dia_fin_semana || "domingo");
      }

      const grupos = configuraciones.find(
        (c) => c.programa_tipo === "predicacion" && c.clave === "numero_grupos"
      );
      if (grupos?.valor) {
        setNumeroGrupos(String(grupos.valor.cantidad) || "10");
      }

      // Asignaciones
      const asignacionesDias = configuraciones.find(
        (c) => c.programa_tipo === "asignaciones" && c.clave === "dias_reunion"
      );
      if (asignacionesDias?.valor) {
        setAsignacionesDiaEntreSemana(asignacionesDias.valor.dia_entre_semana || "martes");
        setAsignacionesDiaFinSemana(asignacionesDias.valor.dia_fin_semana || "domingo");
      }

      const validacion = configuraciones.find(
        (c) => c.programa_tipo === "asignaciones" && c.clave === "validacion_consecutiva"
      );
      if (validacion?.valor) {
        setValidacionConsecutiva(validacion.valor.habilitado ?? true);
      }

      const nota = configuraciones.find(
        (c) => c.programa_tipo === "asignaciones" && c.clave === "nota_asignaciones"
      );
      if (nota?.valor) {
        setMostrarNota(nota.valor.mostrar ?? true);
        setTextoNota(nota.valor.texto || "");
      }
    }
  }, [configuraciones]);

  const handleGuardarPredicacion = async () => {
    await actualizarConfiguracion.mutateAsync({
      programaTipo: "predicacion",
      clave: "dias_reunion",
      valor: {
        dia_entre_semana: predicacionDiaEntreSemana,
        dia_fin_semana: predicacionDiaFinSemana,
      },
    });
    await actualizarConfiguracion.mutateAsync({
      programaTipo: "predicacion",
      clave: "numero_grupos",
      valor: { cantidad: parseInt(numeroGrupos) },
    });
  };

  const handleGuardarAsignaciones = async () => {
    await actualizarConfiguracion.mutateAsync({
      programaTipo: "asignaciones",
      clave: "dias_reunion",
      valor: {
        dia_entre_semana: asignacionesDiaEntreSemana,
        dia_fin_semana: asignacionesDiaFinSemana,
      },
    });
    await actualizarConfiguracion.mutateAsync({
      programaTipo: "asignaciones",
      clave: "validacion_consecutiva",
      valor: { habilitado: validacionConsecutiva },
    });
    await actualizarConfiguracion.mutateAsync({
      programaTipo: "asignaciones",
      clave: "nota_asignaciones",
      valor: { mostrar: mostrarNota, texto: textoNota },
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Configuración del Sistema</h1>
            <p className="text-muted-foreground">Configura los parámetros generales de los programas</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="predicacion" className="w-full">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-flex">
          <TabsTrigger value="asignaciones" className="text-xs sm:text-sm">Asignaciones</TabsTrigger>
          <TabsTrigger value="vida-ministerio" className="text-xs sm:text-sm">Vida y Ministerio</TabsTrigger>
          <TabsTrigger value="reunion-publica" className="text-xs sm:text-sm">Reunión Pública</TabsTrigger>
          <TabsTrigger value="predicacion" className="text-xs sm:text-sm">Predicación</TabsTrigger>
          <TabsTrigger value="carritos" className="text-xs sm:text-sm">Carritos</TabsTrigger>
        </TabsList>

        {/* Tab: Programa de Asignaciones */}
        <TabsContent value="asignaciones" className="space-y-4 mt-6">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-primary text-lg">Días de Reunión</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Día Entre Semana</Label>
                  <Select value={asignacionesDiaEntreSemana} onValueChange={setAsignacionesDiaEntreSemana}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DIAS_SEMANA.map((dia) => (
                        <SelectItem key={dia.value} value={dia.value}>
                          {dia.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Día para la Reunión Vida y Ministerio Cristiano</p>
                </div>
                <div className="space-y-2">
                  <Label>Día Fin de Semana</Label>
                  <Select value={asignacionesDiaFinSemana} onValueChange={setAsignacionesDiaFinSemana}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DIAS_SEMANA.map((dia) => (
                        <SelectItem key={dia.value} value={dia.value}>
                          {dia.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Día para la Reunión Pública</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-primary text-lg">Opciones de Validación</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="validacion-consecutiva"
                  checked={validacionConsecutiva}
                  onCheckedChange={(checked) => setValidacionConsecutiva(checked === true)}
                />
                <div className="space-y-1">
                  <Label htmlFor="validacion-consecutiva" className="font-medium cursor-pointer">
                    No utilizar participantes en 2 reuniones seguidas
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Si está activada, un participante usado en martes no podrá ser usado en el domingo siguiente, y viceversa
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-primary text-lg">Nota en Asignaciones del Día</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="mostrar-nota"
                  checked={mostrarNota}
                  onCheckedChange={(checked) => setMostrarNota(checked === true)}
                />
                <div className="space-y-1">
                  <Label htmlFor="mostrar-nota" className="font-medium cursor-pointer">
                    Mostrar nota al final de asignaciones del día
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Si está activada, se mostrará una nota informativa en la página de inicio
                  </p>
                </div>
              </div>
              {mostrarNota && (
                <div className="space-y-2">
                  <Label>Texto de la nota</Label>
                  <Textarea
                    value={textoNota}
                    onChange={(e) => setTextoNota(e.target.value)}
                    placeholder="Escriba el texto de la nota..."
                    className="min-h-[100px]"
                  />
                  <p className="text-xs text-muted-foreground">
                    Este mensaje aparecerá al final del recuadro de asignaciones del día
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Alert className="bg-amber-50 border-amber-200">
            <Info className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              <ul className="list-disc ml-4 space-y-1 text-sm">
                <li>Los cambios en los días de reunión afectarán los nuevos programas que se generen</li>
                <li>La opción de no consecutivas ayuda a distribuir mejor las asignaciones</li>
              </ul>
            </AlertDescription>
          </Alert>

          <div className="flex justify-end">
            <Button onClick={handleGuardarAsignaciones} disabled={actualizarConfiguracion.isPending}>
              <Save className="h-4 w-4 mr-2" />
              Guardar
            </Button>
          </div>
        </TabsContent>

        {/* Tab: Vida y Ministerio */}
        <TabsContent value="vida-ministerio" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-primary text-lg">Reunión Vida y Ministerio Cristiano</CardTitle>
              <CardDescription>Configuración específica para este programa</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                Próximamente: Configuraciones específicas para el programa de Vida y Ministerio Cristiano.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Reunión Pública */}
        <TabsContent value="reunion-publica" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-primary text-lg">Reunión Pública</CardTitle>
              <CardDescription>Configuración específica para este programa</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                Próximamente: Configuraciones específicas para el programa de Reunión Pública.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Predicación */}
        <TabsContent value="predicacion" className="space-y-4 mt-6">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-primary text-lg">Días de Reunión</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Día Entre Semana</Label>
                  <Select value={predicacionDiaEntreSemana} onValueChange={setPredicacionDiaEntreSemana}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DIAS_SEMANA.map((dia) => (
                        <SelectItem key={dia.value} value={dia.value}>
                          {dia.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Día para la Reunión Vida y Ministerio Cristiano</p>
                </div>
                <div className="space-y-2">
                  <Label>Día Fin de Semana</Label>
                  <Select value={predicacionDiaFinSemana} onValueChange={setPredicacionDiaFinSemana}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DIAS_SEMANA.map((dia) => (
                        <SelectItem key={dia.value} value={dia.value}>
                          {dia.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Día para la Reunión Pública</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-primary text-lg">Configuración de Grupos de Predicación</CardTitle>
              <CardDescription>Define cuántos grupos de predicación tiene la congregación</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Número de Grupos</Label>
                <Select value={numeroGrupos} onValueChange={setNumeroGrupos}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GRUPOS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Los grupos de predicación se mostrarán dinámicamente en la página de Grupos
                </p>
              </div>
            </CardContent>
          </Card>

          <Alert className="bg-amber-50 border-amber-200">
            <Info className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              <ul className="list-disc ml-4 space-y-1 text-sm">
                <li>Los cambios en los días de reunión afectarán los nuevos programas que se generen</li>
                <li>El número de grupos se utilizará para organizar a los participantes</li>
              </ul>
            </AlertDescription>
          </Alert>

          <div className="flex justify-end">
            <Button onClick={handleGuardarPredicacion} disabled={actualizarConfiguracion.isPending}>
              <Save className="h-4 w-4 mr-2" />
              Guardar
            </Button>
          </div>
        </TabsContent>

        {/* Tab: Carritos */}
        <TabsContent value="carritos" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-primary text-lg">Asignación de Carritos</CardTitle>
              <CardDescription>Configuración específica para este programa</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                Próximamente: Configuraciones específicas para el programa de Asignación de Carritos.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
