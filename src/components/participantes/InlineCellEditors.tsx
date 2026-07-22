import { useState } from "react";
import { Check, X, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const RESPONSABILIDADES = [
  { value: "publicador", label: "Publicador", abbr: "PB" },
  { value: "publicador_no_bautizado", label: "Publicador No Bautizado", abbr: "PNB" },
  { value: "precursor_regular", label: "Precursor Regular", abbr: "PR" },
  { value: "siervo_ministerial", label: "Siervo Ministerial", abbr: "SM" },
  { value: "anciano", label: "Anciano", abbr: "A" },
  { value: "super_circuito", label: "Super. de Circuito", abbr: "SC" },
  { value: "solo_smm", label: "Inscrito en SMM", abbr: "SMM" },
];

const DISABLE_RULES: Record<string, string[]> = {
  anciano: ["publicador_no_bautizado", "publicador", "siervo_ministerial", "super_circuito", "solo_smm"],
  publicador: ["publicador_no_bautizado", "anciano", "siervo_ministerial", "super_circuito", "solo_smm"],
  precursor_regular: ["super_circuito", "publicador_no_bautizado", "solo_smm"],
  siervo_ministerial: ["anciano", "publicador", "publicador_no_bautizado", "super_circuito", "solo_smm"],
  publicador_no_bautizado: ["anciano", "siervo_ministerial", "precursor_regular", "publicador", "super_circuito", "solo_smm"],
  super_circuito: ["publicador", "precursor_regular", "anciano", "publicador_no_bautizado", "siervo_ministerial", "solo_smm"],
  solo_smm: ["publicador", "precursor_regular", "anciano", "publicador_no_bautizado", "siervo_ministerial", "super_circuito"],
};

interface InlineRespEditorProps {
  values: string[];
  disabled?: boolean;
  onSave: (next: string[]) => void;
  extraBadges?: React.ReactNode;
}

export function InlineRespEditor({ values, disabled, onSave, extraBadges }: InlineRespEditorProps) {
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState<string[]>(values);

  // Filtramos solo responsabilidades reales (no asignaciones)
  const respValues = local.filter((v) => RESPONSABILIDADES.some((r) => r.value === v));
  const nonRespValues = local.filter((v) => !RESPONSABILIDADES.some((r) => r.value === v));

  const isDisabled = (target: string) =>
    respValues.some((sel) => sel !== target && DISABLE_RULES[sel]?.includes(target));

  const toggle = (value: string) => {
    setLocal((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const handleOpenChange = (o: boolean) => {
    if (disabled) return;
    if (o) setLocal(values);
    else {
      // Solo devolvemos las responsabilidades (no asignaciones de servicio)
      const onlyResp = Array.from(
        new Set(local.filter((v) => RESPONSABILIDADES.some((r) => r.value === v)))
      );
      const originalResp = Array.from(
        new Set(values.filter((v) => RESPONSABILIDADES.some((r) => r.value === v)))
      );
      const sortedNew = [...onlyResp].sort().join(",");
      const sortedOld = [...originalResp].sort().join(",");
      if (sortedNew !== sortedOld) onSave(onlyResp);
    }
    setOpen(o);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          className={cn(
            "flex flex-wrap gap-1 min-h-[28px] min-w-[60px] items-center rounded px-1 py-0.5 text-left",
            !disabled && "hover:bg-accent cursor-pointer",
            disabled && "cursor-default"
          )}
        >
          {respValues.length === 0 && !extraBadges ? (
            <span className="text-xs text-muted-foreground">—</span>
          ) : (
            <>
              {respValues.map((r) => (
                <Badge key={r} variant="outline">
                  {RESPONSABILIDADES.find((x) => x.value === r)?.abbr || r}
                </Badge>
              ))}
              {extraBadges}
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" showOverlay={false} align="start">
        <p className="text-sm font-medium mb-2">Responsabilidades</p>
        <div className="space-y-2">
          {RESPONSABILIDADES.map((r) => {
            const checked = respValues.includes(r.value);
            const d = isDisabled(r.value);
            return (
              <div key={r.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`inline-resp-${r.value}`}
                  checked={checked}
                  onCheckedChange={() => toggle(r.value)}
                  disabled={d}
                />
                <Label
                  htmlFor={`inline-resp-${r.value}`}
                  className={cn("cursor-pointer text-sm", d && "opacity-50")}
                >
                  {r.label} ({r.abbr})
                </Label>
              </div>
            );
          })}
        </div>
        <div className="flex justify-end mt-3">
          <Button size="sm" onClick={() => handleOpenChange(false)}>
            Aplicar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface InlineAsignacionesEditorProps {
  values: string[];
  options: { value: string; label: string; abbr: string }[];
  disabled?: boolean;
  isOptionDisabled?: (value: string) => boolean;
  disabledLabelSuffix?: string;
  onSave: (next: string[]) => void;
  disabledTitle?: string;
}

export function InlineAsignacionesEditor({
  values,
  options,
  disabled,
  isOptionDisabled,
  disabledLabelSuffix,
  onSave,
  disabledTitle,
}: InlineAsignacionesEditorProps) {
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState<string[]>(values);

  const allowed = options.map((o) => o.value);
  const current = local.filter((v) => allowed.includes(v));
  const displayed = values.filter((v) => allowed.includes(v));
  const displayedLabels = displayed
    .map((v) => options.find((o) => o.value === v)?.label || v)
    .join(", ");
  const triggerTitle = disabled
    ? disabledTitle || undefined
    : displayed.length > 0
      ? `Asignaciones activas: ${displayedLabels}`
      : "Sin asignaciones";

  const toggle = (value: string) => {
    setLocal((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const handleOpenChange = (o: boolean) => {
    if (disabled) return;
    if (o) {
      setLocal(values);
    } else {
      // Solo devolvemos asignaciones válidas (no responsabilidades) y descartamos las deshabilitadas
      const onlyAsig = Array.from(
        new Set(
          local.filter(
            (v) => allowed.includes(v) && !isOptionDisabled?.(v)
          )
        )
      );
      const originalAsig = Array.from(
        new Set(values.filter((v) => allowed.includes(v)))
      );
      const sortedNew = [...onlyAsig].sort().join(",");
      const sortedOld = [...originalAsig].sort().join(",");
      if (sortedNew !== sortedOld) onSave(onlyAsig);
    }
    setOpen(o);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          title={triggerTitle}
          className={cn(
            "flex flex-wrap gap-1 min-h-[28px] min-w-[60px] items-center rounded px-1 py-0.5 text-left",
            !disabled && "hover:bg-accent cursor-pointer",
            disabled && "cursor-default"
          )}
        >
          {displayed.length === 0 ? (
            <span className="text-xs text-muted-foreground">—</span>
          ) : (
            <Badge variant="secondary" className="font-mono">
              {displayed.length}/{options.length}
            </Badge>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" showOverlay={false} align="start">
        <p className="text-sm font-medium mb-2">Asignaciones de Servicio</p>
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {options.map((o) => {
            const checked = current.includes(o.value);
            const d = !!isOptionDisabled?.(o.value);
            return (
              <div key={o.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`inline-asig-${o.value}`}
                  checked={checked && !d}
                  onCheckedChange={() => !d && toggle(o.value)}
                  disabled={d}
                />
                <Label
                  htmlFor={`inline-asig-${o.value}`}
                  className={cn("cursor-pointer text-sm", d && "opacity-50")}
                >
                  {o.label}
                  {d && disabledLabelSuffix ? ` ${disabledLabelSuffix}` : ""}
                </Label>
              </div>
            );
          })}
        </div>
        <div className="flex justify-end mt-3">
          <Button size="sm" onClick={() => handleOpenChange(false)}>
            Aplicar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface InlineSelectEditorProps {
  value: string | null;
  options: { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
  display: React.ReactNode;
  onSave: (next: string | null) => void;
  noneLabel?: string;
}

export function InlineSelectEditor({
  value,
  options,
  disabled,
  display,
  onSave,
  noneLabel = "Sin asignar",
}: InlineSelectEditorProps) {
  const [open, setOpen] = useState(false);

  return (
    <Select
      open={open}
      onOpenChange={(o) => !disabled && setOpen(o)}
      value={value ?? "_none"}
      onValueChange={(v) => {
        const next = v === "_none" ? null : v;
        if (next !== value) onSave(next);
      }}
      disabled={disabled}
    >
      <SelectTrigger
        className={cn(
          "border-0 bg-transparent shadow-none h-auto p-0 px-1 min-h-[28px] [&>svg]:hidden",
          !disabled && "hover:bg-accent rounded"
        )}
      >
        <span className="inline-flex items-center gap-1">
          {display}
          {!disabled && <ChevronDown className="h-3 w-3 opacity-40" />}
        </span>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="_none">{noneLabel}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface InlineBooleanToggleProps {
  value: boolean;
  disabled?: boolean;
  onSave: (next: boolean) => void;
  trueColor?: string;
  trueIconColor?: string;
  title?: string;
}

export function InlineBooleanToggle({
  value,
  disabled,
  onSave,
  trueIconColor = "text-green-600",
  title,
}: InlineBooleanToggleProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title || (value ? "Sí (clic para cambiar)" : "No (clic para cambiar)")}
      onClick={() => !disabled && onSave(!value)}
      className={cn(
        "inline-flex items-center justify-center rounded p-1 mx-auto",
        !disabled && "hover:bg-accent cursor-pointer",
        disabled && "cursor-default"
      )}
    >
      {value ? (
        <Check className={cn("h-4 w-4", trueIconColor)} />
      ) : (
        <X className="h-4 w-4 text-muted-foreground" />
      )}
    </button>
  );
}

interface CandidatoConyuge {
  id: string;
  nombre: string;
  apellido: string;
  genero?: string | null;
  activo?: boolean | null;
}

interface InlineGeneroEditorProps {
  participanteId: string;
  esVaron: boolean;
  esCasado: boolean;
  tieneHijos: boolean;
  conyugeId: string | null;
  candidatos: CandidatoConyuge[];
  disabled?: boolean;
  bloqueadoAMujerTitle?: string;
  onSave: (data: {
    esVaron: boolean;
    esCasado: boolean;
    tieneHijos: boolean;
    conyugeId: string | null;
  }) => void;
}

export function InlineGeneroEditor({
  participanteId,
  esVaron,
  esCasado,
  tieneHijos,
  conyugeId,
  candidatos,
  disabled,
  bloqueadoAMujerTitle,
  onSave,
}: InlineGeneroEditorProps) {
  const [open, setOpen] = useState(false);
  const [localEsVaron, setLocalEsVaron] = useState(esVaron);
  const [localEsCasado, setLocalEsCasado] = useState(esCasado);
  const [localTieneHijos, setLocalTieneHijos] = useState(tieneHijos);
  const [localConyugeId, setLocalConyugeId] = useState(conyugeId ?? "_none");

  const handleOpenChange = (o: boolean) => {
    if (disabled) return;
    if (o) {
      setLocalEsVaron(esVaron);
      setLocalEsCasado(esCasado);
      setLocalTieneHijos(tieneHijos);
      setLocalConyugeId(conyugeId ?? "_none");
    } else {
      const nextConyugeId = localEsCasado && localConyugeId !== "_none" ? localConyugeId : null;
      const changed =
        localEsVaron !== esVaron ||
        localEsCasado !== esCasado ||
        (localEsCasado ? localTieneHijos : false) !== tieneHijos ||
        nextConyugeId !== conyugeId;
      if (changed) {
        onSave({
          esVaron: localEsVaron,
          esCasado: localEsCasado,
          tieneHijos: localEsCasado ? localTieneHijos : false,
          conyugeId: nextConyugeId,
        });
      }
    }
    setOpen(o);
  };

  const candidatosFiltrados = candidatos
    .filter((p) => p.id !== participanteId && p.activo && p.genero === (localEsVaron ? "F" : "M"))
    .sort((a, b) => `${a.apellido} ${a.nombre}`.localeCompare(`${b.apellido} ${b.nombre}`));

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          className={cn(
            "inline-flex items-center justify-center rounded p-1 mx-auto",
            !disabled && "hover:bg-accent cursor-pointer",
            disabled && "cursor-default"
          )}
        >
          <Badge variant="outline">{esVaron ? "V" : "M"}</Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" showOverlay={false} align="start">
        <p className="text-sm font-medium mb-2">Género y datos personales</p>
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="ig-varon"
              checked={localEsVaron}
              onCheckedChange={() => setLocalEsVaron(true)}
            />
            <Label htmlFor="ig-varon" className="cursor-pointer text-sm">Varón</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="ig-mujer"
              checked={!localEsVaron}
              disabled={!!bloqueadoAMujerTitle}
              onCheckedChange={() => setLocalEsVaron(false)}
            />
            <Label
              htmlFor="ig-mujer"
              className={cn("cursor-pointer text-sm", bloqueadoAMujerTitle && "opacity-50")}
              title={bloqueadoAMujerTitle}
            >
              Mujer
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="ig-casado"
              checked={localEsCasado}
              onCheckedChange={(checked) => {
                setLocalEsCasado(checked as boolean);
                if (!checked) {
                  setLocalTieneHijos(false);
                  setLocalConyugeId("_none");
                }
              }}
            />
            <Label htmlFor="ig-casado" className="cursor-pointer text-sm">Casado(a)</Label>
          </div>
          {localEsCasado && (
            <div className="flex items-center space-x-2 pl-4">
              <Checkbox
                id="ig-hijos"
                checked={localTieneHijos}
                onCheckedChange={(checked) => setLocalTieneHijos(checked as boolean)}
              />
              <Label htmlFor="ig-hijos" className="cursor-pointer text-sm">Tiene hijos</Label>
            </div>
          )}
          {localEsCasado && (
            <div className="pl-4 space-y-1">
              <Label htmlFor="ig-conyuge" className="text-xs text-muted-foreground">Cónyuge</Label>
              <Select value={localConyugeId} onValueChange={setLocalConyugeId}>
                <SelectTrigger id="ig-conyuge" className="h-8 text-sm">
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">No aplica</SelectItem>
                  {candidatosFiltrados.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.apellido}, {p.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <div className="flex justify-end mt-3">
          <Button size="sm" onClick={() => handleOpenChange(false)}>
            Aplicar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
