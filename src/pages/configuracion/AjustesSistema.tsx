import { useState, useEffect, useMemo } from "react";
import { Settings, Save, Info, Globe, Calendar, Plus, Pencil, Trash2, X, Check, Building, Palette, Users } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useConfiguracionSistema } from "@/hooks/useConfiguracionSistema";
import { useGruposPredicacion } from "@/hooks/useGruposPredicacion";
import { useDiasEspeciales, DiaEspecial } from "@/hooks/useDiasEspeciales";
import { useCongregacion } from "@/contexts/CongregacionContext";
import { useReunionPublica } from "@/hooks/useReunionPublica";
import { useParticipantes } from "@/hooks/useParticipantes";
import { ColorSelector } from "@/components/congregaciones/ColorSelector";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { applyColorTheme } from "@/lib/congregation-colors";

const BLOQUEO_OPTIONS = [
  { value: "completo", label: "Día completo" },
  { value: "manana", label: "Solo mañana" },
  { value: "tarde", label: "Solo tarde" },
];

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
  const { sincronizarGrupos } = useGruposPredicacion();
  const { diasEspeciales, crearDiaEspecial, actualizarDiaEspecial, eliminarDiaEspecial, isLoading: loadingDias } = useDiasEspeciales();
  const { congregacionActual } = useCongregacion();
  const { toast } = useToast();
  
  // Estado para configuración General (transversal)
  const [nombreCongregacion, setNombreCongregacion] = useState("");
  const [colorPrimario, setColorPrimario] = useState("blue");
  const [diaEntreSemana, setDiaEntreSemana] = useState("martes");
  const [horaEntreSemana, setHoraEntreSemana] = useState("19:00");
  const [diaFinSemana, setDiaFinSemana] = useState("domingo");
  const [horaFinSemana, setHoraFinSemana] = useState("10:00");
  const [numeroGrupos, setNumeroGrupos] = useState("10");

  // Estado para Asignaciones
  const [validacionConsecutiva, setValidacionConsecutiva] = useState(true);
  const [mostrarNota, setMostrarNota] = useState(true);
  const [textoNota, setTextoNota] = useState("");

  // Estado para Predicación
  const [cantidadHistorial, setCantidadHistorial] = useState("6");
  const [linkRegistroManzanas, setLinkRegistroManzanas] = useState("");
  const [letraMaximaManzanas, setLetraMaximaManzanas] = useState("P");

  // Estado para días especiales
  const [nuevoDia, setNuevoDia] = useState({ nombre: "", bloqueo_tipo: "completo" as "completo" | "manana" | "tarde" });
  const [editandoDia, setEditandoDia] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ nombre: "", bloqueo_tipo: "completo" as "completo" | "manana" | "tarde" });

  // Cargar valores existentes
  useEffect(() => {
    if (configuraciones) {
      // Nombre de la congregación
      const nombreConfig = configuraciones.find(
        (c) => c.programa_tipo === "general" && c.clave === "nombre_congregacion"
      );
      if (nombreConfig?.valor) {
        const valor = nombreConfig.valor;
        setNombreCongregacion(typeof valor === 'object' && valor.nombre ? valor.nombre : (typeof valor === 'string' ? valor : ""));
      }

      // Cargar color de la congregación actual
      if (congregacionActual?.color_primario) {
        setColorPrimario(congregacionActual.color_primario);
      }

      // General (transversal)
      const diasReunion = configuraciones.find(
        (c) => c.programa_tipo === "general" && c.clave === "dias_reunion"
      );
      if (diasReunion?.valor) {
        setDiaEntreSemana(diasReunion.valor.dia_entre_semana || "martes");
        setHoraEntreSemana(diasReunion.valor.hora_entre_semana || "19:00");
        setDiaFinSemana(diasReunion.valor.dia_fin_semana || "domingo");
        setHoraFinSemana(diasReunion.valor.hora_fin_semana || "10:00");
      }

      const gruposConfig = configuraciones.find(
        (c) => c.programa_tipo === "general" && c.clave === "numero_grupos"
      );
      if (gruposConfig?.valor) {
        setNumeroGrupos(String(gruposConfig.valor.cantidad) || "10");
      }

      // Asignaciones
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

      // Predicación
      const historialConfig = configuraciones.find(
        (c) => c.programa_tipo === "predicacion" && c.clave === "cantidad_historial"
      );
      if (historialConfig?.valor) {
        setCantidadHistorial(String(historialConfig.valor.cantidad) || "6");
      }

      const linkManzanasConfig = configuraciones.find(
        (c) => c.programa_tipo === "predicacion" && c.clave === "link_registro_manzanas"
      );
      if (linkManzanasConfig?.valor) {
        setLinkRegistroManzanas(linkManzanasConfig.valor.url || "");
      }

      const letraManzanasConfig = configuraciones.find(
        (c) => c.programa_tipo === "predicacion" && c.clave === "letra_maxima_manzanas"
      );
      if (letraManzanasConfig?.valor) {
        setLetraMaximaManzanas(letraManzanasConfig.valor.letra || "P");
      }
    }
  }, [configuraciones]);

  const handleGuardarGeneral = async () => {
    // Guardar nombre de la congregación (siempre en mayúsculas)
    await actualizarConfiguracion.mutateAsync({
      programaTipo: "general",
      clave: "nombre_congregacion",
      valor: { nombre: nombreCongregacion.toUpperCase() },
    });

    // Guardar color de la congregación en la tabla congregaciones
    if (congregacionActual) {
      const { error } = await supabase
        .from("congregaciones")
        .update({ color_primario: colorPrimario })
        .eq("id", congregacionActual.id);
      
      if (error) {
        toast({
          title: "Error",
          description: "No se pudo guardar el color",
          variant: "destructive",
        });
      } else {
        // Aplicar el nuevo color inmediatamente
        applyColorTheme(colorPrimario);
      }
    }

    await actualizarConfiguracion.mutateAsync({
      programaTipo: "general",
      clave: "dias_reunion",
      valor: {
        dia_entre_semana: diaEntreSemana,
        hora_entre_semana: horaEntreSemana,
        dia_fin_semana: diaFinSemana,
        hora_fin_semana: horaFinSemana,
      },
    });
    await actualizarConfiguracion.mutateAsync({
      programaTipo: "general",
      clave: "numero_grupos",
      valor: { cantidad: parseInt(numeroGrupos) },
    });
    // Sincronizar grupos después de guardar
    sincronizarGrupos.mutate(parseInt(numeroGrupos));
  };

  const handleGuardarAsignaciones = async () => {
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

  const handleCrearDiaEspecial = () => {
    if (!nuevoDia.nombre.trim()) return;
    crearDiaEspecial.mutate({
      nombre: nuevoDia.nombre.trim(),
      bloqueo_tipo: nuevoDia.bloqueo_tipo,
    });
    setNuevoDia({ nombre: "", bloqueo_tipo: "completo" });
  };

  const handleEditarDia = (dia: DiaEspecial) => {
    setEditandoDia(dia.id);
    setEditForm({ nombre: dia.nombre, bloqueo_tipo: dia.bloqueo_tipo });
  };

  const handleGuardarEdicion = () => {
    if (!editandoDia || !editForm.nombre.trim()) return;
    actualizarDiaEspecial.mutate({
      id: editandoDia,
      nombre: editForm.nombre.trim(),
      bloqueo_tipo: editForm.bloqueo_tipo,
    });
    setEditandoDia(null);
  };

  const getBloqueoLabel = (tipo: string) => {
    return BLOQUEO_OPTIONS.find(o => o.value === tipo)?.label || tipo;
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
            <p className="text-muted-foreground">Configura los parámetros generales y específicos de cada programa</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-6 lg:w-auto lg:inline-flex">
          <TabsTrigger value="general" className="text-xs sm:text-sm">General</TabsTrigger>
          <TabsTrigger value="asignaciones" className="text-xs sm:text-sm">Asignaciones</TabsTrigger>
          <TabsTrigger value="vida-ministerio" className="text-xs sm:text-sm">Vida y Ministerio</TabsTrigger>
          <TabsTrigger value="reunion-publica" className="text-xs sm:text-sm">Reunión Pública</TabsTrigger>
          <TabsTrigger value="predicacion" className="text-xs sm:text-sm">Predicación</TabsTrigger>
          <TabsTrigger value="carritos" className="text-xs sm:text-sm">Carritos</TabsTrigger>
        </TabsList>

        {/* Tab: General (Transversal) */}
        <TabsContent value="general" className="space-y-4 mt-6">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <Building className="h-5 w-5 text-primary" />
                <CardTitle className="text-primary text-lg">Información de la Congregación</CardTitle>
              </div>
              <CardDescription>
                Configura el nombre de la congregación que se mostrará en el sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Nombre de la Congregación</Label>
                <Input
                  placeholder="Ej: VILLA REAL"
                  value={nombreCongregacion}
                  onChange={(e) => setNombreCongregacion(e.target.value.toUpperCase())}
                  className="max-w-md uppercase"
                />
                <p className="text-xs text-muted-foreground">
                  Este nombre se mostrará en el encabezado del sistema
                </p>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <Palette className="h-4 w-4 text-muted-foreground" />
                  <Label>Color del Tema</Label>
                </div>
                <ColorSelector
                  value={colorPrimario}
                  onChange={setColorPrimario}
                  label=""
                />
                <p className="text-xs text-muted-foreground">
                  Define el color principal de la interfaz para esta congregación
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" />
                <CardTitle className="text-primary text-lg">Días de Reunión</CardTitle>
              </div>
              <CardDescription>
                Configuración transversal que aplica a todos los programas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Día Entre Semana</Label>
                      <Select value={diaEntreSemana} onValueChange={setDiaEntreSemana}>
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
                    </div>
                    <div className="space-y-2">
                      <Label>Hora</Label>
                      <Input
                        type="time"
                        value={horaEntreSemana}
                        onChange={(e) => setHoraEntreSemana(e.target.value)}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Reunión Vida y Ministerio Cristiano</p>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Día Fin de Semana</Label>
                      <Select value={diaFinSemana} onValueChange={setDiaFinSemana}>
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
                    </div>
                    <div className="space-y-2">
                      <Label>Hora</Label>
                      <Input
                        type="time"
                        value={horaFinSemana}
                        onChange={(e) => setHoraFinSemana(e.target.value)}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Reunión Pública</p>
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
                  Los grupos de predicación se mostrarán dinámicamente en la página de Grupos de Predicación
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                <CardTitle className="text-primary text-lg">Días Especiales</CardTitle>
              </div>
              <CardDescription>
                Configura asambleas, conmemoración y otros eventos que afectan los programas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Formulario para agregar */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-3 bg-muted/50 rounded-lg">
                <div className="space-y-1">
                  <Label className="text-xs">Nombre del evento</Label>
                  <Input
                    placeholder="Ej: Asamblea de Circuito"
                    value={nuevoDia.nombre}
                    onChange={(e) => setNuevoDia({ ...nuevoDia, nombre: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Bloqueo</Label>
                  <Select 
                    value={nuevoDia.bloqueo_tipo} 
                    onValueChange={(v) => setNuevoDia({ ...nuevoDia, bloqueo_tipo: v as "completo" | "manana" | "tarde" })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BLOQUEO_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button 
                    onClick={handleCrearDiaEspecial} 
                    disabled={!nuevoDia.nombre.trim() || crearDiaEspecial.isPending}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Agregar
                  </Button>
                </div>
              </div>

              {/* Lista de días especiales */}
              {loadingDias ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
                </div>
              ) : diasEspeciales.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-4">
                  No hay días especiales configurados
                </p>
              ) : (
                <div className="space-y-2">
                  {diasEspeciales.map((dia) => (
                    <div 
                      key={dia.id} 
                      className="flex items-center justify-between p-3 border rounded-lg bg-background"
                    >
                      {editandoDia === dia.id ? (
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
                          <Input
                            value={editForm.nombre}
                            onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })}
                          />
                          <Select 
                            value={editForm.bloqueo_tipo} 
                            onValueChange={(v) => setEditForm({ ...editForm, bloqueo_tipo: v as "completo" | "manana" | "tarde" })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {BLOQUEO_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <div className="flex gap-1">
                            <Button size="sm" onClick={handleGuardarEdicion} disabled={actualizarDiaEspecial.isPending}>
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setEditandoDia(null)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-3">
                            <div>
                              <p className="font-medium">{dia.nombre}</p>
                            </div>
                            <Badge variant="secondary" className="text-xs">
                              {getBloqueoLabel(dia.bloqueo_tipo)}
                            </Badge>
                          </div>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" onClick={() => handleEditarDia(dia)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="text-destructive hover:text-destructive"
                              onClick={() => eliminarDiaEspecial.mutate(dia.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Alert className="bg-amber-50 border-amber-200">
            <Info className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              <ul className="list-disc ml-4 space-y-1 text-sm">
                <li>Los días de reunión configurados aquí se utilizan en todos los programas</li>
                <li>Al cambiar el número de grupos, se crearán o desactivarán grupos automáticamente</li>
                <li>Los cambios afectarán los nuevos programas que se generen</li>
              </ul>
            </AlertDescription>
          </Alert>

          <div className="flex justify-end">
            <Button onClick={handleGuardarGeneral} disabled={actualizarConfiguracion.isPending}>
              <Save className="h-4 w-4 mr-2" />
              Guardar
            </Button>
          </div>
        </TabsContent>

        {/* Tab: Programa de Asignaciones */}
        <TabsContent value="asignaciones" className="space-y-4 mt-6">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-primary text-lg">Opciones de Validación</CardTitle>
              <CardDescription>Reglas específicas para el programa de asignaciones</CardDescription>
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
          <ReunionPublicaSettings />
        </TabsContent>

        {/* Tab: Predicación */}
        <TabsContent value="predicacion" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-primary text-lg">Programa de Predicación</CardTitle>
              <CardDescription>Configuración específica para este programa</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Cantidad de programas en Historial</Label>
                <Select value={cantidadHistorial} onValueChange={setCantidadHistorial}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((num) => (
                      <SelectItem key={num} value={String(num)}>
                        {num} {num === 1 ? "programa" : "programas"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Define cuántos programas se mostrarán en la página de Historial
                </p>
              </div>

              <div className="space-y-2">
                <Label>Link de Registro de Manzanas</Label>
                <Input
                  type="url"
                  placeholder="https://forms.google.com/..."
                  value={linkRegistroManzanas}
                  onChange={(e) => setLinkRegistroManzanas(e.target.value)}
                  className="max-w-xl"
                />
                <p className="text-xs text-muted-foreground">
                  Este link (formulario de Google, etc.) aparecerá en la página de detalle de cada territorio para que el capitán registre las manzanas trabajadas
                </p>
              </div>

              <div className="space-y-2">
                <Label>Manzanas disponibles</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Desde la A hasta la</span>
                  <Select value={letraMaximaManzanas} onValueChange={setLetraMaximaManzanas}>
                    <SelectTrigger className="w-[80px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 25 }, (_, i) => String.fromCharCode(66 + i)).map((letra) => (
                        <SelectItem key={letra} value={letra}>
                          {letra}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground">
                  Define hasta qué letra estarán disponibles las manzanas al crear/editar territorios
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button 
              onClick={async () => {
                await actualizarConfiguracion.mutateAsync({
                  programaTipo: "predicacion",
                  clave: "cantidad_historial",
                  valor: { cantidad: parseInt(cantidadHistorial) },
                });
                await actualizarConfiguracion.mutateAsync({
                  programaTipo: "predicacion",
                  clave: "link_registro_manzanas",
                  valor: { url: linkRegistroManzanas },
                });
                await actualizarConfiguracion.mutateAsync({
                  programaTipo: "predicacion",
                  clave: "letra_maxima_manzanas",
                  valor: { letra: letraMaximaManzanas },
                });
              }} 
              disabled={actualizarConfiguracion.isPending}
            >
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

// Componente separado para la configuración de Reunión Pública
function ReunionPublicaSettings() {
  const { conductores, agregarConductor, eliminarConductor, isLoading } = useReunionPublica();
  const { participantes } = useParticipantes();
  const [selectedConductor, setSelectedConductor] = useState<string>("");

  // Filtrar solo ancianos
  const ancianos = useMemo(() => {
    return participantes?.filter(p => 
      p.responsabilidad?.includes("anciano")
    ) || [];
  }, [participantes]);

  // IDs de conductores ya agregados
  const conductoresIds = conductores?.map(c => c.participante_id) || [];

  // Ancianos disponibles para agregar
  const ancianosDisponibles = ancianos.filter(a => !conductoresIds.includes(a.id));

  // Conductores con datos del participante
  const conductoresConDatos = useMemo(() => {
    return conductores?.map(conductor => {
      const participante = participantes?.find(p => p.id === conductor.participante_id);
      return {
        ...conductor,
        nombre: participante?.nombre || "Desconocido",
        apellido: participante?.apellido || "",
      };
    }) || [];
  }, [conductores, participantes]);

  const handleAgregar = async () => {
    if (!selectedConductor) return;
    await agregarConductor.mutateAsync(selectedConductor);
    setSelectedConductor("");
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <CardTitle className="text-primary text-lg">Conductores de La Atalaya</CardTitle>
        </div>
        <CardDescription>
          Selecciona los 3 ancianos que pueden ser asignados como conductores del Estudio de La Atalaya
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Agregar conductor */}
        {conductoresConDatos.length < 3 && (
          <div className="flex gap-2">
            <Select value={selectedConductor} onValueChange={setSelectedConductor}>
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="Seleccionar anciano..." />
              </SelectTrigger>
              <SelectContent>
                {ancianosDisponibles.length > 0 ? (
                  ancianosDisponibles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nombre} {p.apellido}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="_none" disabled>
                    No hay más ancianos disponibles
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            <Button 
              onClick={handleAgregar} 
              disabled={!selectedConductor || agregarConductor.isPending}
            >
              <Plus className="h-4 w-4 mr-2" />
              Agregar
            </Button>
          </div>
        )}

        {conductoresConDatos.length >= 3 && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Ya tienes configurados los 3 conductores máximos permitidos
            </AlertDescription>
          </Alert>
        )}

        {/* Lista de conductores */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">#</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead className="w-[100px]">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {conductoresConDatos.length > 0 ? (
              conductoresConDatos.map((conductor, index) => (
                <TableRow key={conductor.id}>
                  <TableCell className="font-medium">{index + 1}</TableCell>
                  <TableCell>{conductor.nombre} {conductor.apellido}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => eliminarConductor.mutate(conductor.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                  No hay conductores configurados. Agregue hasta 3 ancianos.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
