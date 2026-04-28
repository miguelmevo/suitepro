export interface MaestroDiscurso {
  id: string; // local uuid for React keys
  titulo: string;
  tipo: "demostracion" | "discurso";
  titular_id: string | null;
  ayudante_id: string | null;
}

export interface VidaCristianaParte {
  id: string; // local uuid
  titulo: string;
  participante_id: string | null;
}

export interface TesorosBlock {
  titulo: string;
  participante_id: string | null;
}

export interface LecturaBiblicaBlock {
  cita: string;
  participante_id: string | null;
}

export interface EstudioBiblicoBlock {
  titulo: string;
  conductor_id: string | null;
  lector_id: string | null;
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
  notas: string | null;
  estado: "borrador" | "completo";
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export type ParticipanteFiltro =
  | "anciano"
  | "anciano_o_sm"
  | "anciano_o_sm_varon"
  | "varon_publicador"
  | "publicador"
  | "lector_atalaya"
  | "cualquiera";
