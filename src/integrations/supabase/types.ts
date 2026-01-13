export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      asignaciones_capitan_fijas: {
        Row: {
          activo: boolean
          capitan_id: string
          congregacion_id: string
          created_at: string
          dia_semana: number
          horario_id: string
          id: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          capitan_id: string
          congregacion_id: string
          created_at?: string
          dia_semana: number
          horario_id: string
          id?: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          capitan_id?: string
          congregacion_id?: string
          created_at?: string
          dia_semana?: number
          horario_id?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "asignaciones_capitan_fijas_capitan_id_fkey"
            columns: ["capitan_id"]
            isOneToOne: false
            referencedRelation: "participantes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asignaciones_capitan_fijas_congregacion_id_fkey"
            columns: ["congregacion_id"]
            isOneToOne: false
            referencedRelation: "congregaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asignaciones_capitan_fijas_horario_id_fkey"
            columns: ["horario_id"]
            isOneToOne: false
            referencedRelation: "horarios_salida"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracion_sistema: {
        Row: {
          clave: string
          congregacion_id: string
          created_at: string
          id: string
          programa_tipo: string
          updated_at: string
          valor: Json
        }
        Insert: {
          clave: string
          congregacion_id: string
          created_at?: string
          id?: string
          programa_tipo: string
          updated_at?: string
          valor?: Json
        }
        Update: {
          clave?: string
          congregacion_id?: string
          created_at?: string
          id?: string
          programa_tipo?: string
          updated_at?: string
          valor?: Json
        }
        Relationships: [
          {
            foreignKeyName: "configuracion_sistema_congregacion_id_fkey"
            columns: ["congregacion_id"]
            isOneToOne: false
            referencedRelation: "congregaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      congregaciones: {
        Row: {
          activo: boolean
          created_at: string
          id: string
          nombre: string
          slug: string
          updated_at: string
          url_oculta: boolean
        }
        Insert: {
          activo?: boolean
          created_at?: string
          id?: string
          nombre: string
          slug: string
          updated_at?: string
          url_oculta?: boolean
        }
        Update: {
          activo?: boolean
          created_at?: string
          id?: string
          nombre?: string
          slug?: string
          updated_at?: string
          url_oculta?: boolean
        }
        Relationships: []
      }
      dias_especiales: {
        Row: {
          activo: boolean
          bloqueo_tipo: string
          color: string
          congregacion_id: string
          created_at: string
          fecha: string | null
          id: string
          nombre: string
        }
        Insert: {
          activo?: boolean
          bloqueo_tipo: string
          color?: string
          congregacion_id: string
          created_at?: string
          fecha?: string | null
          id?: string
          nombre: string
        }
        Update: {
          activo?: boolean
          bloqueo_tipo?: string
          color?: string
          congregacion_id?: string
          created_at?: string
          fecha?: string | null
          id?: string
          nombre?: string
        }
        Relationships: [
          {
            foreignKeyName: "dias_especiales_congregacion_id_fkey"
            columns: ["congregacion_id"]
            isOneToOne: false
            referencedRelation: "congregaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      direcciones_bloqueadas: {
        Row: {
          activo: boolean
          congregacion_id: string
          created_at: string
          direccion: string
          id: string
          motivo: string | null
          territorio_id: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          congregacion_id: string
          created_at?: string
          direccion: string
          id?: string
          motivo?: string | null
          territorio_id: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          congregacion_id?: string
          created_at?: string
          direccion?: string
          id?: string
          motivo?: string | null
          territorio_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "direcciones_bloqueadas_congregacion_id_fkey"
            columns: ["congregacion_id"]
            isOneToOne: false
            referencedRelation: "congregaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direcciones_bloqueadas_territorio_id_fkey"
            columns: ["territorio_id"]
            isOneToOne: false
            referencedRelation: "territorios"
            referencedColumns: ["id"]
          },
        ]
      }
      disponibilidad_capitanes: {
        Row: {
          activo: boolean
          bloque_horario: string
          capitan_id: string
          congregacion_id: string
          created_at: string
          dia_semana: number
          id: string
        }
        Insert: {
          activo?: boolean
          bloque_horario: string
          capitan_id: string
          congregacion_id: string
          created_at?: string
          dia_semana: number
          id?: string
        }
        Update: {
          activo?: boolean
          bloque_horario?: string
          capitan_id?: string
          congregacion_id?: string
          created_at?: string
          dia_semana?: number
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "disponibilidad_capitanes_capitan_id_fkey"
            columns: ["capitan_id"]
            isOneToOne: false
            referencedRelation: "participantes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disponibilidad_capitanes_congregacion_id_fkey"
            columns: ["congregacion_id"]
            isOneToOne: false
            referencedRelation: "congregaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      grupos_predicacion: {
        Row: {
          activo: boolean
          auxiliar_id: string | null
          congregacion_id: string
          created_at: string
          id: string
          numero: number
          superintendente_id: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          auxiliar_id?: string | null
          congregacion_id: string
          created_at?: string
          id?: string
          numero: number
          superintendente_id?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          auxiliar_id?: string | null
          congregacion_id?: string
          created_at?: string
          id?: string
          numero?: number
          superintendente_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grupos_predicacion_auxiliar_id_fkey"
            columns: ["auxiliar_id"]
            isOneToOne: false
            referencedRelation: "participantes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grupos_predicacion_congregacion_id_fkey"
            columns: ["congregacion_id"]
            isOneToOne: false
            referencedRelation: "congregaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grupos_predicacion_superintendente_id_fkey"
            columns: ["superintendente_id"]
            isOneToOne: false
            referencedRelation: "participantes"
            referencedColumns: ["id"]
          },
        ]
      }
      grupos_servicio: {
        Row: {
          activo: boolean
          congregacion_id: string
          created_at: string
          descripcion: string | null
          id: string
          nombre: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          congregacion_id: string
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          congregacion_id?: string
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grupos_servicio_congregacion_id_fkey"
            columns: ["congregacion_id"]
            isOneToOne: false
            referencedRelation: "congregaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      horarios_salida: {
        Row: {
          activo: boolean
          congregacion_id: string
          created_at: string
          hora: string
          id: string
          nombre: string
          orden: number
        }
        Insert: {
          activo?: boolean
          congregacion_id: string
          created_at?: string
          hora: string
          id?: string
          nombre: string
          orden?: number
        }
        Update: {
          activo?: boolean
          congregacion_id?: string
          created_at?: string
          hora?: string
          id?: string
          nombre?: string
          orden?: number
        }
        Relationships: [
          {
            foreignKeyName: "horarios_salida_congregacion_id_fkey"
            columns: ["congregacion_id"]
            isOneToOne: false
            referencedRelation: "congregaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      indisponibilidad_participantes: {
        Row: {
          activo: boolean
          congregacion_id: string
          created_at: string
          fecha_fin: string | null
          fecha_inicio: string
          id: string
          motivo: string | null
          participante_id: string
          tipo_responsabilidad: string[]
          updated_at: string
        }
        Insert: {
          activo?: boolean
          congregacion_id: string
          created_at?: string
          fecha_fin?: string | null
          fecha_inicio: string
          id?: string
          motivo?: string | null
          participante_id: string
          tipo_responsabilidad?: string[]
          updated_at?: string
        }
        Update: {
          activo?: boolean
          congregacion_id?: string
          created_at?: string
          fecha_fin?: string | null
          fecha_inicio?: string
          id?: string
          motivo?: string | null
          participante_id?: string
          tipo_responsabilidad?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "indisponibilidad_participantes_congregacion_id_fkey"
            columns: ["congregacion_id"]
            isOneToOne: false
            referencedRelation: "congregaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indisponibilidad_participantes_participante_id_fkey"
            columns: ["participante_id"]
            isOneToOne: false
            referencedRelation: "participantes"
            referencedColumns: ["id"]
          },
        ]
      }
      manzanas_territorio: {
        Row: {
          activo: boolean
          congregacion_id: string
          created_at: string
          id: string
          letra: string
          territorio_id: string
        }
        Insert: {
          activo?: boolean
          congregacion_id: string
          created_at?: string
          id?: string
          letra: string
          territorio_id: string
        }
        Update: {
          activo?: boolean
          congregacion_id?: string
          created_at?: string
          id?: string
          letra?: string
          territorio_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "manzanas_territorio_congregacion_id_fkey"
            columns: ["congregacion_id"]
            isOneToOne: false
            referencedRelation: "congregaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manzanas_territorio_territorio_id_fkey"
            columns: ["territorio_id"]
            isOneToOne: false
            referencedRelation: "territorios"
            referencedColumns: ["id"]
          },
        ]
      }
      mensajes_adicionales: {
        Row: {
          activo: boolean
          color: string
          congregacion_id: string
          created_at: string
          fecha: string
          id: string
          mensaje: string
        }
        Insert: {
          activo?: boolean
          color?: string
          congregacion_id: string
          created_at?: string
          fecha: string
          id?: string
          mensaje: string
        }
        Update: {
          activo?: boolean
          color?: string
          congregacion_id?: string
          created_at?: string
          fecha?: string
          id?: string
          mensaje?: string
        }
        Relationships: [
          {
            foreignKeyName: "mensajes_adicionales_congregacion_id_fkey"
            columns: ["congregacion_id"]
            isOneToOne: false
            referencedRelation: "congregaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      miembros_grupo: {
        Row: {
          activo: boolean
          congregacion_id: string
          created_at: string
          es_capitan: boolean
          grupo_id: string
          id: string
          participante_id: string
        }
        Insert: {
          activo?: boolean
          congregacion_id: string
          created_at?: string
          es_capitan?: boolean
          grupo_id: string
          id?: string
          participante_id: string
        }
        Update: {
          activo?: boolean
          congregacion_id?: string
          created_at?: string
          es_capitan?: boolean
          grupo_id?: string
          id?: string
          participante_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "miembros_grupo_congregacion_id_fkey"
            columns: ["congregacion_id"]
            isOneToOne: false
            referencedRelation: "congregaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "miembros_grupo_grupo_id_fkey"
            columns: ["grupo_id"]
            isOneToOne: false
            referencedRelation: "grupos_servicio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "miembros_grupo_participante_id_fkey"
            columns: ["participante_id"]
            isOneToOne: false
            referencedRelation: "participantes"
            referencedColumns: ["id"]
          },
        ]
      }
      participantes: {
        Row: {
          activo: boolean
          apellido: string
          congregacion_id: string
          created_at: string
          es_capitan_grupo: boolean
          estado_aprobado: boolean
          grupo_predicacion_id: string | null
          id: string
          nombre: string
          responsabilidad: string[]
          responsabilidad_adicional: string | null
          restriccion_disponibilidad: string | null
          telefono: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          activo?: boolean
          apellido: string
          congregacion_id: string
          created_at?: string
          es_capitan_grupo?: boolean
          estado_aprobado?: boolean
          grupo_predicacion_id?: string | null
          id?: string
          nombre: string
          responsabilidad?: string[]
          responsabilidad_adicional?: string | null
          restriccion_disponibilidad?: string | null
          telefono?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          activo?: boolean
          apellido?: string
          congregacion_id?: string
          created_at?: string
          es_capitan_grupo?: boolean
          estado_aprobado?: boolean
          grupo_predicacion_id?: string | null
          id?: string
          nombre?: string
          responsabilidad?: string[]
          responsabilidad_adicional?: string | null
          restriccion_disponibilidad?: string | null
          telefono?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "participantes_congregacion_id_fkey"
            columns: ["congregacion_id"]
            isOneToOne: false
            referencedRelation: "congregaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participantes_grupo_predicacion_id_fkey"
            columns: ["grupo_predicacion_id"]
            isOneToOne: false
            referencedRelation: "grupos_predicacion"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          apellido: string | null
          aprobado: boolean | null
          aprobado_por: string | null
          created_at: string
          debe_cambiar_password: boolean | null
          email: string
          fecha_aprobacion: string | null
          id: string
          nombre: string | null
          updated_at: string
        }
        Insert: {
          apellido?: string | null
          aprobado?: boolean | null
          aprobado_por?: string | null
          created_at?: string
          debe_cambiar_password?: boolean | null
          email: string
          fecha_aprobacion?: string | null
          id: string
          nombre?: string | null
          updated_at?: string
        }
        Update: {
          apellido?: string | null
          aprobado?: boolean | null
          aprobado_por?: string | null
          created_at?: string
          debe_cambiar_password?: boolean | null
          email?: string
          fecha_aprobacion?: string | null
          id?: string
          nombre?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      programa_predicacion: {
        Row: {
          activo: boolean
          asignaciones_grupos: Json | null
          capitan_id: string | null
          colspan_completo: boolean
          congregacion_id: string
          created_at: string
          es_mensaje_especial: boolean
          es_por_grupos: boolean
          fecha: string
          horario_id: string | null
          id: string
          mensaje_especial: string | null
          punto_encuentro_id: string | null
          territorio_id: string | null
          territorio_ids: string[] | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          asignaciones_grupos?: Json | null
          capitan_id?: string | null
          colspan_completo?: boolean
          congregacion_id: string
          created_at?: string
          es_mensaje_especial?: boolean
          es_por_grupos?: boolean
          fecha: string
          horario_id?: string | null
          id?: string
          mensaje_especial?: string | null
          punto_encuentro_id?: string | null
          territorio_id?: string | null
          territorio_ids?: string[] | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          asignaciones_grupos?: Json | null
          capitan_id?: string | null
          colspan_completo?: boolean
          congregacion_id?: string
          created_at?: string
          es_mensaje_especial?: boolean
          es_por_grupos?: boolean
          fecha?: string
          horario_id?: string | null
          id?: string
          mensaje_especial?: string | null
          punto_encuentro_id?: string | null
          territorio_id?: string | null
          territorio_ids?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "programa_predicacion_capitan_id_fkey"
            columns: ["capitan_id"]
            isOneToOne: false
            referencedRelation: "participantes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programa_predicacion_congregacion_id_fkey"
            columns: ["congregacion_id"]
            isOneToOne: false
            referencedRelation: "congregaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programa_predicacion_horario_id_fkey"
            columns: ["horario_id"]
            isOneToOne: false
            referencedRelation: "horarios_salida"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programa_predicacion_punto_encuentro_id_fkey"
            columns: ["punto_encuentro_id"]
            isOneToOne: false
            referencedRelation: "puntos_encuentro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programa_predicacion_territorio_id_fkey"
            columns: ["territorio_id"]
            isOneToOne: false
            referencedRelation: "territorios"
            referencedColumns: ["id"]
          },
        ]
      }
      programas_publicados: {
        Row: {
          activo: boolean
          cerrado: boolean
          cerrado_por: string | null
          congregacion_id: string
          created_at: string
          fecha_cierre: string | null
          fecha_fin: string
          fecha_inicio: string
          id: string
          pdf_path: string
          pdf_url: string
          periodo: string
          publicado_por: string | null
          tipo_programa: string
        }
        Insert: {
          activo?: boolean
          cerrado?: boolean
          cerrado_por?: string | null
          congregacion_id: string
          created_at?: string
          fecha_cierre?: string | null
          fecha_fin: string
          fecha_inicio: string
          id?: string
          pdf_path: string
          pdf_url: string
          periodo: string
          publicado_por?: string | null
          tipo_programa?: string
        }
        Update: {
          activo?: boolean
          cerrado?: boolean
          cerrado_por?: string | null
          congregacion_id?: string
          created_at?: string
          fecha_cierre?: string | null
          fecha_fin?: string
          fecha_inicio?: string
          id?: string
          pdf_path?: string
          pdf_url?: string
          periodo?: string
          publicado_por?: string | null
          tipo_programa?: string
        }
        Relationships: [
          {
            foreignKeyName: "programas_publicados_congregacion_id_fkey"
            columns: ["congregacion_id"]
            isOneToOne: false
            referencedRelation: "congregaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      puntos_encuentro: {
        Row: {
          activo: boolean
          congregacion_id: string
          created_at: string
          direccion: string | null
          id: string
          nombre: string
          updated_at: string
          url_maps: string | null
        }
        Insert: {
          activo?: boolean
          congregacion_id: string
          created_at?: string
          direccion?: string | null
          id?: string
          nombre: string
          updated_at?: string
          url_maps?: string | null
        }
        Update: {
          activo?: boolean
          congregacion_id?: string
          created_at?: string
          direccion?: string | null
          id?: string
          nombre?: string
          updated_at?: string
          url_maps?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "puntos_encuentro_congregacion_id_fkey"
            columns: ["congregacion_id"]
            isOneToOne: false
            referencedRelation: "congregaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      territorios: {
        Row: {
          activo: boolean
          congregacion_id: string
          created_at: string
          descripcion: string | null
          id: string
          imagen_url: string | null
          nombre: string | null
          numero: string
          updated_at: string
          url_maps: string | null
        }
        Insert: {
          activo?: boolean
          congregacion_id: string
          created_at?: string
          descripcion?: string | null
          id?: string
          imagen_url?: string | null
          nombre?: string | null
          numero: string
          updated_at?: string
          url_maps?: string | null
        }
        Update: {
          activo?: boolean
          congregacion_id?: string
          created_at?: string
          descripcion?: string | null
          id?: string
          imagen_url?: string | null
          nombre?: string | null
          numero?: string
          updated_at?: string
          url_maps?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "territorios_congregacion_id_fkey"
            columns: ["congregacion_id"]
            isOneToOne: false
            referencedRelation: "congregaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      tipos_programa: {
        Row: {
          activo: boolean
          created_at: string
          descripcion: string | null
          icono: string | null
          id: string
          nombre: string
          orden: number
        }
        Insert: {
          activo?: boolean
          created_at?: string
          descripcion?: string | null
          icono?: string | null
          id?: string
          nombre: string
          orden?: number
        }
        Update: {
          activo?: boolean
          created_at?: string
          descripcion?: string | null
          icono?: string | null
          id?: string
          nombre?: string
          orden?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      usuarios_congregacion: {
        Row: {
          activo: boolean
          congregacion_id: string
          created_at: string
          es_principal: boolean
          id: string
          participante_id: string | null
          rol: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          activo?: boolean
          congregacion_id: string
          created_at?: string
          es_principal?: boolean
          id?: string
          participante_id?: string | null
          rol?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          activo?: boolean
          congregacion_id?: string
          created_at?: string
          es_principal?: boolean
          id?: string
          participante_id?: string | null
          rol?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_congregacion_congregacion_id_fkey"
            columns: ["congregacion_id"]
            isOneToOne: false
            referencedRelation: "congregaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuarios_congregacion_participante_id_fkey"
            columns: ["participante_id"]
            isOneToOne: false
            referencedRelation: "participantes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_congregation_creator: {
        Args: { _congregacion_id: string }
        Returns: undefined
      }
      assign_user_to_congregation: {
        Args: { _congregacion_id: string }
        Returns: undefined
      }
      can_create_congregation: { Args: never; Returns: boolean }
      cerrar_programa: { Args: { _programa_id: string }; Returns: undefined }
      create_congregation_and_admin: {
        Args: { _nombre: string; _slug: string; _url_oculta?: boolean }
        Returns: {
          id: string
          slug: string
        }[]
      }
      delete_congregation_cascade: {
        Args: { _congregacion_id: string }
        Returns: undefined
      }
      delete_orphan_user:
        | { Args: { _user_id: string }; Returns: undefined }
        | {
            Args: { _caller_id?: string; _user_id: string }
            Returns: undefined
          }
      get_congregacion_by_slug: {
        Args: { _slug: string }
        Returns: {
          activo: boolean
          id: string
          nombre: string
          slug: string
        }[]
      }
      get_orphan_users: {
        Args: never
        Returns: {
          apellido: string
          created_at: string
          email: string
          id: string
          nombre: string
        }[]
      }
      get_participantes_seguros: {
        Args: never
        Returns: {
          activo: boolean
          apellido: string
          created_at: string
          es_capitan_grupo: boolean
          estado_aprobado: boolean
          grupo_predicacion_id: string
          id: string
          nombre: string
          responsabilidad: string[]
          responsabilidad_adicional: string
          restriccion_disponibilidad: string
          telefono: string
          updated_at: string
          user_id: string
        }[]
      }
      get_user_congregacion_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role_in_congregacion: {
        Args: {
          _congregacion_id: string
          _role: Database["public"]["Enums"]["app_role"]
        }
        Returns: boolean
      }
      is_admin_or_editor: { Args: { _user_id: string }; Returns: boolean }
      is_admin_or_editor_in_congregacion: {
        Args: { _congregacion_id: string }
        Returns: boolean
      }
      is_congregation_admin: {
        Args: { _congregacion_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      programa_mes_cerrado: {
        Args: {
          _congregacion_id: string
          _fecha_fin: string
          _fecha_inicio: string
          _tipo_programa: string
        }
        Returns: boolean
      }
      reabrir_programa: { Args: { _programa_id: string }; Returns: undefined }
      restore_super_admin_access: { Args: never; Returns: undefined }
      user_has_access_to_congregacion: {
        Args: { _congregacion_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "editor" | "user" | "super_admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "editor", "user", "super_admin"],
    },
  },
} as const
