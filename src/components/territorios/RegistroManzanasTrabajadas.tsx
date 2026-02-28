import { useState } from "react";
import { format } from "date-fns";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCiclosTerritorios } from "@/hooks/useCiclosTerritorios";
import { cn } from "@/lib/utils";

interface ManzanaDisponible {
  id: string;
  letra: string;
}

interface RegistroManzanasTrabajadasProps {
  territorioId: string;
  congregacionId: string;
  manzanas: ManzanaDisponible[];
  onClose?: () => void;
}

export function RegistroManzanasTrabajadas({
  territorioId,
  congregacionId,
  manzanas,
  onClose,
}: RegistroManzanasTrabajadasProps) {
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set());
  const [enviando, setEnviando] = useState(false);

  const {
    cicloActivo,
    trabajadasIds,
    marcarManzana,
    isLoading,
  } = useCiclosTerritorios(territorioId, congregacionId);

  const disponibles = manzanas.filter((m) => !trabajadasIds.has(m.id));

  const toggleSeleccion = (id: string) => {
    setSeleccionadas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleEnviar = async () => {
    if (seleccionadas.size === 0) return;
    setEnviando(true);
    const hoy = format(new Date(), "yyyy-MM-dd");
    try {
      for (const manzanaId of seleccionadas) {
        await marcarManzana.mutateAsync({ manzanaId, fechaTrabajada: hoy });
      }
      setSeleccionadas(new Set());
      onClose?.();
    } catch {
      // error handled by hook toast
    } finally {
      setEnviando(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {disponibles.length > 0 ? (
        <div>
          <p className="text-sm font-medium mb-2">Selecciona las manzanas trabajadas</p>
          <div className="flex flex-wrap gap-2 items-center">
            {disponibles.map((m) => (
              <Button
                key={m.id}
                variant={seleccionadas.has(m.id) ? "default" : "outline"}
                size="sm"
                className={cn(
                  "h-10 w-10 p-0 text-base font-bold transition-colors",
                  seleccionadas.has(m.id) && "bg-green-600 hover:bg-green-700 text-white border-green-600"
                )}
                onClick={() => toggleSeleccion(m.id)}
                disabled={enviando}
              >
                {m.letra}
              </Button>
            ))}
            <Button
              size="sm"
              className="gap-1.5 h-10"
              onClick={handleEnviar}
              disabled={seleccionadas.size === 0 || enviando}
            >
              {enviando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Enviar
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground italic">
          Todas las manzanas han sido trabajadas en este ciclo.
        </p>
      )}

      {/* Cycle info */}
      {cicloActivo && (
        <p className="text-xs text-muted-foreground">
          Ciclo #{cicloActivo.ciclo_numero} · Inicio: {format(new Date(cicloActivo.fecha_inicio + "T12:00:00"), "dd/MM/yyyy")}
        </p>
      )}
    </div>
  );
}
