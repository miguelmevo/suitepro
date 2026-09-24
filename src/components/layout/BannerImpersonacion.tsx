import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useImpersonacion, volverAMiCuenta } from "@/lib/impersonacion";

/** Aviso fijo mientras un administrador ve la app como otro usuario. */
export function BannerImpersonacion() {
  const estado = useImpersonacion();
  if (!estado) return null;
  return (
    <div className="fixed bottom-20 md:bottom-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 rounded-full border border-amber-400 bg-amber-100 px-4 py-2 text-sm text-amber-950 shadow-lg max-w-[95vw]">
      <Eye className="h-4 w-4 shrink-0" />
      <span className="truncate">Viendo como <strong>{estado.nombre}</strong></span>
      <Button size="sm" className="h-7 shrink-0" onClick={() => volverAMiCuenta()}>
        Volver a mi cuenta
      </Button>
    </div>
  );
}
