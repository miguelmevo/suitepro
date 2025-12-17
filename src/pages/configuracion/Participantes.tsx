import { useState } from "react";
import { Plus, Pencil, Trash2, Loader2, Phone, Check, X } from "lucide-react";
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

const RESPONSABILIDADES = [
  { value: "publicador", label: "Publicador (PB)" },
  { value: "siervo_ministerial", label: "Siervo Ministerial (SM)" },
  { value: "anciano", label: "Anciano (A)" },
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

export default function Participantes() {
  const { 
    participantes, 
    isLoading, 
    crearParticipante, 
    actualizarParticipante, 
    eliminarParticipante 
  } = useParticipantes();
  
  const { grupos } = useGruposPredicacion();
  
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    nombre: "",
    apellido: "",
    estado_aprobado: true,
    responsabilidad: "publicador",
    responsabilidad_adicional: "_none",
    grupo_predicacion_id: "_none",
    restriccion_disponibilidad: "sin_restriccion",
    es_capitan_grupo: false,
  });

  const resetForm = () => {
    setFormData({
      nombre: "",
      apellido: "",
      estado_aprobado: true,
      responsabilidad: "publicador",
      responsabilidad_adicional: "_none",
      grupo_predicacion_id: "_none",
      restriccion_disponibilidad: "sin_restriccion",
      es_capitan_grupo: false,
    });
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Si no es anciano o siervo ministerial, limpiar responsabilidad_adicional
    const esAncianoOSM = formData.responsabilidad === "anciano" || formData.responsabilidad === "siervo_ministerial";
    
    const dataToSave = {
      nombre: formData.nombre,
      apellido: formData.apellido,
      estado_aprobado: formData.estado_aprobado,
      responsabilidad: formData.responsabilidad,
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
    setFormData({
      nombre: participante.nombre,
      apellido: participante.apellido,
      estado_aprobado: participante.estado_aprobado ?? true,
      responsabilidad: participante.responsabilidad ?? "publicador",
      responsabilidad_adicional: participante.responsabilidad_adicional ?? "_none",
      grupo_predicacion_id: participante.grupo_predicacion_id ?? "_none",
      restriccion_disponibilidad: participante.restriccion_disponibilidad ?? "sin_restriccion",
      es_capitan_grupo: participante.es_capitan_grupo ?? false,
    });
    setEditingId(participante.id);
    setOpen(true);
  };

  const handleDelete = (id: string) => {
    eliminarParticipante.mutate(id);
  };

  const getResponsabilidadLabel = (value: string) => {
    return RESPONSABILIDADES.find(r => r.value === value)?.label || value;
  };

  const getResponsabilidadAdicionalLabel = (value: string | null) => {
    if (!value) return null;
    return RESPONSABILIDADES_ADICIONALES.find(r => r.value === value)?.label || null;
  };

  const mostrarResponsabilidadAdicional = 
    formData.responsabilidad === "anciano" || formData.responsabilidad === "siervo_ministerial";

  const getGrupoNumero = (grupoId: string | null) => {
    if (!grupoId) return "-";
    const grupo = grupos?.find(g => g.id === grupoId);
    return grupo ? `G${grupo.numero}` : "-";
  };

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

              {/* Estado Aprobado */}
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

              {/* Responsabilidad */}
              <div className="space-y-2">
                <Label htmlFor="responsabilidad">Responsabilidad *</Label>
                <Select
                  value={formData.responsabilidad}
                  onValueChange={(value) => setFormData({ 
                    ...formData, 
                    responsabilidad: value,
                    // Limpiar responsabilidad adicional si cambia a publicador
                    responsabilidad_adicional: (value === "anciano" || value === "siervo_ministerial") 
                      ? formData.responsabilidad_adicional 
                      : "_none"
                  })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione responsabilidad" />
                  </SelectTrigger>
                  <SelectContent>
                    {RESPONSABILIDADES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
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

              {/* Capitán de Grupo */}
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
              <TableHead>Grupo</TableHead>
              <TableHead className="text-center">Aprobado</TableHead>
              <TableHead className="text-center">Capitán</TableHead>
              <TableHead className="w-[100px]">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {participantes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No hay participantes
                </TableCell>
              </TableRow>
            ) : (
              participantes.map((participante) => (
                <TableRow key={participante.id}>
                  <TableCell className="font-medium">{participante.apellido}</TableCell>
                  <TableCell>{participante.nombre}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge variant="outline">
                        {getResponsabilidadLabel(participante.responsabilidad ?? "publicador")}
                      </Badge>
                      {getResponsabilidadAdicionalLabel(participante.responsabilidad_adicional) && (
                        <Badge variant="secondary" className="text-xs">
                          {getResponsabilidadAdicionalLabel(participante.responsabilidad_adicional)}
                        </Badge>
                      )}
                    </div>
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
    </div>
  );
}