import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  computeBloqueoRP,
  leerBloqueoConfigRP,
} from "@/lib/reunion-publica-bloqueos";
import { RP_CATEGORIA_LABEL, type RpCategoria, type UltimasPorParticipanteRP } from "@/lib/reunion-publica-historial";

interface OpcionParticipante {
  id: string;
  nombre: string;
  apellido: string;
  alias?: string | null;
}

interface Props {
  value: string | null;
  onChange: (value: string | null) => void;
  opciones: OpcionParticipante[];
  ultimasMap: UltimasPorParticipanteRP;
  configuraciones: Array<{ clave: string; valor: Record<string, any> }> | undefined | null;
  categoria: RpCategoria;
  fechaPrograma: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  emptyMessage?: string;
  /** Nombre a mostrar si el participante seleccionado ya no está entre las opciones
   *  elegibles (inactivado o eliminado de la congregación). */
  nombreNoDisponible?: string | null;
}

const NONE = "__none__";

export function ParticipanteSelectorRP({
  value,
  onChange,
  opciones,
  ultimasMap,
  configuraciones,
  categoria,
  fechaPrograma,
  placeholder = "Seleccionar...",
  disabled,
  className,
  emptyMessage = "No hay participantes elegibles.",
  nombreNoDisponible,
}: Props) {
  const [popoverOpen, setPopoverOpen] = useState(false);

  const formatFechaCorta = (fecha: string) => {
    try {
      return format(parseISO(fecha), "d MMM yy", { locale: es });
    } catch {
      return fecha;
    }
  };

  const buildInlineUltima = (id: string) => {
    const entry = ultimasMap.get(id);
    const ult = entry?.[categoria]?.[0];
    if (!ult) return "nunca";
    return `últ: ${formatFechaCorta(ult.fecha)}`;
  };

  const bloqueoCfg = useMemo(() => leerBloqueoConfigRP(configuraciones), [configuraciones]);

  const opcionesOrdenadas = useMemo(() => {
    return [...opciones].sort((a, b) => {
      const fa = ultimasMap.get(a.id)?.[categoria]?.[0]?.fecha ?? "";
      const fb = ultimasMap.get(b.id)?.[categoria]?.[0]?.fecha ?? "";
      if (fa !== fb) return fa.localeCompare(fb);
      const ap = (a.apellido || "").localeCompare(b.apellido || "");
      if (ap !== 0) return ap;
      return (a.nombre || "").localeCompare(b.nombre || "");
    });
  }, [opciones, ultimasMap, categoria]);

  const bloqueosMap = useMemo(() => {
    const m = new Map<string, ReturnType<typeof computeBloqueoRP>>();
    for (const p of opcionesOrdenadas) {
      m.set(p.id, computeBloqueoRP(ultimasMap.get(p.id), categoria, fechaPrograma, bloqueoCfg));
    }
    return m;
  }, [opcionesOrdenadas, ultimasMap, categoria, fechaPrograma, bloqueoCfg]);

  const totalDisponibles = useMemo(() => {
    let c = 0;
    for (const p of opcionesOrdenadas) if (!bloqueosMap.get(p.id)?.bloqueado) c++;
    return c;
  }, [opcionesOrdenadas, bloqueosMap]);

  const permitirBloqueados = totalDisponibles < bloqueoCfg.umbralRelajacion;

  const seleccionado = value ? opciones.find((p) => p.id === value) : null;

  // Última fecha PREVIA a esta misma (excluye la propia fecha en curso, si ya quedó guardada).
  const fechaUltimaPrevia = useMemo(() => {
    if (!seleccionado) return null;
    const arr = ultimasMap.get(seleccionado.id)?.[categoria] ?? [];
    const previa = arr.find((e) => e.fecha < fechaPrograma) ?? arr.find((e) => e.fecha !== fechaPrograma);
    return previa?.fecha ?? null;
  }, [seleccionado, ultimasMap, categoria, fechaPrograma]);

  const handleSelect = (v: string) => {
    onChange(v === NONE ? null : v);
    setPopoverOpen(false);
  };

  return (
    <div className="space-y-1">
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={popoverOpen}
          disabled={disabled}
          className={cn("w-full justify-between font-normal", className)}
        >
          {seleccionado ? (
            <span className="truncate">
              {seleccionado.apellido}, {seleccionado.nombre}
              {seleccionado.alias ? ` (${seleccionado.alias})` : ""}
            </span>
          ) : value && nombreNoDisponible ? (
            <span className="truncate italic text-muted-foreground" title="Participante inactivado o eliminado de la congregación">
              {nombreNoDisponible}
            </span>
          ) : (
            <span className="truncate text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        showOverlay={false}
        className="w-[--radix-popover-trigger-width] p-0 bg-popover border shadow-lg z-[100]"
        align="start"
      >
        <Command>
          <CommandInput placeholder="Buscar participante..." />
          <CommandList
            className="max-h-[45vh] overflow-y-auto overscroll-contain"
            onWheel={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
          >
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            {totalDisponibles < bloqueoCfg.umbralRelajacion && opcionesOrdenadas.length > 0 && (
              <div className="px-2 py-1 text-[10px] text-amber-700 dark:text-amber-400 border-b">
                ⚠ Pocos participantes disponibles ({totalDisponibles}). Se permiten bloqueados.
              </div>
            )}
            <CommandGroup>
              <CommandItem value="__sin_asignar__" onSelect={() => handleSelect(NONE)}>
                <Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
                — Sin asignar —
              </CommandItem>
              {opcionesOrdenadas.map((p) => {
                const bloqueo = bloqueosMap.get(p.id);
                const estaMarcado = !!bloqueo?.marcado;
                const estaBloqueado = !!bloqueo?.bloqueado;
                const deshabilitar = estaBloqueado && !permitirBloqueados;
                const esSeleccionado = value === p.id;
                const alias = p.alias ? ` (${p.alias})` : "";
                const tooltip = estaMarcado && bloqueo?.detalle
                  ? bloqueo.detalle
                  : `${RP_CATEGORIA_LABEL[categoria]} ${buildInlineUltima(p.id)}`;
                return (
                  <CommandItem
                    key={p.id}
                    value={`${p.apellido} ${p.nombre}${alias} ${p.id}`}
                    title={tooltip}
                    disabled={deshabilitar && !esSeleccionado}
                    onSelect={() => handleSelect(p.id)}
                    className={cn(estaBloqueado && "opacity-70")}
                  >
                    <Check className={cn("mr-2 h-4 w-4 shrink-0", esSeleccionado ? "opacity-100" : "opacity-0")} />
                    <span className="flex flex-col">
                      <span className="flex items-center gap-1">
                        {estaMarcado && (
                          <span
                            className={cn(
                              "inline-block text-[9px] font-bold px-1 rounded",
                              bloqueo?.motivo === "rotacion"
                                ? "bg-destructive/15 text-destructive"
                                : "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                            )}
                          >
                            {bloqueo?.motivo === "rotacion" ? "ROT" : "DESC"}
                          </span>
                        )}
                        <span>
                          {p.apellido}, {p.nombre}
                          {alias}
                        </span>
                      </span>
                      <span className="text-[10px] text-muted-foreground leading-tight">
                        {estaMarcado && bloqueo?.detalle ? bloqueo.detalle : buildInlineUltima(p.id)}
                      </span>
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
    {seleccionado && (
      <p className="text-[10px] text-muted-foreground px-0.5">
        Última vez: {fechaUltimaPrevia ? formatFechaCorta(fechaUltimaPrevia) : "nunca"}
      </p>
    )}
    </div>
  );
}
