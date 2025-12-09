import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Plus, Loader2 } from "lucide-react";
import { HorarioSalida, PuntoEncuentro, Territorio } from "@/types/programa-predicacion";
import { Participante } from "@/types/grupos-servicio";

interface EntradaFormModalProps {
  fecha: Date;
  horarios: HorarioSalida[];
  puntos: PuntoEncuentro[];
  territorios: Territorio[];
  participantes: Participante[];
  onSubmit: (data: {
    fecha: string;
    horario_id?: string;
    punto_encuentro_id?: string;
    territorio_id?: string;
    capitan_id?: string;
    es_mensaje_especial?: boolean;
    mensaje_especial?: string;
    colspan_completo?: boolean;
  }) => void;
  isLoading?: boolean;
}

export function EntradaFormModal({
  fecha,
  horarios,
  puntos,
  territorios,
  participantes,
  onSubmit,
  isLoading,
}: EntradaFormModalProps) {
  const [open, setOpen] = useState(false);
  const [esMensaje, setEsMensaje] = useState(false);
  const [colspanCompleto, setColspanCompleto] = useState(false);
  const [horarioId, setHorarioId] = useState("");
  const [puntoId, setPuntoId] = useState("");
  const [territorioId, setTerritorioId] = useState("");
  const [capitanId, setCapitanId] = useState("");
  const [mensaje, setMensaje] = useState("");

  const handleSubmit = () => {
    onSubmit({
      fecha: format(fecha, "yyyy-MM-dd"),
      horario_id: esMensaje && colspanCompleto ? undefined : horarioId || undefined,
      punto_encuentro_id: esMensaje ? undefined : puntoId || undefined,
      territorio_id: esMensaje ? undefined : territorioId || undefined,
      capitan_id: esMensaje ? undefined : capitanId || undefined,
      es_mensaje_especial: esMensaje,
      mensaje_especial: esMensaje ? mensaje : undefined,
      colspan_completo: colspanCompleto,
    });
    setOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setEsMensaje(false);
    setColspanCompleto(false);
    setHorarioId("");
    setPuntoId("");
    setTerritorioId("");
    setCapitanId("");
    setMensaje("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="h-4 w-4 mr-1" />
          Agregar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Agregar entrada - {format(fecha, "EEEE d 'de' MMMM", { locale: es })}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch checked={esMensaje} onCheckedChange={setEsMensaje} />
            <Label>Es mensaje especial (sin predicación)</Label>
          </div>

          {esMensaje && (
            <div className="flex items-center gap-3">
              <Switch checked={colspanCompleto} onCheckedChange={setColspanCompleto} />
              <Label>Aplica todo el día</Label>
            </div>
          )}

          {(!esMensaje || !colspanCompleto) && (
            <div className="space-y-2">
              <Label>Horario</Label>
              <Select value={horarioId} onValueChange={setHorarioId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar horario" />
                </SelectTrigger>
                <SelectContent>
                  {horarios.map((h) => (
                    <SelectItem key={h.id} value={h.id}>
                      {h.hora.slice(0, 5)} - {h.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {esMensaje ? (
            <div className="space-y-2">
              <Label>Mensaje</Label>
              <Input
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
                placeholder="Ej: Reunión de servicio"
              />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Punto de encuentro</Label>
                <Select value={puntoId} onValueChange={setPuntoId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar punto" />
                  </SelectTrigger>
                  <SelectContent>
                    {puntos.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Territorio</Label>
                <Select value={territorioId} onValueChange={setTerritorioId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar territorio" />
                  </SelectTrigger>
                  <SelectContent>
                    {territorios.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.numero} {t.nombre && `- ${t.nombre}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Capitán</Label>
                <Select value={capitanId} onValueChange={setCapitanId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar capitán" />
                  </SelectTrigger>
                  <SelectContent>
                    {participantes.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nombre} {p.apellido}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <Button onClick={handleSubmit} disabled={isLoading} className="w-full">
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Guardar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
