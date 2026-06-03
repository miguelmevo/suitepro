import { useState } from "react";
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
import { toast } from "sonner";
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

const RESPONSABILIDADES_ADICIONALES = [
  { value: "superintendente_grupo", label: "Superintendente de Grupo (SG)" },
  { value: "auxiliar_grupo", label: "Auxiliar de Grupo (AG)" },
];

const RESPONSABILIDADES_OPERATIVAS = [
  "anciano",
  "siervo_ministerial",
  "publicador",
  "precursor_regular",
  "publicador_no_bautizado",
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
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (nuevoId: string) => void;
  initialNombre?: string;
  initialApellido?: string;
}

const INITIAL = {
  nombre: "",
  apellido: "",
  estado_aprobado: false,
  es_capitan_grupo: false,
  es_publicador_inactivo: false,
  responsabilidades: [] as string[],
  responsabilidad_adicional: "_none",
  grupo_predicacion_id: "_none",
  es_varon: false,
  es_casado: false,
  tiene_hijos: false,
  inscrito_emc: false,
};

export function CrearParticipanteRapidoModal({ open, onOpenChange, onCreated, initialNombre, initialApellido }: Props) {
  const { crearParticipante, todosParticipantes } = useParticipantes();
  const { grupos } = useGruposPredicacion();
  const [formData, setFormData] = useState({
    ...INITIAL,
    nombre: initialNombre ?? "",
    apellido: initialApellido ?? "",
  });

  // Re-sincroniza cuando se abre el modal con nuevos valores iniciales
  useEffect(() => {
    if (open) {
      setFormData({
        ...INITIAL,
        nombre: initialNombre ?? "",
        apellido: initialApellido ?? "",
      });
    }
  }, [open, initialNombre, initialApellido]);
  const [duplicateDialog, setDuplicateDialog] = useState<{
    open: boolean;
    nombreExistente: string;
    aliasExistente?: string | null;
  }>({ open: false, nombreExistente: "" });

  const esSuperCircuito = formData.responsabilidades.includes("super_circuito");
  const tieneOperativa = formData.responsabilidades.some((r) => RESPONSABILIDADES_OPERATIVAS.includes(r));
  const mostrarBloquePersonal = tieneOperativa && !formData.es_publicador_inactivo && !esSuperCircuito;
  const mostrarGrupoPredicacion = !esSuperCircuito;
  const mostrarResponsabilidadAdicional =
    !formData.es_publicador_inactivo &&
    !esSuperCircuito &&
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
          ...formData,
          responsabilidades: nuevas,
          es_varon: false,
          es_casado: false,
          tiene_hijos: false,
          estado_aprobado: false,
          es_capitan_grupo: false,
          inscrito_emc: false,
        });
      } else {
        setFormData({ ...formData, responsabilidades: nuevas });
      }
    } else {
      if (value === "super_circuito" || value === "anciano" || value === "siervo_ministerial") {
        setFormData({
          ...formData,
          responsabilidades: [...current, value],
          es_varon: true,
          estado_aprobado: true,
          es_capitan_grupo: true,
          inscrito_emc: true,
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
        es_varon: false,
        estado_aprobado: false,
        es_capitan_grupo: false,
        responsabilidades: formData.responsabilidades.filter((r) => !RESPONSABILIDADES_SOLO_VARON.includes(r)),
      });
    } else {
      setFormData({ ...formData, es_varon: true });
    }
  };

  const handleClose = (v: boolean) => {
    onOpenChange(v);
    if (!v) setFormData(INITIAL);
  };

  const buildDataToSave = (alias: string | null) => {
    const isDisabled = formData.es_publicador_inactivo;
    const esAncianoOSM =
      formData.responsabilidades.includes("anciano") || formData.responsabilidades.includes("siervo_ministerial");

    return {
      nombre: formData.nombre.trim(),
      apellido: formData.apellido.trim(),
      activo: true,
      estado_aprobado: isDisabled ? false : formData.estado_aprobado,
      responsabilidad: formData.responsabilidades,
      responsabilidad_adicional:
        isDisabled
          ? null
          : esAncianoOSM && formData.responsabilidad_adicional !== "_none"
            ? formData.responsabilidad_adicional
            : null,
      grupo_predicacion_id: esSuperCircuito
        ? null
        : formData.grupo_predicacion_id === "_none"
          ? null
          : formData.grupo_predicacion_id,
      restriccion_disponibilidad: "sin_restriccion",
      es_capitan_grupo: isDisabled ? false : esSuperCircuito ? true : formData.es_capitan_grupo,
      es_publicador_inactivo: formData.es_publicador_inactivo,
      genero: formData.es_varon ? "M" : "F",
      es_casado: formData.es_varon ? formData.es_casado : false,
      tiene_hijos: formData.es_varon && formData.es_casado ? formData.tiene_hijos : false,
      inscrito_emc: formData.inscrito_emc,
      alias,
    } as any;
  };

  const ejecutarCreacion = async (alias: string | null) => {
    try {
      const nuevo = await crearParticipante.mutateAsync(buildDataToSave(alias));
      if (nuevo?.id && onCreated) onCreated(nuevo.id);
      setDuplicateDialog({ open: false, nombreExistente: "" });
      handleClose(false);
    } catch (err: any) {
      toast.error("Error al crear participante: " + (err?.message ?? ""));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nombre = formData.nombre.trim();
    const apellido = formData.apellido.trim();
    if (!nombre || !apellido) return;

    const duplicado = findDuplicateActivo(todosParticipantes ?? [], nombre, apellido);
    if (duplicado) {
      setDuplicateDialog({
        open: true,
        nombreExistente: `${duplicado.nombre} ${duplicado.apellido}`,
        aliasExistente: (duplicado as any).alias ?? null,
      });
      return;
    }

    await ejecutarCreacion(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Nuevo Participante</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="qp-nombre">Nombre *</Label>
              <Input
                id="qp-nombre"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="qp-apellido">Apellido *</Label>
              <Input
                id="qp-apellido"
                value={formData.apellido}
                onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Responsabilidad(es)</Label>
            <div className="p-3 border rounded-md bg-background">
              <div className="grid grid-cols-2 gap-2">
                {RESPONSABILIDADES.map((r) => {
                  const disabledByRule = isRespDisabled(r.value);
                  return (
                    <div key={r.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`qp-resp-${r.value}`}
                        checked={formData.responsabilidades.includes(r.value)}
                        onCheckedChange={() => toggleResponsabilidad(r.value)}
                        disabled={disabledByRule}
                      />
                      <Label
                        htmlFor={`qp-resp-${r.value}`}
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
                  id="qp-pin"
                  checked={formData.es_publicador_inactivo}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, es_publicador_inactivo: checked as boolean })
                  }
                  disabled={isRespDisabled("PIN")}
                />
                <Label
                  htmlFor="qp-pin"
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
                    id="qp-varon"
                    checked={formData.es_varon}
                    onCheckedChange={(checked) => handleVaronChange(checked as boolean)}
                  />
                  <Label htmlFor="qp-varon" className="cursor-pointer">Varón</Label>
                </div>
                {formData.es_varon && (
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="qp-aprobado"
                      checked={formData.estado_aprobado}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, estado_aprobado: checked as boolean })
                      }
                    />
                    <Label htmlFor="qp-aprobado" className="cursor-pointer">Aprobado</Label>
                  </div>
                )}
                {formData.es_varon && (
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="qp-capitan"
                      checked={formData.es_capitan_grupo}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, es_capitan_grupo: checked as boolean })
                      }
                    />
                    <Label htmlFor="qp-capitan" className="cursor-pointer">Capitán de Grupo</Label>
                  </div>
                )}
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="qp-emc"
                    checked={formData.inscrito_emc}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, inscrito_emc: checked as boolean })
                    }
                  />
                  <Label htmlFor="qp-emc" className="cursor-pointer">EMC</Label>
                </div>
                {formData.es_varon && (
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="qp-casado"
                      checked={formData.es_casado}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          es_casado: checked as boolean,
                          tiene_hijos: checked ? formData.tiene_hijos : false,
                        })
                      }
                    />
                    <Label htmlFor="qp-casado" className="cursor-pointer">Casado</Label>
                  </div>
                )}
                {formData.es_varon && formData.es_casado && (
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="qp-hijos"
                      checked={formData.tiene_hijos}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, tiene_hijos: checked as boolean })
                      }
                    />
                    <Label htmlFor="qp-hijos" className="cursor-pointer">Tiene hijos</Label>
                  </div>
                )}
              </div>
            </div>
          )}

          {mostrarResponsabilidadAdicional && (
            <div className="space-y-2">
              <Label htmlFor="qp-resp-add">Responsabilidad Adicional</Label>
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

          {mostrarGrupoPredicacion && (
            <div className="space-y-2">
              <Label htmlFor="qp-grupo">Grupo de Predicación</Label>
              <Select
                value={formData.grupo_predicacion_id}
                onValueChange={(value) => setFormData({ ...formData, grupo_predicacion_id: value })}
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

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => handleClose(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={crearParticipante.isPending}>
              Crear
            </Button>
          </div>
        </form>
      </DialogContent>

      <DuplicateParticipanteAliasDialog
        open={duplicateDialog.open}
        nombreExistente={duplicateDialog.nombreExistente}
        aliasExistente={duplicateDialog.aliasExistente}
        isSaving={crearParticipante.isPending}
        onCancel={() => setDuplicateDialog({ open: false, nombreExistente: "" })}
        onConfirm={(alias) => ejecutarCreacion(alias)}
      />
    </Dialog>
  );
}
