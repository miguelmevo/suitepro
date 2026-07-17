import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  /** Texto que precede al título (ej. "1. Tesoros de la Biblia", "Título de la parte"). */
  prefijo: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: boolean;
  modalTitle: string;
  modalPlaceholder?: string;
}

export function TituloEditableModal({
  prefijo,
  value,
  onChange,
  disabled,
  error,
  modalTitle,
  modalPlaceholder,
}: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  const handleGuardar = () => {
    onChange(draft);
    setOpen(false);
  };

  return (
    <>
      <div className="flex items-center gap-1.5 min-w-0">
        <span
          className={cn(
            "text-sm truncate",
            value ? "font-medium" : "italic text-muted-foreground",
            error && !value && "text-destructive"
          )}
          title={value || undefined}
        >
          {prefijo}
          {value ? `: ${value}` : ": Sin título — toca la i para agregarlo"}
        </span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={disabled}
          title="Editar título"
          aria-label="Editar título"
          className={cn(
            "shrink-0 font-bold italic text-primary hover:text-primary/70 disabled:opacity-40 disabled:pointer-events-none",
            error && !value && "text-destructive"
          )}
        >
          <sup>i</sup>
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{modalTitle}</DialogTitle>
          </DialogHeader>
          <div className="space-y-1">
            <Label>Título</Label>
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={modalPlaceholder}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleGuardar();
                }
              }}
            />
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
