import { useState, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { MessageSquarePlus, Trash2 } from "lucide-react";

const COLORES_BASE = [
  { value: "#16a34a", label: "Verde" },
  { value: "#1e3a5f", label: "Azul" },
  { value: "#9333ea", label: "Morado" },
  { value: "#dc2626", label: "Rojo" },
  { value: "#ea580c", label: "Naranja" },
  { value: "#0891b2", label: "Cian" },
  { value: "#475569", label: "Gris" },
];

interface ExistingMsg {
  id: string;
  mensaje: string;
  color: string;
  modulo: string;
}

interface Props {
  fecha: string;
  existing?: ExistingMsg;
  defaultColor?: string;
  onCreate: (data: { fecha: string; mensaje: string; color: string; modulo: "asignaciones_servicio" | "ambos" }) => void;
  onUpdate: (data: { id: string; mensaje: string; color: string; modulo: "asignaciones_servicio" | "ambos" }) => void;
  onDelete: (id: string) => void;
}

export function MensajeAdicionalPopover({ fecha, existing, defaultColor, onCreate, onUpdate, onDelete }: Props) {
  const [open, setOpen] = useState(false);
  const [texto, setTexto] = useState("");
  const initialColor = defaultColor || "#16a34a";
  const [color, setColor] = useState(initialColor);
  const [aplicarAmbos, setAplicarAmbos] = useState(false);

  const COLORES = defaultColor && !COLORES_BASE.some((c) => c.value.toLowerCase() === defaultColor.toLowerCase())
    ? [{ value: defaultColor, label: "Color del tema" }, ...COLORES_BASE]
    : COLORES_BASE;

  useEffect(() => {
    if (open) {
      setTexto(existing?.mensaje || "");
      setColor(existing?.color || initialColor);
      setAplicarAmbos(existing?.modulo === "ambos");
    }
  }, [open, existing, initialColor]);

  const handleSave = () => {
    if (!texto.trim()) return;
    const modulo = aplicarAmbos ? "ambos" : "asignaciones_servicio";
    if (existing) {
      onUpdate({ id: existing.id, mensaje: texto.trim(), color, modulo });
    } else {
      onCreate({ fecha, mensaje: texto.trim(), color, modulo });
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 p-0"
          title={existing ? `Mensaje: ${existing.mensaje}` : "Agregar mensaje adicional"}
        >
          <MessageSquarePlus
            className="h-3 w-3"
            style={existing ? { color: existing.color } : { opacity: 0.5 }}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="end">
        <div className="text-xs font-semibold mb-2">
          {existing ? "Editar mensaje adicional" : "Nuevo mensaje adicional"}
        </div>
        <Input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Ej: Visita del Superintendente"
          className="text-xs h-8 mb-2"
        />
        <div className="flex flex-wrap gap-1 mb-2">
          {COLORES.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setColor(c.value)}
              className={`h-6 w-6 rounded border-2 ${color === c.value ? "border-foreground" : "border-transparent"}`}
              style={{ background: c.value }}
              title={c.label}
            />
          ))}
        </div>
        <div className="flex items-center gap-2 mb-3">
          <Checkbox
            id={`ambos-${fecha}`}
            checked={aplicarAmbos}
            onCheckedChange={(v) => setAplicarAmbos(!!v)}
          />
          <Label htmlFor={`ambos-${fecha}`} className="text-xs font-normal cursor-pointer">
            Aplicar también a Predicación
          </Label>
        </div>
        <div className="flex gap-2 justify-end">
          {existing && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs text-destructive hover:bg-destructive/10"
              onClick={() => {
                onDelete(existing.id);
                setOpen(false);
              }}
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Eliminar
            </Button>
          )}
          <Button size="sm" className="h-7 text-xs" onClick={handleSave} disabled={!texto.trim()}>
            Guardar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
