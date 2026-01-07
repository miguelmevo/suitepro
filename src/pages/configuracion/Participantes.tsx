import { useState } from "react";
import { Plus, Pencil, Trash2, Loader2, Phone, Check, X, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useParticipantes } from "@/hooks/useParticipantes";
import { useGruposPredicacion } from "@/hooks/useGruposPredicacion";
import { CrearUsuarioParticipanteModal } from "@/components/participantes/CrearUsuarioParticipanteModal";
import { useQueryClient } from "@tanstack/react-query";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const RESPONSABILIDADES = [
  { value: "publicador", label: "Publicador", abbr: "PB" },
  { value: "publicador_no_bautizado", label: "Publicador No Bautizado", abbr: "PNB" },
  { value: "precursor_regular", label: "Precursor Regular", abbr: "PR" },
  { value: "siervo_ministerial", label: "Siervo Ministerial", abbr: "SM" },
  { value: "anciano", label: "Anciano", abbr: "A" },
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
  { value: "aseo_1", label: "Aseo #1" },
  { value: "aseo_2", label: "Aseo #2" },
  { value: "hospitalidad", label: "Hospitalidad" },
];

export default function Participantes() {
  const { 
    participantes, 
    isLoading, 
    crearParticipante, 
    actualizarParticipante, 
    eliminarParticipante 
  } = useParticipantes();
  
  const { grupos } = useGruposPredicacion();
  const queryClient = useQueryClient();
  
  // Estado para crear usuario desde participante
  const [crearUsuarioParticipante, setCrearUsuarioParticipante] = useState<{
    id: string;
    nombre: string;
    apellido: string;
    user_id?: string | null;
  } | null>(null);
  
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    nombre: "",
    apellido: "",
    estado_aprobado: false,
    es_capitan_grupo: false,
    responsabilidades: [] as string[],
    responsabilidad_adicional: "_none",
    grupo_predicacion_id: "_none",
    restriccion_disponibilidad: "sin_restriccion",
    asignaciones_servicio: [] as string[],
  });

  const resetForm = () => {
    setFormData({
      nombre: "",
      apellido: "",
      estado_aprobado: false,
      es_capitan_grupo: false,
      responsabilidades: [],
      responsabilidad_adicional: "_none",
      grupo_predicacion_id: "_none",
      restriccion_disponibilidad: "sin_restriccion",
      asignaciones_servicio: [],
    });
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Si no es anciano o siervo ministerial, limpiar responsabilidad_adicional
    const esAncianoOSM = formData.responsabilidades.includes("anciano") || formData.responsabilidades.includes("siervo_ministerial");
    
    const dataToSave = {
      nombre: formData.nombre,
      apellido: formData.apellido,
      estado_aprobado: formData.estado_aprobado,
      responsabilidad: formData.responsabilidades,
      responsabilidad_adicional: esAncianoOSM && formData.responsabilidad_adicional !== "_none" 
        ? formData.responsabilidad_adicional 
        : null,
      grupo_predicacion_id: formData.grupo_predicacion_id === "_none" ? null : formData.grupo_predicacion_id || null,
      restriccion_disponibilidad: formData.restriccion_disponibilidad,
      es_capitan_grupo: formData.es_capitan_grupo,
    };
    
    if (editingId) {
      actualizarParticipante.mutate({ 
        id: editingId, 
        ...dataToSave
      });
    } else {
      crearParticipante.mutate(dataToSave);
    }
    
    setOpen(false);
    resetForm();
  };

  const handleEdit = (participante: typeof participantes[0]) => {
    const responsabilidades = Array.isArray(participante.responsabilidad) 
      ? participante.responsabilidad 
      : participante.responsabilidad ? [participante.responsabilidad] : [];
    setFormData({
      nombre: participante.nombre,
      apellido: participante.apellido,
      estado_aprobado: participante.estado_aprobado ?? true,
      es_capitan_grupo: participante.es_capitan_grupo ?? false,
      responsabilidades,
      responsabilidad_adicional: participante.responsabilidad_adicional ?? "_none",
      grupo_predicacion_id: participante.grupo_predicacion_id ?? "_none",
      restriccion_disponibilidad: participante.restriccion_disponibilidad ?? "sin_restriccion",
      asignaciones_servicio: [], // TODO: cargar cuando exista en BD
    });
    setEditingId(participante.id);
    setOpen(true);
  };

  const handleDelete = (id: string) => {
    eliminarParticipante.mutate(id);
  };

  const getResponsabilidadAbbr = (value: string) => {
    return RESPONSABILIDADES.find(r => r.value === value)?.abbr || value;
  };

  const getResponsabilidadAdicionalLabel = (value: string | null) => {
    if (!value) return null;
    return RESPONSABILIDADES_ADICIONALES.find(r => r.value === value)?.label || null;
  };

  const mostrarResponsabilidadAdicional = 
    formData.responsabilidades.includes("anciano") || formData.responsabilidades.includes("siervo_ministerial");

  const getGrupoNumero = (grupoId: string | null) => {
    if (!grupoId) return "-";
    const grupo = grupos?.find(g => g.id === grupoId);
    return grupo ? `G${grupo.numero}` : "-";
  };

  const toggleResponsabilidad = (value: string) => {
    const current = formData.responsabilidades;
    if (current.includes(value)) {
      setFormData({ ...formData, responsabilidades: current.filter(r => r !== value) });
    } else {
      setFormData({ ...formData, responsabilidades: [...current, value] });
    }
  };

  const toggleAsignacionServicio = (value: string) => {
    const current = formData.asignaciones_servicio;
    if (current.includes(value)) {
      setFormData({ ...formData, asignaciones_servicio: current.filter(a => a !== value) });
    } else {
      setFormData({ ...formData, asignaciones_servicio: [...current, value] });
    }
  };

  const seleccionarTodasAsignaciones = () => {
    setFormData({ ...formData, asignaciones_servicio: ASIGNACIONES_SERVICIO.map(a => a.value) });
  };

  const eliminarTodasAsignaciones = () => {
    setFormData({ ...formData, asignaciones_servicio: [] });
  };

  const todasAsignacionesSeleccionadas = formData.asignaciones_servicio.length === ASIGNACIONES_SERVICIO.length;

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Participantes</h1>
          <p className="text-muted-foreground">
            Gestiona los participantes del programa
          </p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Participante
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[550px]">
            <DialogHeader>
              <DialogTitle>
                {editingId ? "Editar" : "Nuevo"} Participante
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Nombre y Apellido en dos columnas */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nombre">Nombre *</Label>
                  <Input
                    id="nombre"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="apellido">Apellido *</Label>
                  <Input
                    id="apellido"
                    value={formData.apellido}
                    onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
                    required
                  />
                </div>
              </div>

              {/* Estado Aprobado y Capitán de Grupo en la misma línea */}
              <div className="flex items-center gap-6">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="estado_aprobado"
                    checked={formData.estado_aprobado}
                    onCheckedChange={(checked) => 
                      setFormData({ ...formData, estado_aprobado: checked as boolean })
                    }
                  />
                  <Label htmlFor="estado_aprobado" className="cursor-pointer">
                    Estado Aprobado
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="es_capitan_grupo"
                    checked={formData.es_capitan_grupo}
                    onCheckedChange={(checked) => 
                      setFormData({ ...formData, es_capitan_grupo: checked as boolean })
                    }
                  />
                  <Label htmlFor="es_capitan_grupo" className="cursor-pointer">
                    Capitán de Grupo
                  </Label>
                </div>
              </div>

              {/* Responsabilidades (múltiple) */}
              <div className="space-y-2">
                <Label>Responsabilidad(es)</Label>
                <div className="grid grid-cols-2 gap-2 p-3 border rounded-md bg-background">
                  {RESPONSABILIDADES.map((r) => (
                    <div key={r.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`resp-${r.value}`}
                        checked={formData.responsabilidades.includes(r.value)}
                        onCheckedChange={() => toggleResponsabilidad(r.value)}
                      />
                      <Label htmlFor={`resp-${r.value}`} className="cursor-pointer text-sm">
                        {r.label} ({r.abbr})
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Responsabilidad Adicional - Solo para Anciano y SM */}
              {mostrarResponsabilidadAdicional && (
                <div className="space-y-2">
                  <Label htmlFor="responsabilidad_adicional">Responsabilidad Adicional</Label>
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
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Grupo de Predicación */}
              <div className="space-y-2">
                <Label htmlFor="grupo_predicacion">Grupo de Predicación *</Label>
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

              {/* Restricción de Disponibilidad */}
              <div className="space-y-2">
                <Label htmlFor="restriccion">Restricción de Disponibilidad</Label>
                <Select
                  value={formData.restriccion_disponibilidad}
                  onValueChange={(value) => setFormData({ ...formData, restriccion_disponibilidad: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione restricción" />
                  </SelectTrigger>
                  <SelectContent>
                    {RESTRICCIONES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Asignaciones de Servicio */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Asignaciones de Servicio</Label>
                  <button
                    type="button"
                    onClick={todasAsignacionesSeleccionadas ? eliminarTodasAsignaciones : seleccionarTodasAsignaciones}
                    className="text-sm text-primary hover:underline"
                  >
                    {todasAsignacionesSeleccionadas ? "Eliminar todas" : "Seleccionar todas"}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 p-3 border rounded-md bg-background max-h-48 overflow-y-auto">
                  {ASIGNACIONES_SERVICIO.map((a) => (
                    <div key={a.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`asig-${a.value}`}
                        checked={formData.asignaciones_servicio.includes(a.value)}
                        onCheckedChange={() => toggleAsignacionServicio(a.value)}
                      />
                      <Label htmlFor={`asig-${a.value}`} className="cursor-pointer text-sm">
                        {a.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => { setOpen(false); resetForm(); }}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingId ? "Actualizar" : "Crear"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Apellido</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Responsabilidad</TableHead>
              <TableHead>Resp. Adicional</TableHead>
              <TableHead>Grupo</TableHead>
              <TableHead className="text-center">Aprobado</TableHead>
              <TableHead className="text-center">Capitán</TableHead>
              <TableHead className="w-[100px]">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {participantes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  No hay participantes
                </TableCell>
              </TableRow>
            ) : (
              participantes.map((participante) => (
                <TableRow key={participante.id}>
                  <TableCell className="font-medium">{participante.apellido}</TableCell>
                  <TableCell>{participante.nombre}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(Array.isArray(participante.responsabilidad) 
                        ? participante.responsabilidad 
                        : [participante.responsabilidad ?? "publicador"]
                      ).map((r) => (
                        <Badge key={r} variant="outline">
                          {getResponsabilidadAbbr(r)}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    {participante.responsabilidad_adicional ? (
                      <Badge variant="secondary">
                        {participante.responsabilidad_adicional === "superintendente_grupo" ? "SG" : "AG"}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {getGrupoNumero(participante.grupo_predicacion_id)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {participante.estado_aprobado ? (
                      <Check className="h-4 w-4 text-green-600 mx-auto" />
                    ) : (
                      <X className="h-4 w-4 text-muted-foreground mx-auto" />
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {participante.es_capitan_grupo ? (
                      <Check className="h-4 w-4 text-primary mx-auto" />
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {!(participante as any).user_id && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setCrearUsuarioParticipante({
                                id: participante.id,
                                nombre: participante.nombre,
                                apellido: participante.apellido,
                                user_id: (participante as any).user_id,
                              })}
                            >
                              <UserPlus className="h-4 w-4 text-blue-500" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Crear usuario</TooltipContent>
                        </Tooltip>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(participante)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(participante.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <CrearUsuarioParticipanteModal
        participante={crearUsuarioParticipante}
        open={!!crearUsuarioParticipante}
        onOpenChange={(open) => { if (!open) setCrearUsuarioParticipante(null); }}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["participantes"] });
        }}
      />
    </div>
  );
}