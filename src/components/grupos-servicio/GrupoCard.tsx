import { useState } from "react";
import { Users, Crown, MoreVertical, Trash2, UserPlus, Edit } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { GrupoConMiembros } from "@/types/grupos-servicio";
import { AgregarMiembroModal } from "./AgregarMiembroModal";

interface GrupoCardProps {
  grupo: GrupoConMiembros;
  onEliminar: (id: string) => void;
  onAgregarMiembro: (data: { participante_id: string; grupo_id: string; es_capitan?: boolean }) => void;
  onRemoverMiembro: (data: { participante_id: string; grupo_id: string }) => void;
  onToggleCapitan: (data: { participante_id: string; grupo_id: string; es_capitan: boolean }) => void;
  onEditar: (grupo: GrupoConMiembros) => void;
}

export function GrupoCard({
  grupo,
  onEliminar,
  onAgregarMiembro,
  onRemoverMiembro,
  onToggleCapitan,
  onEditar,
}: GrupoCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showAgregarMiembro, setShowAgregarMiembro] = useState(false);

  const capitan = grupo.miembros.find((m) => m.es_capitan);
  const miembrosOrdenados = [...grupo.miembros].sort((a, b) => {
    if (a.es_capitan) return -1;
    if (b.es_capitan) return 1;
    // Ordenar por apellido, luego nombre
    const apellidoCompare = (a.participante?.apellido ?? "").localeCompare(b.participante?.apellido ?? "");
    if (apellidoCompare !== 0) return apellidoCompare;
    return (a.participante?.nombre ?? "").localeCompare(b.participante?.nombre ?? "");
  });

  return (
    <>
      <Card className="animate-fade-in hover:shadow-lg transition-shadow duration-200">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="font-display text-lg">{grupo.nombre}</CardTitle>
              {grupo.descripcion && (
                <p className="text-sm text-muted-foreground">{grupo.descripcion}</p>
              )}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEditar(grupo)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Editar grupo
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowAgregarMiembro(true)}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Agregar miembro
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => setShowDeleteDialog(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar grupo
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {grupo.miembros.length} miembro{grupo.miembros.length !== 1 ? "s" : ""}
            </span>
          </div>

          {miembrosOrdenados.length > 0 ? (
            <div className="space-y-2">
              {miembrosOrdenados.map((miembro) => (
                <div
                  key={miembro.id}
                  className="flex items-center justify-between p-2 rounded-md bg-secondary/50 hover:bg-secondary transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {miembro.es_capitan && (
                      <Crown className="h-4 w-4 text-warning" />
                    )}
                    <span className="text-sm font-medium">
                      {miembro.participante?.apellido}, {miembro.participante?.nombre}
                    </span>
                    {miembro.es_capitan && (
                      <Badge variant="secondary" className="text-xs">
                        Capitán
                      </Badge>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <MoreVertical className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() =>
                          onToggleCapitan({
                            participante_id: miembro.participante_id,
                            grupo_id: grupo.id,
                            es_capitan: !miembro.es_capitan,
                          })
                        }
                      >
                        <Crown className="mr-2 h-4 w-4" />
                        {miembro.es_capitan ? "Quitar capitán" : "Hacer capitán"}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() =>
                          onRemoverMiembro({
                            participante_id: miembro.participante_id,
                            grupo_id: grupo.id,
                          })
                        }
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Remover del grupo
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic text-center py-4">
              Sin miembros asignados
            </p>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar grupo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará el grupo "{grupo.nombre}" y todos sus miembros asociados.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => onEliminar(grupo.id)}
          >
            Aceptar
          </AlertDialogAction>
        </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AgregarMiembroModal
        open={showAgregarMiembro}
        onOpenChange={setShowAgregarMiembro}
        grupoId={grupo.id}
        miembrosActuales={grupo.miembros.map((m) => m.participante_id)}
        onAgregar={onAgregarMiembro}
      />
    </>
  );
}