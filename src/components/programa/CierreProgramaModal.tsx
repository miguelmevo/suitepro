import { useState } from "react";
import { Lock, Unlock, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ProgramaPublicado } from "@/hooks/useProgramasPublicados";
import { useAuth } from "@/hooks/useAuth";

interface CierreProgramaModalProps {
  programaPublicado: ProgramaPublicado | undefined;
  onCerrar: () => void;
  onReabrir: () => void;
  isPendingCerrar: boolean;
  isPendingReabrir: boolean;
  onPublicarPrimero: () => void;
}

export function CierreProgramaModal({
  programaPublicado,
  onCerrar,
  onReabrir,
  isPendingCerrar,
  isPendingReabrir,
  onPublicarPrimero,
}: CierreProgramaModalProps) {
  const [showConfirmCierre, setShowConfirmCierre] = useState(false);
  const [showConfirmReabrir, setShowConfirmReabrir] = useState(false);
  const { isSuperAdmin } = useAuth();

  const estaCerrado = programaPublicado?.cerrado ?? false;

  const handleCerrarClick = () => {
    if (!programaPublicado) {
      onPublicarPrimero();
      return;
    }
    setShowConfirmCierre(true);
  };

  const handleConfirmCierre = () => {
    setShowConfirmCierre(false);
    onCerrar();
  };

  const handleReabrirClick = () => {
    setShowConfirmReabrir(true);
  };

  const handleConfirmReabrir = () => {
    setShowConfirmReabrir(false);
    onReabrir();
  };

  // Si está cerrado, mostrar botón de reabrir (solo para super_admin)
  if (estaCerrado) {
    if (!isSuperAdmin) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              disabled
              className="bg-gray-100 border-gray-300 text-gray-500"
            >
              <Lock className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Programa cerrado</TooltipContent>
        </Tooltip>
      );
    }

    return (
      <>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              onClick={handleReabrirClick}
              disabled={isPendingReabrir}
              className="bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-600"
            >
              {isPendingReabrir ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Unlock className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Reabrir programa</TooltipContent>
        </Tooltip>

        <AlertDialog open={showConfirmReabrir} onOpenChange={setShowConfirmReabrir}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Unlock className="h-5 w-5 text-emerald-600" />
                Reabrir Programa
              </AlertDialogTitle>
              <AlertDialogDescription>
                ¿Estás seguro de que deseas reabrir este programa? Esto permitirá
                que los editores puedan realizar cambios nuevamente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmReabrir}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                Reabrir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  // Botón de cerrar programa
  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            onClick={handleCerrarClick}
            disabled={isPendingCerrar}
            className="bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20 text-amber-600"
          >
            {isPendingCerrar ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Lock className="h-4 w-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {programaPublicado ? "Cerrar programa" : "Publicar y cerrar programa"}
        </TooltipContent>
      </Tooltip>

      <AlertDialog open={showConfirmCierre} onOpenChange={setShowConfirmCierre}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Cerrar Programa
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                ¿Estás seguro de que deseas cerrar este programa? Esto realizará
                las siguientes acciones:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Se bloquearán todas las ediciones del programa</li>
                <li>Solo un super administrador podrá reabrir el programa</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmCierre}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Cerrar Programa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
