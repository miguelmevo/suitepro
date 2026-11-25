/** Cargos del comité de servicio: un cargo por anciano y un titular de cada uno por congregación. */
export const CARGOS_COMITE = [
  { value: "sup_servicio", label: "Superintendente de Servicio", abbr: "SS" },
  { value: "coordinador", label: "Coordinador", abbr: "CO" },
  { value: "secretario", label: "Secretario", abbr: "SEC" },
] as const;

export type CargoComite = (typeof CARGOS_COMITE)[number]["value"];
