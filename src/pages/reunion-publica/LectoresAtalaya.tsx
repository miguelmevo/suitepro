import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, SortableTableHead, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTableSort } from "@/hooks/useTableSort";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, Users, Lock, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { useReunionPublica } from "@/hooks/useReunionPublica";
import { useParticipantes } from "@/hooks/useParticipantes";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { usePermisos } from "@/hooks/usePermisos";

export default function LectoresAtalaya() {
  const { lectoresElegibles, isLoading, agregarLectorElegible, eliminarLectorElegible } = useReunionPublica();
  const { participantes, isLoading: isLoadingParticipantes } = useParticipantes();
  const { canCreate, canDelete } = usePermisos();
  const puedeCrear = canCreate("reunion_publica_lectores");
  const puedeEliminar = canDelete("reunion_publica_lectores");
  const isReadOnly = !puedeCrear && !puedeEliminar;
  
  const [selectedParticipante, setSelectedParticipante] = useState<string>("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [searchTable, setSearchTable] = useState("");

  // Filtrar A, SM y Publicadores (PB) — solo varones
  const participantesElegibles = useMemo(() => {
    return participantes?.filter(p =>
      (p as any).genero === "M" &&
      p.responsabilidad?.some(r => r === "anciano" || r === "siervo_ministerial" || r === "publicador")
    ) || [];
  }, [participantes]);

  // IDs de lectores ya agregados
  const lectoresIds = lectoresElegibles?.map(l => l.participante_id) || [];

  // Participantes disponibles para agregar (no están en la lista)
  const participantesDisponibles = participantesElegibles.filter(
    p => !lectoresIds.includes(p.id)
  );




  // Lectores con datos del participante
  const lectoresConDatos = useMemo(() => {
    return lectoresElegibles?.map(lector => {
      const participante = participantes?.find(p => p.id === lector.participante_id);
      return {
        ...lector,
        nombre: participante?.nombre || "Desconocido",
        apellido: participante?.apellido || "",
        responsabilidad: participante?.responsabilidad || [],
      };
    }) || [];
  }, [lectoresElegibles, participantes]);

  const lectoresFiltrados = useMemo(() => {
    const q = searchTable.trim().toLowerCase();
    if (!q) return lectoresConDatos;
    return lectoresConDatos.filter(l =>
      `${l.nombre} ${l.apellido}`.toLowerCase().includes(q) ||
      `${l.apellido} ${l.nombre}`.toLowerCase().includes(q)
    );
  }, [lectoresConDatos, searchTable]);

  const { sortedData: sortedLectores, sortConfig: lectorSortConfig, requestSort: lectorRequestSort } = useTableSort(lectoresFiltrados, { key: "apellido", direction: "asc" });



  const handleAgregar = async () => {
    if (!selectedParticipante) return;
    await agregarLectorElegible.mutateAsync(selectedParticipante);
    setSelectedParticipante("");
  };

  const handleEliminar = async () => {
    if (!deleteId) return;
    await eliminarLectorElegible.mutateAsync(deleteId);
    setDeleteId(null);
  };

  const getResponsabilidadLabel = (resp: string[]) => {
    if (resp.includes("anciano")) return "Anciano";
    if (resp.includes("siervo_ministerial")) return "Siervo Ministerial";
    if (resp.includes("publicador")) return "Publicador";
    return "Otro";
  };

  if (isLoading || isLoadingParticipantes) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Lectores de La Atalaya</h1>
      </div>

      {isReadOnly && (
        <Alert className="bg-amber-50 border-amber-200">
          <Lock className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            Tu rol no tiene permisos para modificar los lectores. Solo puedes consultar la información.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Participantes Elegibles para Lector
          </CardTitle>
          <CardDescription>
            Administra los participantes que pueden ser asignados como lectores de La Atalaya.
            Por defecto, todos los Ancianos y Siervos Ministeriales pueden ser elegibles.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Agregar nuevo lector */}
          {!isReadOnly && (
          <div className="flex flex-wrap gap-2 items-center">
            <Select value={selectedParticipante} onValueChange={setSelectedParticipante}>
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="Seleccionar participante..." />
              </SelectTrigger>
              <SelectContent>
                {participantesDisponibles.length > 0 ? (
                  participantesDisponibles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.apellido}, {p.nombre} ({getResponsabilidadLabel(p.responsabilidad || [])})
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="_none" disabled>
                    Todos los participantes elegibles ya están agregados
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            <Button 
              onClick={handleAgregar} 
              disabled={!selectedParticipante || agregarLectorElegible.isPending}
            >
              {agregarLectorElegible.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Agregar
            </Button>
          </div>
          )}

          <div className="relative max-w-sm">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar lector en la tabla..."
              value={searchTable}
              onChange={(e) => setSearchTable(e.target.value)}
              className="pl-8"
            />
          </div>


          {/* Tabla de lectores */}
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead sortKey="apellido" currentSort={lectorSortConfig} onSort={lectorRequestSort}>Nombre</SortableTableHead>
                <SortableTableHead sortKey="responsabilidad" currentSort={lectorSortConfig} onSort={lectorRequestSort}>Responsabilidad</SortableTableHead>
                {!isReadOnly && <TableHead className="w-[100px]">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedLectores.length > 0 ? (
                sortedLectores.map((lector) => (
                  <TableRow key={lector.id}>
                    <TableCell className="font-medium">
                      {lector.apellido}, {lector.nombre}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {getResponsabilidadLabel(lector.responsabilidad)}
                      </Badge>
                    </TableCell>
                    {!isReadOnly && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(lector.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                    No hay lectores elegibles configurados.
                    Agregue participantes usando el selector de arriba.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ConfirmDeleteDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={handleEliminar}
        title="Eliminar lector elegible"
        description="¿Está seguro de eliminar este participante de la lista de lectores elegibles?"
      />
    </div>
  );
}
