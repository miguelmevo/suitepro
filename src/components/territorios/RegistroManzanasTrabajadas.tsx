import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2, Lock, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCiclosTerritorios } from "@/hooks/useCiclosTerritorios";
import { obtenerEstadoRegistroManzanas } from "@/lib/estadoRegistroManzanas";
import { ConfirmarOtraVueltaDialog } from "@/components/territorios/ConfirmarOtraVueltaDialog";
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
  /** Se llama cuando todo el envío quedó guardado. */
  onEnviado?: (territorioCompletado: boolean) => void;
}

export function RegistroManzanasTrabajadas({
  territorioId,
  congregacionId,
  manzanas,
  onClose,
  onEnviado,
}: RegistroManzanasTrabajadasProps) {
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set());
  const [enviando, setEnviando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);

  const { data: estado, refetch: refrescarEstado, isLoading: cargandoEstado } = useQuery({
    queryKey: ["estado-registro-manzanas", territorioId],
    queryFn: () => obtenerEstadoRegistroManzanas(territorioId),
    // El bloqueo vence con el tiempo: se vuelve a consultar al abrir y cada minuto.
    refetchOnMount: "always",
    refetchInterval: 60_000,
  });

  const {
    cicloActivo,
    trabajadasIds,
    marcarManzana,
    isLoading,
  } = useCiclosTerritorios(territorioId, congregacionId);

  const disponibles = manzanas.filter((m) => !trabajadasIds.has(m.id));
  const bloqueadas = new Set(estado?.bloqueo_activo ? estado.recientes : []);
  const porEnviar = [...seleccionadas].filter((id) => !bloqueadas.has(id));

  const toggleSeleccion = (id: string) => {
    setSeleccionadas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const registrar = async () => {
    setEnviando(true);
    const hoy = format(new Date(), "yyyy-MM-dd");
    try {
      let completado = false;
      for (const manzanaId of porEnviar) {
        const resultado = await marcarManzana.mutateAsync({ manzanaId, fechaTrabajada: hoy });
        completado = completado || resultado.ciclo_completado;
      }
      setSeleccionadas(new Set());
      onEnviado?.(completado);
      onClose?.();
    } catch {
      // error handled by hook toast
    } finally {
      setEnviando(false);
    }
  };

  const handleEnviar = async () => {
    if (porEnviar.length === 0) return;
    setEnviando(true);
    // Se consulta justo antes de enviar, por si la pantalla quedó abierta.
    const { data: actual } = await refrescarEstado();
    setEnviando(false);
    const repetidas = actual ? porEnviar.filter((id) => actual.recientes.includes(id)) : [];
    if (repetidas.length === 0) {
      await registrar();
    } else if (actual!.bloqueo_activo) {
      setSeleccionadas((prev) => new Set([...prev].filter((id) => !repetidas.includes(id))));
    } else {
      setConfirmar(true);
    }
  };

  if (isLoading || cargandoEstado) {
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
            {disponibles.map((m) => bloqueadas.has(m.id) ? (
              <Button
                key={m.id}
                variant="outline"
                size="sm"
                className="relative h-10 w-10 bg-muted p-0 text-base font-bold text-muted-foreground"
                aria-label={`Manzana ${m.letra} bloqueada`}
                disabled
              >
                {m.letra}
                <Lock className="absolute right-0.5 top-0.5 !h-3 !w-3" />
              </Button>
            ) : (
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
            <div className="w-2" />
            <Button
              size="sm"
              className="gap-1.5 h-10"
              onClick={handleEnviar}
              disabled={porEnviar.length === 0 || enviando}
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

      <ConfirmarOtraVueltaDialog open={confirmar} onOpenChange={setConfirmar} onConfirm={registrar} />

      {/* Cycle info */}
      {cicloActivo && (
        <p className="text-xs text-muted-foreground">
          Ciclo #{cicloActivo.ciclo_numero} · Inicio: {format(new Date(cicloActivo.fecha_inicio + "T12:00:00"), "dd/MM/yyyy")}
        </p>
      )}
    </div>
  );
}
