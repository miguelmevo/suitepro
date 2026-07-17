import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  /** Texto que precede al título (ej. "1.", "Título / referencia"). */
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
  const [previewOpen, setPreviewOpen] = useState(false);
  const [open, setOpen] = useState(false);

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

  // Vista compacta del popover: solo las líneas con contenido, en este orden:
  // título (si no se ve en el encabezado) → minutos → detalle → lección → notas.
  const lineasPreview: string[] = [];
  if (etiquetaFija && texto) lineasPreview.push(texto);
  if (minutos != null) lineasPreview.push(`${minutos} min`);
  if (detalle) lineasPreview.push(detalle);
  if (leccion) lineasPreview.push(`Lección: ${leccion}`);
  if (notas) lineasPreview.push(`Nota: ${notas}`);

  return (
    <>
      <div className="flex items-center gap-1.5 min-w-0">
        <span
          className={cn(
            "text-sm truncate",
            etiquetaFija || texto ? "font-medium" : "italic text-muted-foreground",
            error && !texto && "text-destructive"
          )}
          title={etiquetaFija ? undefined : texto || undefined}
        >
          {etiquetaFija
            ? prefijo
            : `${prefijo}${texto ? `: ${texto}` : ": Sin título — toca la i para agregarlo"}`}
        </span>

        <Popover open={previewOpen} onOpenChange={setPreviewOpen}>
          <PopoverTrigger asChild>
            <span
              role="button"
              tabIndex={disabled ? -1 : 0}
              aria-label="Ver / editar"
              className={cn(
                "shrink-0 h-[18px] w-[18px] rounded-full border border-primary/40 bg-primary/15 text-primary cursor-pointer",
                "flex items-center justify-center text-xs font-bold leading-none select-none",
                "hover:bg-primary/25",
                disabled && "opacity-40 pointer-events-none",
                error && !texto && "bg-destructive/20 border-destructive/50 text-destructive"
              )}
            >
              i
            </span>
          </PopoverTrigger>
          <PopoverContent showOverlay={false} className="w-auto max-w-xs p-2" align="start">
            <div className="flex items-center justify-between gap-3 mb-1">
              <span className="text-xs font-semibold text-primary">{prefijo}</span>
              <button
                type="button"
                onClick={() => {
                  setPreviewOpen(false);
                  setOpen(true);
                }}
                title="Editar"
                aria-label="Editar"
                className="shrink-0 flex h-6 w-6 items-center justify-center rounded-md border hover:bg-accent"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="text-xs text-muted-foreground space-y-0.5">
              {lineasPreview.length > 0 ? (
                lineasPreview.map((l, i) => <div key={i}>{l}</div>)
              ) : (
                <div className="italic">Sin datos</div>
              )}
            </div>
          </PopoverContent>
        </Popover>
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
