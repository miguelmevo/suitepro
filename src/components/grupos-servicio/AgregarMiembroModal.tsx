import { useState } from "react";
import { Search, UserPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useParticipantes } from "@/hooks/useParticipantes";

interface AgregarMiembroModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  grupoId: string;
  miembrosActuales: string[];
  onAgregar: (data: { participante_id: string; grupo_id: string; es_capitan?: boolean }) => void;
}

export function AgregarMiembroModal({
  open,
  onOpenChange,
  grupoId,
  miembrosActuales,
  onAgregar,
}: AgregarMiembroModalProps) {
  const { participantes, isLoading } = useParticipantes();
  const [busqueda, setBusqueda] = useState("");
  const [esCapitan, setEsCapitan] = useState(false);

  const participantesDisponibles = participantes.filter(
    (p) =>
      !miembrosActuales.includes(p.id) &&
      (p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        p.apellido.toLowerCase().includes(busqueda.toLowerCase()))
  );

  const handleAgregar = (participanteId: string) => {
    onAgregar({
      participante_id: participanteId,
      grupo_id: grupoId,
      es_capitan: esCapitan,
    });
    setEsCapitan(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Agregar Miembro al Grupo</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar participante..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="esCapitan"
              checked={esCapitan}
              onCheckedChange={(checked) => setEsCapitan(checked === true)}
            />
            <Label htmlFor="esCapitan" className="text-sm">
              Asignar como capitán del grupo
            </Label>
          </div>

          <ScrollArea className="h-[300px] rounded-md border">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">Cargando...</p>
              </div>
            ) : participantesDisponibles.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-4">
                <p className="text-muted-foreground text-center">
                  {busqueda
                    ? "No se encontraron participantes"
                    : "Todos los participantes ya están en el grupo"}
                </p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {participantesDisponibles.map((participante) => (
                  <div
                    key={participante.id}
                    className="flex items-center justify-between p-3 rounded-md hover:bg-secondary transition-colors"
                  >
                    <div>
                      <p className="font-medium">
                        {participante.nombre} {participante.apellido}
                      </p>
                      {participante.telefono && (
                        <p className="text-sm text-muted-foreground">
                          {participante.telefono}
                        </p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleAgregar(participante.id)}
                    >
                      <UserPlus className="h-4 w-4 mr-1" />
                      Agregar
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}