import { useState, type ReactNode } from "react";
import { Loader2, Pencil, Plus, UserMinus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

export interface FilaUsuarioDialogo {
  id: string;
  titulo: string;
  subtitulo: string;
  badges: string[];
  /** Si no se puede quitar, el motivo (se muestra en el botón deshabilitado). */
  motivoNoQuitar?: string;
  /** Fila fija (p. ej. Administrador): se muestra solo con su etiqueta, sin botones. */
  sinBotones?: boolean;
  /** Si existe, se muestra un botón "Modificar". */
  onModificar?: () => void;
}

interface Props {
  abierto: boolean;
  titulo: string;
  descripcion: string;
  cargando: boolean;
  ocupado: boolean;
  filas: FilaUsuarioDialogo[];
  textoVacio: string;
  opcionesAgregar: { id: string; label: string }[];
  /** Controles extra junto al selector de agregar (por ejemplo, las acciones). */
  extraAgregar?: ReactNode;
  confirmarQuitarTitulo: string;
  confirmarQuitarTexto: (fila: FilaUsuarioDialogo) => string;
  onQuitar: (id: string) => void;
  onAgregar: (id: string) => Promise<void> | void;
  onClose: () => void;
}

/**
 * Pantalla común de "quién tiene esto": lista de usuarios con su detalle,
 * botón Quitar (con confirmación) y selector para agregar a otro usuario.
 * La usan tanto el diálogo de perfiles como el de permisos por módulo.
 */
export function UsuariosDialogBase(props: Props) {
  const {
    abierto, titulo, descripcion, cargando, ocupado, filas, textoVacio, opcionesAgregar, extraAgregar,
    confirmarQuitarTitulo, confirmarQuitarTexto, onQuitar, onAgregar, onClose,
  } = props;
  const [seleccionado, setSeleccionado] = useState("");
  const [aQuitar, setAQuitar] = useState<FilaUsuarioDialogo | null>(null);

  return (
    <>
      <Dialog open={abierto} onOpenChange={(v) => !v && !ocupado && onClose()}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{titulo}</DialogTitle>
            <DialogDescription>{descripcion}</DialogDescription>
          </DialogHeader>

          {cargando ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="max-h-[45vh] overflow-y-auto rounded-md border divide-y">
                {filas.length > 0 ? (
                  filas.map((f) => (
                    <div key={f.id} className="px-3 py-2 space-y-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium truncate">{f.titulo}</p>
                        <div className="flex flex-wrap items-center justify-end gap-1 shrink-0">
                          {f.badges.map((b) => (
                            <Badge key={b} variant="secondary" className="text-[10px] font-normal">{b}</Badge>
                          ))}
                          {!f.sinBotones && f.onModificar && (
                            <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" disabled={ocupado} onClick={f.onModificar}>
                              <Pencil className="h-3.5 w-3.5" />
                              Modificar
                            </Button>
                          )}
                          {!f.sinBotones && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 gap-1 px-2 text-xs text-destructive hover:text-destructive"
                              disabled={ocupado || !!f.motivoNoQuitar}
                              title={f.motivoNoQuitar}
                              onClick={() => setAQuitar(f)}
                            >
                              <UserMinus className="h-3.5 w-3.5" />
                              Quitar
                            </Button>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{f.subtitulo}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-6">{textoVacio}</p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Select value={seleccionado} onValueChange={setSeleccionado}>
                    <SelectTrigger className="flex-1 min-w-0">
                      <SelectValue placeholder="Agregar a un usuario..." />
                    </SelectTrigger>
                    <SelectContent>
                      {opcionesAgregar.length > 0 ? (
                        opcionesAgregar.map((o) => (
                          <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
                        ))
                      ) : (
                        <SelectItem value="_none" disabled>No hay más usuarios para agregar</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <Button
                    className="gap-1.5 shrink-0"
                    disabled={!seleccionado || ocupado}
                    onClick={async () => {
                      try {
                        await onAgregar(seleccionado);
                        setSeleccionado("");
                      } catch {
                        // el llamador ya avisó el error
                      }
                    }}
                  >
                    {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Agregar
                  </Button>
                </div>
                {extraAgregar}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!aQuitar} onOpenChange={(v) => !v && setAQuitar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmarQuitarTitulo}</AlertDialogTitle>
            <AlertDialogDescription>{aQuitar ? confirmarQuitarTexto(aQuitar) : ""}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (aQuitar) onQuitar(aQuitar.id);
                setAQuitar(null);
              }}
            >
              Quitar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
