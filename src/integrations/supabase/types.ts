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
      configuracion_sistema: {
        Row: {
          clave: string
          created_at: string
          id: string
          programa_tipo: string
          updated_at: string
          valor: Json
        }
        Insert: {
          clave: string
          created_at?: string
          id?: string
          programa_tipo: string
          updated_at?: string
          valor?: Json
        }
        Update: {
          clave?: string
          created_at?: string
          id?: string
          programa_tipo?: string
          updated_at?: string
          valor?: Json
        }
        Relationships: []
      }
      dias_especiales: {
        Row: {
          activo: boolean
          bloqueo_tipo: string
          created_at: string
          fecha: string
          id: string
          nombre: string
        }
        Insert: {
          activo?: boolean
          bloqueo_tipo: string
          created_at?: string
          fecha: string
          id?: string
          nombre: string
        }
        Update: {
          activo?: boolean
          bloqueo_tipo?: string
          created_at?: string
          fecha?: string
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      grupos_predicacion: {
        Row: {
          activo: boolean
          auxiliar_id: string | null
          created_at: string
          id: string
          numero: number
          superintendente_id: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          auxiliar_id?: string | null
          created_at?: string
          id?: string
          numero: number
          superintendente_id?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          auxiliar_id?: string | null
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
          created_at: string
          descripcion: string | null
          id: string
          nombre: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre?: string
          updated_at?: string
        }
        Relationships: []
      }
      horarios_salida: {
        Row: {
          activo: boolean
          created_at: string
          hora: string
          id: string
          nombre: string
          orden: number
        }
        Insert: {
          activo?: boolean
          created_at?: string
          hora: string
          id?: string
          nombre: string
          orden?: number
        }
        Update: {
          activo?: boolean
          created_at?: string
          hora?: string
          id?: string
          nombre?: string
          orden?: number
        }
        Relationships: []
      }
      manzanas_territorio: {
        Row: {
          activo: boolean
          created_at: string
          id: string
          letra: string
          territorio_id: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          id?: string
          letra: string
          territorio_id: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          id?: string
          letra?: string
          territorio_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "manzanas_territorio_territorio_id_fkey"
            columns: ["territorio_id"]
            isOneToOne: false
            referencedRelation: "territorios"
            referencedColumns: ["id"]
          },
        ]
      }
      miembros_grupo: {
        Row: {
          activo: boolean
          created_at: string
          es_capitan: boolean
          grupo_id: string
          id: string
          participante_id: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          es_capitan?: boolean
          grupo_id: string
          id?: string
          participante_id: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          es_capitan?: boolean
          grupo_id?: string
          id?: string
          participante_id?: string
        }
        Relationships: [
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
          created_at: string
          id: string
          nombre: string
          telefono: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          apellido: string
          created_at?: string
          id?: string
          nombre: string
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          apellido?: string
          created_at?: string
          id?: string
          nombre?: string
          telefono?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          apellido: string | null
          created_at: string
          email: string
          id: string
          nombre: string | null
          updated_at: string
        }
        Insert: {
          apellido?: string | null
          created_at?: string
          email: string
          id: string
          nombre?: string | null
          updated_at?: string
        }
        Update: {
          apellido?: string | null
          created_at?: string
          email?: string
          id?: string
          nombre?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      programa_predicacion: {
        Row: {
          activo: boolean
          capitan_id: string | null
          colspan_completo: boolean
          created_at: string
          es_mensaje_especial: boolean
          fecha: string
          horario_id: string | null
          id: string
          mensaje_especial: string | null
          punto_encuentro_id: string | null
          territorio_id: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          capitan_id?: string | null
          colspan_completo?: boolean
          created_at?: string
          es_mensaje_especial?: boolean
          fecha: string
          horario_id?: string | null
          id?: string
          mensaje_especial?: string | null
          punto_encuentro_id?: string | null
          territorio_id?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          capitan_id?: string | null
          colspan_completo?: boolean
          created_at?: string
          es_mensaje_especial?: boolean
          fecha?: string
          horario_id?: string | null
          id?: string
          mensaje_especial?: string | null
          punto_encuentro_id?: string | null
          territorio_id?: string | null
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
      puntos_encuentro: {
        Row: {
          activo: boolean
          created_at: string
          direccion: string | null
          id: string
          nombre: string
          updated_at: string
          url_maps: string | null
        }
        Insert: {
          activo?: boolean
          created_at?: string
          direccion?: string | null
          id?: string
          nombre: string
          updated_at?: string
          url_maps?: string | null
        }
        Update: {
          activo?: boolean
          created_at?: string
          direccion?: string | null
          id?: string
          nombre?: string
          updated_at?: string
          url_maps?: string | null
        }
        Relationships: []
      }
      territorios: {
        Row: {
          activo: boolean
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
          created_at?: string
          descripcion?: string | null
          id?: string
          imagen_url?: string | null
          nombre?: string | null
          numero?: string
          updated_at?: string
          url_maps?: string | null
        }
        Relationships: []
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_editor: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "editor" | "user"
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
      app_role: ["admin", "editor", "user"],
    },
  },
} as const
