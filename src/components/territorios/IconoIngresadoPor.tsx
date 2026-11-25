import { UserPen } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Marca que las manzanas las ingresó alguien distinto del capitán. El nombre se
 * ve al pasar el mouse. Solo en la versión de escritorio.
 */
export function IconoIngresadoPor({ nombres }: { nombres: string[] }) {
  if (nombres.length === 0) return null;
  const texto = `Ingresado por: ${nombres.join(", ")}`;
  return (
    <Tooltip delayDuration={100}>
      <TooltipTrigger asChild>
        <span
          className="ml-1 hidden align-middle text-sky-600 dark:text-sky-400 md:inline-flex"
          aria-label={texto}
          tabIndex={0}
        >
          <UserPen className="h-3.5 w-3.5" />
        </span>
      </TooltipTrigger>
      <TooltipContent>{texto}</TooltipContent>
    </Tooltip>
  );
}
