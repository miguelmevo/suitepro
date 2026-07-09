import { useState } from "react";
import { Search, UserPlus, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Participante } from "@/hooks/useParticipantes";
import type { GrupoPredicacion } from "@/hooks/useGruposPredicacion";

interface AgregarParticipanteGrupoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  grupoDestino: GrupoPredicacion;
  participantes: Participante[];
  grupos: GrupoPredicacion[];
  onAsignar: (participanteId: string, grupoId: string) => void;
}

const RESP_ABBR: Record<string, string> = {
  anciano: "A",
  siervo_ministerial: "SM",
  precursor_regular: "PR",
};

const RESP_COLORS: Record<string, string> = {
  anciano: "bg-green-500 text-white",
  siervo_ministerial: "bg-orange-400 text-white",
  precursor_regular: "bg-yellow-400 text-black",
};

export function AgregarParticipanteGrupoModal({
  open,
  onOpenChange,
  grupoDestino,
  participantes,
  grupos,
  onAsignar,
}: AgregarParticipanteGrupoModalProps) {
  const [busqueda, setBusqueda] = useState("");

  // Solo participantes activos (activo=true) sin grupo asignado
  const sinGrupo = participantes.filter(
    (p) =>
      p.activo &&
      !p.grupo_predicacion_id &&
      (`${p.nombre} ${p.apellido}`.toLowerCase().includes(busqueda.toLowerCase()) ||
        `${p.apellido} ${p.nombre}`.toLowerCase().includes(busqueda.toLowerCase()))
  );

  const getGrupoNombre = (grupoId: string | null) => {
    if (!grupoId) return null;
    const g = grupos.find((gr) => gr.id === grupoId);
    return g ? `Grupo ${g.numero}` : null;
  };

  const handleAsignar = (participanteId: string) => {
    onAsignar(participanteId, grupoDestino.id);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setBusqueda(""); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">
            Agregar a Grupo Nro. {grupoDestino.numero}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar participante..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-10"
            />
          </div>

          <ScrollArea className="h-[350px] rounded-md border">
            {sinGrupo.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-4">
                <p className="text-muted-foreground text-center text-sm">
                  {busqueda
                    ? "No se encontraron participantes"
                    : "Todos los participantes ya tienen grupo asignado"}
                </p>
              </div>
            ) : (
              <div className="p-1.5 space-y-0.5">
                {sinGrupo.map((p) => {
                  const badges = (Array.isArray(p.responsabilidad) ? p.responsabilidad : [])
                    .filter((r) => RESP_ABBR[r]);

                  return (
                    <div
                      key={p.id}
                      className={cn(
                        "flex items-center justify-between p-2.5 rounded-md hover:bg-secondary transition-colors",
                        p.es_publicador_inactivo && "opacity-60 bg-amber-50/50 dark:bg-amber-950/10"
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="min-w-0">
                          <p className={cn("text-sm font-medium truncate", p.es_publicador_inactivo && "italic")}>
                            {p.apellido}, {p.nombre}
                            {p.es_publicador_inactivo && (
                              <span className="ml-1 text-[10px] text-red-600 font-semibold">(PIN)</span>
                            )}
                          </p>
                        </div>
                        <div className="flex gap-0.5 shrink-0">
                          {badges.map((b) => (
                            <span
                              key={b}
                              className={cn(
                                "px-1 py-0.5 rounded text-[10px] font-bold",
                                RESP_COLORS[b]
                              )}
                            >
                              {RESP_ABBR[b]}
                            </span>
                          ))}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="ml-2 shrink-0"
                        onClick={() => handleAsignar(p.id)}
                      >
                        <UserPlus className="h-3.5 w-3.5 mr-1" />
                        Agregar
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
