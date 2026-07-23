import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

interface PublicacionAnticipadaConfigProps {
  activo: boolean;
  dia: string;
  onActivoChange: (value: boolean) => void;
  onDiaChange: (value: string) => void;
  disabled?: boolean;
}

export function PublicacionAnticipadaConfig({
  activo,
  dia,
  onActivoChange,
  onDiaChange,
  disabled = false,
}: PublicacionAnticipadaConfigProps) {
  return (
    <div className="space-y-4 pt-4 border-t">
      <div>
        <h4 className="text-sm font-medium mb-1">Publicación anticipada del mes siguiente</h4>
        <p className="text-xs text-muted-foreground">
          A partir del día configurado, si el programa del mes siguiente ya está publicado, se mostrará
          junto al del mes en curso en "Programas del Mes". El mes en curso siempre se elimina
          automáticamente el último día del mes a las 23:59 (hora de Chile).
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Switch
          id="publicacion-anticipada-activo"
          checked={activo}
          onCheckedChange={onActivoChange}
          disabled={disabled}
        />
        <Label htmlFor="publicacion-anticipada-activo" className="cursor-pointer">
          {activo ? "Publicación anticipada activada" : "Publicación anticipada desactivada"}
        </Label>
      </div>

      {activo && (
        <div className="space-y-1">
          <Label>Día del mes desde el que se disponibiliza el mes siguiente</Label>
          <Input
            type="number"
            min={1}
            max={28}
            value={dia}
            onChange={(e) => onDiaChange(e.target.value)}
            className="w-[120px]"
            disabled={disabled}
          />
          <p className="text-xs text-muted-foreground">
            Si el programa del mes siguiente no estaba publicado a esta fecha, se disponibilizará de
            inmediato en cuanto se publique.
          </p>
        </div>
      )}
    </div>
  );
}
