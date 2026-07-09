import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

interface CierreAutomaticoConfigProps {
  activo: boolean;
  dia: string;
  onActivoChange: (value: boolean) => void;
  onDiaChange: (value: string) => void;
  disabled?: boolean;
}

export function CierreAutomaticoConfig({
  activo,
  dia,
  onActivoChange,
  onDiaChange,
  disabled = false,
}: CierreAutomaticoConfigProps) {
  return (
    <div className="space-y-4 pt-4 border-t">
      <div>
        <h4 className="text-sm font-medium mb-1">Cierre automático del programa</h4>
        <p className="text-xs text-muted-foreground">
          El mes anterior siempre queda bloqueado. Aquí configuras si el mes en curso también se cierra automáticamente a partir de un día específico.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Switch
          id="cierre-activo"
          checked={activo}
          onCheckedChange={onActivoChange}
          disabled={disabled}
        />
        <Label htmlFor="cierre-activo" className="cursor-pointer">
          {activo ? "Cierre automático activado" : "Cierre automático desactivado"}
        </Label>
      </div>

      {activo && (
        <div className="space-y-1">
          <Label>Día del mes en que se cierra</Label>
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
            Desde ese día, el programa del mes en curso quedará bloqueado para todos. Solo un super administrador podrá modificarlo.
          </p>
        </div>
      )}
    </div>
  );
}
