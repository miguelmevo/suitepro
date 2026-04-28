import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addMonths,
  subMonths,
} from "date-fns";
import { es } from "date-fns/locale";
import {
  Plus,
  Edit,
  Trash2,
  BookOpen,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

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

  const [mesActual, setMesActual] = useState<Date>(startOfMonth(new Date()));
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id?: string; label?: string }>({
    open: false,
  });

  // Todos los martes del mes seleccionado
  const martesDelMes = useMemo(() => {
    const dias = eachDayOfInterval({
      start: startOfMonth(mesActual),
      end: endOfMonth(mesActual),
    });
    return dias.filter((d) => d.getDay() === 2); // 2 = martes
  }, [mesActual]);

  const programasPorLunes = useMemo(() => {
    const map = new Map<string, (typeof programas)[number]>();
    (programas ?? []).forEach((p) => map.set(p.fecha_semana, p));
    return map;
  }, [programas]);

  const nombreParticipante = (id: string | null) => {
    if (!id) return "—";
    const p = participantes?.find((x) => x.id === id);
    return p ? `${p.nombre} ${p.apellido}` : "—";
  };

  const irAFecha = (martes: Date) => {
    const lunes = format(getMonday(martes), "yyyy-MM-dd");
    navigate(`/vida-y-ministerio/${lunes}`);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const nombreMes = format(mesActual, "MMMM yyyy", { locale: es });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BookOpen className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Vida y Ministerio</h1>
          <p className="text-sm text-muted-foreground">Reuniones entre semana</p>
        </div>
      </div>

      {/* Selector de mes */}
      <Card>
        <CardContent className="flex items-center justify-between gap-3 py-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMesActual((m) => subMonths(m, 1))}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Mes anterior
          </Button>
          <div className="text-center">
            <div className="text-lg font-semibold capitalize">{nombreMes}</div>
            <button
              type="button"
              onClick={() => setMesActual(startOfMonth(new Date()))}
              className="text-xs text-muted-foreground hover:text-primary underline-offset-2 hover:underline"
            >
              Ir al mes actual
            </button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMesActual((m) => addMonths(m, 1))}
          >
            Mes siguiente
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </CardContent>
      </Card>

      {/* Listado de martes */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Semana (martes)</TableHead>
                <TableHead>Presidente</TableHead>
                <TableHead>Lectura Bíblica de la Semana</TableHead>
                <TableHead className="text-center">Estado</TableHead>
                <TableHead className="w-[160px] text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {martesDelMes.map((martes) => {
                const lunesStr = format(getMonday(martes), "yyyy-MM-dd");
                const p = programasPorLunes.get(lunesStr);
                return (
                  <TableRow
                    key={lunesStr}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() => irAFecha(martes)}
                  >
                    <TableCell className="font-medium capitalize">
                      {format(martes, "EEEE d 'de' MMM yyyy", { locale: es })}
                    </TableCell>
                    <TableCell>
                      {p ? nombreParticipante(p.presidente_id) : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {p?.lectura_semana || "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      {p ? (
                        <Badge variant={p.estado === "completo" ? "default" : "secondary"}>
                          {p.estado === "completo" ? "Completo" : "Borrador"}
                        </Badge>
                      ) : (
                        <Badge variant="outline">Sin crear</Badge>
                      )}
                    </TableCell>
                    <TableCell
                      className="text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-1">
                        {p ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => irAFecha(martes)}
                            title={canEdit ? "Editar" : "Ver"}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        ) : (
                          canEdit && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => irAFecha(martes)}
                              className="gap-1"
                            >
                              <Plus className="h-4 w-4" />
                              Crear
                            </Button>
                          )
                        )}
                        {p && canEdit && (
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
                );
              })}
              {martesDelMes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                    No hay martes en este mes.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
