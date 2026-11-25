import { Checkbox } from "@/components/ui/checkbox";
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
 * Casillas SS / CO / SEC (tercera columna de Responsabilidades). Muestra solo los cargos libres; si la
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
    <div className="flex w-24 shrink-0 flex-col gap-2 border-l pl-5 sm:w-40 sm:pl-10">
      {opciones.map((c) => (
        <label key={c.value} className="flex items-center gap-3 text-sm font-medium cursor-pointer" title={c.label}>
          <Checkbox checked={valor === c.value} onCheckedChange={(marcado) => onChange(marcado ? c.value : "")} />
          {c.abbr}
        </label>
      ))}
    </div>
  );
}
