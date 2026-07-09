import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Loader2, Plus, Trash2, Calendar, Pencil, X, Check, Users } from "lucide-react";
import { HorarioSalida, PuntoEncuentro, Territorio } from "@/types/programa-predicacion";
import { DiaEspecial } from "@/hooks/useDiasEspeciales";
import { useGruposPredicacionFicticios } from "@/hooks/useGruposPredicacionFicticios";

interface ConfiguracionModalProps {
  horarios: HorarioSalida[];
  puntos: PuntoEncuentro[];
  territorios: Territorio[];
  diasEspeciales: DiaEspecial[];
  canManageHorarios?: boolean;
  canManagePuntos?: boolean;
  canManageTerritorios?: boolean;
  canManageDiasEspeciales?: boolean;
  onCrearHorario: (data: { hora: string; nombre: string; orden?: number; franja?: "manana" | "tarde" }) => void;
  onActualizarHorario?: (data: { id: string; hora: string; nombre: string; orden?: number; franja?: "manana" | "tarde" }) => void;
  onEliminarHorario?: (id: string) => void;
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
  canManageHorarios = true,
  canManagePuntos = true,
  canManageTerritorios = true,
  canManageDiasEspeciales = true,
  onCrearHorario,
  onActualizarHorario,
  onEliminarHorario,
  onCrearPunto,
  onCrearTerritorio,
  onCrearDiaEspecial,
  onEliminarDiaEspecial,
  isLoading,
}: ConfiguracionModalProps) {
  const [open, setOpen] = useState(false);

  // Helper: deduce franja desde hora
  const inferirFranja = (h: string): "manana" | "tarde" => {
    if (!h) return "manana";
    const horaNum = parseInt(h.split(":")[0], 10);
    return horaNum < 12 ? "manana" : "tarde";
  };

  // Horario form
  const [hora, setHora] = useState("");
  const [nombreHorario, setNombreHorario] = useState("");
  const [franjaHorario, setFranjaHorario] = useState<"manana" | "tarde">("manana");
  const [franjaTocadaManual, setFranjaTocadaManual] = useState(false);

  // Horario edit state
  const [editingHorarioId, setEditingHorarioId] = useState<string | null>(null);
  const [editHora, setEditHora] = useState("");
  const [editNombreHorario, setEditNombreHorario] = useState("");
  const [editFranja, setEditFranja] = useState<"manana" | "tarde">("manana");
  const [editFranjaTocada, setEditFranjaTocada] = useState(false);

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

  // Grupos ficticios
  const { gruposFicticios, crear: crearFicticio, actualizar: actualizarFicticio, eliminar: eliminarFicticio } = useGruposPredicacionFicticios();
  const [nuevoFicticio, setNuevoFicticio] = useState("");
  const [editFicticioId, setEditFicticioId] = useState<string | null>(null);
  const [editFicticioNombre, setEditFicticioNombre] = useState("");

  const handleHoraChange = (nuevaHora: string) => {
    setHora(nuevaHora);
    if (!franjaTocadaManual) {
      setFranjaHorario(inferirFranja(nuevaHora));
    }
  };

  const handleCrearHorario = () => {
    if (!hora || !nombreHorario) return;
    onCrearHorario({ hora, nombre: nombreHorario, orden: horarios.length + 1, franja: franjaHorario });
    setHora("");
    setNombreHorario("");
    setFranjaHorario("manana");
    setFranjaTocadaManual(false);
  };

  const handleEditHorario = (h: HorarioSalida) => {
    setEditingHorarioId(h.id);
    setEditHora(h.hora.slice(0, 5));
    setEditNombreHorario(h.nombre);
    setEditFranja((h.franja as "manana" | "tarde") || inferirFranja(h.hora));
    setEditFranjaTocada(false);
  };

  const handleEditHoraChange = (nuevaHora: string) => {
    setEditHora(nuevaHora);
    if (!editFranjaTocada) {
      setEditFranja(inferirFranja(nuevaHora));
    }
  };

  const handleSaveEditHorario = () => {
    if (!editingHorarioId || !editHora || !editNombreHorario) return;
    onActualizarHorario?.({ id: editingHorarioId, hora: editHora, nombre: editNombreHorario, franja: editFranja });
    setEditingHorarioId(null);
    setEditHora("");
    setEditNombreHorario("");
    setEditFranjaTocada(false);
  };

  const handleCancelEditHorario = () => {
    setEditingHorarioId(null);
    setEditHora("");
    setEditNombreHorario("");
    setEditFranjaTocada(false);
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
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="bg-orange-500/10 border-orange-500/30 hover:bg-orange-500/20 text-orange-600"
            onClick={() => setOpen(true)}
            aria-label="Configuración del programa"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Configuración del Programa</TooltipContent>
      </Tooltip>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configuración del Programa</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="horarios">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="horarios">Horarios</TabsTrigger>
            <TabsTrigger value="puntos">Puntos</TabsTrigger>
            <TabsTrigger value="territorios">Territorios</TabsTrigger>
            <TabsTrigger value="dias">Días Esp.</TabsTrigger>
            <TabsTrigger value="ficticios">G. Ficticios</TabsTrigger>
          </TabsList>

          <TabsContent value="horarios" className="space-y-4">
            <div className="grid gap-3 p-4 border rounded-lg">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Hora (HH:MM)</Label>
                  <Input type="time" value={hora} onChange={(e) => handleHoraChange(e.target.value)} />
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
              <div className="space-y-2">
                <Label>Franja horaria</Label>
                <Select
                  value={franjaHorario}
                  onValueChange={(v) => {
                    setFranjaHorario(v as "manana" | "tarde");
                    setFranjaTocadaManual(true);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manana">Mañana</SelectItem>
                    <SelectItem value="tarde">Tarde</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Se sugiere automáticamente según la hora; puedes cambiarla manualmente.
                </p>
              </div>
              <Button onClick={handleCrearHorario} disabled={isLoading || !hora || !nombreHorario || !canManageHorarios}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                Agregar horario
              </Button>
            </div>
            <div className="space-y-2">
              <Label>Horarios existentes ({horarios.length})</Label>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {horarios.map((h) => (
                  <div key={h.id} className="flex items-center justify-between px-3 py-2 bg-secondary rounded group">
                    {editingHorarioId === h.id ? (
                      <div className="flex flex-wrap items-center gap-2 flex-1">
                        <Input
                          type="time"
                          value={editHora}
                          onChange={(e) => handleEditHoraChange(e.target.value)}
                          className="h-8 w-24"
                        />
                        <Input
                          value={editNombreHorario}
                          onChange={(e) => setEditNombreHorario(e.target.value)}
                          className="h-8 flex-1 min-w-[120px]"
                        />
                        <Select
                          value={editFranja}
                          onValueChange={(v) => {
                            setEditFranja(v as "manana" | "tarde");
                            setEditFranjaTocada(true);
                          }}
                        >
                          <SelectTrigger className="h-8 w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="manana">Mañana</SelectItem>
                            <SelectItem value="tarde">Tarde</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" onClick={handleSaveEditHorario} disabled={!canManageHorarios}>
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleCancelEditHorario}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <span className="text-sm">
                          {h.hora.slice(0, 5)} - {h.nombre}
                          <span className="ml-2 text-xs text-muted-foreground">
                            ({(h.franja || "manana") === "manana" ? "Mañana" : "Tarde"})
                          </span>
                        </span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => handleEditHorario(h)}
                            disabled={!canManageHorarios}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => onEliminarHorario?.(h.id)}
                            disabled={!canManageHorarios}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </>
                    )}
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
              <Button onClick={handleCrearPunto} disabled={isLoading || !nombrePunto || !canManagePuntos}>
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
              <Button onClick={handleCrearTerritorio} disabled={isLoading || !numeroTerr || !canManageTerritorios}>
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
              <Button onClick={handleCrearDiaEspecial} disabled={isLoading || !nombreDia || !canManageDiasEspeciales}>
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
                        disabled={!canManageDiasEspeciales}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="ficticios" className="space-y-4">
            <div className="text-xs text-muted-foreground p-2 bg-muted/50 rounded">
              Los <b>grupos ficticios</b> son grupos adicionales que solo aparecen en
              <i> "Predicación por Grupo de Servicio (Individual)"</i>. No reemplazan a los grupos reales.
              Activa el switch de cada uno para que aparezca como opción en el formulario.
            </div>

            <div className="grid gap-3 p-4 border rounded-lg">
              <div className="space-y-2">
                <Label>Nombre del grupo ficticio</Label>
                <Input
                  value={nuevoFicticio}
                  onChange={(e) => setNuevoFicticio(e.target.value)}
                  placeholder="Ej: Equipo Cartas, Grupo Norte..."
                />
              </div>
              <Button
                onClick={() => {
                  if (!nuevoFicticio.trim()) return;
                  crearFicticio.mutate({ nombre: nuevoFicticio.trim() }, { onSuccess: () => setNuevoFicticio("") });
                }}
                disabled={crearFicticio.isPending || !nuevoFicticio.trim()}
              >
                {crearFicticio.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                Agregar grupo ficticio
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Grupos ficticios ({gruposFicticios.length})</Label>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {gruposFicticios.length === 0 ? (
                  <p className="text-sm text-muted-foreground px-2">No hay grupos ficticios todavía.</p>
                ) : (
                  gruposFicticios.map((g) => (
                    <div key={g.id} className="flex items-center gap-2 px-3 py-2 bg-secondary rounded group">
                      <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                      {editFicticioId === g.id ? (
                        <>
                          <Input
                            value={editFicticioNombre}
                            onChange={(e) => setEditFicticioNombre(e.target.value)}
                            className="h-8 flex-1"
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-green-600"
                            onClick={() => {
                              if (!editFicticioNombre.trim()) return;
                              actualizarFicticio.mutate(
                                { id: g.id, nombre: editFicticioNombre.trim() },
                                { onSuccess: () => setEditFicticioId(null) }
                              );
                            }}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => setEditFicticioId(null)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <span className="text-sm flex-1">{g.nombre}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Mostrar</span>
                            <Switch
                              checked={g.habilitado_en_formulario}
                              onCheckedChange={(v) =>
                                actualizarFicticio.mutate({ id: g.id, habilitado_en_formulario: v })
                              }
                            />
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => {
                              setEditFicticioId(g.id);
                              setEditFicticioNombre(g.nombre);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => eliminarFicticio.mutate(g.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
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
