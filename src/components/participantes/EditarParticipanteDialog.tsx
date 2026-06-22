import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useParticipantes } from "@/hooks/useParticipantes";
import { useGruposPredicacion } from "@/hooks/useGruposPredicacion";
import { useConfiguracionSistema } from "@/hooks/useConfiguracionSistema";
import { IndisponibilidadManager } from "@/components/participantes/IndisponibilidadManager";
import { findDuplicateActivo } from "@/lib/participantes-display";
import { DuplicateParticipanteAliasDialog } from "@/components/participantes/DuplicateParticipanteAliasDialog";

const RESPONSABILIDADES = [
  { value: "publicador", label: "Publicador", abbr: "PB" },
  { value: "publicador_no_bautizado", label: "Publicador No Bautizado", abbr: "PNB" },
  { value: "precursor_regular", label: "Precursor Regular", abbr: "PR" },
  { value: "siervo_ministerial", label: "Siervo Ministerial", abbr: "SM" },
  { value: "anciano", label: "Anciano", abbr: "A" },
  { value: "super_circuito", label: "Super. de Circuito", abbr: "SC" },
];

const RESTRICCIONES = [
  { value: "sin_restriccion", label: "Sin restricción" },
  { value: "solo_fines_semana", label: "Solo fines de semana" },
  { value: "solo_entre_semana", label: "Solo entre semana" },
];

const RESPONSABILIDADES_ADICIONALES = [
  { value: "superintendente_grupo", label: "Superintendente de Grupo (SG)" },
  { value: "auxiliar_grupo", label: "Auxiliar de Grupo (AG)" },
];

const ASIGNACIONES_SERVICIO = [
  { value: "audio", label: "Audio" },
  { value: "video", label: "Video" },
  { value: "zoom", label: "Zoom" },
  { value: "plataforma", label: "Plataforma" },
  { value: "microfono_pasillo_1", label: "Micrófono Pasillo #1" },
  { value: "microfono_pasillo_2", label: "Micrófono Pasillo #2" },
  { value: "acomodador_auditorio", label: "Acomodador Auditorio" },
  { value: "acomodador_entrada_1", label: "Acomodador Entrada #1" },
  { value: "acomodador_entrada_2", label: "Acomodador Entrada #2" },
];

const RESPONSABILIDADES_OPERATIVAS = [
  "anciano", "siervo_ministerial", "publicador", "precursor_regular", "publicador_no_bautizado",
];
const RESPONSABILIDADES_SOLO_VARON = ["anciano", "siervo_ministerial", "super_circuito"];

const DISABLE_RULES: Record<string, string[]> = {
  anciano: ["publicador_no_bautizado", "publicador", "siervo_ministerial", "PIN", "super_circuito"],
  publicador: ["publicador_no_bautizado", "anciano", "siervo_ministerial", "PIN", "super_circuito"],
  precursor_regular: ["super_circuito", "publicador_no_bautizado", "PIN"],
  siervo_ministerial: ["anciano", "publicador", "publicador_no_bautizado", "PIN", "super_circuito"],
  publicador_no_bautizado: ["anciano", "siervo_ministerial", "precursor_regular", "publicador", "PIN", "super_circuito"],
  super_circuito: ["publicador", "precursor_regular", "anciano", "PIN", "publicador_no_bautizado", "siervo_ministerial"],
  PIN: ["publicador", "precursor_regular", "anciano", "publicador_no_bautizado", "siervo_ministerial", "super_circuito"],
};

interface Props {
  participanteId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditarParticipanteDialog({ participanteId, open, onOpenChange }: Props) {
  const { todosParticipantes, actualizarParticipante } = useParticipantes();
  const { grupos } = useGruposPredicacion();
  const { getConfigValue } = useConfiguracionSistema("asignaciones");
  const soloAncianosAcomodador = !!getConfigValue("solo_ancianos_acomodador_auditorio")?.habilitado;

  const participante = participanteId
    ? todosParticipantes.find((p) => p.id === participanteId)
    : null;

  const [formData, setFormData] = useState({
    nombre: "",
    apellido: "",
    activo: true,
    estado_aprobado: false,
    es_capitan_grupo: false,
    es_publicador_inactivo: false,
    responsabilidades: [] as string[],
    responsabilidad_adicional: "_none",
    grupo_predicacion_id: "_none",
    restriccion_disponibilidad: "sin_restriccion",
    asignaciones_servicio: [] as string[],
    es_varon: false,
    es_casado: false,
    tiene_hijos: false,
    inscrito_emc: false,
  });

  const [duplicateDialog, setDuplicateDialog] = useState<{
    open: boolean;
    nombreExistente: string;
    aliasExistente?: string | null;
    pendingData: any | null;
  }>({ open: false, nombreExistente: "", pendingData: null });

  // Hidratar formulario al abrir
  useEffect(() => {
    if (!open || !participante) return;
    const allValues = Array.isArray(participante.responsabilidad)
      ? participante.responsabilidad
      : participante.responsabilidad ? [participante.responsabilidad] : [];
    const asignacionValues = ASIGNACIONES_SERVICIO.map((a) => a.value);
    const responsabilidades = allValues.filter((v) => !asignacionValues.includes(v));
    const asignaciones_servicio = allValues.filter((v) => asignacionValues.includes(v));
    setFormData({
      nombre: participante.nombre,
      apellido: participante.apellido,
      activo: participante.activo ?? true,
      estado_aprobado: participante.estado_aprobado ?? true,
      es_capitan_grupo: participante.es_capitan_grupo ?? false,
      es_publicador_inactivo: (participante as any).es_publicador_inactivo ?? false,
      responsabilidades,
      responsabilidad_adicional: participante.responsabilidad_adicional ?? "_none",
      grupo_predicacion_id: participante.grupo_predicacion_id ?? "_none",
      restriccion_disponibilidad: participante.restriccion_disponibilidad ?? "sin_restriccion",
      asignaciones_servicio,
      es_varon: ((participante as any).genero ?? "M") !== "F",
      es_casado: (participante as any).es_casado ?? false,
      tiene_hijos: (participante as any).tiene_hijos ?? false,
      inscrito_emc: (participante as any).inscrito_emc ?? false,
    });
  }, [open, participante?.id]);

  const esSuperCircuitoForm = formData.responsabilidades.includes("super_circuito");
  const tieneResponsabilidadOperativa = formData.responsabilidades.some((r) => RESPONSABILIDADES_OPERATIVAS.includes(r));
  const mostrarBloquePersonal = tieneResponsabilidadOperativa && !formData.es_publicador_inactivo && !esSuperCircuitoForm;
  const mostrarGrupoPredicacion = !esSuperCircuitoForm;
  const mostrarResponsabilidadAdicional =
    !formData.es_publicador_inactivo && !esSuperCircuitoForm &&
    (formData.responsabilidades.includes("anciano") || formData.responsabilidades.includes("siervo_ministerial"));

  const isRespDisabled = (target: string) => {
    const selected = [
      ...formData.responsabilidades,
      ...(formData.es_publicador_inactivo ? ["PIN"] : []),
    ];
    return selected.some((sel) => sel !== target && DISABLE_RULES[sel]?.includes(target));
  };

  const toggleResponsabilidad = (value: string) => {
    const current = formData.responsabilidades;
    if (current.includes(value)) {
      const nuevas = current.filter((r) => r !== value);
      const quedaOperativa = nuevas.some((r) => RESPONSABILIDADES_OPERATIVAS.includes(r));
      if (!quedaOperativa) {
        setFormData({
          ...formData, responsabilidades: nuevas,
          es_varon: false, es_casado: false, tiene_hijos: false,
          estado_aprobado: false, es_capitan_grupo: false, inscrito_emc: false,
        });
      } else {
        setFormData({ ...formData, responsabilidades: nuevas });
      }
    } else {
      if (value === "super_circuito" || value === "anciano" || value === "siervo_ministerial") {
        setFormData({
          ...formData, responsabilidades: [...current, value],
          es_varon: true, estado_aprobado: true, es_capitan_grupo: true, inscrito_emc: true,
        });
      } else {
        setFormData({ ...formData, responsabilidades: [...current, value] });
      }
    }
  };

  const handleVaronChange = (esVaron: boolean) => {
    if (!esVaron) {
      setFormData({
        ...formData,
        es_varon: false, estado_aprobado: false, es_capitan_grupo: false,
        responsabilidades: formData.responsabilidades.filter((r) => !RESPONSABILIDADES_SOLO_VARON.includes(r)),
        restriccion_disponibilidad: "sin_restriccion",
        asignaciones_servicio: [],
      });
    } else {
      setFormData({ ...formData, es_varon: true });
    }
  };

  const toggleAsignacionServicio = (value: string) => {
    const current = formData.asignaciones_servicio;
    setFormData({
      ...formData,
      asignaciones_servicio: current.includes(value)
        ? current.filter((a) => a !== value)
        : [...current, value],
    });
  };

  const todasAsignacionesSeleccionadas = formData.asignaciones_servicio.length === ASIGNACIONES_SERVICIO.length;
  const seleccionarTodasAsignaciones = () =>
    setFormData({ ...formData, asignaciones_servicio: ASIGNACIONES_SERVICIO.map((a) => a.value) });
  const eliminarTodasAsignaciones = () => setFormData({ ...formData, asignaciones_servicio: [] });

  const persist = (dataToSave: any) => {
    if (!participanteId) return;
    actualizarParticipante.mutate(
      { id: participanteId, ...dataToSave },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!participanteId) return;
    const esAncianoOSM =
      formData.responsabilidades.includes("anciano") || formData.responsabilidades.includes("siervo_ministerial");
    const isDisabled = !formData.activo || formData.es_publicador_inactivo;
    const esSC = formData.responsabilidades.includes("super_circuito");

    const esAncianoForm = formData.responsabilidades.includes("anciano");
    const asignacionesFiltradas =
      soloAncianosAcomodador && !esAncianoForm
        ? formData.asignaciones_servicio.filter((a) => a !== "acomodador_auditorio")
        : formData.asignaciones_servicio;

    const responsabilidadCombinada = isDisabled || esSC
      ? formData.responsabilidades
      : [...formData.responsabilidades,
         ...(formData.es_varon && formData.estado_aprobado ? asignacionesFiltradas : [])];

    const existingAlias = (participante as any)?.alias ?? null;

    const dataToSave = {
      nombre: formData.nombre,
      apellido: formData.apellido,
      activo: formData.activo,
      estado_aprobado: isDisabled ? false : formData.estado_aprobado,
      responsabilidad: responsabilidadCombinada,
      responsabilidad_adicional: isDisabled
        ? null
        : (esAncianoOSM && formData.responsabilidad_adicional !== "_none"
          ? formData.responsabilidad_adicional
          : null),
      grupo_predicacion_id: esSC ? null : (formData.grupo_predicacion_id === "_none" ? null : formData.grupo_predicacion_id || null),
      restriccion_disponibilidad: isDisabled || esSC ? "sin_restriccion" : formData.restriccion_disponibilidad,
      es_capitan_grupo: isDisabled ? false : (esSC ? true : formData.es_capitan_grupo),
      es_publicador_inactivo: formData.es_publicador_inactivo,
      genero: formData.es_varon ? "M" : "F",
      es_casado: formData.es_varon ? formData.es_casado : false,
      tiene_hijos: formData.es_varon && formData.es_casado ? formData.tiene_hijos : false,
      inscrito_emc: formData.inscrito_emc,
      alias: existingAlias,
    } as any;

    const duplicado = findDuplicateActivo(
      todosParticipantes ?? [],
      formData.nombre,
      formData.apellido,
      participanteId,
    );

    if (duplicado) {
      setDuplicateDialog({
        open: true,
        nombreExistente: `${duplicado.nombre} ${duplicado.apellido}`,
        aliasExistente: (duplicado as any).alias ?? null,
        pendingData: dataToSave,
      });
      return;
    }
    persist(dataToSave);
  };

  if (!participanteId) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Editar Participante</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ep-nombre">Nombre *</Label>
                <Input
                  id="ep-nombre"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ep-apellido">Apellido *</Label>
                <Input
                  id="ep-apellido"
                  value={formData.apellido}
                  onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="ep-inactivo"
                  checked={!formData.activo}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, activo: !(checked as boolean) })
                  }
                />
                <Label htmlFor="ep-inactivo" className="cursor-pointer text-destructive">
                  Inactivar
                </Label>
              </div>
            </div>

            <div className={!formData.activo ? "opacity-50 pointer-events-none space-y-4" : "space-y-4"}>
              <div className="space-y-2">
                <Label>Responsabilidad(es)</Label>
                <div className="p-3 border rounded-md bg-background">
                  <div className="grid grid-cols-2 gap-2">
                    {RESPONSABILIDADES.map((r) => {
                      const disabledByRule = isRespDisabled(r.value);
                      return (
                        <div key={r.value} className="flex items-center space-x-2">
                          <Checkbox
                            id={`ep-resp-${r.value}`}
                            checked={formData.responsabilidades.includes(r.value)}
                            onCheckedChange={() => toggleResponsabilidad(r.value)}
                            disabled={disabledByRule || !formData.activo}
                          />
                          <Label
                            htmlFor={`ep-resp-${r.value}`}
                            className={`cursor-pointer text-sm ${disabledByRule ? "opacity-50" : ""}`}
                          >
                            {r.label} ({r.abbr})
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center space-x-2 mt-2">
                    <Checkbox
                      id="ep-pin"
                      checked={formData.es_publicador_inactivo}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, es_publicador_inactivo: checked as boolean })
                      }
                      disabled={!formData.activo || isRespDisabled("PIN")}
                    />
                    <Label
                      htmlFor="ep-pin"
                      className={`cursor-pointer text-sm ${isRespDisabled("PIN") ? "opacity-50" : ""}`}
                    >
                      Publicador Inactivo (PIN)
                    </Label>
                  </div>
                </div>
              </div>

              {mostrarBloquePersonal && (
                <div className="p-3 border rounded-md bg-background">
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="ep-varon"
                        checked={formData.es_varon}
                        onCheckedChange={(checked) => handleVaronChange(checked as boolean)}
                        disabled={!formData.activo}
                      />
                      <Label htmlFor="ep-varon" className="cursor-pointer">Varón</Label>
                    </div>
                    {formData.es_varon && (
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="ep-aprobado"
                          checked={formData.estado_aprobado}
                          onCheckedChange={(checked) =>
                            setFormData({ ...formData, estado_aprobado: checked as boolean })
                          }
                          disabled={!formData.activo}
                        />
                        <Label htmlFor="ep-aprobado" className="cursor-pointer">Aprobado</Label>
                      </div>
                    )}
                    {formData.es_varon && (
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="ep-capitan"
                          checked={formData.es_capitan_grupo}
                          onCheckedChange={(checked) =>
                            setFormData({ ...formData, es_capitan_grupo: checked as boolean })
                          }
                          disabled={!formData.activo}
                        />
                        <Label htmlFor="ep-capitan" className="cursor-pointer">Capitán de Grupo</Label>
                      </div>
                    )}
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="ep-emc"
                        checked={formData.inscrito_emc}
                        onCheckedChange={(checked) =>
                          setFormData({ ...formData, inscrito_emc: checked as boolean })
                        }
                      />
                      <Label htmlFor="ep-emc" className="cursor-pointer">SMM</Label>
                    </div>
                    {formData.es_varon && (
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="ep-casado"
                          checked={formData.es_casado}
                          onCheckedChange={(checked) =>
                            setFormData({
                              ...formData,
                              es_casado: checked as boolean,
                              tiene_hijos: checked ? formData.tiene_hijos : false,
                            })
                          }
                        />
                        <Label htmlFor="ep-casado" className="cursor-pointer">Casado</Label>
                      </div>
                    )}
                    {formData.es_varon && formData.es_casado && (
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="ep-hijos"
                          checked={formData.tiene_hijos}
                          onCheckedChange={(checked) =>
                            setFormData({ ...formData, tiene_hijos: checked as boolean })
                          }
                        />
                        <Label htmlFor="ep-hijos" className="cursor-pointer">Tiene hijos</Label>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {mostrarGrupoPredicacion && (
                <div className="space-y-2">
                  <Label htmlFor="ep-grupo">Grupo de Predicación *</Label>
                  <Select
                    value={formData.grupo_predicacion_id}
                    onValueChange={(value) => setFormData({ ...formData, grupo_predicacion_id: value })}
                    disabled={!formData.activo}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione un grupo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Sin asignar</SelectItem>
                      {grupos?.map((grupo) => (
                        <SelectItem key={grupo.id} value={grupo.id}>
                          Grupo {grupo.numero}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {mostrarResponsabilidadAdicional && (
                <div className="space-y-2">
                  <Label htmlFor="ep-resp-add">Responsabilidad Adicional</Label>
                  <Select
                    value={formData.responsabilidad_adicional}
                    onValueChange={(value) => setFormData({ ...formData, responsabilidad_adicional: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione responsabilidad adicional" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Sin responsabilidad adicional</SelectItem>
                      {RESPONSABILIDADES_ADICIONALES.map((r) => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {formData.es_varon && formData.estado_aprobado && !esSuperCircuitoForm && (
                <div className={`space-y-2 ${formData.es_publicador_inactivo ? "opacity-50 pointer-events-none" : ""}`}>
                  <Label htmlFor="ep-restriccion">Restricción de Disponibilidad</Label>
                  <Select
                    value={formData.restriccion_disponibilidad}
                    onValueChange={(value) => setFormData({ ...formData, restriccion_disponibilidad: value })}
                    disabled={formData.es_publicador_inactivo || !formData.activo}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione restricción" />
                    </SelectTrigger>
                    <SelectContent>
                      {RESTRICCIONES.map((r) => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {formData.es_varon && formData.estado_aprobado && !esSuperCircuitoForm && (
                <div className={`space-y-2 ${formData.es_publicador_inactivo ? "opacity-50 pointer-events-none" : ""}`}>
                  <div className="flex items-center justify-between">
                    <Label>Asignaciones de Servicio</Label>
                    <button
                      type="button"
                      onClick={todasAsignacionesSeleccionadas ? eliminarTodasAsignaciones : seleccionarTodasAsignaciones}
                      className="text-sm text-primary hover:underline"
                      disabled={formData.es_publicador_inactivo || !formData.activo}
                    >
                      {todasAsignacionesSeleccionadas ? "Eliminar todas" : "Seleccionar todas"}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 p-3 border rounded-md bg-background max-h-48 overflow-y-auto">
                    {ASIGNACIONES_SERVICIO.map((a) => {
                      const esAnciano = formData.responsabilidades.includes("anciano");
                      const bloqueadoPorAnciano = soloAncianosAcomodador && a.value === "acomodador_auditorio" && !esAnciano;
                      const disabled = formData.es_publicador_inactivo || !formData.activo || bloqueadoPorAnciano;
                      return (
                        <div key={a.value} className={`flex items-center space-x-2 ${bloqueadoPorAnciano ? "opacity-50" : ""}`}>
                          <Checkbox
                            id={`ep-asig-${a.value}`}
                            checked={formData.asignaciones_servicio.includes(a.value) && !bloqueadoPorAnciano}
                            onCheckedChange={() => toggleAsignacionServicio(a.value)}
                            disabled={disabled}
                          />
                          <Label htmlFor={`ep-asig-${a.value}`} className={`text-sm ${disabled ? "" : "cursor-pointer"}`}>
                            {a.label}
                            {bloqueadoPorAnciano && <span className="ml-1 text-xs text-muted-foreground">(Solo A)</span>}
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {participanteId && !formData.es_publicador_inactivo && formData.activo && !esSuperCircuitoForm && (
              <div className="border-t pt-4">
                <IndisponibilidadManager
                  participanteId={participanteId}
                  participanteNombre={`${formData.nombre} ${formData.apellido}`}
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={actualizarParticipante.isPending}>
                Actualizar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <DuplicateParticipanteAliasDialog
        open={duplicateDialog.open}
        nombreExistente={duplicateDialog.nombreExistente}
        aliasExistente={duplicateDialog.aliasExistente}
        isSaving={actualizarParticipante.isPending}
        onCancel={() => setDuplicateDialog({ open: false, nombreExistente: "", pendingData: null })}
        onConfirm={(alias) => {
          const data = { ...(duplicateDialog.pendingData || {}), alias };
          setDuplicateDialog({ open: false, nombreExistente: "", pendingData: null });
          persist(data);
        }}
      />
    </>
  );
}
