import { useState } from "react";
import { Eraser, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

type TipoLimpieza = "todo" | "capitanes" | "territorios" | "puntos";

const OPCIONES_LIMPIEZA: { value: TipoLimpieza; label: string; descripcion: string }[] = [
  { value: "capitanes", label: "Solo capitanes", descripcion: "Quitar todos los capitanes asignados" },
  { value: "territorios", label: "Solo territorios", descripcion: "Quitar todos los territorios asignados" },
  { value: "puntos", label: "Solo puntos de encuentro", descripcion: "Quitar todos los puntos de encuentro" },
  { value: "todo", label: "Todo el programa", descripcion: "Eliminar todas las entradas del período" },
];

interface LimpiarProgramaModalProps {
  onLimpiar: (tipo: TipoLimpieza) => void;
  isPending: boolean;
  cantidadEntradas: number;
}

export function LimpiarProgramaModal({
  onLimpiar,
  isPending,
  cantidadEntradas,
}: LimpiarProgramaModalProps) {
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<TipoLimpieza>("capitanes");

  const handleLimpiar = () => {
    onLimpiar(tipo);
    setOpen(false);
  };

  const opcionSeleccionada = OPCIONES_LIMPIEZA.find((o) => o.value === tipo);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="bg-red-500/10 border-red-500/30 hover:bg-red-500/20 text-red-600"
            onClick={() => setOpen(true)}
            aria-label="Limpiar programa"
          >
            <Eraser className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Limpiar Programa</TooltipContent>
      </Tooltip>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Limpiar Programa</DialogTitle>
          <DialogDescription>
            Selecciona qué deseas limpiar del programa actual
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>¿Qué deseas limpiar?</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as TipoLimpieza)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPCIONES_LIMPIEZA.map((opcion) => (
                  <SelectItem key={opcion.value} value={opcion.value}>
                    {opcion.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {opcionSeleccionada && (
              <p className="text-sm text-muted-foreground">
                {opcionSeleccionada.descripcion}
              </p>
            )}
          </div>

          {tipo === "todo" && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Esta acción eliminará <strong>todas las {cantidadEntradas} entradas</strong> del período actual. Esta acción no se puede deshacer.
              </AlertDescription>
            </Alert>
          )}

          {tipo !== "todo" && cantidadEntradas > 0 && (
            <p className="text-sm text-muted-foreground">
              Se afectarán hasta {cantidadEntradas} entradas del período actual.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            variant={tipo === "todo" ? "destructive" : "default"}
            onClick={handleLimpiar}
            disabled={isPending || cantidadEntradas === 0}
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Limpiando...
              </>
            ) : (
              <>
                <Eraser className="h-4 w-4 mr-2" />
                Limpiar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
