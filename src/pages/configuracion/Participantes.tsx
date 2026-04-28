import { useState } from "react";
import { Plus, Pencil, Trash2, Loader2, Check, X, UserPlus, RotateCcw, UserX } from "lucide-react";
import { useQuery, useQueryClient as useQC } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCongregacionId } from "@/contexts/CongregacionContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  SortableTableHead,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTableSort } from "@/hooks/useTableSort";
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
import { IndisponibilidadManager } from "@/components/participantes/IndisponibilidadManager";
import { useQueryClient } from "@tanstack/react-query";
import { toast as sonnerToast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { EstadisticasTab } from "@/components/participantes/EstadisticasTab";

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
  { value: "aseo_1", label: "Aseo #1" },
  { value: "aseo_2", label: "Aseo #2" },
  { value: "hospitalidad", label: "Hospitalidad" },
];

export default function Participantes() {
  const { 
    todosParticipantes: participantes, 
    isLoading, 
    crearParticipante, 
    actualizarParticipante, 
    inactivarParticipante,
    eliminarParticipante 
  } = useParticipantes();
  
  const { grupos } = useGruposPredicacion();
  const queryClient = useQueryClient();
  const congregacionId = useCongregacionId();

  // Obtener emails de usuarios vinculados a participantes
  const { data: usuariosCongregacion } = useQuery({
    queryKey: ["usuarios-congregacion-vinculacion", congregacionId],
    queryFn: async () => {
      if (!congregacionId) return [];
      // Obtener membresías
      const { data: memberships, error: mError } = await supabase
        .from("usuarios_congregacion")
        .select("user_id, participante_id")
        .eq("congregacion_id", congregacionId)
        .eq("activo", true);
      if (mError) throw mError;
      if (!memberships?.length) return [];

      // Obtener emails de profiles por separado
      const userIds = memberships.map(m => m.user_id);
      const { data: profiles, error: pError } = await supabase
        .from("profiles")
        .select("id, email")
        .in("id", userIds);
      if (pError) throw pError;

      const emailMap = new Map((profiles || []).map(p => [p.id, p.email]));
      return memberships.map(m => ({
        user_id: m.user_id,
        participante_id: m.participante_id,
        email: emailMap.get(m.user_id) || "",
      }));
    },
    enabled: !!congregacionId,
  });

  // Usuarios disponibles para vincular (sin participante asociado)
  const usuariosDisponibles = (usuariosCongregacion || []).filter(u => !u.participante_id);

  // Obtener email del usuario vinculado a un participante
  const getEmailUsuarioVinculado = (userId: string | null) => {
    if (!userId) return null;
    return (usuariosCongregacion || []).find(u => u.user_id === userId)?.email || null;
  };

  const vincularUsuario = async (participanteId: string, userId: string) => {
    try {
      // Actualizar participantes.user_id
      await supabase.from("participantes").update({ user_id: userId }).eq("id", participanteId);
      // Actualizar usuarios_congregacion.participante_id
      await supabase.from("usuarios_congregacion")
        .update({ participante_id: participanteId })
        .eq("user_id", userId)
        .eq("congregacion_id", congregacionId);
      queryClient.invalidateQueries({ queryKey: ["participantes"] });
      queryClient.invalidateQueries({ queryKey: ["usuarios-congregacion-vinculacion"] });
      sonnerToast.success("Usuario vinculado al participante");
    } catch (error: any) {
      sonnerToast.error("Error al vincular: " + error.message);
    }
  };

  const desvincularUsuario = async (participanteId: string, userId: string) => {
    try {
      await supabase.from("participantes").update({ user_id: null }).eq("id", participanteId);
      await supabase.from("usuarios_congregacion")
        .update({ participante_id: null })
        .eq("user_id", userId)
        .eq("congregacion_id", congregacionId);
      queryClient.invalidateQueries({ queryKey: ["participantes"] });
      queryClient.invalidateQueries({ queryKey: ["usuarios-congregacion-vinculacion"] });
      sonnerToast.success("Usuario desvinculado del participante");
    } catch (error: any) {
      sonnerToast.error("Error al desvincular: " + error.message);
    }
  };

  const [activeTab, setActiveTab] = useState("activos");
  const [selectedInactivos, setSelectedInactivos] = useState<Set<string>>(new Set());
  
  // Estado para crear usuario desde participante
  const [crearUsuarioParticipante, setCrearUsuarioParticipante] = useState<{
    id: string;
    nombre: string;
    apellido: string;
    user_id?: string | null;
  } | null>(null);
  
  // Estado para diálogo de confirmación de eliminación
  const [deleteDialog, setDeleteDialog] = useState<{ 
    open: boolean; 
    participante: { id: string; nombre: string; apellido: string } | null;
    isPermanent?: boolean;
  }>({
    open: false,
    participante: null,
    isPermanent: false,
  });

  const [inactivarDialog, setInactivarDialog] = useState<{
    open: boolean;
    participante: { id: string; nombre: string; apellido: string } | null;
  }>({
    open: false,
    participante: null,
  });
  
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
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
    es_varon: true,
  });

  const resetForm = () => {
    setFormData({
      nombre: "",
      apellido: "",
      activo: true,
      estado_aprobado: false,
      es_capitan_grupo: false,
      es_publicador_inactivo: false,
      responsabilidades: [],
      responsabilidad_adicional: "_none",
      grupo_predicacion_id: "_none",
      restriccion_disponibilidad: "sin_restriccion",
      asignaciones_servicio: [],
      es_varon: true,
    });
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const esAncianoOSM = formData.responsabilidades.includes("anciano") || formData.responsabilidades.includes("siervo_ministerial");
    
    // Si es publicador inactivo, limpiar responsabilidades y asignaciones
    const isDisabled = !formData.activo || formData.es_publicador_inactivo;
    
    const dataToSave = {
      nombre: formData.nombre,
      apellido: formData.apellido,
      activo: formData.activo,
      estado_aprobado: isDisabled ? false : formData.estado_aprobado,
      responsabilidad: isDisabled ? formData.responsabilidades : formData.responsabilidades,
      responsabilidad_adicional: isDisabled 
        ? null 
        : (esAncianoOSM && formData.responsabilidad_adicional !== "_none" 
          ? formData.responsabilidad_adicional 
          : null),
      grupo_predicacion_id: formData.grupo_predicacion_id === "_none" ? null : formData.grupo_predicacion_id || null,
      restriccion_disponibilidad: isDisabled ? "sin_restriccion" : formData.restriccion_disponibilidad,
      es_capitan_grupo: isDisabled ? false : formData.es_capitan_grupo,
      es_publicador_inactivo: formData.es_publicador_inactivo,
      genero: formData.es_varon ? "M" : "F",
    } as any;
    
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
      activo: participante.activo ?? true,
      estado_aprobado: participante.estado_aprobado ?? true,
      es_capitan_grupo: participante.es_capitan_grupo ?? false,
      es_publicador_inactivo: (participante as any).es_publicador_inactivo ?? false,
      responsabilidades,
      responsabilidad_adicional: participante.responsabilidad_adicional ?? "_none",
      grupo_predicacion_id: participante.grupo_predicacion_id ?? "_none",
      restriccion_disponibilidad: participante.restriccion_disponibilidad ?? "sin_restriccion",
      asignaciones_servicio: [],
      es_varon: ((participante as any).genero ?? "M") !== "F",
    });
    setEditingId(participante.id);
    setOpen(true);
  };

  const handleDelete = () => {
    if (!deleteDialog.participante) return;
    eliminarParticipante.mutate(deleteDialog.participante.id);
    setDeleteDialog({ open: false, participante: null, isPermanent: false });
  };

  const handleInactivar = () => {
    if (!inactivarDialog.participante) return;
    inactivarParticipante.mutate(inactivarDialog.participante.id);
    setInactivarDialog({ open: false, participante: null });
  };

  const handleReactivar = (participante: typeof participantes[0]) => {
    actualizarParticipante.mutate({ id: participante.id, activo: true });
  };

  const handleReactivarMasivo = async () => {
    const ids = Array.from(selectedInactivos);
    for (const id of ids) {
      await supabase.from("participantes").update({ activo: true }).eq("id", id);
    }
    queryClient.invalidateQueries({ queryKey: ["participantes"] });
    sonnerToast.success(`${ids.length} participante(s) reactivado(s)`);
    setSelectedInactivos(new Set());
  };

  const handleEliminarMasivo = async () => {
    const ids = Array.from(selectedInactivos);
    for (const id of ids) {
      await supabase.from("participantes").delete().eq("id", id);
    }
    queryClient.invalidateQueries({ queryKey: ["participantes"] });
    sonnerToast.success(`${ids.length} participante(s) eliminado(s)`);
    setSelectedInactivos(new Set());
  };

  const toggleSelectInactivo = (id: string) => {
    setSelectedInactivos(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllInactivos = () => {
    if (selectedInactivos.size === sortedInactivos.length) {
      setSelectedInactivos(new Set());
    } else {
      setSelectedInactivos(new Set(sortedInactivos.map(p => p.id)));
    }
  };

  const [massDeleteDialog, setMassDeleteDialog] = useState(false);

  const getResponsabilidadAbbr = (value: string) => {
    return RESPONSABILIDADES.find(r => r.value === value)?.abbr || value;
  };

  const mostrarResponsabilidadAdicional = 
    !formData.es_publicador_inactivo && (formData.responsabilidades.includes("anciano") || formData.responsabilidades.includes("siervo_ministerial"));

  const getGrupoNumero = (grupoId: string | null) => {
    if (!grupoId) return "-";
    const grupo = grupos?.find(g => g.id === grupoId);
    return grupo ? `G${grupo.numero}` : "-";
  };

  const RESPONSABILIDADES_SOLO_VARON = ["anciano", "siervo_ministerial", "super_circuito"];

  const toggleResponsabilidad = (value: string) => {
    const current = formData.responsabilidades;
    if (current.includes(value)) {
      setFormData({ ...formData, responsabilidades: current.filter(r => r !== value) });
    } else {
      setFormData({ ...formData, responsabilidades: [...current, value] });
    }
  };

  // Cuando cambia a mujer, limpiar campos no permitidos
  const handleVaronChange = (esVaron: boolean) => {
    if (!esVaron) {
      setFormData({
        ...formData,
        es_varon: false,
        estado_aprobado: false,
        es_capitan_grupo: false,
        responsabilidades: formData.responsabilidades.filter(r => !RESPONSABILIDADES_SOLO_VARON.includes(r)),
      });
    } else {
      setFormData({ ...formData, es_varon: true });
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

  // Separar participantes activos e inactivos (por baja)
  const participantesActivos = participantes.filter(p => p.activo);
  const participantesInactivos = participantes.filter(p => !p.activo);

  const sortAccessors = {
    responsabilidad: (p: typeof participantes[0]) => (Array.isArray(p.responsabilidad) ? p.responsabilidad.join(", ") : p.responsabilidad ?? ""),
    responsabilidad_adicional: (p: typeof participantes[0]) => p.responsabilidad_adicional ?? "",
    grupo_predicacion_id: (p: typeof participantes[0]) => {
      const grupo = grupos?.find(g => g.id === p.grupo_predicacion_id);
      return grupo ? grupo.numero : 999;
    },
    estado_aprobado: (p: typeof participantes[0]) => p.estado_aprobado ? 1 : 0,
    es_capitan_grupo: (p: typeof participantes[0]) => p.es_capitan_grupo ? 1 : 0,
  };

  const { sortedData: sortedActivos, sortConfig: activosSortConfig, requestSort: activosRequestSort } = useTableSort(participantesActivos, { key: "apellido", direction: "asc" }, sortAccessors);
  const { sortedData: sortedInactivos, sortConfig: inactivosSortConfig, requestSort: inactivosRequestSort } = useTableSort(participantesInactivos, { key: "apellido", direction: "asc" }, sortAccessors);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const renderParticipantesTable = (sortedData: typeof participantes, sortConfig: typeof activosSortConfig, requestSort: typeof activosRequestSort, showReactivar = false) => {

    return (
    <div className="rounded-lg border bg-card">
      {/* Barra de acciones masivas para inactivos */}
      {showReactivar && selectedInactivos.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-muted border-b">
          <span className="text-sm font-medium">{selectedInactivos.size} seleccionado(s)</span>
          <Button size="sm" variant="outline" onClick={handleReactivarMasivo} className="gap-1">
            <RotateCcw className="h-3.5 w-3.5" />
            Reactivar
          </Button>
          <Button size="sm" variant="destructive" onClick={() => setMassDeleteDialog(true)} className="gap-1">
            <Trash2 className="h-3.5 w-3.5" />
            Eliminar
          </Button>
        </div>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            {showReactivar && (
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={sortedData.length > 0 && selectedInactivos.size === sortedData.length}
                  onCheckedChange={toggleSelectAllInactivos}
                />
              </TableHead>
            )}
            <SortableTableHead sortKey="apellido" currentSort={sortConfig} onSort={requestSort}>Apellido</SortableTableHead>
            <SortableTableHead sortKey="nombre" currentSort={sortConfig} onSort={requestSort}>Nombre</SortableTableHead>
            <SortableTableHead sortKey="responsabilidad" currentSort={sortConfig} onSort={requestSort}>Responsabilidad</SortableTableHead>
            <SortableTableHead sortKey="responsabilidad_adicional" currentSort={sortConfig} onSort={requestSort}>Resp. Adicional</SortableTableHead>
            <SortableTableHead sortKey="grupo_predicacion_id" currentSort={sortConfig} onSort={requestSort}>Grupo</SortableTableHead>
            <SortableTableHead sortKey="estado_aprobado" currentSort={sortConfig} onSort={requestSort} className="text-center">Aprobado</SortableTableHead>
            <SortableTableHead sortKey="es_capitan_grupo" currentSort={sortConfig} onSort={requestSort} className="text-center">Capitán</SortableTableHead>
            <TableHead className="w-[100px]">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedData.length === 0 ? (
            <TableRow>
              <TableCell colSpan={showReactivar ? 9 : 8} className="text-center text-muted-foreground">
                {showReactivar ? "No hay participantes inactivos" : "No hay participantes"}
              </TableCell>
            </TableRow>
          ) : (
            sortedData.map((participante) => (
              <TableRow key={participante.id} className={(participante as any).es_publicador_inactivo ? "opacity-60" : ""}>
                {showReactivar && (
                  <TableCell>
                    <Checkbox
                      checked={selectedInactivos.has(participante.id)}
                      onCheckedChange={() => toggleSelectInactivo(participante.id)}
                    />
                  </TableCell>
                )}
                <TableCell className="font-medium">
                  {participante.apellido}
                  {(participante as any).es_publicador_inactivo && (
                    <Badge variant="outline" className="ml-2 text-[10px] border-amber-400 text-amber-600">
                      PB Inactivo
                    </Badge>
                  )}
                </TableCell>
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
                    <X className="h-4 w-4 text-muted-foreground mx-auto" />
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {showReactivar ? (
                      <>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(participante)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Ver / Editar participante</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleReactivar(participante)}
                            >
                              <RotateCcw className="h-4 w-4 text-green-500" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Reactivar participante</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteDialog({ 
                                open: true, 
                                participante: { 
                                  id: participante.id, 
                                  nombre: participante.nombre, 
                                  apellido: participante.apellido 
                                } 
                              })}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Eliminar participante</TooltipContent>
                        </Tooltip>
                      </>
                    ) : (
                      <>
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
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setInactivarDialog({ 
                                open: true, 
                                participante: { 
                                  id: participante.id, 
                                  nombre: participante.nombre, 
                                  apellido: participante.apellido 
                                } 
                              })}
                            >
                              <UserX className="h-4 w-4 text-amber-500" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Inactivar participante</TooltipContent>
                        </Tooltip>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
    );
  };

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
                {editingId && (() => {
                  const ep = participantes.find(p => p.id === editingId);
                  const email = getEmailUsuarioVinculado(ep?.user_id || null);
                  return email ? <span className="text-sm font-normal text-muted-foreground"> ({email})</span> : null;
                })()}
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


              {/* Aprobado, Capitán de Grupo e Inactivar - debajo del nombre */}
              <div className={`flex items-center gap-6 ${formData.es_publicador_inactivo ? "opacity-50 pointer-events-none" : ""}`}>
                {formData.es_varon && (
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="estado_aprobado"
                      checked={formData.estado_aprobado}
                      onCheckedChange={(checked) => 
                        setFormData({ ...formData, estado_aprobado: checked as boolean })
                      }
                      disabled={formData.es_publicador_inactivo || !formData.activo}
                    />
                    <Label htmlFor="estado_aprobado" className="cursor-pointer">
                      Aprobado
                    </Label>
                  </div>
                )}
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="es_varon"
                    checked={formData.es_varon}
                    onCheckedChange={(checked) => handleVaronChange(checked as boolean)}
                    disabled={!formData.activo}
                  />
                  <Label htmlFor="es_varon" className="cursor-pointer">
                    Varón
                  </Label>
                </div>
                {formData.es_varon && (
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="es_capitan_grupo"
                      checked={formData.es_capitan_grupo}
                      onCheckedChange={(checked) => 
                        setFormData({ ...formData, es_capitan_grupo: checked as boolean })
                      }
                      disabled={formData.es_publicador_inactivo || !formData.activo}
                    />
                    <Label htmlFor="es_capitan_grupo" className="cursor-pointer">
                      Capitán de Grupo
                    </Label>
                  </div>
                )}
                {editingId && (
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="participante_inactivo"
                      checked={!formData.activo}
                      onCheckedChange={(checked) => 
                        setFormData({ ...formData, activo: !(checked as boolean) })
                      }
                    />
                    <Label htmlFor="participante_inactivo" className="cursor-pointer text-destructive">
                      Inactivar
                    </Label>
                  </div>
                )}
              </div>

              {/* Todo lo demás se grisea si el participante está inactivo */}
              <div className={!formData.activo ? "opacity-50 pointer-events-none space-y-4" : "space-y-4"}>
                {/* Responsabilidades (múltiple) - PIN dentro del mismo grid */}
                <div className="space-y-2">
                  <Label>Responsabilidad(es)</Label>
                  <div className="p-3 border rounded-md bg-background">
                    <div className={`grid grid-cols-2 gap-2 ${formData.es_publicador_inactivo ? "opacity-50 pointer-events-none" : ""}`}>
                      {RESPONSABILIDADES.map((r) => {
                        const bloqueadaPorGenero = !formData.es_varon && RESPONSABILIDADES_SOLO_VARON.includes(r.value);
                        return (
                          <div key={r.value} className="flex items-center space-x-2">
                            <Checkbox
                              id={`resp-${r.value}`}
                              checked={formData.responsabilidades.includes(r.value)}
                              onCheckedChange={() => toggleResponsabilidad(r.value)}
                              disabled={formData.es_publicador_inactivo || !formData.activo || bloqueadaPorGenero}
                            />
                            <Label htmlFor={`resp-${r.value}`} className={`cursor-pointer text-sm ${bloqueadaPorGenero ? "opacity-50" : ""}`}>
                              {r.label} ({r.abbr})
                            </Label>
                          </div>
                        );
                      })}
                    </div>
                    {/* Publicador Inactivo (PIN) - siempre clickeable */}
                    <div className="flex items-center space-x-2 mt-2">
                      <Checkbox
                        id="es_publicador_inactivo"
                        checked={formData.es_publicador_inactivo}
                        onCheckedChange={(checked) => 
                          setFormData({ ...formData, es_publicador_inactivo: checked as boolean })
                        }
                        disabled={!formData.activo}
                      />
                      <Label htmlFor="es_publicador_inactivo" className="cursor-pointer text-sm">
                        Publicador Inactivo (PIN)
                      </Label>
                    </div>
                  </div>
                </div>

                {/* Grupo de Predicación */}
                <div className="space-y-2">
                  <Label htmlFor="grupo_predicacion">Grupo de Predicación *</Label>
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

                {/* Restricción de Disponibilidad - Solo varones */}
                {formData.es_varon && (
                  <div className={`space-y-2 ${formData.es_publicador_inactivo ? "opacity-50 pointer-events-none" : ""}`}>
                    <Label htmlFor="restriccion">Restricción de Disponibilidad</Label>
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
                          <SelectItem key={r.value} value={r.value}>
                            {r.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Asignaciones de Servicio - Solo varones */}
                {formData.es_varon && (
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
                      {ASIGNACIONES_SERVICIO.map((a) => (
                        <div key={a.value} className="flex items-center space-x-2">
                          <Checkbox
                            id={`asig-${a.value}`}
                            checked={formData.asignaciones_servicio.includes(a.value)}
                            onCheckedChange={() => toggleAsignacionServicio(a.value)}
                            disabled={formData.es_publicador_inactivo || !formData.activo}
                          />
                          <Label htmlFor={`asig-${a.value}`} className="cursor-pointer text-sm">
                            {a.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Indisponibilidad - Solo en modo edición y no inactivo */}
              {editingId && !formData.es_publicador_inactivo && formData.activo && (
                <div className="border-t pt-4">
                  <IndisponibilidadManager
                    participanteId={editingId}
                    participanteNombre={`${formData.nombre} ${formData.apellido}`}
                  />
                </div>
              )}


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

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="activos">
            Activos ({participantesActivos.length})
          </TabsTrigger>
          <TabsTrigger value="inactivos">
            Inactivos ({participantesInactivos.length})
          </TabsTrigger>
          <TabsTrigger value="estadisticas">
            Estadísticas
          </TabsTrigger>
        </TabsList>
        <TabsContent value="activos">
          {renderParticipantesTable(sortedActivos, activosSortConfig, activosRequestSort)}
        </TabsContent>
        <TabsContent value="inactivos">
          {renderParticipantesTable(sortedInactivos, inactivosSortConfig, inactivosRequestSort, true)}
        </TabsContent>
        <TabsContent value="estadisticas">
          <EstadisticasTab participantes={participantes} />
        </TabsContent>
      </Tabs>

      <CrearUsuarioParticipanteModal
        participante={crearUsuarioParticipante}
        open={!!crearUsuarioParticipante}
        onOpenChange={(open) => { if (!open) setCrearUsuarioParticipante(null); }}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["participantes"] });
        }}
      />

      <ConfirmDeleteDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, participante: open ? deleteDialog.participante : null, isPermanent: deleteDialog.isPermanent })}
        onConfirm={handleDelete}
        title="¿Eliminar participante permanentemente?"
        description={deleteDialog.participante ? `¿Estás seguro que deseas eliminar permanentemente a "${deleteDialog.participante.nombre} ${deleteDialog.participante.apellido}"? Esta acción no se puede deshacer y se borrarán todos sus datos.` : undefined}
      />

      <ConfirmDeleteDialog
        open={inactivarDialog.open}
        onOpenChange={(open) => setInactivarDialog({ open, participante: open ? inactivarDialog.participante : null })}
        onConfirm={handleInactivar}
        title="¿Inactivar participante?"
        description={inactivarDialog.participante ? `¿Estás seguro que deseas inactivar a "${inactivarDialog.participante.nombre} ${inactivarDialog.participante.apellido}"? El participante pasará a la pestaña Inactivos.` : undefined}
      />

      <ConfirmDeleteDialog
        open={massDeleteDialog}
        onOpenChange={setMassDeleteDialog}
        onConfirm={handleEliminarMasivo}
        title="¿Eliminar participantes seleccionados?"
        description={`¿Estás seguro que deseas eliminar permanentemente ${selectedInactivos.size} participante(s)? Esta acción no se puede deshacer.`}
      />
    </div>
  );
}
