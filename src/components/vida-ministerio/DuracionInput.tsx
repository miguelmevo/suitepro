import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  disabled?: boolean;
  showLabel?: boolean;
}

/** Extrae los minutos del sufijo "(X mins.)" si existe en el título. */
export function extraerMinutosDeTitulo(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = s.match(/\(\s*(\d{1,2})\s*mins?\.?\s*\)/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  if (isNaN(n) || n < 1 || n > 20) return null;
  return n;
}

export function DuracionInput({ value, onChange, disabled, showLabel = true }: Props) {
  return (
    <div className="space-y-1">
      {showLabel && <Label className="text-xs">Mins.</Label>}
      <Input
        type="number"
        min={1}
        max={20}
        step={1}
        value={value ?? ""}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") return onChange(null);
          let n = parseInt(raw, 10);
          if (isNaN(n)) return onChange(null);
          if (n < 1) n = 1;
          if (n > 20) n = 20;
          onChange(n);
        }}
        disabled={disabled}
        className="text-center"
      />
    </div>
  );
}
