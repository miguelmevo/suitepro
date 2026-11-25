import { useState } from "react";
import { DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Territorio, AsignacionGrupo } from "@/types/programa-predicacion";
import { GrupoPredicacion } from "@/hooks/useGruposPredicacion";
import { Participante } from "@/types/grupos-servicio";
import { useConfiguracionSistema } from "@/hooks/useConfiguracionSistema";
import { gruposSinCapitanes, ordenarPorApellido, puedeSerCapitan } from "@/lib/capitanes";
import { sortTerritorioNumeros } from "@/lib/sorting";
import { cn } from "@/lib/utils";

interface Props {
  grupos: GrupoPredicacion[];
  territorios: Territorio[];
  participantes: Participante[];
  asignacionesIniciales?: AsignacionGrupo[];
  onSubmit: (asignaciones: AsignacionGrupo[]) => void;
  isLoading?: boolean;
  submitLabel?: string;
}

/**
 * Salida "Visita SS": el Superintendente de Servicio visita un solo grupo. Se elige el grupo,
 * sus territorios, el capitán (el SS queda preseleccionado) y un mensaje opcional que se
 * muestra en el programa debajo del grupo.
 */
export function VisitaSSForm({ grupos, territorios, participantes, asignacionesIniciales = [], onSubmit, isLoading, submitLabel = "Guardar" }: Props) {
  const { getConfigValue } = useConfiguracionSistema("predicacion");
  const asociacionHabilitada = getConfigValue?.("asociacion_grupos")?.habilitado ?? false;
  const superServicio = participantes.find((p) => p.cargo_comite === "sup_servicio" && p.activo !== false);

  const inicial = asignacionesIniciales.find((a) => a.visita_ss);
  const [grupoId, setGrupoId] = useState(inicial?.grupo_id || "");
  const [territorioIds, setTerritorioIds] = useState<string[]>(
    inicial?.territorio_ids?.length ? inicial.territorio_ids : inicial?.territorio_id ? [inicial.territorio_id] : [],
  );
  // null = aún no se ha tocado: se propone el SS.
  const [capitanElegido, setCapitanElegido] = useState<string | null>(inicial?.capitan_id ?? null);
  const [mensaje, setMensaje] = useState(inicial?.mensaje_visita || "");
  const [avisoCambio, setAvisoCambio] = useState(false);
  const [intentoGuardar, setIntentoGuardar] = useState(false);
  const capitanId = capitanElegido ?? superServicio?.id ?? "";

  const grupoIds = grupoId ? [grupoId] : [];
  const elegible = (p: Participante, ids: string[]) => p.id === superServicio?.id || puedeSerCapitan(p, ids, asociacionHabilitada);
  const capitanes = ordenarPorApellido(participantes.filter((p) => p.id === capitanId || elegible(p, grupoIds)));

  const elegirGrupo = (id: string) => {
    setGrupoId(id);
    const actual = participantes.find((p) => p.id === capitanId);
    if (actual && !elegible(actual, [id])) {
      setCapitanElegido("");
      setAvisoCambio(true);
    }
  };

  const territoriosDelGrupo = territorios
    .filter((t) => {
      const ids = t.grupos_predicacion_ids || [];
      return !grupoId || ids.length === 0 || ids.includes(grupoId);
    })
    .sort((a, b) => a.numero.localeCompare(b.numero, "es", { numeric: true }));
  const numeros = sortTerritorioNumeros(territorioIds.map((id) => territorios.find((t) => t.id === id)?.numero));

  const toggleTerritorio = (id: string) =>
    setTerritorioIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const guardar = () => {
    if (!grupoId || !capitanId) {
      setIntentoGuardar(true);
      return;
    }
    onSubmit([
      {
        grupo_id: grupoId,
        territorio_id: territorioIds[0] || "",
        territorio_ids: territorioIds,
        salida_index: 0,
        capitan_id: capitanId,
        visita_ss: true,
        ...(mensaje.trim() ? { mensaje_visita: mensaje.trim() } : {}),
      },
    ]);
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Grupo que se visita</Label>
        <div className="flex flex-wrap gap-1">
          {grupos.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => elegirGrupo(g.id)}
              className={cn(
                "px-2 py-1 rounded text-xs border transition-colors",
                grupoId === g.id ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted border-border",
              )}
            >
              G{g.numero}
            </button>
          ))}
        </div>
        {intentoGuardar && !grupoId && <p className="text-xs text-destructive">Elige el grupo que se visita.</p>}
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Territorios (selecciona uno o más)</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" role="combobox" className="h-8 w-full justify-between font-normal text-xs">
              <span className="truncate">{numeros.length ? numeros.join(", ") : "Seleccionar territorios..."}</span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            showOverlay={false}
            className="w-[var(--radix-popover-trigger-width)] min-w-[240px] max-h-[320px] overflow-hidden p-0 bg-popover border shadow-lg z-[100]"
            align="start"
          >
            <Command className="max-h-[320px]">
              <CommandInput placeholder="Buscar..." className="h-8" />
              <CommandList className="h-[260px] max-h-[260px] overflow-y-auto overscroll-contain">
                <CommandEmpty>No encontrado.</CommandEmpty>
                <CommandGroup>
                  {territoriosDelGrupo.map((t) => (
                    <CommandItem key={t.id} value={`${t.numero} ${t.nombre || ""}`} onSelect={() => toggleTerritorio(t.id)}>
                      <Check className={cn("mr-2 h-4 w-4", territorioIds.includes(t.id) ? "opacity-100" : "opacity-0")} />
                      {t.numero} {t.nombre && `- ${t.nombre}`}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {territorioIds.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {territorioIds.map((id) => {
              const t = territorios.find((x) => x.id === id);
              return t ? (
                <Badge key={id} variant="secondary" className="text-xs">
                  {t.numero}
                  <button type="button" className="ml-1 hover:text-destructive" onClick={() => toggleTerritorio(id)}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ) : null;
            })}
          </div>
        )}
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Capitán</Label>
        {gruposSinCapitanes(participantes, grupoIds, asociacionHabilitada) && (
          <p className="text-xs text-destructive">No existen capitanes asignados a los grupos seleccionados.</p>
        )}
        <Select
          value={capitanId}
          onValueChange={(v) => {
            setCapitanElegido(v);
            setAvisoCambio(false);
          }}
        >
          <SelectTrigger className={cn("h-8 text-xs", !capitanId && (avisoCambio || intentoGuardar) && "border-destructive")}>
            <SelectValue placeholder="Selecciona un capitán" />
          </SelectTrigger>
          <SelectContent className="bg-popover border shadow-lg z-[100]">
            {capitanes.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.apellido}, {p.nombre}
                {p.id === superServicio?.id ? " (SS)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!capitanId && avisoCambio && <p className="text-xs text-destructive">Cambiaste el grupo: elige también un nuevo capitán.</p>}
        {!capitanId && !avisoCambio && intentoGuardar && <p className="text-xs text-destructive">Debes elegir un capitán para guardar.</p>}
      </div>

      <div className="space-y-1">
        <Label htmlFor="mensaje-visita" className="text-xs text-muted-foreground">
          Mensaje (opcional, se muestra debajo del grupo)
        </Label>
        <Input
          id="mensaje-visita"
          value={mensaje}
          maxLength={80}
          onChange={(e) => setMensaje(e.target.value)}
          placeholder="Ej: Visita del Superintendente de Servicio"
          className="h-8 text-xs"
        />
      </div>

      <div className="flex gap-2 pt-2">
        <DialogClose asChild>
          <Button type="button" size="sm" variant="outline" className="flex-1">
            <X className="h-4 w-4 mr-1" />
            Cancelar
          </Button>
        </DialogClose>
        <Button size="sm" className="flex-1" onClick={guardar} disabled={isLoading}>
          <Check className="h-4 w-4 mr-1" />
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
