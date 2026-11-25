import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { CARGOS_COMITE } from "@/lib/cargosComite";

interface Props {
  /** Solo los ancianos activos pueden tener un cargo del comité de servicio. */
  habilitado: boolean;
  valor: string;
  onChange: (valor: string) => void;
  participantes: { id: string; activo: boolean; cargo_comite?: string | null }[];
  participanteId: string | null;
}

/**
 * Casillas SS / CO / SEC de la ficha del participante. Muestra solo los cargos libres; si la
 * persona ya tiene uno, muestra únicamente ese (para poder desmarcarlo).
 */
export function CargoComiteCampo({ habilitado, valor, onChange, participantes, participanteId }: Props) {
  if (!habilitado) return null;

  const ocupados = new Set(
    participantes.filter((p) => p.id !== participanteId && p.activo && p.cargo_comite).map((p) => p.cargo_comite),
  );
  const opciones = CARGOS_COMITE.filter((c) => (valor ? c.value === valor : !ocupados.has(c.value)));
  if (opciones.length === 0) return null;

  return (
    <div className="space-y-2">
      <Label>Comité de Servicio</Label>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {opciones.map((c) => (
          <label key={c.value} className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={valor === c.value} onCheckedChange={(marcado) => onChange(marcado ? c.value : "")} />
            {c.label} ({c.abbr})
          </label>
        ))}
      </div>
    </div>
  );
}
