import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Plus, Edit, Trash2, BookOpen, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";

import {
  useEliminarProgramaVidaMinisterio,
  useProgramasVidaMinisterio,
} from "@/hooks/useProgramaVidaMinisterio";
import { useParticipantes } from "@/hooks/useParticipantes";
import { useAuthContext } from "@/contexts/AuthProvider";
import { useCongregacion } from "@/contexts/CongregacionContext";

function getMonday(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  return d;
}

export default function ListaVidaMinisterio() {
  const navigate = useNavigate();
  const { data: programas, isLoading } = useProgramasVidaMinisterio();
  const eliminar = useEliminarProgramaVidaMinisterio();
  const { participantes } = useParticipantes();
  const { roles, isAdminOrEditorInCongregacion } = useAuthContext();
  const { congregacionActual } = useCongregacion();

  const congregacionId = congregacionActual?.id || "";
  const isSuperAdmin = roles.includes("super_admin");
  const isSvMinisterio = roles.includes("svministerio");
  const canEdit =
    isSuperAdmin || isSvMinisterio || (congregacionId && isAdminOrEditorInCongregacion(congregacionId));

  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id?: string; label?: string }>({
    open: false,
  });

  const nombreParticipante = (id: string | null) => {
    if (!id) return "—";
    const p = participantes?.find((x) => x.id === id);
    return p ? `${p.nombre} ${p.apellido}` : "—";
  };

  const irNueva = () => {
    const lunes = format(getMonday(new Date()), "yyyy-MM-dd");
    navigate(`/vida-y-ministerio/${lunes}`);
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
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BookOpen className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Vida y Ministerio</h1>
            <p className="text-sm text-muted-foreground">Reuniones entre semana</p>
          </div>
        </div>
        {canEdit && (
          <Button onClick={irNueva} className="gap-1">
            <Plus className="h-4 w-4" />
            Nueva semana
          </Button>
        )}
      </div>

      {!programas || programas.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>Aún no hay programas creados.</p>
            {canEdit && (
              <Button variant="outline" size="sm" className="mt-3" onClick={irNueva}>
                Crear el primero
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Semana</TableHead>
                  <TableHead>Presidente</TableHead>
                  <TableHead>Estudio bíblico</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                  <TableHead className="w-[140px] text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {programas.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      {format(parseISO(p.fecha_semana), "EEEE d 'de' MMM yyyy", { locale: es })}
                    </TableCell>
                    <TableCell>{nombreParticipante(p.presidente_id)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {p.estudio_biblico?.titulo || "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={p.estado === "completo" ? "default" : "secondary"}>
                        {p.estado === "completo" ? "Completo" : "Borrador"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate(`/vida-y-ministerio/${p.fecha_semana}`)}
                          title={canEdit ? "Editar" : "Ver"}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() =>
                              setDeleteDialog({
                                open: true,
                                id: p.id,
                                label: format(parseISO(p.fecha_semana), "d 'de' MMM yyyy", {
                                  locale: es,
                                }),
                              })
                            }
                            title="Eliminar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <ConfirmDeleteDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog((d) => ({ ...d, open }))}
        title="Eliminar programa"
        description={`¿Eliminar el programa de la semana del ${deleteDialog.label}? Esta acción no se puede deshacer.`}
        onConfirm={() => {
          if (deleteDialog.id) eliminar.mutate(deleteDialog.id);
          setDeleteDialog({ open: false });
        }}
      />
    </div>
  );
}
