import { useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuthContext } from "@/contexts/AuthProvider";
import { useConsentimiento } from "@/hooks/useConsentimiento";
import { estaImpersonando } from "@/lib/impersonacion";
import { EVENTO_ABRIR_CONSENTIMIENTO } from "@/lib/consentimiento";

interface Aviso {
  id: string;
  titulo: string;
  detalle: string;
  accion: string;
  onAccion: () => void;
}

/** Campana de avisos: hoy muestra el consentimiento pendiente; queda lista para otros mensajes. */
export function CampanaAvisos({ className }: { className?: string }) {
  const { user } = useAuthContext();
  const { congregacionId, aceptado, cargando } = useConsentimiento();
  const [abierto, setAbierto] = useState(false);

  const avisos: Aviso[] = [];
  if (user && congregacionId && !cargando && !aceptado && !estaImpersonando()) {
    avisos.push({
      id: "consentimiento",
      titulo: "Consentimiento pendiente",
      detalle: "Tienes pendiente aceptar el tratamiento de tus datos personales.",
      accion: "Revisar y aceptar",
      onAccion: () => {
        setAbierto(false);
        window.dispatchEvent(new Event(EVENTO_ABRIR_CONSENTIMIENTO));
      },
    });
  }

  if (!user) return null;

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`relative h-8 w-8 text-muted-foreground ${className ?? ""}`}
          aria-label={avisos.length ? `Avisos (${avisos.length} pendientes)` : "Avisos"}
          title="Avisos"
        >
          <Bell className="h-4 w-4" />
          {avisos.length > 0 && <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        <div className="px-4 py-3 border-b text-sm font-semibold">Avisos</div>
        {avisos.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground text-center">No tienes avisos pendientes.</p>
        ) : (
          <ul className="divide-y">
            {avisos.map((a) => (
              <li key={a.id} className="px-4 py-3 space-y-2">
                <p className="text-sm font-medium">{a.titulo}</p>
                <p className="text-xs text-muted-foreground">{a.detalle}</p>
                <Button size="sm" onClick={a.onAccion}>{a.accion}</Button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
