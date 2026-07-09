
-- 1. Campos en participantes
ALTER TABLE public.participantes
  ADD COLUMN IF NOT EXISTS es_casado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tiene_hijos boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS inscrito_emc boolean NOT NULL DEFAULT false;

-- 2. Tabla de historial
CREATE TABLE IF NOT EXISTS public.historial_participacion_vym (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  congregacion_id uuid NOT NULL,
  participante_id uuid NOT NULL,
  fecha_semana date NOT NULL,
  parte text NOT NULL,
  titulo_parte text,
  origen text NOT NULL DEFAULT 'programa',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE INDEX IF NOT EXISTS idx_hist_vym_cong_fecha ON public.historial_participacion_vym(congregacion_id, fecha_semana);
CREATE INDEX IF NOT EXISTS idx_hist_vym_participante ON public.historial_participacion_vym(participante_id, fecha_semana);
CREATE UNIQUE INDEX IF NOT EXISTS uq_hist_vym_unico ON public.historial_participacion_vym(congregacion_id, participante_id, fecha_semana, parte);

ALTER TABLE public.historial_participacion_vym ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios ven historial VyM de su congregación"
  ON public.historial_participacion_vym FOR SELECT
  USING (user_has_access_to_congregacion(congregacion_id));

CREATE POLICY "Editores VyM insertan historial"
  ON public.historial_participacion_vym FOR INSERT
  WITH CHECK (can_edit_vida_ministerio(congregacion_id));

CREATE POLICY "Editores VyM actualizan historial"
  ON public.historial_participacion_vym FOR UPDATE
  USING (can_edit_vida_ministerio(congregacion_id));

CREATE POLICY "Editores VyM eliminan historial"
  ON public.historial_participacion_vym FOR DELETE
  USING (can_edit_vida_ministerio(congregacion_id));

-- 3. Actualizar función segura de participantes para exponer los nuevos campos
DROP FUNCTION IF EXISTS public.get_participantes_seguros(uuid);

CREATE OR REPLACE FUNCTION public.get_participantes_seguros(_congregacion_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, nombre text, apellido text, telefono text, estado_aprobado boolean, responsabilidad text[], responsabilidad_adicional text, grupo_predicacion_id uuid, restriccion_disponibilidad text, es_capitan_grupo boolean, es_publicador_inactivo boolean, activo boolean, created_at timestamp with time zone, updated_at timestamp with time zone, user_id uuid, genero text, es_casado boolean, tiene_hijos boolean, inscrito_emc boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    p.id, p.nombre, p.apellido,
    CASE 
      WHEN is_admin_or_editor_in_congregacion(p.congregacion_id) THEN p.telefono
      ELSE NULL
    END as telefono,
    p.estado_aprobado, p.responsabilidad, p.responsabilidad_adicional, p.grupo_predicacion_id,
    p.restriccion_disponibilidad, p.es_capitan_grupo, p.es_publicador_inactivo,
    p.activo, p.created_at, p.updated_at, p.user_id, p.genero,
    p.es_casado, p.tiene_hijos, p.inscrito_emc
  FROM public.participantes p
  WHERE p.congregacion_id = COALESCE(_congregacion_id, get_user_congregacion_id())
$function$;
