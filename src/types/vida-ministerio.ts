export interface MaestroDiscurso {
  id: string; // local uuid for React keys
  titulo: string;
  tipo: "demostracion" | "discurso";
  titular_id: string | null;
  ayudante_id: string | null;
  // Asignaciones por sala auxiliar (mismo título, distintos participantes)
  titular_sala_b_id?: string | null;
  ayudante_sala_b_id?: string | null;
  titular_sala_c_id?: string | null;
  ayudante_sala_c_id?: string | null;
  duracion?: number | null;
  /** Referencia de fuente (ej. "lmd lección 4 punto 3"). Auto-scrapeada de la plantilla oficial. */
  leccion?: string | null;
  /** Párrafo descriptivo del discurso. Auto-scrapeado de la plantilla oficial, editable. */
  detalle?: string | null;
  /** Nota libre del encargado de VyM, nunca auto-completada. */
  notas?: string | null;
}

export interface VidaCristianaParte {
  id: string; // local uuid
  titulo: string;
  participante_id: string | null;
  duracion?: number | null;
  /** Detalle de la asignación. Auto-scrapeado de la plantilla oficial, editable. */
  detalle?: string | null;
  /** Nota libre del encargado de VyM, nunca auto-completada. */
  notas?: string | null;
}

export interface TesorosBlock {
  titulo: string;
  participante_id: string | null;
  duracion?: number | null;
  // Minutos de partes fijas (se almacenan aquí para evitar migración):
  perlas_duracion?: number | null;
  palabras_intro_duracion?: number | null;
  cantico_inicial_duracion?: number | null;
  cantico_intermedio_duracion?: number | null;
  presidente_duracion?: number | null;
  /**
   * Texto adicional entre corchetes que aparece solo la semana en que cambia
   * el libro bíblico (ej. "[Ponga el VIDEO Información sobre Jeremías]").
   * Auto-scrapeado cuando existe; si no viene, el campo no se muestra.
   */
  detalle?: string | null;
  /** Nota libre del encargado de VyM, nunca auto-completada. */
  notas?: string | null;
}

export interface LecturaBiblicaBlock {
  cita: string;
  participante_id: string | null;
  duracion?: number | null;
  /** Referencia de fuente (ej. "th lección 2"). Auto-scrapeada de la plantilla oficial. */
  leccion?: string | null;
  /** Nota libre del encargado de VyM, nunca auto-completada. */
  notas?: string | null;
}

export interface EstudioBiblicoBlock {
  titulo: string;
  conductor_id: string | null;
  lector_id: string | null;
  visita_superintendente?: boolean;
  titulo_discurso?: string;
  duracion?: number | null;
  palabras_conclusion_duracion?: number | null;
  cantico_final_duracion?: number | null;
}

export interface ProgramaVidaMinisterio {
  id: string;
  congregacion_id: string;
  fecha_semana: string; // YYYY-MM-DD (lunes)
  presidente_id: string | null;
  cantico_inicial: number | null;
  cantico_intermedio: number | null;
  cantico_final: number | null;
  oracion_inicial_id: string | null;
  oracion_final_id: string | null;
  salas_auxiliares_override: number | null;
  tesoros: TesorosBlock;
  perlas_id: string | null;
  lectura_biblica: LecturaBiblicaBlock;
  maestros: MaestroDiscurso[];
  encargado_sala_b_id: string | null;
  encargado_sala_c_id: string | null;
  vida_cristiana: VidaCristianaParte[];
  estudio_biblico: EstudioBiblicoBlock;
  lectura_semana: string | null;
  notas: string | null;
  estado: "borrador" | "completo";
  activo: boolean;
  sin_reunion?: boolean;
  sin_reunion_motivo?: string | null;
  sin_reunion_motivo_2?: string | null;
  created_at: string;
  updated_at: string;
}

export type ParticipanteFiltro =
  | "anciano"
  | "anciano_o_sm"
  | "anciano_o_sm_varon"
  | "varon_publicador"
  | "varon_emc"
  | "publicador"
  | "lector_atalaya"
  | "lector_ebc"
  | "superintendente_circuito"
  | "aprobado"
  | "cualquiera";
