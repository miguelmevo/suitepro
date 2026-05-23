import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle } from "lucide-react";

interface Props {
  open: boolean;
  /** Nombre+apellido del participante que ya existe (ej: "Tomás Dinamarca") */
  nombreExistente: string;
  /** Alias ya existente del otro participante, si lo tiene */
  aliasExistente?: string | null;
  onCancel: () => void;
  onConfirm: (alias: string) => void;
  isSaving?: boolean;
}

export function DuplicateParticipanteAliasDialog({
  open,
  nombreExistente,
  aliasExistente,
  onCancel,
  onConfirm,
  isSaving,
}: Props) {
  const [alias, setAlias] = useState("");

  useEffect(() => {
    if (open) setAlias("");
  }, [open]);

  const trimmed = alias.trim();
  const canSave = trimmed.length > 0 && !isSaving;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="sm:max-w-[460px]" onCloseAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Participante duplicado
          </DialogTitle>
          <DialogDescription>
            Ya existe un participante llamado{" "}
            <strong className="text-foreground">{nombreExistente}</strong>
            {aliasExistente ? (
              <> (alias: <em>{aliasExistente}</em>)</>
            ) : null}
            . Para distinguirlos, agrega un alias (por ejemplo: <em>hijo</em>, <em>padre</em>,{" "}
            <em>de Juan</em>).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="alias-input">Alias *</Label>
          <Input
            id="alias-input"
            autoFocus
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            placeholder="hijo, padre, de Juan…"
            maxLength={40}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canSave) {
                e.preventDefault();
                onConfirm(trimmed);
              }
            }}
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
            Cancelar
          </Button>
          <Button type="button" disabled={!canSave} onClick={() => onConfirm(trimmed)}>
            Guardar con alias
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
