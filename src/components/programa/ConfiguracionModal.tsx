import { useState } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Loader2, Plus, Trash2, Calendar } from "lucide-react";
import { HorarioSalida, PuntoEncuentro, Territorio } from "@/types/programa-predicacion";
import { DiaEspecial } from "@/hooks/useDiasEspeciales";

interface ConfiguracionModalProps {
  horarios: HorarioSalida[];
  puntos: PuntoEncuentro[];
  territorios: Territorio[];
  diasEspeciales: DiaEspecial[];
  onCrearHorario: (data: { hora: string; nombre: string; orden?: number }) => void;
  onCrearPunto: (data: { nombre: string; direccion?: string; url_maps?: string }) => void;
  onCrearTerritorio: (data: { numero: string; nombre?: string }) => void;
  onCrearDiaEspecial: (data: { nombre: string; bloqueo_tipo: "completo" | "manana" | "tarde" }) => void;
  onEliminarDiaEspecial: (id: string) => void;
  isLoading?: boolean;
}

export function ConfiguracionModal({
  horarios,
  puntos,
  territorios,
  diasEspeciales,
  onCrearHorario,
  onCrearPunto,
  onCrearTerritorio,
  onCrearDiaEspecial,
  onEliminarDiaEspecial,
  isLoading,
}: ConfiguracionModalProps) {
  const [open, setOpen] = useState(false);

  // Horario form
  const [hora, setHora] = useState("");
  const [nombreHorario, setNombreHorario] = useState("");

  // Punto form
  const [nombrePunto, setNombrePunto] = useState("");
  const [direccion, setDireccion] = useState("");
  const [urlMaps, setUrlMaps] = useState("");

  // Territorio form
  const [numeroTerr, setNumeroTerr] = useState("");
  const [nombreTerr, setNombreTerr] = useState("");

  // Día especial form
  const [nombreDia, setNombreDia] = useState("");
  const [bloqueoTipo, setBloqueoTipo] = useState<"completo" | "manana" | "tarde">("completo");

  const handleCrearHorario = () => {
    if (!hora || !nombreHorario) return;
    onCrearHorario({ hora, nombre: nombreHorario, orden: horarios.length + 1 });
    setHora("");
    setNombreHorario("");
  };

  const handleCrearPunto = () => {
    if (!nombrePunto) return;
    onCrearPunto({ nombre: nombrePunto, direccion: direccion || undefined, url_maps: urlMaps || undefined });
    setNombrePunto("");
    setDireccion("");
    setUrlMaps("");
  };

  const handleCrearTerritorio = () => {
    if (!numeroTerr) return;
    onCrearTerritorio({ numero: numeroTerr, nombre: nombreTerr || undefined });
    setNumeroTerr("");
    setNombreTerr("");
  };

  const handleCrearDiaEspecial = () => {
    if (!nombreDia) return;
    onCrearDiaEspecial({ nombre: nombreDia, bloqueo_tipo: bloqueoTipo });
    setNombreDia("");
    setBloqueoTipo("completo");
  };

  const getBloqueoLabel = (tipo: string) => {
    switch (tipo) {
      case "completo": return "Día completo";
      case "manana": return "Solo mañana";
      case "tarde": return "Solo tarde";
      default: return tipo;
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="h-4 w-4 mr-1" />
          Configuración
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configuración del Programa</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="horarios">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="horarios">Horarios</TabsTrigger>
            <TabsTrigger value="puntos">Puntos</TabsTrigger>
            <TabsTrigger value="territorios">Territorios</TabsTrigger>
            <TabsTrigger value="dias">Días Especiales</TabsTrigger>
          </TabsList>

          <TabsContent value="horarios" className="space-y-4">
            <div className="grid gap-3 p-4 border rounded-lg">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Hora (HH:MM)</Label>
                  <Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Nombre</Label>
                  <Input
                    value={nombreHorario}
                    onChange={(e) => setNombreHorario(e.target.value)}
                    placeholder="Ej: Mañana"
                  />
                </div>
              </div>
              <Button onClick={handleCrearHorario} disabled={isLoading || !hora || !nombreHorario}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                Agregar horario
              </Button>
            </div>
            <div className="space-y-2">
              <Label>Horarios existentes</Label>
              <div className="flex flex-wrap gap-2">
                {horarios.map((h) => (
                  <div key={h.id} className="px-3 py-1 bg-secondary rounded-full text-sm">
                    {h.hora.slice(0, 5)} - {h.nombre}
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="puntos" className="space-y-4">
            <div className="grid gap-3 p-4 border rounded-lg">
              <div className="space-y-2">
                <Label>Nombre del punto</Label>
                <Input
                  value={nombrePunto}
                  onChange={(e) => setNombrePunto(e.target.value)}
                  placeholder="Ej: Salón del Reino"
                />
              </div>
              <div className="space-y-2">
                <Label>Dirección</Label>
                <Input
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                  placeholder="Ej: Calle Principal 123"
                />
              </div>
              <div className="space-y-2">
                <Label>Link Google Maps</Label>
                <Input
                  value={urlMaps}
                  onChange={(e) => setUrlMaps(e.target.value)}
                  placeholder="https://maps.google.com/..."
                />
              </div>
              <Button onClick={handleCrearPunto} disabled={isLoading || !nombrePunto}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                Agregar punto
              </Button>
            </div>
            <div className="space-y-2">
              <Label>Puntos existentes ({puntos.length})</Label>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {puntos.map((p) => (
                  <div key={p.id} className="px-3 py-2 bg-secondary rounded text-sm">
                    {p.nombre}
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="territorios" className="space-y-4">
            <div className="grid gap-3 p-4 border rounded-lg">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Número</Label>
                  <Input
                    value={numeroTerr}
                    onChange={(e) => setNumeroTerr(e.target.value)}
                    placeholder="Ej: 15"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nombre (opcional)</Label>
                  <Input
                    value={nombreTerr}
                    onChange={(e) => setNombreTerr(e.target.value)}
                    placeholder="Ej: Centro"
                  />
                </div>
              </div>
              <Button onClick={handleCrearTerritorio} disabled={isLoading || !numeroTerr}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                Agregar territorio
              </Button>
            </div>
            <div className="space-y-2">
              <Label>Territorios existentes ({territorios.length})</Label>
              <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                {territorios.map((t) => (
                  <div key={t.id} className="px-3 py-1 bg-secondary rounded-full text-sm">
                    {t.numero} {t.nombre && `- ${t.nombre}`}
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="dias" className="space-y-4">
            <div className="grid gap-3 p-4 border rounded-lg">
              <div className="space-y-2">
                <Label>Nombre del evento</Label>
                <Input
                  value={nombreDia}
                  onChange={(e) => setNombreDia(e.target.value)}
                  placeholder="Ej: Asamblea Regional 2025"
                />
              </div>
              <div className="space-y-2">
                <Label>Bloqueo</Label>
                <Select value={bloqueoTipo} onValueChange={(v) => setBloqueoTipo(v as typeof bloqueoTipo)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="completo">Día completo</SelectItem>
                    <SelectItem value="manana">Solo mañana</SelectItem>
                    <SelectItem value="tarde">Solo tarde</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleCrearDiaEspecial} disabled={isLoading || !nombreDia}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                Agregar día especial
              </Button>
            </div>
            <div className="space-y-2">
              <Label>Días especiales configurados ({diasEspeciales.length})</Label>
              <div className="max-h-48 overflow-y-auto space-y-2">
                {diasEspeciales.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hay días especiales configurados</p>
                ) : (
                  diasEspeciales.map((d) => (
                    <div key={d.id} className="flex items-center justify-between px-3 py-2 bg-secondary rounded group">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <span className="text-sm font-medium">{d.nombre}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {getBloqueoLabel(d.bloqueo_tipo)}
                          </span>
                        </div>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                        onClick={() => onEliminarDiaEspecial(d.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
