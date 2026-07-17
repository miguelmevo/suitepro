import { useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  /** Texto que precede al título (ej. "1. Tesoros de la Biblia", "Título / referencia"). */
  prefijo: string;
  /** Si es true, el encabezado muestra solo `prefijo` (texto fijo) y nunca el valor de
   * `titulo` — usado en Lectura Bíblica, que no expone la cita en el encabezado. */
  etiquetaFija?: boolean;
  titulo: string;
  onTituloChange: (value: string) => void;
  tituloLabel?: string;
  tituloPlaceholder?: string;
  disabled?: boolean;
  error?: boolean;
  modalTitle: string;

  minutos?: number | null;
  onMinutosChange?: (value: number | null) => void;

  leccion?: string | null;
  onLeccionChange?: (value: string) => void;
  leccionPlaceholder?: string;

  detalle?: string | null;
  onDetalleChange?: (value: string) => void;
  /** Si es false, el campo Detalle solo se muestra cuando ya tiene contenido (ej. Tesoros). */
  detalleSiempreVisible?: boolean;

  notas?: string | null;
  onNotasChange?: (value: string) => void;
}

export function TituloEditableModal({
  prefijo,
  etiquetaFija,
  titulo,
  onTituloChange,
  tituloLabel = "Título",
  tituloPlaceholder,
  disabled,
  error,
  modalTitle,
  minutos,
  onMinutosChange,
  leccion,
  onLeccionChange,
  leccionPlaceholder,
  detalle,
  onDetalleChange,
  detalleSiempreVisible = true,
  notas,
  onNotasChange,
}: Props) {
  const [armado, setArmado] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const [draftTitulo, setDraftTitulo] = useState(titulo);
  const [draftMinutos, setDraftMinutos] = useState<string>(minutos != null ? String(minutos) : "");
  const [draftLeccion, setDraftLeccion] = useState(leccion ?? "");
  const [draftDetalle, setDraftDetalle] = useState(detalle ?? "");
  const [draftNotas, setDraftNotas] = useState(notas ?? "");

  useEffect(() => {
    if (!open) return;
    setDraftTitulo(titulo);
    setDraftMinutos(minutos != null ? String(minutos) : "");
    setDraftLeccion(leccion ?? "");
    setDraftDetalle(detalle ?? "");
    setDraftNotas(notas ?? "");
  }, [open, titulo, minutos, leccion, detalle, notas]);

  useEffect(() => {
    if (!armado) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setArmado(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [armado]);

  const mostrarDetalle = onDetalleChange && (detalleSiempreVisible || !!detalle);

  const handleGuardar = () => {
    onTituloChange(draftTitulo);
    if (onMinutosChange) {
      const n = parseInt(draftMinutos, 10);
      onMinutosChange(Number.isFinite(n) && draftMinutos.trim() !== "" ? n : null);
    }
    if (onLeccionChange) onLeccionChange(draftLeccion);
    if (onDetalleChange) onDetalleChange(draftDetalle);
    if (onNotasChange) onNotasChange(draftNotas);
    setOpen(false);
  };

  const texto = titulo;

  return (
    <>
      <div ref={wrapRef} className="flex items-center gap-1.5 min-w-0">
        <span
          className={cn(
            "text-sm truncate",
            etiquetaFija || texto ? "font-medium" : "italic text-muted-foreground",
            error && !texto && "text-destructive"
          )}
          title={texto || undefined}
        >
          {etiquetaFija
            ? prefijo
            : `${prefijo}${texto ? `: ${texto}` : ": Sin título — toca la i para agregarlo"}`}
        </span>

        <span
          role="button"
          tabIndex={disabled ? -1 : 0}
          onClick={() => !disabled && setArmado((a) => !a)}
          onKeyDown={(e) => {
            if (disabled) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setArmado((a) => !a);
            }
          }}
          aria-label="Ver / editar"
          className={cn(
            "relative shrink-0 h-4 w-4 rounded-full bg-muted-foreground/30 text-background cursor-pointer",
            "flex items-center justify-center text-[10px] font-bold leading-none select-none",
            "hover:bg-muted-foreground/50",
            disabled && "opacity-40 pointer-events-none",
            error && !texto && "bg-destructive/70"
          )}
        >
          i
          {armado && !disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setArmado(false);
                setOpen(true);
              }}
              title="Editar"
              aria-label="Editar"
              className="absolute left-full top-1/2 -translate-y-1/2 ml-1 z-20 flex h-6 w-6 items-center justify-center rounded-md border bg-popover shadow-md hover:bg-accent"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
        </span>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{modalTitle}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>{tituloLabel}</Label>
              <Input
                value={draftTitulo}
                onChange={(e) => setDraftTitulo(e.target.value)}
                placeholder={tituloPlaceholder}
                autoFocus
              />
            </div>

            {onMinutosChange && (
              <div className="space-y-1 max-w-[120px]">
                <Label>Minutos</Label>
                <Input
                  type="number"
                  min={1}
                  max={60}
                  value={draftMinutos}
                  onChange={(e) => setDraftMinutos(e.target.value)}
                />
              </div>
            )}

            {onLeccionChange && (
              <div className="space-y-1">
                <Label>Lección</Label>
                <Input
                  value={draftLeccion}
                  onChange={(e) => setDraftLeccion(e.target.value)}
                  placeholder={leccionPlaceholder ?? "Ej: lmd lección 4 punto 3"}
                />
              </div>
            )}

            {mostrarDetalle && (
              <div className="space-y-1">
                <Label>Detalle</Label>
                <Textarea
                  value={draftDetalle}
                  onChange={(e) => setDraftDetalle(e.target.value)}
                  rows={3}
                />
              </div>
            )}

            {onNotasChange && (
              <div className="space-y-1">
                <Label>Notas</Label>
                <Textarea
                  value={draftNotas}
                  onChange={(e) => setDraftNotas(e.target.value)}
                  placeholder="Nota para el equipo o para recordar algo..."
                  rows={2}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleGuardar}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
